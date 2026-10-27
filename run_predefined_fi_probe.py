#!/usr/bin/env python3
"""Delete cc datasets, copy each predefined, clean+transform, RF train, collect FI."""

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
MADRID = ZoneInfo("Europe/Madrid")
OUT = Path("/root/tfmv1/backend/training_logs/predefined_fi_probe")
POLL = 4

# Best-known target column per predefined table
TARGETS = {
    "nslkdd_train_part": "class",
    "nslkdd": "class",
    "tuandromd": "Label",
    "phishing_websites_uci": "Result",
    "phiusiil_phishing_url_dataset": "label",
}

SESSION = requests.Session()
SESSION.headers.update({"Origin": ORIGIN, "Content-Type": "application/json"})


def log(msg: str) -> None:
    line = f"[{datetime.now(MADRID).strftime('%Y-%m-%d %H:%M:%S %Z')}] {msg}"
    print(line, flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "runner.log").open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def login() -> None:
    r = SESSION.post(f"{BASE}/api/users/login", json={"email": EMAIL, "password": PASSWORD}, timeout=60)
    r.raise_for_status()
    log(f"LOGIN {r.status_code}")


def list_main() -> list[dict]:
    dbs = SESSION.get(f"{BASE}/api/databases", params={"userId": USER_ID}, timeout=60).json()
    return sorted(
        [d for d in dbs if not re.search(r"_(reset|numerized|backup)$", d["table_name"])],
        key=lambda x: x["created_at"],
    )


def delete_all_main() -> list[str]:
    deleted = []
    while True:
        mains = list_main()
        if not mains:
            break
        for d in mains:
            name = d["table_name"]
            r = SESSION.delete(
                f"{BASE}/api/delete-database-with-related",
                json={"dbName": name},
                timeout=180,
            )
            log(f"DELETE {name} -> {r.status_code} {r.text[:200]}")
            r.raise_for_status()
            deleted.append(name)
        time.sleep(0.5)
    return deleted


def poll_job(kind: str, job_id: str, max_wait=3600) -> dict:
    t0 = time.time()
    last = 0
    while True:
        if time.time() - t0 > max_wait:
            raise TimeoutError(kind)
        st = SESSION.get(f"{BASE}/api/{kind}/status/{job_id}", timeout=60)
        st.raise_for_status()
        data = st.json()
        logs = data.get("logs") or []
        for line in logs[last:]:
            log(f"  [{kind}] {line}")
        last = len(logs)
        status = data.get("status")
        if status == "awaiting_input" and kind == "auto-clean-split":
            SESSION.post(
                f"{BASE}/api/{kind}/continue",
                json={"job_id": job_id, "remove_duplicates": True},
                timeout=60,
            ).raise_for_status()
            time.sleep(POLL)
            continue
        if status in ("done", "error", "completed"):
            return data
        time.sleep(POLL)


def train_rf(dataset: str) -> dict:
    tid = f"rf_{dataset}_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    payload = {
        "numerized_dataset_name": dataset,
        "original_dataset_name": dataset,
        "model_type": "random_forest",
        "training_id": tid,
        "validation_method": "holdout",
        "n_repetitions": 3,
        "n_estimators": 80,
        "criterion": "gini",
        "max_depth": None,
        "min_samples_split": 2,
        "min_samples_leaf": 1,
        "max_features": "sqrt",
        "bootstrap": True,
        "oob_score": False,
        "random_state": 42,
        "n_jobs": -1,
        "final_training_on_all_data": False,
    }
    r = SESSION.post(f"{BASE}/api/train-random-forest", json=payload, timeout=120)
    log(f"TRAIN start {dataset} -> {r.status_code} {r.text[:180]}")
    if r.status_code >= 400:
        return {"ok": False, "error": r.text, "training_id": tid}
    t0 = time.time()
    while True:
        if time.time() - t0 > 3600:
            return {"ok": False, "error": "timeout", "training_id": tid}
        st = SESSION.get(f"{BASE}/api/training-status/{tid}", timeout=60).json()
        if st.get("completed"):
            err = st.get("error")
            result = st.get("result") or {}
            metrics = result.get("metrics") or {}
            fi = metrics.get("feature_importance") or {}
            # strip huge payloads
            top = sorted(fi.items(), key=lambda x: abs(float(x[1] or 0)), reverse=True)[:30]
            return {
                "ok": err is None and result.get("status") == "success",
                "error": err,
                "training_id": tid,
                "accuracy": metrics.get("accuracy"),
                "f1": metrics.get("f1"),
                "n_features_importance": len(fi),
                "top30_feature_importance": top,
                "classes": metrics.get("classes"),
                "duration_seconds": time.time() - t0,
            }
        time.sleep(POLL)


