#!/usr/bin/env python3
"""
NSL-KDD predefined → copy → group cleanup → transform → train all clf (holdout×5).

Runs on the live host against http://127.0.0.1 (nginx→backend).
Writes stage markers + results under backend/training_logs/nsl_kdd_pipeline_*/
"""

from __future__ import annotations

import json
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
PREDEFINED = "nsl_kdd"
DATASET = "nsl_kdd_clf_nov5"
N_REPS = 5
VALIDATION = "holdout"
MADRID = ZoneInfo("Europe/Madrid")

ROOT = Path("/root/tfmv1")
OUT = ROOT / "backend" / "training_logs" / "nsl_kdd_pipeline_nov5"
STAGE_LOG = OUT / "stages.log"
SUMMARY = OUT / "run_summary.jsonl"
FINAL = OUT / "final_results.json"
STATS = OUT / "dataset_stats.json"

POLL_EVERY = 5
MAX_WAIT_S = 3 * 60 * 60

SESSION = requests.Session()
SESSION.headers.update({"Origin": ORIGIN, "Content-Type": "application/json"})


def now_madrid() -> str:
    return datetime.now(MADRID).strftime("%Y-%m-%d %H:%M:%S %Z")


def stage(msg: str) -> None:
    line = f"[{now_madrid()}] {msg}"
    print(line, flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    with STAGE_LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def login() -> None:
    r = SESSION.post(
        f"{BASE}/api/users/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=60,
    )
    r.raise_for_status()
    stage(f"LOGIN ok ({r.status_code})")


def api(method: str, path: str, **kwargs):
    r = SESSION.request(method, f"{BASE}{path}", timeout=kwargs.pop("timeout", 300), **kwargs)
    return r


def collect_stats(bd_name: str, label: str) -> dict:
    """Best-effort dataset + target stats via SQL through backend container env is not available;
    use platform APIs + a lightweight row sample when possible."""
    info: dict = {"label": label, "bdName": bd_name, "captured_at": now_madrid()}

    # split stats
    r = api("GET", "/api/get-split-stats2", params={"bdName": bd_name, "quick": "false"})
    info["split"] = r.json() if r.ok else {"error": r.text[:300], "status": r.status_code}

    # target
    r = api("GET", "/api/get-target-column2", params={"dbName": bd_name})
    info["target_meta"] = r.json() if r.ok else {"error": r.text[:300]}

    # columns / types
    r = api(
        "GET",
        "/api/analyze-column-types",
        params={"bdName": bd_name},
    )
    info["column_types"] = r.json() if r.ok else {"error": r.text[:500], "status": r.status_code}

    # paginated shape
    r = api(
        "GET",
        "/api/get-data-paginatedd",
        params={"bdName": bd_name, "page": 0, "page_size": 5},
    )
    if r.ok:
        d = r.json()
        info["columns"] = d.get("columns")
        info["n_columns"] = len(d.get("columns") or [])
        info["sample_rows"] = (d.get("rows") or [])[:3]
        info["total_hint"] = d.get("total") or d.get("total_rows") or d.get("row_count")
    else:
        info["columns_error"] = r.text[:300]

    # problem type / class distribution if available
    r = api("GET", "/api/detect-problem-type", params={"bdName": bd_name})
    info["problem_type"] = r.json() if r.ok else {"error": r.text[:300], "status": r.status_code}

    return info


def duplicate() -> None:
    stage(f"COPY start: predefined={PREDEFINED} → {DATASET}")
    r = api(
        "POST",
        "/api/duplicate-predefined-dataset",
        json={"original_table_name": PREDEFINED, "new_dataset_name": DATASET},
        timeout=600,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"duplicate failed: {r.status_code} {r.text[:500]}")
    stage(f"COPY done: {r.text[:300]}")


def delete_columns(cols: list[str]) -> None:
    stage(f"GROUP delete columns: {cols}")
    r = api(
        "POST",
        "/api/delete-column",
        json={
            "originalBdName": DATASET,
            "currentBdName": DATASET,
            "columnNames": cols,
        },
        timeout=300,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"delete-column failed: {r.status_code} {r.text[:500]}")
    stage(f"GROUP delete done: {r.text[:400]}")


def group_optimize() -> None:
    stage("GROUP optimize (update-stage + reset-id + checkpoint)")
    r = api("POST", "/api/update-stage", json={"bdName": DATASET, "newStage": "data_cleaning"})
    stage(f"  update-stage → {r.status_code} {r.text[:200]}")
    r = api(
        "POST",
        "/api/reset-id-column-sequential",
        json={"bdName": DATASET, "idColumnName": "id"},
    )
    stage(f"  reset-id → {r.status_code} {r.text[:200]}")
    r = api("POST", "/api/dataset/save-checkpoint", json={"source_db": DATASET})
    stage(f"  checkpoint → {r.status_code} {r.text[:200]}")
    stage("GROUP optimize done")


def transform() -> None:
    stage("TRANSFORM start: label(attack_type) + onehot(protocol_type,service,flag)")
    # global stats optional but UI sends them
    r = api("GET", "/api/get-global-statistics", params={"bdName": DATASET})
    global_stats = (r.json() or {}).get("statistics", {}) if r.ok else {}

    configs = [
        {"column": "attack_type", "method": "label", "parameters": {"global_stats": global_stats.get("attack_type")}},
        {
            "column": "protocol_type",
            "method": "onehot",
            "parameters": {"global_stats": global_stats.get("protocol_type")},
        },
        {"column": "service", "method": "onehot", "parameters": {"global_stats": global_stats.get("service")}},
        {"column": "flag", "method": "onehot", "parameters": {"global_stats": global_stats.get("flag")}},
    ]
    r = api(
        "POST",
        "/api/process-numerisation",
        json={"bdName": DATASET, "configurations": configs},
        timeout=900,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"transform failed: {r.status_code} {r.text[:800]}")
    stage(f"TRANSFORM done: {r.text[:500]}")
    # advance stage toward create model
    for st in ("data_transformation", "create_model"):
        try:
            api("POST", "/api/update-stage", json={"bdName": DATASET, "newStage": st})
        except Exception:
            pass
    api("POST", "/api/dataset/save-checkpoint", json={"source_db": DATASET})
    stage("TRANSFORM checkpoint saved")


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
        # keep classification_report / confusion / FI
        out["metrics"] = m
    return out


def poll(tid: str) -> dict:
    started = time.time()
    while True:
        elapsed = time.time() - started
        if elapsed > MAX_WAIT_S:
            raise TimeoutError(f"{tid} exceeded {MAX_WAIT_S}s")
        r = api("GET", f"/api/training-status/{tid}", timeout=60)
        if r.status_code == 404:
            time.sleep(POLL_EVERY)
            continue
        r.raise_for_status()
        data = r.json()
        if data.get("completed"):
            return data
        if int(elapsed) % 60 < POLL_EVERY:
            stage(f"  … {tid} running ({elapsed:.0f}s) progress={data.get('progress')}")
        time.sleep(POLL_EVERY)


def train_one(algo: str, endpoint: str, params: dict) -> dict:
    tid = training_id(algo)
    payload = {
        "numerized_dataset_name": DATASET,
        "original_dataset_name": DATASET,
        "model_type": algo,
        "training_id": tid,
        "validation_method": VALIDATION,
        "n_repetitions": N_REPS,
        **params,
    }
    stage(f"TRAIN START {algo} tid={tid}")
    t0 = time.time()
    r = api("POST", endpoint, json=payload, timeout=120)
    stage(f"TRAIN POST {algo} → {r.status_code} {r.text[:300]}")
    if r.status_code >= 400:
        summary = {
            "algorithm": algo,
            "training_id": tid,
            "ok": False,
            "error": r.text,
            "http_status": r.status_code,
            "duration_seconds": time.time() - t0,
            "finished_at": now_madrid(),
        }
        with SUMMARY.open("a", encoding="utf-8") as f:
            f.write(json.dumps(summary, ensure_ascii=False, default=str) + "\n")
        stage(f"TRAIN FAIL {algo}")
        return summary
    status = poll(tid)
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
        "started_at_unix": t0,
        "finished_at": now_madrid(),
        "accuracy": metrics.get("accuracy"),
        "precision": metrics.get("precision"),
        "recall": metrics.get("recall"),
        "f1": metrics.get("f1"),
        "roc_auc": metrics.get("roc_auc"),
        "validation_method": VALIDATION,
        "n_repetitions": N_REPS,
        "dataset": DATASET,
        "result": result,
    }
    with SUMMARY.open("a", encoding="utf-8") as f:
        f.write(json.dumps(summary, ensure_ascii=False, default=str) + "\n")
    stage(
        f"TRAIN DONE {algo} ok={summary['ok']} duration={duration:.1f}s "
        f"acc={summary['accuracy']} f1={summary['f1']}"
    )
    return summary


