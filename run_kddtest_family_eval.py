#!/usr/bin/env python3
"""Export kddtest Use Model predictions + detection-by-family (DoS/Probe/R2L/U2R)."""

from __future__ import annotations

import csv
import io
import json
import tempfile
import time
from collections import defaultdict
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

# NSL-KDD / KDD'99 attack family mapping (standard thesis taxonomy)
FAMILY_MAP = {
    # DoS
    "apache2": "DoS",
    "back": "DoS",
    "land": "DoS",
    "mailbomb": "DoS",
    "neptune": "DoS",
    "pod": "DoS",
    "processtable": "DoS",
    "smurf": "DoS",
    "teardrop": "DoS",
    "udpstorm": "DoS",
    "worm": "DoS",
    # Probe
    "ipsweep": "Probe",
    "mscan": "Probe",
    "nmap": "Probe",
    "portsweep": "Probe",
    "saint": "Probe",
    "satan": "Probe",
    # R2L
    "ftp_write": "R2L",
    "guess_passwd": "R2L",
    "httptunnel": "R2L",
    "imap": "R2L",
    "multihop": "R2L",
    "named": "R2L",
    "phf": "R2L",
    "sendmail": "R2L",
    "snmpgetattack": "R2L",
    "snmpguess": "R2L",
    "spy": "R2L",
    "warezclient": "R2L",
    "warezmaster": "R2L",
    "xlock": "R2L",
    "xsnoop": "R2L",
    # U2R
    "buffer_overflow": "U2R",
    "loadmodule": "U2R",
    "perl": "U2R",
    "ps": "U2R",
    "rootkit": "U2R",
    "sqlattack": "U2R",
    "xterm": "U2R",
    # Normal
    "normal": "Normal",
}

FAMILIES = ["DoS", "Probe", "R2L", "U2R", "Normal"]

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


def family_of(label: str) -> str:
    key = (label or "").strip().lower()
    return FAMILY_MAP.get(key, "Unknown")


def is_pred_anomaly(row: dict) -> bool:
    if "is_anomaly" in row:
        v = str(row["is_anomaly"]).strip().lower()
        return v in ("1", "true", "yes", "anomaly")
    for k in ("predicted_label", "prediction", "anomaly_label"):
        if k in row and row[k] is not None:
            return str(row[k]).strip().lower() in ("anomaly", "attack", "-1")
    return False


def get_attack_type(row: dict) -> str:
    for k in ("actual_attack_type", "attack_type", "actual_label", "target"):
        if k in row and row[k] is not None and str(row[k]).strip() != "":
            return str(row[k]).strip()
    return ""


def get_pred_label(row: dict) -> str:
    if "is_anomaly" in row:
        return "anomaly" if is_pred_anomaly(row) else "normal"
    for k in ("predicted_label", "prediction", "anomaly_label"):
        if k in row and row[k] is not None and str(row[k]).strip() != "":
            return str(row[k]).strip()
    return "anomaly" if is_pred_anomaly(row) else "normal"


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
            raise RuntimeError(f"no download_token chunk={idx}")
        rr = SESSION.get(
            f"{BASE}/api/predict-batch-download",
            params={"batchId": token},
            timeout=600,
        )
        rr.raise_for_status()
        text = rr.content.decode("utf-8", errors="replace")
        return list(csv.DictReader(io.StringIO(text)))
    finally:
        tmp_path.unlink(missing_ok=True)


