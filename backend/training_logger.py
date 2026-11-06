"""
Structured training run logs for backend.

Every completed (or failed) training writes:
- human-readable lines to the process logger
- a JSON record under /app/backend/training_logs/ (and mirrored under cwd)

Logs intentionally omit huge payloads (model_object base64, raw prediction arrays)
while keeping hyperparameters, validation config, timings, and all UI metrics.
"""

from __future__ import annotations

import json
import logging
import math
import os
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

_DROP_KEYS = {
    "model_object",
    "model_bytes",
    "predictions",
    "y_true",
    "y_pred",
    "y_proba",
    "y_train_true",
    "y_train_pred",
}

_LOG_DIRS = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "training_logs"),
    "/tmp/tfmv1_training_logs",
]


def _json_safe(obj: Any, *, depth: int = 0) -> Any:
    if depth > 12:
        return "<max_depth>"
    if obj is None or isinstance(obj, (str, int, bool)):
        return obj
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            key = str(k)
            if key in _DROP_KEYS:
                if key == "predictions":
                    out[key] = "<omitted: prediction arrays>"
                elif key == "model_object":
                    out[key] = "<omitted: serialized model>"
                else:
                    out[key] = "<omitted>"
                continue
            out[key] = _json_safe(v, depth=depth + 1)
        return out
    if isinstance(obj, (list, tuple)):
        # Cap very long lists (e.g. feature lists stay; huge arrays already dropped)
        if len(obj) > 200:
            return [_json_safe(v, depth=depth + 1) for v in obj[:200]] + [
                f"<truncated {len(obj) - 200} more items>"
            ]
        return [_json_safe(v, depth=depth + 1) for v in obj]
    # numpy / pandas leftovers
    try:
        import numpy as np

        if isinstance(obj, np.generic):
            return obj.item()
        if isinstance(obj, np.ndarray):
            return _json_safe(obj.tolist(), depth=depth + 1)
    except Exception:
        pass
    try:
        return str(obj)
    except Exception:
        return "<unserializable>"


def _ensure_log_dirs() -> list[str]:
    ready = []
    for path in _LOG_DIRS:
        try:
            os.makedirs(path, exist_ok=True)
            ready.append(path)
        except Exception as e:
            logger.warning("Could not create training log dir %s: %s", path, e)
    return ready


