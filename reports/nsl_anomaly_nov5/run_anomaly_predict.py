#!/usr/bin/env python3
"""Predict-batch against backend:8000 (bypass nginx) for both saved anomaly models."""

from __future__ import annotations

import json
import time
from pathlib import Path

import requests

BASE = "http://backend:8000"  # docker network
ORIGIN = "http://46.62.212.226"
EMAIL = "cc@cc.cc"
PASSWORD = "qwerqwer"
ART = Path("/artifacts")
CSV = ART / "nsl_only_train_csv_nov5.csv"
STAGE = ART / "predict_stages.log"

SESSION = requests.Session()
SESSION.headers.update({"Origin": ORIGIN})


def log(msg: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with STAGE.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def login() -> None:
    r = SESSION.post(
        f"{BASE}/api/users/login",
        json={"email": EMAIL, "password": PASSWORD},
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    r.raise_for_status()
    log(f"LOGIN {r.status_code}")


def predict(model_id: int, tag: str) -> dict:
    log(f"PREDICT start model={model_id} tag={tag} csv_bytes={CSV.stat().st_size}")
    t0 = time.time()
    with CSV.open("rb") as fh:
        files = {"file": (CSV.name, fh, "text/csv")}
        r = SESSION.post(
            f"{BASE}/api/predict-batch",
            params={
                "modelId": model_id,
                "decisionThreshold": 0.5,
                "page": 1,
                "pageSize": 25,
            },
            files=files,
            timeout=3600,
        )
    log(f"PREDICT HTTP {r.status_code} in {time.time()-t0:.1f}s")
    if r.status_code >= 400:
        (ART / f"predict_error_{tag}.txt").write_text(r.text[:5000], encoding="utf-8")
        raise RuntimeError(f"predict failed {r.status_code}: {r.text[:500]}")
    data = r.json()
    (ART / f"predict_batch_{tag}.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )
    # summarize preview
    preview = data.get("preview") or data.get("rows") or []
    summary = {
        "model_id": model_id,
        "tag": tag,
        "keys": list(data.keys()),
        "total_rows": data.get("total_rows") or data.get("n_rows") or data.get("row_count"),
        "anomaly_count": data.get("anomaly_count") or data.get("n_anomalies"),
        "normal_count": data.get("normal_count") or data.get("n_normals"),
        "anomaly_rate": data.get("anomaly_rate"),
        "preview_len": len(preview) if isinstance(preview, list) else None,
        "download_token": data.get("download_token"),
        "metrics": data.get("metrics") or data.get("summary"),
    }
    (ART / f"predict_summary_{tag}.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )
    log(f"PREDICT summary {summary}")
    token = data.get("download_token")
    if token:
        rr = SESSION.get(
            f"{BASE}/api/predict-batch-download",
            params={"batchId": token},
            timeout=3600,
        )
        if rr.ok:
            out = ART / f"predictions_{tag}.csv"
            out.write_bytes(rr.content)
            log(f"PREDICT csv saved {out} bytes={out.stat().st_size}")
        else:
            log(f"PREDICT download failed {rr.status_code}")
    return data


def main() -> None:
    ART.mkdir(parents=True, exist_ok=True)
    login()
    # model ids from previous save
    predict(48, "isolation_forest")
    log("STAGE_DONE predict_isolation_forest")
    predict(49, "one_class_svm")
    log("STAGE_DONE predict_one_class_svm")
    log("PREDICT PIPELINE COMPLETE")


if __name__ == "__main__":
    main()
