#!/usr/bin/env python3
"""Use Model on My Dataset `kddtest` with saved anomaly models + GT metrics."""

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
CSV = ART / "kddtest.csv"
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


def ensure_csv() -> None:
    ART.mkdir(parents=True, exist_ok=True)
    if CSV.exists() and CSV.stat().st_size > 1000:
        log(f"CSV already present {CSV} bytes={CSV.stat().st_size}")
        return
    log("DOWNLOAD kddtest CSV")
    r = SESSION.get(
        f"{BASE}/api/download-dataset-csv",
        params={"dbName": "kddtest"},
        timeout=600,
    )
    r.raise_for_status()
    CSV.write_bytes(r.content)
    log(f"WROTE {CSV} bytes={CSV.stat().st_size}")


def dataset_stats() -> dict:
    with CSV.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        header = list(reader.fieldnames or [])
        counts: dict[str, int] = {}
        n = 0
        for row in reader:
            n += 1
            at = (row.get("attack_type") or "").strip()
            counts[at] = counts.get(at, 0) + 1
    n_normal = counts.get("normal", 0)
    n_attack = n - n_normal
    out = {
        "dataset": "kddtest",
        "source": "My Datasets",
        "n_rows": n,
        "n_columns": len(header),
        "columns": header,
        "n_normal": n_normal,
        "n_attack": n_attack,
        "attack_rate": (n_attack / n) if n else None,
        "attack_type_value_counts": dict(
            sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        ),
    }
    (ART / "kddtest_stats.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    log(
        f"STATS kddtest n={n} normal={n_normal} attack={n_attack} "
        f"rate={(n_attack/n if n else 0):.4f} distinct_labels={len(counts)}"
    )
    return out


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
                files={"file": (f"kddtest_chunk_{idx}.csv", fh, "text/csv")},
                timeout=600,
            )
        r.raise_for_status()
        data = r.json()
        token = data.get("download_token")
        if not token:
            raise RuntimeError(f"no download_token chunk={idx} keys={list(data.keys())}")
        rr = SESSION.get(
            f"{BASE}/api/predict-batch-download",
            params={"batchId": token},
            timeout=600,
        )
        rr.raise_for_status()
        text = rr.content.decode("utf-8", errors="replace")
        return list(csv.DictReader(io.StringIO(text))), data
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
        "anomaly_rate": ((tp + fp) / total) if total else None,
    }