def _fmt_dt(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    try:
        return str(value)
    except Exception:
        return None


def _extract_hparams(result: dict | None) -> dict:
    if not isinstance(result, dict):
        return {}
    metrics = result.get("metrics") or {}
    hparams: dict[str, Any] = {}

    # Common / nested places algorithms stash their params
    for key in (
        "metadata",
        "final_parameters",
        "params_used",
        "hyperparameters",
        "model_params",
        "best_params",
        "random_search",
    ):
        if isinstance(metrics.get(key), dict):
            hparams[key] = metrics[key]
        if isinstance(result.get(key), dict):
            hparams[key] = result[key]

    # Scalar “best X used” style fields on metrics
    for key, value in metrics.items():
        if key.endswith("_used") or key in {
            "C_search_space",
            "C_selection_method",
            "alpha_search_space",
            "layers_used",
            "activation_used",
            "learning_rate_used",
            "n_estimators",
            "max_depth",
            "kernel",
            "n_neighbors",
        }:
            hparams[key] = value

    training_info = result.get("training_info")
    if isinstance(training_info, dict):
        hparams["training_info"] = training_info

    return hparams


def _extract_validation(result: dict | None) -> dict:
    if not isinstance(result, dict):
        return {}
    metrics = result.get("metrics") or {}
    validation = {
        "method": metrics.get("validation_method")
        or (result.get("training_info") or {}).get("validation_method"),
        "n_repetitions": (result.get("training_info") or {}).get("n_repetitions"),
        "validation_results": metrics.get("validation_results"),
    }
    vr = metrics.get("validation_results") or {}
    if isinstance(vr, dict):
        for key in (
            "method",
            "n_repetitions",
            "n_splits",
            "n_folds",
            "n_repeats",
            "test_size",
            "train_size",
            "n_bootstraps",
        ):
            if key in vr and validation.get(key) in (None,):
                validation[key] = vr[key]
    return validation


def _extract_metrics_summary(result: dict | None) -> dict:
    if not isinstance(result, dict):
        return {}
    metrics = result.get("metrics") or {}
    keep = {}
    for key in (
        "accuracy",
        "precision",
        "recall",
        "f1",
        "roc_auc",
        "log_loss",
        "train_accuracy",
        "r2",
        "mse",
        "mae",
        "rmse",
        "train_r2",
        "final_test",
        "final_train",
        "confusion_matrix",
        "classification_report",
        "classes",
        "n_classes",
        "is_classification",
        "silhouette",
        "calinski_harabasz",
        "davies_bouldin",
        "feature_importance",
        "features_used",
        "target_column",
        "validation_results",
    ):
        if key in metrics:
            keep[key] = metrics[key]
    # Also keep any top-level numeric metrics the UI might show
    for key, value in metrics.items():
        if key not in keep and isinstance(value, (int, float, str, bool)):
            keep[key] = value
    return keep


def log_training_started(
    *,
    training_id: str,
    model_type: str,
    user_id: str | None = None,
    dataset: str | None = None,
    request_summary: dict | None = None,
) -> None:
    started = datetime.now(timezone.utc).isoformat()
    payload = {
        "event": "training_started",
        "training_id": training_id,
        "algorithm": model_type,
        "user_id": user_id,
        "dataset": dataset,
        "started_at": started,
        "request": _json_safe(request_summary or {}),
    }
    logger.info(
        "TRAINING_START algorithm=%s training_id=%s dataset=%s started_at=%s",
        model_type,
        training_id,
        dataset,
        started,
    )
    _write_json_record(payload, kind="start")


def log_training_finished(
    *,
    training_id: str,
    result: dict | None,
    start_time: Any = None,
    model_type: str | None = None,
    user_id: str | None = None,
    error: str | None = None,
) -> None:
    end_dt = datetime.now(timezone.utc)
    start_dt = start_time
    if isinstance(start_dt, datetime) and start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    duration_s = None
    if isinstance(start_dt, datetime):
        duration_s = (end_dt - start_dt).total_seconds()

    algorithm = (
        model_type
        or (result or {}).get("model_type")
        or ((result or {}).get("metrics") or {}).get("metadata", {}).get("model_type")
        or "unknown"
    )
    dataset = (result or {}).get("dataset_used")

    record = {
        "event": "training_finished" if not error else "training_failed",
        "training_id": training_id,
        "algorithm": algorithm,
        "user_id": user_id,
        "dataset": dataset,
        "started_at": _fmt_dt(start_dt),
        "finished_at": end_dt.isoformat(),
        "duration_seconds": duration_s,
        "error": error,
        "hyperparameters": _json_safe(_extract_hparams(result)),
        "validation": _json_safe(_extract_validation(result)),
        "metrics": _json_safe(_extract_metrics_summary(result)),
        "training_info": _json_safe((result or {}).get("training_info")),
        "status": (result or {}).get("status"),
        "result_timestamp": (result or {}).get("timestamp"),
        # Full sanitized result (minus huge blobs) for audit / report building
        "result_sanitized": _json_safe(result) if result else None,
    }

    logger.info("=" * 72)
    logger.info(
        "TRAINING_END algorithm=%s training_id=%s dataset=%s",
        algorithm,
        training_id,
        dataset,
    )
    logger.info("  started_at=%s", record["started_at"])
    logger.info("  finished_at=%s", record["finished_at"])
    logger.info("  duration_seconds=%s", duration_s)
    if error:
        logger.info("  error=%s", error)
    logger.info("  validation=%s", json.dumps(record["validation"], default=str)[:2000])
    logger.info(
        "  hyperparameters=%s",
        json.dumps(record["hyperparameters"], default=str)[:4000],
    )
    logger.info("  metrics=%s", json.dumps(record["metrics"], default=str)[:6000])
    logger.info("=" * 72)

    _write_json_record(record, kind="end")


def _write_json_record(record: dict, *, kind: str) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    algo = str(record.get("algorithm") or "unknown").replace("/", "_")
    tid = str(record.get("training_id") or "no_id")[:40]
    filename = f"{stamp}_{kind}_{algo}_{tid}.json"
    body = json.dumps(record, indent=2, ensure_ascii=False, default=str)
    for directory in _ensure_log_dirs():
        path = os.path.join(directory, filename)
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
            # Append-only index for easy report aggregation
            index_path = os.path.join(directory, "training_runs.jsonl")
            with open(index_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
            logger.info("Training log written: %s", path)
        except Exception as e:
            logger.warning("Failed writing training log to %s: %s", path, e)
