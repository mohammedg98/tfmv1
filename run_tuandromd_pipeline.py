#!/usr/bin/env python3
"""
Full tuandromd pipeline on live tfmv1:
  free slot → duplicate predefined → set target → delete non malware/goodware
  → auto-clean-split → auto-transform → train all clf holdout×10
  → write pipeline artifacts for PDF report.
"""

from __future__ import annotations

import json
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

BASE = "http://127.0.0.1"
ORIGIN = "http://46.62.212.226"
EMAIL = "cc@cc.cc"
PASSWORD = "qwerqwer"
USER_ID = "6a7649c85389ffb49703be24"
PREDEFINED = "tuandromd"
TARGET_COL = "Label"
KEEP_LABELS = {"malware", "goodware"}  # goodware = benign ("normal") in this dataset
N_REPS = 10
VALIDATION = "holdout"
POLL_EVERY = 5
MAX_JOB_WAIT_S = 2 * 60 * 60
MAX_TRAIN_WAIT_S = 4 * 60 * 60
MADRID = ZoneInfo("Europe/Madrid")

OUT_DIR = Path("/root/tfmv1/backend/training_logs/tuandromd_pipeline")
ARTIFACT = OUT_DIR / "pipeline_artifact.json"
SUMMARY = OUT_DIR / "run_summary.jsonl"
FINAL = OUT_DIR / "final_results.json"
RUNNER_LOG = OUT_DIR / "runner.log"

SESSION = requests.Session()
SESSION.headers.update({"Origin": ORIGIN, "Content-Type": "application/json"})


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def madrid_now() -> str:
    return datetime.now(MADRID).strftime("%Y-%m-%d %H:%M:%S %Z")


