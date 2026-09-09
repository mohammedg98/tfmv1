"""
Anomaly detection training: Isolation Forest & One-Class SVM.

Anti-leakage:
  - Fit scaler + model on train split ONLY
  - Evaluate scores / rates on train vs test separately
  - Optional labels used only for test metrics (and optional OC-SVM normals filter on train)
"""

from __future__ import annotations

import base64
import io
import logging
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

import joblib
import numpy as np
import pandas as pd
from fastapi import BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.svm import OneClassSVM
from psycopg2 import sql

logger = logging.getLogger(__name__)
# Routes are registered onto data_managment.router via register_anomaly_routes()

_ANOMALY_POSITIVE_TOKENS = {
    "attack",
    "anomaly",
    "anomalous",
    "intrusion",
    "malicious",
    "abnormal",
    "outlier",
    "threat",
    "yes",
    "true",
    "1",
    "positive",
    "dos",
    "probe",
    "r2l",
    "u2r",
    "botnet",
    "malware",
}


def _series_to_anomaly_mask(y):
    if y is None:
        return None
    s = pd.Series(y).astype(str).str.strip().str.lower()
    pos = s.isin(_ANOMALY_POSITIVE_TOKENS)
    if pos.any() and (~pos).any():
        return pos.values.astype(bool)
    try:
        yn = pd.to_numeric(pd.Series(y), errors="coerce")
        uniq = set(yn.dropna().unique().tolist())
        if uniq.issubset({0, 1}) and len(uniq) == 2:
            return (yn == 1).fillna(False).values.astype(bool)
    except Exception:
        pass
    vc = s.value_counts()
    if len(vc) >= 2:
        return (s == vc.idxmin()).values.astype(bool)
    return None


def _fetch_target_column_name(cur, table_name: str, owner_id: str):
    base = (table_name or "").replace("_numerized", "").replace("_backup", "").replace("_reset", "")
    for cand in (table_name, base, f"{base}_numerized"):
        cur.execute(
            """
            SELECT target_column FROM user_tables_metadata
            WHERE table_name = %s AND owner_id = %s
            """,
            (cand, owner_id),
        )
        row = cur.fetchone()
        if row and row[0]:
            return row[0]
    return None


class TrainAnomalyRequest(BaseModel):
    numerized_dataset_name: str
    original_dataset_name: str
    algorithm: Literal["isolation_forest", "one_class_svm"] = "isolation_forest"
    model_type: Optional[str] = "anomaly"
    use_scaling: bool = Field(True)
    random_state: Optional[int] = Field(42)
    date_column: Optional[str] = None
    training_id: Optional[str] = None
    n_estimators: int = Field(100, ge=10, le=1000)
    contamination: float = Field(0.05, gt=0.0, le=0.5)
    max_samples: Union[str, float, int] = Field("auto")
    max_features: float = Field(1.0, gt=0.0, le=1.0)
    bootstrap: bool = False
    kernel: Literal["rbf", "linear", "poly", "sigmoid"] = "rbf"
    nu: float = Field(0.05, gt=0.0, le=1.0)
    gamma: Union[str, float] = Field("scale")
    degree: int = Field(3, ge=1, le=10)
    coef0: float = 0.0
    train_on_normals_only: bool = False


