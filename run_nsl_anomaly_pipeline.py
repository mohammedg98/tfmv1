#!/usr/bin/env python3
"""
NSL only-train → keep normal → split 80/20 → transform → IsolationForest + OneClassSVM
→ save models → second predefined copy → CSV → predict-batch → artifacts for report.
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

BASE = "http://127.0.0.1"
ORIGIN = "http://46.62.212.226"
EMAIL = "cc@cc.cc"
PASSWORD = "qwerqwer"
USER_ID = "6a7649c85389ffb49703be24"
PREDEFINED = "nslkdd_only_train_part"
TRAIN_DS = "nsl_only_train_anom_nov5"
CSV_DS = "nsl_only_train_csv_nov5"
MADRID = ZoneInfo("Europe/Madrid")

OUT = Path("/root/tfmv1/backend/training_logs/nsl_anomaly_pipeline_nov5")
STAGE = OUT / "stages.log"
ART = OUT / "artifacts"
POLL = 4
MAX_WAIT = 2 * 60 * 60

SESSION = requests.Session()
SESSION.headers.update({"Origin": ORIGIN, "Content-Type": "application/json"})


def now() -> str:
    return datetime.now(MADRID).strftime("%Y-%m-%d %H:%M:%S %Z")


def stage(msg: str) -> None:
    line = f"[{now()}] {msg}"
    print(line, flush=True)
    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    with STAGE.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def login() -> None:
    r = SESSION.post(
        f"{BASE}/api/users/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=60,
    )
    r.raise_for_status()
    stage(f"LOGIN ok {r.status_code}")


def api(method: str, path: str, **kwargs):
    timeout = kwargs.pop("timeout", 300)
    return SESSION.request(method, f"{BASE}{path}", timeout=timeout, **kwargs)


def dump(name: str, obj) -> None:
    ART.mkdir(parents=True, exist_ok=True)
    p = ART / name
    p.write_text(json.dumps(obj, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    stage(f"ARTIFACT {p.name}")


def duplicate(src: str, dst: str) -> None:
    stage(f"COPY start {src} → {dst}")
    r = api(
        "POST",
        "/api/duplicate-predefined-dataset",
        json={"original_table_name": src, "new_dataset_name": dst},
        timeout=900,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"duplicate failed: {r.status_code} {r.text[:600]}")
    stage(f"COPY done {r.text[:300]}")


def save_target(bd: str, col: str = "attack_type") -> None:
    stage(f"TARGET set {bd}.{col}")
    r = api(
        "POST",
        "/api/save-target-column",
        json={"dataset_name": bd, "target_column": col},
    )
    if r.status_code >= 400:
        raise RuntimeError(f"save-target failed: {r.status_code} {r.text[:400]}")
    stage(f"TARGET ok {r.text[:200]}")


def list_attack_values(bd: str) -> list[str]:
    # column-value-counts API
    r = api(
        "POST",
        "/api/column-value-counts",
        json={"bdName": bd, "column_name": "attack_type", "page": 0, "page_size": 500},
        timeout=120,
    )
    if r.ok:
        data = r.json()
        vals = []
        for item in data.get("values") or data.get("rows") or data.get("counts") or []:
            if isinstance(item, dict):
                v = item.get("value") or item.get("name") or item.get("key")
                if v is not None and str(v) != "normal":
                    vals.append(str(v))
            elif isinstance(item, (list, tuple)) and item:
                if str(item[0]) != "normal":
                    vals.append(str(item[0]))
        if vals:
            return vals
    # fallback hardcoded from probe (fine-grained KDD labels except normal)
    return [
        "neptune",
        "satan",
        "ipsweep",
        "portsweep",
        "smurf",
        "nmap",
        "back",
        "teardrop",
        "warezclient",
        "pod",
        "guess_passwd",
        "buffer_overflow",
        "warezmaster",
        "land",
        "imap",
        "rootkit",
        "loadmodule",
        "ftp_write",
        "multihop",
        "phf",
        "perl",
        "spy",
    ]


def keep_only_normal(bd: str) -> None:
    vals = list_attack_values(bd)
    stage(f"FILTER keep only normal — deleting {len(vals)} attack labels")
    r = api(
        "POST",
        "/api/delete-rows",
        json={"bdName": bd, "column_name": "attack_type", "values_to_delete": vals},
        timeout=600,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"delete-rows failed: {r.status_code} {r.text[:500]}")
    stage(f"FILTER done {r.text[:300]}")


def delete_columns(bd: str, cols: list[str]) -> None:
    stage(f"DELETE columns {cols}")
    r = api(
        "POST",
        "/api/delete-column",
        json={"originalBdName": bd, "currentBdName": bd, "columnNames": cols},
        timeout=300,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"delete-column failed: {r.status_code} {r.text[:400]}")
    stage(f"DELETE columns done {r.text[:300]}")


def group_continue(bd: str) -> None:
    stage("GROUP continue (stage+checkpoint)")
    api("POST", "/api/update-stage", json={"bdName": bd, "newStage": "data_cleaning"})
    api("POST", "/api/reset-id-column-sequential", json={"bdName": bd, "idColumnName": "id"})
    r = api("POST", "/api/dataset/save-checkpoint", json={"source_db": bd})
    stage(f"GROUP continue done {r.status_code}")


def split_80_20(bd: str) -> None:
    # After only-normal, stratified is impossible (1 class) → random 80/20
    stage("SPLIT random 80/20 (seed=42)")
    r = api(
        "POST",
        "/api/split-data2",
        json={
            "bdName": bd,
            "trainSize": 0.8,
            "splitMethod": "random",
            "useSeed": True,
            "seedValue": 42,
            "balanceClasses": False,
            "targetColumn": "attack_type",
        },
        timeout=600,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"split failed: {r.status_code} {r.text[:500]}")
    stage(f"SPLIT done {r.text[:400]}")
    st = api("GET", "/api/get-split-stats2", params={"bdName": bd, "quick": "false"})
    dump("split_stats.json", st.json() if st.ok else {"error": st.text})


def transform_same(bd: str) -> None:
    stage("TRANSFORM label(attack_type)+onehot(protocol_type,service,flag)")
    gs = api("GET", "/api/get-global-statistics", params={"bdName": bd})
    global_stats = (gs.json() or {}).get("statistics", {}) if gs.ok else {}
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
        json={"bdName": bd, "configurations": configs},
        timeout=900,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"transform failed: {r.status_code} {r.text[:800]}")
    stage(f"TRANSFORM done {r.text[:500]}")
    dump("transform_result.json", r.json())
    for stg in ("data_transformation", "create_model"):
        api("POST", "/api/update-stage", json={"bdName": bd, "newStage": stg})
    api("POST", "/api/dataset/save-checkpoint", json={"source_db": bd})


def tid(algo: str) -> str:
    return f"{algo}_{int(time.time())}_{uuid.uuid4().hex[:8]}"


def poll(training_id: str) -> dict:
    t0 = time.time()
    while True:
        if time.time() - t0 > MAX_WAIT:
            raise TimeoutError(training_id)
        r = api("GET", f"/api/training-status/{training_id}", timeout=60)
        if r.status_code == 404:
            time.sleep(POLL)
            continue
        r.raise_for_status()
        data = r.json()
        if data.get("completed"):
            return data
        elapsed = time.time() - t0
        if int(elapsed) % 60 < POLL:
            stage(f"  … {training_id} running ({elapsed:.0f}s)")
        time.sleep(POLL)


def strip_heavy(result):
    if not isinstance(result, dict):
        return result
    out = dict(result)
    out.pop("model_object", None)
    m = out.get("metrics")
    if isinstance(m, dict):
        mm = dict(m)
        # drop huge arrays
        for k in ("predictions", "scores", "train_predictions", "test_predictions"):
            mm.pop(k, None)
        vr = mm.get("train") or mm.get("test")
        # anomaly metrics often nest train/test with predictions
        for nest in ("train", "test"):
            if isinstance(mm.get(nest), dict):
                nn = dict(mm[nest])
                nn.pop("predictions", None)
                nn.pop("scores", None)
                mm[nest] = nn
        out["metrics"] = mm
    return out


def train_anomaly(algo: str, params: dict) -> dict:
    training_id = tid(algo)
    payload = {
        "numerized_dataset_name": TRAIN_DS,
        "original_dataset_name": TRAIN_DS,
        "algorithm": algo,
        "model_type": "anomaly",
        "training_id": training_id,
        **params,
    }
    stage(f"TRAIN START {algo} tid={training_id}")
    t0 = time.time()
    r = api("POST", "/api/train-anomaly", json=payload, timeout=120)
    stage(f"TRAIN POST {algo} → {r.status_code} {r.text[:250]}")
    if r.status_code >= 400:
        raise RuntimeError(r.text[:500])
    status = poll(training_id)
    dur = time.time() - t0
    err = status.get("error")
    result = strip_heavy(status.get("result"))
    summary = {
        "algorithm": algo,
        "training_id": training_id,
        "ok": err is None and (result or {}).get("status") in (None, "success") or (
            result is not None and err is None
        ),
        "error": err,
        "duration_seconds": dur,
        "finished_at": now(),
        "hyperparameters": params,
        "result": result,
    }
    # ok heuristic: completed without error
    summary["ok"] = err is None and result is not None
    dump(f"train_{algo}.json", summary)
    stage(f"TRAIN DONE {algo} ok={summary['ok']} duration={dur:.1f}s")
    return summary


def save_model(algo: str, training_id: str, feature_names: list, name: str) -> dict:
    stage(f"SAVE MODEL {name} ({algo})")
    payload = {
        "model_name": name,
        "db_name": TRAIN_DS,
        "db_columns": feature_names,
        "training_id": training_id,
        "framework": "sklearn",
        "algorithm": algo,
        "r2_score": None,
        "accuracy_score": None,
    }
    r = api("POST", "/api/save-model", json=payload, timeout=120)
    if r.status_code >= 400:
        raise RuntimeError(f"save-model failed: {r.status_code} {r.text[:500]}")
    data = r.json()
    dump(f"save_{algo}.json", data)
    stage(f"SAVE MODEL done {data}")
    return data


def download_csv(bd: str, dest: Path) -> Path:
    stage(f"CSV download {bd}")
    r = api("GET", "/api/download-dataset-csv", params={"dbName": bd}, timeout=600)
    if r.status_code >= 400:
        raise RuntimeError(f"csv download failed: {r.status_code} {r.text[:400]}")
    dest.write_bytes(r.content)
    stage(f"CSV saved {dest} bytes={dest.stat().st_size}")
    return dest


def predict_batch(model_id, csv_path: Path) -> dict:
    stage(f"USE MODEL predict-batch modelId={model_id} file={csv_path.name}")
    # multipart without forcing JSON content-type
    files = {"file": (csv_path.name, csv_path.read_bytes(), "text/csv")}
    # temporary header without Content-Type so requests sets multipart boundary
    headers = {"Origin": ORIGIN}
    cookies = SESSION.cookies.get_dict()
    r = requests.post(
        f"{BASE}/api/predict-batch",
        params={"modelId": model_id, "decisionThreshold": 0.5, "page": 1, "pageSize": 25},
        files=files,
        headers=headers,
        cookies=cookies,
        timeout=900,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"predict-batch failed: {r.status_code} {r.text[:800]}")
    data = r.json()
    dump(f"predict_batch_model_{model_id}.json", data)
    # download full predictions if token
    token = data.get("download_token")
    if token:
        rr = api("GET", "/api/predict-batch-download", params={"batchId": token}, timeout=900)
        if rr.ok:
            out = ART / f"predictions_model_{model_id}.csv"
            out.write_bytes(rr.content)
            stage(f"PREDICT CSV saved {out} bytes={out.stat().st_size}")
        else:
            stage(f"PREDICT download failed {rr.status_code}")
    stage("USE MODEL done")
    return data


def feature_names_from_result(result: dict) -> list:
    m = (result or {}).get("metrics") or {}
    names = m.get("feature_names") or m.get("features_used") or []
    if isinstance(names, list) and names:
        return [str(x) for x in names]
    # fallback split-info
    r = api("GET", "/api/get-split-info", params={"bdName": TRAIN_DS})
    cols = (r.json() or {}).get("available_columns") or []
    return [c for c in cols if c not in ("id", "split_type", "attack_type")]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    login()

    # 1) Train copy
    duplicate(PREDEFINED, TRAIN_DS)
    save_target(TRAIN_DS, "attack_type")
    stage("STAGE_DONE copy_and_target")

    # before stats snapshot via APIs
    before = {
        "dataset": TRAIN_DS,
        "target": api("GET", "/api/get-target-column2", params={"dbName": TRAIN_DS}).json(),
        "types": api("GET", "/api/analyze-column-types", params={"bdName": TRAIN_DS}).json()
        if True
        else {},
    }
    # attack dist via column-value-counts
    vc = api(
        "POST",
        "/api/column-value-counts",
        json={"bdName": TRAIN_DS, "column_name": "attack_type", "page": 0, "page_size": 500},
    )
    before["attack_type_values"] = vc.json() if vc.ok else vc.text[:500]
    dump("before_filter_stats.json", before)

    keep_only_normal(TRAIN_DS)
    delete_columns(TRAIN_DS, ["difficulty_level"])
    group_continue(TRAIN_DS)
    stage("STAGE_DONE group_filter")

    split_80_20(TRAIN_DS)
    stage("STAGE_DONE split")

    transform_same(TRAIN_DS)
    stage("STAGE_DONE transform")

    after = {
        "split": api("GET", "/api/get-split-stats2", params={"bdName": TRAIN_DS, "quick": "false"}).json(),
        "target": api("GET", "/api/get-target-column2", params={"dbName": TRAIN_DS}).json(),
        "types": api("GET", "/api/analyze-column-types", params={"bdName": TRAIN_DS}).json(),
    }
    dump("after_preprocess_stats.json", after)

    iso_params = {
        "n_estimators": 100,
        "contamination": 0.05,
        "max_samples": "auto",
        "max_features": 1.0,
        "bootstrap": False,
        "random_state": 42,
        "use_scaling": True,
    }
    ocsvm_params = {
        "kernel": "rbf",
        "nu": 0.05,
        "gamma": "scale",
        "degree": 3,
        "coef0": 0.0,
        "random_state": 42,
        "use_scaling": True,
        "train_on_normals_only": False,  # already filtered to normal
    }

    iso = train_anomaly("isolation_forest", iso_params)
    stage("STAGE_DONE train_isolation_forest")
    feats_iso = feature_names_from_result(iso.get("result") or {})
    save_iso = save_model(
        "isolation_forest",
        iso["training_id"],
        feats_iso,
        "nsl_iso_normal_nov5",
    )
    stage("STAGE_DONE save_isolation_forest")

    ocs = train_anomaly("one_class_svm", ocsvm_params)
    stage("STAGE_DONE train_one_class_svm")
    feats_ocs = feature_names_from_result(ocs.get("result") or {})
    save_ocs = save_model(
        "one_class_svm",
        ocs["training_id"],
        feats_ocs,
        "nsl_ocsvm_normal_nov5",
    )
    stage("STAGE_DONE save_one_class_svm")

    # 2) Second predefined copy unmodified + CSV
    duplicate(PREDEFINED, CSV_DS)
    stage("STAGE_DONE copy_for_csv")
    csv_path = download_csv(CSV_DS, ART / f"{CSV_DS}.csv")
    stage("STAGE_DONE csv_download")

    # Prefer isolation forest for use-model demo; also run OCSVM if id available
    models = api("GET", "/api/get-saved-models", params={"userId": USER_ID})
    models_data = models.json() if models.ok else []
    if isinstance(models_data, dict):
        models_data = models_data.get("models") or []
    dump("saved_models_list.json", models_data)

    def find_model(name: str):
        for m in models_data:
            if (m.get("model_name") or "") == name:
                return m
        return None

    iso_m = find_model("nsl_iso_normal_nov5")
    ocs_m = find_model("nsl_ocsvm_normal_nov5")
    preds = {}
    if iso_m:
        preds["isolation_forest"] = predict_batch(iso_m.get("id"), csv_path)
        stage("STAGE_DONE predict_isolation_forest")
    if ocs_m:
        preds["one_class_svm"] = predict_batch(ocs_m.get("id"), csv_path)
        stage("STAGE_DONE predict_one_class_svm")

    final = {
        "train_dataset": TRAIN_DS,
        "csv_dataset": CSV_DS,
        "isolation": {"train": iso, "save": save_iso, "model": iso_m},
        "one_class_svm": {"train": ocs, "save": save_ocs, "model": ocs_m},
        "predictions_summary_keys": {k: list(v.keys()) for k, v in preds.items()},
    }
    dump("final_summary.json", final)
    stage("PIPELINE COMPLETE")


if __name__ == "__main__":
    main()