def export_model(model_id: int, tag: str) -> dict:
    log(f"EXPORT start {tag} model={model_id}")
    out_csv = ART / f"predictions_kddtest_{tag}.csv"
    fieldnames = [
        "row_index",
        "attack_type",
        "attack_family",
        "predicted_label",
        "is_anomaly",
        "anomaly_score",
    ]

    by_family = {
        fam: {"support": 0, "detected": 0, "missed": 0} for fam in FAMILIES + ["Unknown"]
    }
    by_label: dict[str, dict] = defaultdict(
        lambda: {"family": "", "support": 0, "detected": 0, "missed": 0}
    )
    n = 0
    n_anom = 0

    with out_csv.open("w", encoding="utf-8", newline="") as fout:
        writer = csv.DictWriter(fout, fieldnames=fieldnames)
        writer.writeheader()
        for idx, (header, rows) in enumerate(iter_chunks(CSV, CHUNK), 1):
            pred_rows = predict_download(model_id, header, rows, idx)
            for row in pred_rows:
                n += 1
                attack = get_attack_type(row)
                fam = family_of(attack)
                pred_anom = is_pred_anomaly(row)
                pred_label = get_pred_label(row)
                if pred_anom:
                    n_anom += 1
                score = row.get("anomaly_score", "")
                writer.writerow(
                    {
                        "row_index": n,
                        "attack_type": attack,
                        "attack_family": fam,
                        "predicted_label": pred_label,
                        "is_anomaly": int(pred_anom),
                        "anomaly_score": score,
                    }
                )
                by_family[fam]["support"] += 1
                by_label[attack]["family"] = fam
                by_label[attack]["support"] += 1
                if fam == "Normal":
                    # for Normal, "detected" = correctly predicted normal (not anomaly)
                    if not pred_anom:
                        by_family[fam]["detected"] += 1
                        by_label[attack]["detected"] += 1
                    else:
                        by_family[fam]["missed"] += 1
                        by_label[attack]["missed"] += 1
                else:
                    if pred_anom:
                        by_family[fam]["detected"] += 1
                        by_label[attack]["detected"] += 1
                    else:
                        by_family[fam]["missed"] += 1
                        by_label[attack]["missed"] += 1
            log(f"  {tag} chunk {idx}: rows={n} anomalies={n_anom}")

    # detection rate = detected/support for attack families
    family_table = []
    for fam in ["DoS", "Probe", "R2L", "U2R"]:
        s = by_family[fam]
        rate = (s["detected"] / s["support"]) if s["support"] else None
        family_table.append(
            {
                "family": fam,
                "support": s["support"],
                "detected": s["detected"],
                "missed": s["missed"],
                "detection_rate": rate,
            }
        )
    normal = by_family["Normal"]
    attacks_support = sum(by_family[f]["support"] for f in ["DoS", "Probe", "R2L", "U2R"])
    attacks_detected = sum(by_family[f]["detected"] for f in ["DoS", "Probe", "R2L", "U2R"])

    label_table = []
    for label, s in sorted(by_label.items(), key=lambda kv: (-kv[1]["support"], kv[0])):
        rate = (s["detected"] / s["support"]) if s["support"] else None
        label_table.append(
            {
                "attack_type": label,
                "family": s["family"],
                "support": s["support"],
                "detected": s["detected"],
                "missed": s["missed"],
                "detection_rate": rate,
            }
        )

    summary = {
        "model_id": model_id,
        "tag": tag,
        "dataset": "kddtest",
        "n_rows": n,
        "predicted_anomaly": n_anom,
        "predicted_normal": n - n_anom,
        "anomaly_rate": n_anom / n if n else None,
        "predictions_csv": str(out_csv),
        "family_detection": family_table,
        "normal": {
            "support": normal["support"],
            "correct_normal": normal["detected"],
            "false_positive": normal["missed"],
            "true_negative_rate": (
                normal["detected"] / normal["support"] if normal["support"] else None
            ),
        },
        "all_attacks": {
            "support": attacks_support,
            "detected": attacks_detected,
            "missed": attacks_support - attacks_detected,
            "detection_rate": (
                attacks_detected / attacks_support if attacks_support else None
            ),
        },
        "by_attack_type": label_table,
        "family_map_notes": "NSL-KDD standard taxonomy DoS/Probe/R2L/U2R",
    }
    path = ART / f"family_detection_kddtest_{tag}.json"
    path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"WROTE {out_csv} bytes={out_csv.stat().st_size}")
    log(f"WROTE {path}")
    for row in family_table:
        log(
            f"  {tag} {row['family']}: detected={row['detected']}/{row['support']} "
            f"rate={(row['detection_rate'] or 0):.4f}"
        )
    return summary


def main() -> None:
    ART.mkdir(parents=True, exist_ok=True)
    if not CSV.exists():
        raise SystemExit(f"missing {CSV}")
    login()
    results = {}
    for mid, tag in MODELS:
        results[tag] = export_model(mid, tag)
        log(f"STAGE_DONE family_{tag}")

    # comparison table like thesis Table 8.9
    comparison = {
        "dataset": "kddtest",
        "definition": {
            "detected": "attack family row predicted as anomaly",
            "support": "number of rows with that family in kddtest",
            "detection_rate": "detected / support",
        },
        "models": {},
        "table_8_9": [],
    }
    for fam in ["DoS", "Probe", "R2L", "U2R"]:
        row = {"family": fam}
        for tag in ("isolation_forest", "one_class_svm"):
            fam_rows = {
                r["family"]: r for r in results[tag]["family_detection"]
            }
            fr = fam_rows[fam]
            row[f"{tag}_support"] = fr["support"]
            row[f"{tag}_detected"] = fr["detected"]
            row[f"{tag}_missed"] = fr["missed"]
            row[f"{tag}_detection_rate"] = fr["detection_rate"]
        # support identical across models
        row["support"] = row["isolation_forest_support"]
        comparison["table_8_9"].append(row)
        comparison["models"] = {
            tag: {
                "model_id": results[tag]["model_id"],
                "all_attacks": results[tag]["all_attacks"],
                "normal": results[tag]["normal"],
                "predictions_csv": results[tag]["predictions_csv"],
            }
            for tag in ("isolation_forest", "one_class_svm")
        }

    out = ART / "family_detection_kddtest_summary.json"
    out.write_text(json.dumps(comparison, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"WROTE {out}")
    log("FAMILY_EVAL_COMPLETE")


if __name__ == "__main__":
    main()