def register_anomaly_routes(
    target_router,
    *,
    get_db_connection,
    get_current_user2,
    get_table_columns,
    detect_date_columns,
    convert_numpy_types,
    active_trainings: dict,
    training_stop_flags: dict,
    safe_set_training_result,
    safe_set_training_error,
):
    """Attach POST /train-anomaly onto the shared data APIRouter."""

    async def train_anomaly_with_stop_check(
        request: TrainAnomalyRequest,
        background_tasks: BackgroundTasks = None,
        current_user_id: str = None,
        training_id: str = None,
    ):
        def check_stop():
            if training_id and training_stop_flags.get(training_id, False):
                raise HTTPException(400, "Training stopped by user")

        try:
            check_stop()
            algo = request.algorithm
            logger.info("=== ANOMALY TRAINING STARTED (%s) ===", algo)

            if not request.numerized_dataset_name or not request.original_dataset_name:
                raise HTTPException(400, "Dataset names are required")

            table = request.numerized_dataset_name.lower()

            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT 1 FROM user_tables_metadata
                        WHERE table_name = %s AND owner_id = %s
                        """,
                        (table, current_user_id),
                    )
                    if not cur.fetchone():
                        raise HTTPException(404, "Dataset not found or access denied")

                    all_columns = get_table_columns(cur, table)
                    if not all_columns:
                        raise HTTPException(404, "No columns found")

                    has_split = any(c == "split_type" for c in all_columns)
                    if not has_split:
                        raise HTTPException(
                            400,
                            "Train/test split required for anomaly detection (anti-leakage). "
                            "Complete Clean · Split · Impute first.",
                        )

                    target_col = _fetch_target_column_name(cur, table, current_user_id)
                    select_cols = list(all_columns)
                    query = sql.SQL("SELECT {columns} FROM {tbl}").format(
                        columns=sql.SQL(",").join(map(sql.Identifier, select_cols)),
                        tbl=sql.Identifier(table),
                    )
                    cur.execute(query)
                    rows = cur.fetchall()

            check_stop()
            df = pd.DataFrame(rows, columns=select_cols)
            if df.empty:
                raise HTTPException(400, "Dataset is empty")

            exclude = {"id", "split_type"}
            if target_col and target_col in df.columns:
                exclude.add(target_col)
            if request.date_column:
                exclude.add(request.date_column)
            for dc in detect_date_columns(df):
                exclude.add(dc)

            feature_columns = [c for c in df.columns if c not in exclude]
            if not feature_columns:
                raise HTTPException(400, "No feature columns available for anomaly detection")

            train_df = df[df["split_type"].astype(str).str.lower() == "train"].copy()
            test_df = df[df["split_type"].astype(str).str.lower() == "test"].copy()
            if train_df.empty:
                raise HTTPException(400, "No train rows found — fix the split before training")

            def _prep_X(part: pd.DataFrame) -> pd.DataFrame:
                X_raw = part[feature_columns].copy()
                for col in X_raw.columns:
                    X_raw.loc[:, col] = pd.to_numeric(X_raw[col], errors="coerce")
                med = X_raw.median(numeric_only=True)
                return X_raw.fillna(med).fillna(0)

            X_train = _prep_X(train_df)
            X_test = _prep_X(test_df) if not test_df.empty else None

            y_train_raw = (
                train_df[target_col] if target_col and target_col in train_df.columns else None
            )
            y_test_raw = (
                test_df[target_col]
                if target_col and target_col in test_df.columns and not test_df.empty
                else None
            )

            normals_filter_applied = False
            if algo == "one_class_svm" and request.train_on_normals_only and y_train_raw is not None:
                anom_mask = _series_to_anomaly_mask(y_train_raw)
                if anom_mask is not None and (~anom_mask).any():
                    X_train = X_train.loc[~anom_mask].copy()
                    normals_filter_applied = True
                    if len(X_train) < 10:
                        raise HTTPException(
                            400,
                            "Too few normal train rows after filtering. "
                            "Disable 'train on normals only' or check labels.",
                        )

            check_stop()

            # One-Class SVM (noyau RBF/kernel) dépend fortement de la mise à
            # l'échelle des features — jamais laissé à l'utilisateur, toujours
            # forcé côté backend (défense en profondeur, même si l'API est
            # appelée directement sans passer par l'UI).
            effective_use_scaling = (
                True if algo == "one_class_svm" else request.use_scaling
            )

            if effective_use_scaling:
                scaler = StandardScaler()
                X_train_s = scaler.fit_transform(X_train.values)
                X_test_s = (
                    scaler.transform(X_test.values)
                    if X_test is not None and len(X_test)
                    else None
                )
            else:
                scaler = None
                X_train_s = X_train.values
                X_test_s = X_test.values if X_test is not None and len(X_test) else None
            check_stop()

            if algo == "isolation_forest":
                max_samples = request.max_samples
                if isinstance(max_samples, str) and max_samples != "auto":
                    try:
                        max_samples = float(max_samples)
                    except Exception:
                        max_samples = "auto"
                model = IsolationForest(
                    n_estimators=request.n_estimators,
                    contamination=float(request.contamination),
                    max_samples=max_samples,
                    max_features=float(request.max_features),
                    bootstrap=bool(request.bootstrap),
                    random_state=request.random_state,
                    n_jobs=-1,
                )
                model.fit(X_train_s)
            else:
                gamma = request.gamma
                if isinstance(gamma, str) and gamma not in ("scale", "auto"):
                    try:
                        gamma = float(gamma)
                    except Exception:
                        gamma = "scale"
                model = OneClassSVM(
                    kernel=request.kernel,
                    nu=float(request.nu),
                    gamma=gamma,
                    degree=int(request.degree),
                    coef0=float(request.coef0),
                )
                model.fit(X_train_s)

            check_stop()

            def _score_split(Xs):
                if Xs is None or len(Xs) == 0:
                    return None
                pred = model.predict(Xs)
                scores = model.decision_function(Xs)
                n_anom = int(np.sum(pred == -1))
                return {
                    "n_samples": int(len(Xs)),
                    "n_anomalies": n_anom,
                    "anomaly_rate": float(n_anom / max(len(Xs), 1)),
                    "score_mean": float(np.mean(scores)),
                    "score_std": float(np.std(scores)),
                    "score_min": float(np.min(scores)),
                    "score_max": float(np.max(scores)),
                    "predictions": pred,
                    "scores": scores,
                }

            train_stats = _score_split(X_train_s)
            test_stats = _score_split(X_test_s)

            label_eval = None
            if test_stats is not None and y_test_raw is not None:
                y_anom = _series_to_anomaly_mask(y_test_raw)
                if y_anom is not None and y_anom.any() and (~y_anom).any():
                    y_pred_anom = test_stats["predictions"] == -1
                    tp = int(np.sum(y_pred_anom & y_anom))
                    fp = int(np.sum(y_pred_anom & ~y_anom))
                    fn = int(np.sum(~y_pred_anom & y_anom))
                    tn = int(np.sum(~y_pred_anom & ~y_anom))
                    prec = tp / max(tp + fp, 1)
                    rec = tp / max(tp + fn, 1)
                    f1 = (2 * prec * rec) / max(prec + rec, 1e-12)
                    try:
                        from sklearn.metrics import roc_auc_score

                        auc = float(roc_auc_score(y_anom.astype(int), -test_stats["scores"]))
                    except Exception:
                        auc = None
                    label_eval = {
                        "available": True,
                        "scope": "test_only",
                        "note": "Labels used only for evaluation — never for fitting (no leakage).",
                        "precision": float(prec),
                        "recall": float(rec),
                        "f1": float(f1),
                        "roc_auc": auc,
                        "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
                        "positive_means": "anomaly / attack",
                    }

            viz = None
            try:
                if X_train_s.shape[1] >= 2 and len(X_train_s) >= 5:
                    pca = PCA(n_components=2)
                    idx = np.arange(len(X_train_s))
                    if len(idx) > 1500:
                        rng = np.random.RandomState(request.random_state or 42)
                        idx = rng.choice(idx, 1500, replace=False)
                    emb = pca.fit_transform(X_train_s[idx])
                    preds = train_stats["predictions"][idx]
                    scores = train_stats["scores"][idx]
                    viz = {
                        "2d": {
                            "points": [
                                {
                                    "x": float(emb[i, 0]),
                                    "y": float(emb[i, 1]),
                                    "is_anomaly": bool(preds[i] == -1),
                                    "score": float(scores[i]),
                                }
                                for i in range(len(emb))
                            ],
                            "explained_variance": pca.explained_variance_ratio_.tolist(),
                            "scope": "train_sample",
                        }
                    }
            except Exception as viz_err:
                logger.warning("Anomaly PCA viz skipped: %s", viz_err)

            check_stop()

            params_used: Dict[str, Any] = {
                "algorithm": algo,
                "use_scaling": effective_use_scaling,
                "random_state": request.random_state,
            }
            if algo == "isolation_forest":
                params_used.update(
                    {
                        "n_estimators": request.n_estimators,
                        "contamination": request.contamination,
                        "max_samples": request.max_samples,
                        "max_features": request.max_features,
                        "bootstrap": request.bootstrap,
                    }
                )
            else:
                params_used.update(
                    {
                        "kernel": request.kernel,
                        "nu": request.nu,
                        "gamma": request.gamma,
                        "degree": request.degree,
                        "coef0": request.coef0,
                        "train_on_normals_only": request.train_on_normals_only,
                        "normals_filter_applied": normals_filter_applied,
                    }
                )

            metrics = {
                "model_family": "anomaly",
                "algorithm": algo,
                "feature_names": feature_columns,
                "target_excluded": target_col,
                "n_features": len(feature_columns),
                "train": {
                    "n_samples": train_stats["n_samples"],
                    "n_anomalies": train_stats["n_anomalies"],
                    "anomaly_rate": train_stats["anomaly_rate"],
                    "score_mean": train_stats["score_mean"],
                    "score_std": train_stats["score_std"],
                    "score_min": train_stats["score_min"],
                    "score_max": train_stats["score_max"],
                },
                "test": None
                if test_stats is None
                else {
                    "n_samples": test_stats["n_samples"],
                    "n_anomalies": test_stats["n_anomalies"],
                    "anomaly_rate": test_stats["anomaly_rate"],
                    "score_mean": test_stats["score_mean"],
                    "score_std": test_stats["score_std"],
                    "score_min": test_stats["score_min"],
                    "score_max": test_stats["score_max"],
                },
                "label_evaluation": label_eval,
                "params": params_used,
                "anti_leakage": {
                    "fit_scope": "train_only",
                    "scaler_scope": "train_only" if request.use_scaling else "disabled",
                    "test_used_for_fit": False,
                    "labels_used_for_fit": normals_filter_applied,
                    "labels_fit_note": (
                        "Train rows filtered to normals for One-Class SVM only; test features never used."
                        if normals_filter_applied
                        else "Unsupervised fit on train features only."
                    ),
                },
                "visualization_data": viz,
                "cyber_hint": (
                    "Lower anomaly score ⇒ more suspicious. Useful for intrusion / rare-event "
                    "screening; review flagged rows with an analyst."
                ),
            }

            model_bytes = io.BytesIO()
            joblib.dump(
                {
                    "model": model,
                    "scaler": scaler,
                    "feature_names": feature_columns,
                    "algorithm": algo,
                    "model_type": "anomaly",
                    "params": params_used,
                    "target_excluded": target_col,
                },
                model_bytes,
            )
            model_bytes.seek(0)
            model_base64 = base64.b64encode(model_bytes.read()).decode("utf-8")

            return {
                "status": "success",
                "model_type": "anomaly",
                "algorithm": algo,
                "model_object": model_base64,
                "metrics": convert_numpy_types(metrics),
                "visualization_data": convert_numpy_types(viz) if viz else None,
                "timestamp": datetime.now().isoformat(),
                "training_info": {
                    "training_samples": int(len(X_train_s)),
                    "test_samples": int(len(X_test_s)) if X_test_s is not None else 0,
                    "feature_scaling": "StandardScaler (train-fit)"
                    if request.use_scaling
                    else "None",
                    "algorithm": algo,
                },
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error in train_anomaly: %s", e, exc_info=True)
            raise HTTPException(
                status_code=500,
                detail={"error_message": str(e), "error_type": type(e).__name__},
            )

    @target_router.post("/train-anomaly")
    async def train_anomaly(
        request: TrainAnomalyRequest,
        background_tasks: BackgroundTasks = None,
        current_user_id: str = Depends(get_current_user2),
    ):
        if request.training_id and background_tasks is not None:
            training_id = request.training_id
            training_stop_flags[training_id] = False

            def train_in_background():
                import asyncio

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    new_request = request.copy()
                    new_request.training_id = None
                    result = loop.run_until_complete(
                        train_anomaly_with_stop_check(
                            new_request, None, current_user_id, training_id
                        )
                    )
                    if training_id in active_trainings and not training_stop_flags.get(
                        training_id, False
                    ):
                        active_trainings[training_id]["completed"] = True
                        active_trainings[training_id]["result"] = result
                        safe_set_training_result(training_id, result)
                except Exception as e:
                    error_msg = str(e)
                    if "Training stopped by user" in error_msg:
                        if training_id in active_trainings:
                            active_trainings[training_id]["completed"] = True
                            active_trainings[training_id]["error"] = "Training stopped by user"
                            active_trainings[training_id]["result"] = None
                            safe_set_training_error(
                                training_id, "Training stopped by user", stopped=True
                            )
                    else:
                        if training_id in active_trainings:
                            active_trainings[training_id]["completed"] = True
                            active_trainings[training_id]["error"] = error_msg
                            safe_set_training_error(training_id, error_msg, stopped=False)
                finally:
                    loop.close()

            active_trainings[training_id] = {
                "completed": False,
                "result": None,
                "error": None,
                "started_at": datetime.now().isoformat(),
                "user_id": current_user_id,
                "model_type": request.algorithm,
            }
            background_tasks.add_task(train_in_background)
            return {
                "status": "training_started",
                "training_id": training_id,
                "message": f"{request.algorithm} training started in background",
            }

        return await train_anomaly_with_stop_check(
            request, background_tasks, current_user_id, None
        )