def log(msg: str) -> None:
    line = f"[{madrid_now()}] {msg}"
    print(line, flush=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with RUNNER_LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def login() -> None:
    r = SESSION.post(
        f"{BASE}/api/users/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=60,
    )
    r.raise_for_status()
    me = SESSION.get(f"{BASE}/api/users/me", timeout=30)
    me.raise_for_status()
    log(f"LOGIN ok me={me.text}")


def check_limit() -> dict:
    r = SESSION.get(f"{BASE}/api/check-dataset-limit", timeout=30)
    r.raise_for_status()
    return r.json()


def list_main_datasets() -> list[dict]:
    r = SESSION.get(f"{BASE}/api/databases", params={"userId": USER_ID}, timeout=60)
    r.raise_for_status()
    dbs = r.json()
    main = []
    for d in dbs:
        n = d["table_name"]
        if re.search(r"_(reset|numerized|backup)$", n):
            continue
        main.append(d)
    return sorted(main, key=lambda x: x["created_at"])


def free_slot_if_needed(artifact: dict) -> None:
    lim = check_limit()
    artifact["limit_before"] = lim
    log(f"LIMIT before={lim}")
    while lim.get("limit_reached") or lim.get("count", 0) >= 10:
        mains = list_main_datasets()
        if not mains:
            raise RuntimeError("Limit reached but no deletable datasets")
        oldest = mains[0]
        name = oldest["table_name"]
        log(f"DELETE oldest dataset {name} created={oldest['created_at']}")
        r = SESSION.delete(
            f"{BASE}/api/delete-database-with-related",
            json={"dbName": name},
            timeout=120,
        )
        log(f"DELETE {name} -> {r.status_code} {r.text[:400]}")
        r.raise_for_status()
        artifact.setdefault("deleted_datasets", []).append(
            {"table_name": name, "created_at": oldest["created_at"], "response": r.json()}
        )
        time.sleep(1)
        lim = check_limit()
        log(f"LIMIT after delete={lim}")
    artifact["limit_after_delete"] = lim


def unique_name() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"tuandromd_copy_{stamp}"


def duplicate(artifact: dict) -> str:
    name = unique_name()
    payload = {"original_table_name": PREDEFINED, "new_dataset_name": name}
    log(f"DUPLICATE {payload}")
    r = SESSION.post(f"{BASE}/api/duplicate-predefined-dataset", json=payload, timeout=300)
    log(f"DUPLICATE -> {r.status_code} {r.text[:500]}")
    r.raise_for_status()
    artifact["dataset_name"] = name
    artifact["duplicate_response"] = r.json()
    return name


def save_target(dataset: str, artifact: dict) -> None:
    payload = {"dataset_name": dataset, "target_column": TARGET_COL}
    r = SESSION.post(f"{BASE}/api/save-target-column", json=payload, timeout=60)
    log(f"SAVE_TARGET {payload} -> {r.status_code} {r.text[:400]}")
    r.raise_for_status()
    artifact["save_target"] = {"payload": payload, "response": r.json()}


def column_value_counts(dataset: str, column: str) -> dict:
    payload = {
        "bdName": dataset,
        "column_name": column,
        "page": 0,
        "page_size": 500,
        "search_term": "",
    }
    r = SESSION.post(f"{BASE}/api/column-value-counts", json=payload, timeout=120)
    log(f"VALUE_COUNTS {column} -> {r.status_code}")
    r.raise_for_status()
    return r.json()


def delete_non_keep_labels(dataset: str, artifact: dict) -> None:
    before = column_value_counts(dataset, TARGET_COL)
    artifact["label_counts_before"] = before
    values = before.get("value_counts") or []
    to_delete = []
    for item in values:
        raw = item.get("value")
        if raw is None:
            continue
        s = str(raw).strip()
        key = s.lower()
        if key in KEEP_LABELS:
            continue
        # empty / other → delete (group-optimizer style)
        to_delete.append(raw if raw != "" else "[Empty]")
        if s == "" or s.lower() in ("null", "none", "[empty]"):
            if "[Empty]" not in to_delete:
                to_delete.append("[Empty]")
    # de-dupe preserving order
    seen = set()
    uniq = []
    for v in to_delete:
        if v not in seen:
            seen.add(v)
            uniq.append(v)
    artifact["values_to_delete"] = uniq
    if not uniq:
        log("DELETE_ROWS skip — no non-keep labels")
        artifact["delete_rows"] = {"deleted_rows": 0, "skipped": True}
        return
    payload = {
        "bdName": dataset,
        "column_name": TARGET_COL,
        "values_to_delete": uniq,
    }
    r = SESSION.post(f"{BASE}/api/delete-rows", json=payload, timeout=300)
    log(f"DELETE_ROWS {payload} -> {r.status_code} {r.text[:500]}")
    r.raise_for_status()
    artifact["delete_rows"] = {"payload": payload, "response": r.json()}
    after = column_value_counts(dataset, TARGET_COL)
    artifact["label_counts_after"] = after


def poll_job(kind: str, job_id: str, max_wait: float = MAX_JOB_WAIT_S) -> dict:
    status_url = f"{BASE}/api/{kind}/status/{job_id}"
    continue_url = f"{BASE}/api/{kind}/continue"
    started = time.time()
    last_log_n = 0
    while True:
        elapsed = time.time() - started
        if elapsed > max_wait:
            raise TimeoutError(f"{kind} {job_id} exceeded {max_wait}s")
        r = SESSION.get(status_url, timeout=60)
        if r.status_code == 404:
            time.sleep(POLL_EVERY)
            continue
        r.raise_for_status()
        data = r.json()
        logs = data.get("logs") or []
        if len(logs) > last_log_n:
            for line in logs[last_log_n:]:
                log(f"  [{kind}] {line}")
            last_log_n = len(logs)
        status = data.get("status")
        if status == "awaiting_input" and kind == "auto-clean-split":
            # Prefer remove duplicates when asked (same as typical UI choice)
            log("  [auto-clean-split] awaiting_input → continue remove_duplicates=True")
            cr = SESSION.post(
                continue_url,
                json={"job_id": job_id, "remove_duplicates": True},
                timeout=60,
            )
            log(f"  continue -> {cr.status_code} {cr.text[:300]}")
            cr.raise_for_status()
            time.sleep(POLL_EVERY)
            continue
        if status in ("done", "error", "completed"):
            return data
        time.sleep(POLL_EVERY)


def auto_clean_split(dataset: str, artifact: dict) -> None:
    # Pass remove_duplicates=True to skip prompt when possible
    payload = {"bdName": dataset, "remove_duplicates": True}
    r = SESSION.post(f"{BASE}/api/auto-clean-split/start", json=payload, timeout=60)
    log(f"AUTO_CLEAN start {payload} -> {r.status_code} {r.text[:400]}")
    r.raise_for_status()
    job_id = r.json()["job_id"]
    data = poll_job("auto-clean-split", job_id)
    artifact["auto_clean_split"] = {
        "job_id": job_id,
        "status": data.get("status"),
        "logs": data.get("logs") or [],
        "result": data.get("result"),
        "pending_question": data.get("pending_question"),
    }
    if data.get("status") == "error":
        raise RuntimeError(f"auto-clean-split failed: {data.get('result')}")


def auto_transform(dataset: str, artifact: dict) -> None:
    payload = {
        "bdName": dataset,
        "scaling_strategy": "none",  # UI default for Auto Transform
        "date_strategy": "keep",
    }
    r = SESSION.post(f"{BASE}/api/auto-transform/start", json=payload, timeout=60)
    log(f"AUTO_TRANSFORM start {payload} -> {r.status_code} {r.text[:400]}")
    r.raise_for_status()
    job_id = r.json()["job_id"]
    data = poll_job("auto-transform", job_id)
    artifact["auto_transform"] = {
        "job_id": job_id,
        "status": data.get("status"),
        "logs": data.get("logs") or [],
        "result": data.get("result"),
        "request": payload,
    }
    if data.get("status") == "error":
        raise RuntimeError(f"auto-transform failed: {data.get('result')}")


def training_id(algo: str) -> str:
    return f"{algo}_{int(time.time())}_{uuid.uuid4().hex[:8]}"


def strip_heavy(result: dict | None) -> dict | None:
    if not isinstance(result, dict):
        return result
    out = dict(result)
    out.pop("model_object", None)
    metrics = out.get("metrics")
    if isinstance(metrics, dict):
        m = dict(metrics)
        m.pop("predictions", None)
        out["metrics"] = m
    return out


ALGORITHMS = [
    (
        "logistic",
        "/api/train-logistic-regression",
        {
            "penalty": "l2",
            "solver": "lbfgs",
            "max_iter": 1000,
            "multi_class": "auto",
            "class_weight": None,
            "use_scaling": True,
            "random_state": None,
        },
    ),
    (
        "knn",
        "/api/train-knn",
        {
            "n_neighbors": 5,
            "weights": "uniform",
            "algorithm": "auto",
            "leaf_size": 30,
            "p": 2,
            "metric": "minkowski",
            "use_scaling": False,
            "final_training_on_all_data": False,
        },
    ),
    (
        "lightgbm",
        "/api/train-lightgbm",
        {
            "boosting_type": "gbdt",
            "num_leaves": 31,
            "learning_rate": 0.1,
            "n_estimators": 100,
            "max_depth": -1,
            "min_child_samples": 20,
            "subsample": 1.0,
            "colsample_bytree": 1.0,
            "reg_alpha": 0.0,
            "reg_lambda": 0.0,
            "early_stopping_rounds": 10,
            "verbose": -1,
            "final_training_on_all_data": False,
        },
    ),
    (
        "random_forest",
        "/api/train-random-forest",
        {
            "n_estimators": 100,
            "criterion": "gini",
            "max_depth": None,
            "min_samples_split": 2,
            "min_samples_leaf": 1,
            "max_features": "sqrt",
            "bootstrap": True,
            "oob_score": False,
            "random_state": None,
            "n_jobs": -1,
            "final_training_on_all_data": False,
        },
    ),
    (
        "mlp",
        "/api/train-mlp-pytorch",
        {
            "layers": [64, 32],
            "activation": "relu",
            "problem_type": "auto",
            "dropout_rate": 0.2,
            "learning_rate": 0.001,
            "batch_size": 32,
            "epochs": 100,
            "patience": 10,
            "validation_split": 0.2,
            "use_scaling": True,
        },
    ),
    (
        "svm",
        "/api/train-svm",
        {
            "kernel": "rbf",
            "C": 1.0,
            "gamma": "scale",
            "degree": 3,
            "shrinking": True,
            "probability": False,
            "final_training_on_all_data": False,
        },
    ),
]


def poll_training(tid: str) -> dict:
    started = time.time()
    while True:
        elapsed = time.time() - started
        if elapsed > MAX_TRAIN_WAIT_S:
            raise TimeoutError(f"Training {tid} exceeded {MAX_TRAIN_WAIT_S}s")
        r = SESSION.get(f"{BASE}/api/training-status/{tid}", timeout=60)
        if r.status_code == 404:
            time.sleep(POLL_EVERY)
            continue
        r.raise_for_status()
        data = r.json()
        if data.get("completed"):
            return data
        prog = data.get("progress")
        log(f"  … {tid} running ({elapsed:.0f}s)" + (f" progress={prog}" if prog else ""))
        time.sleep(POLL_EVERY)


def train_one(dataset: str, algo: str, endpoint: str, params: dict) -> dict:
    tid = training_id(algo)
    payload = {
        "numerized_dataset_name": dataset,
        "original_dataset_name": dataset,
        "model_type": algo,
        "training_id": tid,
        "validation_method": VALIDATION,
        "n_repetitions": N_REPS,
        **params,
    }
    log("=" * 72)
    log(f"START {algo} tid={tid}")
    t0 = time.time()
    r = SESSION.post(f"{BASE}{endpoint}", json=payload, timeout=120)
    log(f"POST {endpoint} -> {r.status_code} {r.text[:500]}")
    if r.status_code >= 400:
        summary = {
            "algorithm": algo,
            "training_id": tid,
            "ok": False,
            "error": r.text,
            "http_status": r.status_code,
            "duration_seconds": time.time() - t0,
            "request_params": params,
            "payload": payload,
        }
    else:
        status = poll_training(tid)
        duration = time.time() - t0
        err = status.get("error")
        result = strip_heavy(status.get("result"))
        metrics = (result or {}).get("metrics") or {}
        summary = {
            "algorithm": algo,
            "training_id": tid,
            "ok": err is None and (result or {}).get("status") == "success",
            "error": err,
            "duration_seconds": duration,
            "started_at": now_iso(),
            "finished_at": now_iso(),
            "accuracy": metrics.get("accuracy"),
            "precision": metrics.get("precision"),
            "recall": metrics.get("recall"),
            "f1": metrics.get("f1"),
            "roc_auc": metrics.get("roc_auc"),
            "validation_method": VALIDATION,
            "n_repetitions": N_REPS,
            "dataset": dataset,
            "request_params": params,
            "payload": payload,
            "result": result,
        }
    with SUMMARY.open("a", encoding="utf-8") as f:
        f.write(json.dumps(summary, ensure_ascii=False, default=str) + "\n")
    log(
        f"DONE {algo} ok={summary.get('ok')} duration={summary.get('duration_seconds'):.1f}s "
        f"acc={summary.get('accuracy')} f1={summary.get('f1')} err={summary.get('error')}"
    )
    return summary


def save_artifact(artifact: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT.write_text(
        json.dumps(artifact, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    artifact: dict = {
        "pipeline": "tuandromd_full",
        "started_at_utc": now_iso(),
        "started_at_madrid": madrid_now(),
        "user": EMAIL,
        "user_id": USER_ID,
        "predefined": PREDEFINED,
        "target_column": TARGET_COL,
        "keep_labels": sorted(KEEP_LABELS),
        "validation": VALIDATION,
        "n_repetitions": N_REPS,
    }
    save_artifact(artifact)
    login()
    free_slot_if_needed(artifact)
    save_artifact(artifact)
    dataset = duplicate(artifact)
    save_artifact(artifact)
    save_target(dataset, artifact)
    save_artifact(artifact)
    delete_non_keep_labels(dataset, artifact)
    save_artifact(artifact)
    auto_clean_split(dataset, artifact)
    save_artifact(artifact)
    auto_transform(dataset, artifact)
    save_artifact(artifact)

    results = []
    for algo, endpoint, params in ALGORITHMS:
        try:
            results.append(train_one(dataset, algo, endpoint, params))
        except Exception as e:
            log(f"FATAL {algo}: {e}")
            results.append(
                {
                    "algorithm": algo,
                    "ok": False,
                    "error": str(e),
                    "finished_at": now_iso(),
                }
            )
            with SUMMARY.open("a", encoding="utf-8") as f:
                f.write(json.dumps(results[-1], ensure_ascii=False, default=str) + "\n")
        save_artifact({**artifact, "trainings_so_far": [r.get("algorithm") for r in results]})

    FINAL.write_text(
        json.dumps(results, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    artifact["finished_at_utc"] = now_iso()
    artifact["finished_at_madrid"] = madrid_now()
    artifact["training_results_path"] = str(FINAL)
    artifact["trainings"] = [
        {
            "algorithm": r.get("algorithm"),
            "ok": r.get("ok"),
            "accuracy": r.get("accuracy"),
            "f1": r.get("f1"),
            "duration_seconds": r.get("duration_seconds"),
            "training_id": r.get("training_id"),
            "error": r.get("error"),
        }
        for r in results
    ]
    save_artifact(artifact)
    log("ALL DONE")


if __name__ == "__main__":
    main()
