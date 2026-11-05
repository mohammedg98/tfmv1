#!/usr/bin/env python3
"""Evaluate anomaly predictions vs ground-truth attacks (attack_type != normal)."""

from __future__ import annotations

import csv
import io
import json
import tempfile
import time
from pathlib import Path

import requests

BASE = "http://127.0.0.1"
ORIGIN = "http://46.62.212.226"
EMAIL = "cc@cc.cc"
PASSWORD = "qwerqwer"
ART = Path("/root/tfmv1/backend/training_logs/nsl_anomaly_pipeline_nov5/artifacts")
CSV = ART / "nsl_only_train_csv_nov5.csv"
CHUNK = 4000
MODELS = [(48, "isolation_forest"), (49, "one_class_svm")]

SESSION = requests.Session()
SESSION.headers.update({"Origin": ORIGIN})


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def login() -> None:
    r = SESSION.post(
        f"{BASE}/api/users/login",
        json={"email": EMAIL, "password": PASSWORD},
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    r.raise_for_status()
    log("LOGIN ok")


def iter_chunks(path: Path, chunk_size: int):
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = []
        for row in reader:
            rows.append(row)
            if len(rows) >= chunk_size:
                yield header, rows
                rows = []
        if rows:
            yield header, rows


def predict_download(model_id: int, header, rows, idx: int) -> list[dict]:
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, newline="") as tmp:
        w = csv.writer(tmp)
        w.writerow(header)
        w.writerows(rows)
        tmp_path = Path(tmp.name)
    try:
        with tmp_path.open("rb") as fh:
            r = SESSION.post(
                f"{BASE}/api/predict-batch",
                params={
                    "modelId": model_id,
                    "decisionThreshold": 0.5,
                    "page": 1,
                    "pageSize": 25,
                },
                files={"file": (f"chunk_{idx}.csv", fh, "text/csv")},
                timeout=600,
            )
        r.raise_for_status()
        data = r.json()
        token = data.get("download_token")
        if not token:
            raise RuntimeError(f"no download_token chunk={idx}")
        rr = SESSION.get(
            f"{BASE}/api/predict-batch-download",
            params={"batchId": token},
            timeout=600,
        )
        rr.raise_for_status()
        text = rr.content.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        return list(reader)
    finally:
        tmp_path.unlink(missing_ok=True)


def is_true_attack(row: dict) -> bool:
    for k in ("actual_attack_type", "attack_type", "actual_label", "target"):
        if k in row and row[k] is not None and str(row[k]).strip() != "":
            return str(row[k]).strip().lower() != "normal"
    return False


def is_pred_anomaly(row: dict) -> bool:
    if "is_anomaly" in row:
        v = str(row["is_anomaly"]).strip().lower()
        return v in ("1", "true", "yes", "anomaly")
    for k in ("predicted_label", "prediction", "anomaly_label"):
        if k in row and row[k] is not None:
            return str(row[k]).strip().lower() in ("anomaly", "attack", "-1")
    return False


def metrics_from_counts(tp, fp, tn, fn) -> dict:
    total = tp + fp + tn + fn
    acc = (tp + tn) / total if total else 0.0
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    spec = tn / (tn + fp) if (tn + fp) else 0.0
    f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) else 0.0
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    fnr = fn / (fn + tp) if (fn + tp) else 0.0
    return {
        "n": total,
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "specificity": spec,
        "f1": f1,
        "false_positive_rate": fpr,
        "false_negative_rate": fnr,
        "support_attack": tp + fn,
        "support_normal": tn + fp,
        "predicted_anomaly": tp + fp,
        "predicted_normal": tn + fn,
    }


def evaluate(model_id: int, tag: str) -> dict:
    log(f"EVAL start {tag} model={model_id}")
    tp = fp = tn = fn = 0
    n_rows = 0
    # optional score stats by class
    scores_attack = []
    scores_normal = []
    for idx, (header, rows) in enumerate(iter_chunks(CSV, CHUNK), 1):
        pred_rows = predict_download(model_id, header, rows, idx)
        for row in pred_rows:
            y_true = is_true_attack(row)
            y_pred = is_pred_anomaly(row)
            n_rows += 1
            if y_true and y_pred:
                tp += 1
            elif (not y_true) and y_pred:
                fp += 1
            elif (not y_true) and (not y_pred):
                tn += 1
            else:
                fn += 1
            sc = row.get("anomaly_score")
            try:
                scf = float(sc)
                (scores_attack if y_true else scores_normal).append(scf)
            except Exception:
                pass
        log(
            f"  chunk {idx}: cum n={n_rows} tp={tp} fp={fp} tn={tn} fn={fn} "
            f"acc={(tp+tn)/max(n_rows,1):.4f}"
        )
    out = metrics_from_counts(tp, fp, tn, fn)
    out.update(
        {
            "model_id": model_id,
            "tag": tag,
            "definition": {
                "y_true_positive": "attack_type != normal (true attack)",
                "y_pred_positive": "model predicted anomaly",
            },
            "score_mean_true_attack": (
                sum(scores_attack) / len(scores_attack) if scores_attack else None
            ),
            "score_mean_true_normal": (
                sum(scores_normal) / len(scores_normal) if scores_normal else None
            ),
        }
    )
    path = ART / f"eval_vs_attacks_{tag}.json"
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"WROTE {path}")
    log(
        f"DONE {tag}: acc={out['accuracy']:.4f} prec={out['precision']:.4f} "
        f"rec={out['recall']:.4f} f1={out['f1']:.4f} "
        f"tp={tp} fp={fp} tn={tn} fn={fn}"
    )
    return out


def main() -> None:
    login()
    results = {}
    for mid, tag in MODELS:
        results[tag] = evaluate(mid, tag)
        log(f"STAGE_DONE eval_{tag}")
    (ART / "eval_vs_attacks_summary.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    log("EVAL_COMPLETE")


if __name__ == "__main__":
    main()