def process_one(predef: str) -> dict:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    # keep name short / valid
    short = predef.replace("phishing_url_dataset", "phi").replace("websites_uci", "uci")
    short = re.sub(r"[^a-z0-9_]", "_", short.lower())[:30]
    name = f"{short}_c_{stamp[-6:]}"
    target = TARGETS[predef]
    out = {"predefined": predef, "dataset": name, "target": target, "steps": {}}

    r = SESSION.post(
        f"{BASE}/api/duplicate-predefined-dataset",
        json={"original_table_name": predef, "new_dataset_name": name},
        timeout=600,
    )
    log(f"DUP {predef} -> {name} {r.status_code}")
    out["steps"]["duplicate"] = {"status": r.status_code, "body": r.text[:500]}
    r.raise_for_status()

    r = SESSION.post(
        f"{BASE}/api/save-target-column",
        json={"dataset_name": name, "target_column": target},
        timeout=60,
    )
    log(f"TARGET {target} -> {r.status_code}")
    out["steps"]["save_target"] = {"status": r.status_code, "body": r.text[:300]}
    r.raise_for_status()

    # Value counts before clean (rare labels)
    vc = SESSION.post(
        f"{BASE}/api/column-value-counts",
        json={"bdName": name, "column_name": target, "page": 0, "page_size": 50},
        timeout=120,
    )
    out["steps"]["label_before"] = vc.json() if vc.status_code == 200 else vc.text[:300]

    r = SESSION.post(
        f"{BASE}/api/auto-clean-split/start",
        json={"bdName": name, "remove_duplicates": True},
        timeout=60,
    )
    r.raise_for_status()
    clean = poll_job("auto-clean-split", r.json()["job_id"])
    out["steps"]["auto_clean"] = {
        "status": clean.get("status"),
        "result": clean.get("result"),
        "n_logs": len(clean.get("logs") or []),
    }
    if clean.get("status") == "error":
        out["ok"] = False
        out["error"] = clean.get("result")
        return out

    r = SESSION.post(
        f"{BASE}/api/auto-transform/start",
        json={"bdName": name, "scaling_strategy": "none", "date_strategy": "keep"},
        timeout=60,
    )
    r.raise_for_status()
    tr = poll_job("auto-transform", r.json()["job_id"])
    out["steps"]["auto_transform"] = {
        "status": tr.get("status"),
        "result": {
            "ok": (tr.get("result") or {}).get("ok"),
            "deleted_columns": ((tr.get("result") or {}).get("report") or {}).get("deleted_columns"),
            "transforms": ((tr.get("result") or {}).get("report") or {}).get("transforms"),
            "n_decisions": len(((tr.get("result") or {}).get("report") or {}).get("decisions") or []),
        },
        "n_logs": len(tr.get("logs") or []),
    }
    if tr.get("status") == "error":
        out["ok"] = False
        out["error"] = tr.get("result")
        return out

    train = train_rf(name)
    out["steps"]["train_rf"] = train
    out["ok"] = bool(train.get("ok"))
    out["error"] = train.get("error")
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    login()
    deleted = delete_all_main()
    lim = SESSION.get(f"{BASE}/api/check-dataset-limit", timeout=30).json()
    log(f"After delete limit={lim} deleted={deleted}")

    predefined = SESSION.get(f"{BASE}/api/predefined-datasets", timeout=60).json().get("datasets") or []
    names = [d["table_name"] for d in predefined]
    log(f"PREDEFINED {names}")

    results = []
    for predef in names:
        if predef not in TARGETS:
            log(f"SKIP no target mapping for {predef}")
            continue
        log("=" * 72)
        log(f"PROCESS {predef}")
        try:
            results.append(process_one(predef))
        except Exception as e:
            log(f"FATAL {predef}: {e}")
            results.append({"predefined": predef, "ok": False, "error": str(e)})
        (OUT / "results.json").write_text(
            json.dumps(results, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

    (OUT / "results.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    log("ALL DONE")
    for r in results:
        tr = (r.get("steps") or {}).get("train_rf") or {}
        log(
            f"SUMMARY {r.get('predefined')} ok={r.get('ok')} "
            f"acc={tr.get('accuracy')} n_fi={tr.get('n_features_importance')} err={r.get('error')}"
        )


if __name__ == "__main__":
    main()
