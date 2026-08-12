"""
Hyperparameter Random Search for Train Model.

When random_search=True:
  - Sample trial params (UI-aligned ranges)
  - Score each trial with a cheap holdout (no nested grids)
  - Return best params so the normal train path runs with FIXED params
    (Ridge/Logistic: single-value alpha/C search space → internal grids off)

When random_search=False/absent: callers must not invoke this module.
"""
from __future__ import annotations

import logging
import math
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
from fastapi import HTTPException
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.svm import SVC, SVR

logger = logging.getLogger(__name__)

RS_SUPPORTED = frozenset(
    {"ridge", "logistic", "random_forest", "svm", "knn", "lightgbm"}
)
MAX_TRAIN_ROWS_FOR_RS = 10_000
MAX_TRIALS = 50
DEFAULT_TRIALS = 20


def assert_random_search_allowed(n_train_rows: int, n_trials: Optional[int]) -> int:
    if n_train_rows >= MAX_TRAIN_ROWS_FOR_RS:
        raise HTTPException(
            400,
            f"Random Search is only available for training sets with fewer than "
            f"{MAX_TRAIN_ROWS_FOR_RS:,} rows (got {n_train_rows:,}).",
        )
    trials = int(n_trials if n_trials is not None else DEFAULT_TRIALS)
    if trials < 1:
        trials = 1
    if trials > MAX_TRIALS:
        trials = MAX_TRIALS
    return trials


def _log_uniform(rng: np.random.Generator, low: float, high: float) -> float:
    return float(np.exp(rng.uniform(math.log(low), math.log(high))))


def _choice(rng: np.random.Generator, options: List[Any]) -> Any:
    return options[int(rng.integers(0, len(options)))]


def update_rs_progress(
    active_trainings: dict,
    training_id: Optional[str],
    *,
    append_log: Optional[str] = None,
    **fields: Any,
) -> None:
    if not training_id or training_id not in active_trainings:
        return
    prog = active_trainings[training_id].setdefault(
        "progress",
        {
            "phase": "random_search",
            "trial": 0,
            "n_trials": 0,
            "best_score": None,
            "best_params": None,
            "logs": [],
        },
    )
    for k, v in fields.items():
        prog[k] = v
    if append_log:
        logs = prog.setdefault("logs", [])
        logs.append(append_log)
        if len(logs) > 80:
            prog["logs"] = logs[-80:]


def sample_trial_params(
    algorithm: str,
    rng: np.random.Generator,
    *,
    is_classification: bool,
    fixed: Optional[Dict[str, Any]] = None,
    n_train: int = 100,
) -> Optional[Dict[str, Any]]:
    """Sample one valid param dict. Returns None if combo is invalid (caller retries)."""
    fixed = fixed or {}

    if algorithm == "ridge":
        return {"alpha": _log_uniform(rng, 1e-3, 1e3)}

    if algorithm == "logistic":
        params = {"C": _log_uniform(rng, 1e-3, 1e3)}
        penalty = fixed.get("penalty", "l2")
        if penalty == "elasticnet":
            params["l1_ratio"] = float(rng.uniform(0.05, 0.95))
        return params

    if algorithm == "random_forest":
        max_depth_roll = int(rng.integers(0, 6))
        max_depth = None if max_depth_roll == 0 else int(rng.integers(2, 21))
        if is_classification:
            max_features = _choice(rng, ["sqrt", "log2", None])
        else:
            max_features = _choice(rng, [1.0, 0.5, 0.33, "sqrt", "log2", None])
        return {
            "n_estimators": int(rng.integers(10, 501)),
            "max_depth": max_depth,
            "min_samples_split": int(rng.integers(2, 21)),
            "min_samples_leaf": int(rng.integers(1, 11)),
            "max_features": max_features,
        }

    if algorithm == "svm":
        kernel = _choice(rng, ["rbf", "linear", "poly", "sigmoid"])
        gamma_roll = int(rng.integers(0, 4))
        if gamma_roll == 0:
            gamma: Any = "scale"
        elif gamma_roll == 1:
            gamma = "auto"
        else:
            gamma = _log_uniform(rng, 1e-4, 10.0)
        params = {
            "kernel": kernel,
            "C": _log_uniform(rng, 0.01, 100.0),
            "gamma": gamma,
            "degree": int(rng.integers(1, 6)) if kernel == "poly" else 3,
        }
        return params

    if algorithm == "knn":
        metric = _choice(rng, ["minkowski", "euclidean", "manhattan", "chebyshev"])
        k_hi = max(2, min(50, max(1, n_train - 1)))
        params = {
            "n_neighbors": int(rng.integers(1, k_hi + 1)),
            "weights": _choice(rng, ["uniform", "distance"]),
            "metric": metric,
            "algorithm": _choice(rng, ["auto", "ball_tree", "kd_tree", "brute"]),
            "leaf_size": int(rng.integers(10, 51)),
            "p": int(rng.integers(1, 6)) if metric == "minkowski" else 2,
        }
        return params

    if algorithm == "lightgbm":
        return {
            "num_leaves": int(rng.integers(8, 129)),
            "learning_rate": _log_uniform(rng, 0.01, 0.3),
            "n_estimators": int(rng.integers(50, 501)),
            "max_depth": _choice(rng, [-1, 3, 4, 5, 6, 8, 10, 12]),
            "min_child_samples": int(rng.integers(5, 51)),
            "subsample": float(rng.uniform(0.5, 1.0)),
            "colsample_bytree": float(rng.uniform(0.5, 1.0)),
            "reg_alpha": _log_uniform(rng, 1e-3, 10.0) if rng.random() > 0.4 else 0.0,
            "reg_lambda": _log_uniform(rng, 1e-3, 10.0) if rng.random() > 0.4 else 0.0,
        }

    return None