def find_constant_columns() -> list[str]:
    """Ask Postgres via a small helper endpoint is unavailable — use analyze + heuristics.
    For this pipeline we already know num_outbound_cmds; still try column_types distinct==1."""
    constants = []
    r = api("GET", "/api/analyze-column-types", params={"bdName": DATASET})
    if r.ok:
        data = r.json()
        items = data.get("column_types") or data.get("columns") or []
        for it in items:
            name = it.get("column_name") or it.get("name")
            stats = it.get("stats") or {}
            distinct = stats.get("distinct")
            if name and distinct == 1 and name not in ("split_type", "id"):
                # never drop target
                tgt = (api("GET", "/api/get-target-column2", params={"dbName": DATASET}).json() or {}).get(
                    "target_column"
                )
                if tgt and name.lower() == str(tgt).lower():
                    continue
                constants.append(name)
    if "num_outbound_cmds" not in constants:
        # known constant on train for NSL-KDD
        constants.append("num_outbound_cmds")
    return constants


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    login()

    # --- copy ---
    duplicate()
    before = collect_stats(DATASET, "before_preprocessing")
    STATS.write_text(
        json.dumps({"before": before}, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    stage("STATS before_preprocessing saved")
    stage("STAGE_DONE copy")

    # --- group: drop unique=1 + difficulty_level; no split changes ---
    constants = find_constant_columns()
    to_drop = sorted(set(constants + ["difficulty_level"]))
    stage(f"GROUP columns to drop: {to_drop}")
    delete_columns(to_drop)
    group_optimize()
    stage("STAGE_DONE group")

    # --- transform ---
    transform()
    after = collect_stats(DATASET, "after_preprocessing")
    blob = json.loads(STATS.read_text(encoding="utf-8"))
    blob["after"] = after
    STATS.write_text(json.dumps(blob, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    stage("STATS after_preprocessing saved")
    stage("STAGE_DONE transform")

    # --- train all ---
    results = []
    for algo, endpoint, params in ALGORITHMS:
        try:
            results.append(train_one(algo, endpoint, params))
            stage(f"STAGE_DONE train_{algo}")
        except Exception as e:
            stage(f"TRAIN FATAL {algo}: {e}")
            results.append(
                {
                    "algorithm": algo,
                    "ok": False,
                    "error": str(e),
                    "finished_at": now_madrid(),
                }
            )
            with SUMMARY.open("a", encoding="utf-8") as f:
                f.write(json.dumps(results[-1], ensure_ascii=False, default=str) + "\n")
            stage(f"STAGE_DONE train_{algo}_failed")

    FINAL.write_text(json.dumps(results, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    stage("STAGE_DONE all_training")
    stage("PIPELINE COMPLETE")


if __name__ == "__main__":
    main()