def evaluate(model_id: int, tag: str) -> dict:
    log(f"EVAL start {tag} model={model_id} csv={CSV.name}")
    tp = fp = tn = fn = 0
    n_rows = 0
    scores_attack = []
    scores_normal = []
    chunk_summaries = []
    score_min = score_max = None
    score_sum = 0.0
    score_n = 0

    for idx, (header, rows) in enumerate(iter_chunks(CSV, CHUNK), 1):
        pred_rows, batch_meta = predict_download(model_id, header, rows, idx)
        c_tp = c_fp = c_tn = c_fn = 0
        for row in pred_rows:
            y_true = is_true_attack(row)
            y_pred = is_pred_anomaly(row)
            n_rows += 1
            if y_true and y_pred:
                tp += 1
                c_tp += 1
            elif (not y_true) and y_pred:
                fp += 1
                c_fp += 1
            elif (not y_true) and (not y_pred):
                tn += 1
                c_tn += 1
            else:
                fn += 1
                c_fn += 1
            sc = row.get("anomaly_score")
            try:
                scf = float(sc)
                (scores_attack if y_true else scores_normal).append(scf)
                score_sum += scf
                score_n += 1
                score_min = scf if score_min is None else min(score_min, scf)
                score_max = scf if score_max is None else max(score_max, scf)
            except Exception:
                pass
        chunk_summaries.append(
            {
                "chunk": idx,
                "rows": len(pred_rows),
                "tp": c_tp,
                "fp": c_fp,
                "tn": c_tn,
                "fn": c_fn,
                "class_distribution": batch_meta.get("class_distribution"),
                "metrics": batch_meta.get("metrics"),
            }
        )
        log(
            f"  chunk {idx}: cum n={n_rows} tp={tp} fp={fp} tn={tn} fn={fn} "
            f"acc={(tp+tn)/max(n_rows,1):.4f}"
        )

    out = metrics_from_counts(tp, fp, tn, fn)
    out.update(
        {
            "model_id": model_id,
            "tag": tag,
            "dataset": "kddtest",
            "csv_file": str(CSV),
            "chunks": len(chunk_summaries),
            "chunk_size": CHUNK,
            "definition": {
                "y_true_positive": "attack_type != normal (true attack)",
                "y_pred_positive": "model predicted anomaly",
            },
            "score_min": score_min,
            "score_mean": (score_sum / score_n) if score_n else None,
            "score_max": score_max,
            "score_mean_true_attack": (
                sum(scores_attack) / len(scores_attack) if scores_attack else None
            ),
            "score_mean_true_normal": (
                sum(scores_normal) / len(scores_normal) if scores_normal else None
            ),
            "chunk_summaries": chunk_summaries,
        }
    )
    path = ART / f"eval_kddtest_{tag}.json"
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    # slim predict-full summary (without heavy chunk list for report)
    slim = {k: v for k, v in out.items() if k != "chunk_summaries"}
    (ART / f"predict_kddtest_{tag}.json").write_text(
        json.dumps(
            {
                **slim,
                "rows_processed": out["n"],
                "n_anomaly": out["predicted_anomaly"],
                "n_normal": out["predicted_normal"],
                "pipeline_applied": True,
                "target_column": "attack_type",
                "unexpected_columns_ignored": ["difficulty_level"],
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    log(f"WROTE {path}")
    log(
        f"DONE {tag}: acc={out['accuracy']:.4f} prec={out['precision']:.4f} "
        f"rec={out['recall']:.4f} f1={out['f1']:.4f} "
        f"tp={tp} fp={fp} tn={tn} fn={fn} anomaly_rate={out['anomaly_rate']:.4f}"
    )
    return out


def main() -> None:
    login()
    ensure_csv()
    stats = dataset_stats()
    results = {"dataset_stats": stats}
    for mid, tag in MODELS:
        results[tag] = evaluate(mid, tag)
        log(f"STAGE_DONE eval_kddtest_{tag}")
    summary = {
        "dataset": "kddtest",
        "n_rows": stats["n_rows"],
        "n_normal": stats["n_normal"],
        "n_attack": stats["n_attack"],
        "isolation_forest": {
            k: results["isolation_forest"][k]
            for k in (
                "n",
                "tp",
                "fp",
                "tn",
                "fn",
                "accuracy",
                "precision",
                "recall",
                "specificity",
                "f1",
                "false_positive_rate",
                "false_negative_rate",
                "support_attack",
                "support_normal",
                "predicted_anomaly",
                "predicted_normal",
                "anomaly_rate",
                "model_id",
                "tag",
                "definition",
                "score_mean_true_attack",
                "score_mean_true_normal",
                "score_min",
                "score_mean",
                "score_max",
            )
            if k in results["isolation_forest"]
        },
        "one_class_svm": {
            k: results["one_class_svm"][k]
            for k in (
                "n",
                "tp",
                "fp",
                "tn",
                "fn",
                "accuracy",
                "precision",
                "recall",
                "specificity",
                "f1",
                "false_positive_rate",
                "false_negative_rate",
                "support_attack",
                "support_normal",
                "predicted_anomaly",
                "predicted_normal",
                "anomaly_rate",
                "model_id",
                "tag",
                "definition",
                "score_mean_true_attack",
                "score_mean_true_normal",
                "score_min",
                "score_mean",
                "score_max",
            )
            if k in results["one_class_svm"]
        },
    }
    (ART / "eval_kddtest_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    log("EVAL_KDDTEST_COMPLETE")


if __name__ == "__main__":
    main()