def _build_estimator(
    algorithm: str,
    trial: Dict[str, Any],
    *,
    is_classification: bool,
    fixed: Dict[str, Any],
):
    if algorithm == "ridge":
        return Ridge(
            alpha=float(trial["alpha"]),
            fit_intercept=bool(fixed.get("fit_intercept", True)),
        )

    if algorithm == "logistic":
        penalty = fixed.get("penalty", "l2")
        effective_penalty = None if penalty == "none" else penalty
        kwargs = {
            "C": float(trial["C"]),
            "penalty": effective_penalty,
            "solver": fixed.get("solver", "lbfgs"),
            "max_iter": int(fixed.get("max_iter", 1000) or 1000),
            "multi_class": fixed.get("multi_class", "auto"),
            "class_weight": fixed.get("class_weight"),
        }
        if effective_penalty == "elasticnet":
            kwargs["l1_ratio"] = float(trial.get("l1_ratio", fixed.get("l1_ratio", 0.5)))
        return LogisticRegression(**kwargs)

    if algorithm == "random_forest":
        kwargs = {
            "n_estimators": int(trial["n_estimators"]),
            "max_depth": trial.get("max_depth"),
            "min_samples_split": int(trial["min_samples_split"]),
            "min_samples_leaf": int(trial["min_samples_leaf"]),
            "max_features": trial.get("max_features"),
            "bootstrap": bool(fixed.get("bootstrap", True)),
            "n_jobs": -1,
            "random_state": None,
        }
        if fixed.get("criterion"):
            kwargs["criterion"] = fixed["criterion"]
        cls = RandomForestClassifier if is_classification else RandomForestRegressor
        return cls(**kwargs)

    if algorithm == "svm":
        kwargs = {
            "kernel": trial["kernel"],
            "C": float(trial["C"]),
            "gamma": trial["gamma"],
            "degree": int(trial.get("degree", 3)),
            "shrinking": bool(fixed.get("shrinking", True)),
        }
        if is_classification:
            kwargs["probability"] = bool(fixed.get("probability", False))
            return SVC(**kwargs)
        return SVR(**{k: v for k, v in kwargs.items() if k != "probability"})

    if algorithm == "knn":
        kwargs = {
            "n_neighbors": int(trial["n_neighbors"]),
            "weights": trial["weights"],
            "algorithm": trial.get("algorithm", "auto"),
            "leaf_size": int(trial.get("leaf_size", 30)),
            "metric": trial["metric"],
            "p": int(trial.get("p", 2)),
        }
        cls = KNeighborsClassifier if is_classification else KNeighborsRegressor
        return cls(**kwargs)

    if algorithm == "lightgbm":
        try:
            import lightgbm as lgb
        except ImportError as e:
            raise HTTPException(500, "LightGBM is not installed") from e
        kwargs = {
            "boosting_type": fixed.get("boosting_type", "gbdt"),
            "num_leaves": int(trial["num_leaves"]),
            "learning_rate": float(trial["learning_rate"]),
            "n_estimators": int(trial["n_estimators"]),
            "max_depth": int(trial["max_depth"]),
            "min_child_samples": int(trial["min_child_samples"]),
            "subsample": float(trial["subsample"]),
            "colsample_bytree": float(trial["colsample_bytree"]),
            "reg_alpha": float(trial["reg_alpha"]),
            "reg_lambda": float(trial["reg_lambda"]),
            "n_jobs": -1,
            "verbose": -1,
            "random_state": 42,
        }
        if is_classification:
            return lgb.LGBMClassifier(**kwargs)
        return lgb.LGBMRegressor(**kwargs)

    raise HTTPException(400, f"Random Search not supported for {algorithm}")


def _cheap_score(model, X, y, *, is_classification: bool, seed: int) -> float:
    stratify = None
    if is_classification:
        try:
            _, counts = np.unique(y, return_counts=True)
            if counts.min() >= 2 and len(y) >= 10:
                stratify = y
        except Exception:
            stratify = None
    test_size = 0.2 if len(y) >= 20 else 0.3
    X_tr, X_va, y_tr, y_va = train_test_split(
        X, y, test_size=test_size, random_state=seed, stratify=stratify
    )
    model.fit(X_tr, y_tr)
    return float(model.score(X_va, y_va))


def _format_params(params: Dict[str, Any]) -> str:
    parts = []
    for k, v in params.items():
        if isinstance(v, float):
            parts.append(f"{k}={v:.6g}")
        else:
            parts.append(f"{k}={v}")
    return ", ".join(parts)


def run_hyperparam_random_search(
    algorithm: str,
    X,
    y,
    *,
    n_trials: int,
    is_classification: bool,
    check_stop: Callable[[], None],
    active_trainings: dict,
    training_id: Optional[str],
    fixed_params: Optional[Dict[str, Any]] = None,
    random_state: int = 42,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Returns (best_params, meta) where meta is JSON-safe for API/result payloads.
    """
    if algorithm not in RS_SUPPORTED:
        raise HTTPException(400, f"Random Search is not available for {algorithm}")

    fixed = dict(fixed_params or {})
    X_arr = np.asarray(X)
    y_arr = np.asarray(y).ravel()
    n_train = len(y_arr)
    trials = assert_random_search_allowed(n_train, n_trials)
    rng = np.random.default_rng(random_state)

    update_rs_progress(
        active_trainings,
        training_id,
        phase="random_search",
        trial=0,
        n_trials=trials,
        best_score=None,
        best_params=None,
        append_log=f"Random Search started: {trials} trials ({algorithm})",
    )

    best_score = -np.inf
    best_params: Optional[Dict[str, Any]] = None
    trial_logs: List[Dict[str, Any]] = []
    attempts = 0
    completed = 0
    max_attempts = trials * 8

    while completed < trials and attempts < max_attempts:
        check_stop()
        attempts += 1
        trial = sample_trial_params(
            algorithm,
            rng,
            is_classification=is_classification,
            fixed=fixed,
            n_train=n_train,
        )
        if trial is None:
            continue
        try:
            model = _build_estimator(
                algorithm, trial, is_classification=is_classification, fixed=fixed
            )
            score = _cheap_score(
                model,
                X_arr,
                y_arr,
                is_classification=is_classification,
                seed=int(rng.integers(0, 1_000_000)),
            )
        except Exception as e:
            logger.info(f"RS trial skipped ({algorithm}): {e}")
            update_rs_progress(
                active_trainings,
                training_id,
                append_log=f"Trial skipped (invalid/failed): {_format_params(trial)}",
            )
            continue

        completed += 1
        improved = score > best_score
        if improved:
            best_score = score
            best_params = dict(trial)

        line = (
            f"Trial {completed}/{trials}: {_format_params(trial)} → "
            f"score={score:.4f}"
            + (" ★ best" if improved else "")
        )
        trial_logs.append(
            {
                "trial": completed,
                "params": {k: (float(v) if isinstance(v, (np.floating,)) else v) for k, v in trial.items()},
                "score": float(score),
                "best": bool(improved),
            }
        )
        update_rs_progress(
            active_trainings,
            training_id,
            phase="random_search",
            trial=completed,
            n_trials=trials,
            best_score=float(best_score) if np.isfinite(best_score) else None,
            best_params=best_params,
            append_log=line,
        )

    if best_params is None:
        raise HTTPException(400, "Random Search failed: no valid trial completed")

    summary = (
        f"Random Search done. Best score={best_score:.4f} with "
        f"{_format_params(best_params)}. Starting final training…"
    )
    update_rs_progress(
        active_trainings,
        training_id,
        phase="final_training",
        trial=trials,
        n_trials=trials,
        best_score=float(best_score),
        best_params=best_params,
        append_log=summary,
    )

    meta = {
        "enabled": True,
        "algorithm": algorithm,
        "n_trials": trials,
        "best_score": float(best_score),
        "best_params": best_params,
        "internal_search_disabled": True,
        "trial_logs": trial_logs[-30:],
        "message": summary,
    }
    return best_params, meta
