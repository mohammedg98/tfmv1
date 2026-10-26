#!/usr/bin/env python3
"""Build a detailed PDF report for the tuandromd pipeline run."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fpdf import FPDF

MADRID = ZoneInfo("Europe/Madrid")
ROOT = Path("/workspace/reports/tuandromd_pipeline")
OUT_PDF = Path("/opt/cursor/artifacts/tuandromd_copy_classification_holdout10_report.pdf")
OUT_PDF_COPY = ROOT / "tuandromd_copy_classification_holdout10_report.pdf"
OUT_MD = ROOT / "tuandromd_copy_classification_holdout10_report.md"

ALGO_TITLES = {
    "logistic": "Logistic Regression",
    "knn": "k-Nearest Neighbors (KNN)",
    "lightgbm": "LightGBM",
    "random_forest": "Random Forest",
    "mlp": "Neural Net — MLP (PyTorch)",
    "svm": "Support Vector Machine (SVM)",
}


def to_madrid(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=MADRID)
        return dt.astimezone(MADRID).strftime("%Y-%m-%d %H:%M:%S %Z")
    except Exception:
        return str(iso)


def fmt(x, nd=4):
    if x is None:
        return "—"
    if isinstance(x, float):
        return f"{x:.{nd}f}"
    return str(x)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def find_end(algo: str, tid: str) -> dict:
    matches = list(ROOT.glob(f"*_end_{algo}_{tid}.json"))
    if not matches:
        matches = list(ROOT.glob(f"*_end_*{tid}*.json"))
    return load_json(matches[0]) if matches else {}


def find_start(algo: str, tid: str) -> dict:
    matches = list(ROOT.glob(f"*_start_{algo}_{tid}.json"))
    if not matches:
        matches = list(ROOT.glob(f"*_start_*{tid}*.json"))
    return load_json(matches[0]) if matches else {}


def holdout_stats(metrics: dict) -> tuple[str, float | None, float | None]:
    vr = metrics.get("validation_results") or {}
    if not isinstance(vr, dict):
        # sometimes nested under result differently
        return "—", None, None
    mean = vr.get("mean_score") or vr.get("cv_validation_accuracy_mean") or vr.get("cv_validation_r2_mean")
    std = vr.get("std_score") or vr.get("cv_validation_accuracy_std") or vr.get("cv_validation_r2_std")
    method = vr.get("method") or "Hold-Out Repeated"
    return method, mean, std


FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")


class ReportPDF(FPDF):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.add_font("DejaVu", "", str(FONT_DIR / "DejaVuSans.ttf"))
        self.add_font("DejaVu", "B", str(FONT_DIR / "DejaVuSans-Bold.ttf"))
        self.add_font("DejaVu", "I", str(FONT_DIR / "DejaVuSans.ttf"))
        self.add_font("DejaVuMono", "", str(FONT_DIR / "DejaVuSansMono.ttf"))

    def header(self):
        self.set_font("DejaVu", "I", 8)
        self.set_text_color(90, 90, 90)
        self.cell(0, 6, "tfmv1 — tuandromd pipeline report", align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self):
        self.set_y(-12)
        self.set_font("DejaVu", "I", 8)
        self.set_text_color(90, 90, 90)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="C")

    def h1(self, text: str):
        self.set_font("DejaVu", "B", 16)
        self.set_text_color(20, 20, 20)
        self.multi_cell(0, 9, text)
        self.ln(2)

    def h2(self, text: str):
        self.set_font("DejaVu", "B", 13)
        self.set_text_color(30, 30, 30)
        self.ln(2)
        self.multi_cell(0, 8, text)
        self.ln(1)

    def h3(self, text: str):
        self.set_font("DejaVu", "B", 11)
        self.set_text_color(40, 40, 40)
        self.ln(1)
        self.multi_cell(0, 7, text)
        self.ln(1)

    def body(self, text: str):
        self.set_font("DejaVu", "", 9)
        self.set_text_color(20, 20, 20)
        self.multi_cell(0, 5, text)
        self.ln(1)

    def kv_table(self, rows: list[tuple[str, str]], col1=55):
        usable = self.w - self.l_margin - self.r_margin
        c2 = usable - col1
        for k, v in rows:
            if self.get_y() > self.h - 20:
                self.add_page()
            self.set_x(self.l_margin)
            y0 = self.get_y()
            self.set_font("DejaVu", "B", 8)
            self.multi_cell(col1, 5, str(k), border=0)
            y1 = self.get_y()
            self.set_xy(self.l_margin + col1, y0)
            self.set_font("DejaVu", "", 8)
            self.multi_cell(c2, 5, str(v) if v is not None else "—", border=0)
            y2 = self.get_y()
            self.set_y(max(y1, y2))
            self.set_x(self.l_margin)

    def mono_block(self, lines: list[str], max_lines: int | None = None):
        self.set_x(self.l_margin)
        self.set_font("DejaVuMono", "", 7)
        self.set_text_color(25, 25, 25)
        shown = lines if max_lines is None else lines[:max_lines]
        for line in shown:
            if self.get_y() > self.h - 18:
                self.add_page()
            self.set_x(self.l_margin)
            # Soft-wrap very long log lines for fpdf width
            text = line or ""
            if len(text) > 220:
                text = text[:217] + "..."
            self.multi_cell(self.epw, 3.6, text)
        if max_lines is not None and len(lines) > max_lines:
            self.set_x(self.l_margin)
            self.set_font("DejaVu", "I", 8)
            self.cell(0, 5, f"... ({len(lines) - max_lines} more lines omitted; full logs in artifact)", new_x="LMARGIN", new_y="NEXT")
        self.ln(1)


def build_markdown(artifact: dict, results: list[dict], ends: dict) -> str:
    ds = artifact["dataset_name"]
    acs = artifact["auto_clean_split"]["result"]["report"]
    lines = []
    lines.append("# Rapport détaillé — tuandromd copy (classification)")
    lines.append("")
    lines.append("## Contexte commun")
    lines.append("")
    lines.append("| Champ | Valeur |")
    lines.append("|---|---|")
    lines.append("| Plateforme | http://46.62.212.226 (tfmv1) |")
    lines.append(f"| Utilisateur | `{artifact['user']}` |")
    lines.append(f"| Dataset | `{ds}` (copie de predefined `tuandromd`) |")
    lines.append("| Cible | `Label` (malware / goodware ; « normal » = goodware dans ce dataset) |")
    lines.append(f"| Split plateforme | train **{acs['final']['train_rows']}** / test **{acs['final']['test_rows']}** / total **{acs['final']['rows']}** |")
    lines.append("| Validation | **Hold-out répété × 10**, test_size interne = 0.2 |")
    lines.append("| Features finales | ~199 colonnes numériques (booléennes 0/1) |")
    lines.append(f"| Date du run | {artifact.get('started_at_madrid')} → {artifact.get('finished_at_madrid')} |")
    lines.append("")
    lines.append("### Tableau récapitulatif")
    lines.append("")
    lines.append("| # | Algorithme | Acc. holdout mean±std | Acc. test | Precision | Recall | F1 | ROC-AUC | Durée |")
    lines.append("|---:|---|---:|---:|---:|---:|---:|---:|---:|")
    for i, r in enumerate(results, 1):
        algo = r["algorithm"]
        m = (r.get("result") or {}).get("metrics") or {}
        _, mean, std = holdout_stats(m)
        hold = f"{fmt(mean)}±{fmt(std)}" if mean is not None else "—"
        lines.append(
            f"| {i} | {ALGO_TITLES.get(algo, algo)} | {hold} | {fmt(m.get('accuracy'))} | "
            f"{fmt(m.get('precision'))} | {fmt(m.get('recall'))} | {fmt(m.get('f1'))} | "
            f"{fmt(m.get('roc_auc'))} | {fmt(r.get('duration_seconds'), 1)}s |"
        )
    lines.append("")
    return "\n".join(lines)


def main():
    artifact = load_json(ROOT / "pipeline_artifact.json")
    results = load_json(ROOT / "final_results.json")
    acs_rep = artifact["auto_clean_split"]["result"]["report"]
    at_rep = artifact["auto_transform"]["result"]["report"]
    ds = artifact["dataset_name"]

    ends = {}
    starts = {}
    for r in results:
        algo = r["algorithm"]
        tid = r["training_id"]
        ends[algo] = find_end(algo, tid)
        starts[algo] = find_start(algo, tid)

    OUT_MD.write_text(build_markdown(artifact, results, ends), encoding="utf-8")

    pdf = ReportPDF(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.h1("Rapport détaillé — tuandromd copy (classification)")
    pdf.body(
        "Pipeline live tfmv1: login SSH/API, libération d'un slot dataset, "
        "duplication du predefined tuandromd, cible Label, suppression group-optimizer "
        "des lignes ni malware ni goodware (normal), auto-clean-split, auto-transform, "
        "entraînement de tous les algorithmes de classification en hold-out ×10, "
        "avec documentation complète des logs, transformations, hyperparamètres, MV et résultats."
    )

    pdf.h2("1. Contexte & identite du run")
    pdf.kv_table(
        [
            ("Plateforme", "http://46.62.212.226 (tfmv1)"),
            ("Utilisateur", artifact["user"]),
            ("User ID", artifact["user_id"]),
            ("Predefined source", artifact["predefined"]),
            ("Dataset copie", ds),
            ("Colonne cible", artifact["target_column"]),
            ("Labels conserves", ", ".join(artifact["keep_labels"]) + " (goodware = benign/normal)"),
            ("Validation", f"{artifact['validation']} x {artifact['n_repetitions']}"),
            ("Debut (Madrid)", artifact.get("started_at_madrid")),
            ("Fin (Madrid)", artifact.get("finished_at_madrid")),
            ("Debut (UTC)", artifact.get("started_at_utc")),
            ("Fin (UTC)", artifact.get("finished_at_utc")),
        ]
    )

    pdf.h2("2. Gestion de la limite datasets (max 10)")
    pdf.kv_table(
        [
            ("Limite avant", json.dumps(artifact.get("limit_before"))),
            ("Datasets supprimes", json.dumps(artifact.get("deleted_datasets"), default=str)[:500]),
            ("Limite apres delete", json.dumps(artifact.get("limit_after_delete"))),
        ]
    )
    pdf.body(
        "Compte a 10/10. Suppression du plus ancien dataset principal (hors _backup/_reset/_numerized): "
        "hfj (cree 2026-10-08). Ensuite remaining=1, duplication autorisee."
    )

    pdf.h2("3. Duplication predefined tuandromd")
    pdf.kv_table(
        [
            ("original_table_name", "tuandromd"),
            ("new_dataset_name", ds),
            ("API", "POST /api/duplicate-predefined-dataset"),
            ("Reponse", json.dumps(artifact.get("duplicate_response"), default=str)[:600]),
        ]
    )

    pdf.h2("4. Target column")
    pdf.kv_table(
        [
            ("API", "POST /api/save-target-column"),
            ("dataset_name", ds),
            ("target_column", "Label"),
            ("Note", "Le dataset n'a pas de colonne Class; la cible reelle est Label."),
            ("Reponse", json.dumps(artifact.get("save_target", {}).get("response"), default=str)),
        ]
    )

    pdf.h2("5. Group Optimizer — delete-rows (ni malware ni goodware/normal)")
    pdf.body(
        "Distribution initiale Label: malware=3565, goodware=899, [Empty]=1. "
        "Une seule ligne n'etait ni malware ni goodware (equivalent normal/benign). "
        "Suppression via POST /api/delete-rows (meme payload que Group Optimizer UI)."
    )
    pdf.kv_table(
        [
            ("values_to_delete", json.dumps(artifact.get("values_to_delete"))),
            ("deleted_rows", str(artifact.get("delete_rows", {}).get("response", {}).get("deleted_rows"))),
            ("Label apres", "malware=3565, goodware=899 (total 4464)"),
        ]
    )

    pdf.h2("6. Auto Clean Split — rapport & logs")
    pdf.kv_table(
        [
            ("API", "POST /api/auto-clean-split/start (remove_duplicates=true)"),
            ("Job ID", artifact["auto_clean_split"]["job_id"]),
            ("Status", artifact["auto_clean_split"]["status"]),
            ("Original", f"{acs_rep['original']['rows']} rows x {acs_rep['original']['columns']} cols, target={acs_rep['original']['target']}"),
            ("Constant columns removed", str(len(acs_rep["removed"]["constant_columns"]))),
            ("Empty columns", str(acs_rep["removed"]["empty_columns"])),
            ("High-missing columns", str(acs_rep["removed"]["high_missing_columns"])),
            ("Empty rows", str(acs_rep["removed"]["empty_rows"])),
            ("High-missing rows", str(acs_rep["removed"]["high_missing_rows"])),
            ("Duplicate rows removed", str(acs_rep["removed"]["duplicate_rows"])),
            ("Target missing rows", str(acs_rep["removed"]["target_missing_rows"])),
            ("Split", json.dumps(acs_rep["split"])),
            ("Imputation (MV)", json.dumps(acs_rep["imputation"])),
            ("Balance", json.dumps(acs_rep["balance"])),
            ("Validation flags", json.dumps(acs_rep["validation"])),
            ("Final sizes", json.dumps(acs_rep["final"])),
            ("Warnings", json.dumps(acs_rep.get("warnings"), ensure_ascii=False)),
        ]
    )
    pdf.h3("6.1 Decision d'equilibrage (train)")
    bal = acs_rep["balance"]
    pdf.body(
        f"Ratio majority/minority={fmt(bal['ratio'],3)}, n_classes={bal['n_classes']}, "
        f"n_train={bal['n_train']}, n_min={bal['n_min']}, minority_share={fmt(bal['minority_share'],3)}. "
        f"Seuil under-share={bal['under_share_threshold']}, post_under_size={bal['post_under_size']}. "
        f"Methode choisie: {bal['method']} (applied={bal['applied']}, reason={bal['reason']}). "
        "Regle: undersampling si minority>=0.5/k ET k*n_min>=1000; sinon oversampling. "
        "Ici post_under trop petit (210 < 1000) => oversampling. "
        "Train apres resample: 850 rows; test non resampe: 132."
    )
    pdf.h3("6.2 Colonnes constantes supprimees (42)")
    pdf.body(", ".join(acs_rep["removed"]["constant_columns"]))
    pdf.h3("6.3 Logs auto-clean-split (complets)")
    pdf.mono_block(artifact["auto_clean_split"]["logs"])

    pdf.add_page()
    pdf.h2("7. Auto Transform — decisions, MV, logs")
    pdf.kv_table(
        [
            ("API", "POST /api/auto-transform/start"),
            ("Job ID", artifact["auto_transform"]["job_id"]),
            ("Status", artifact["auto_transform"]["status"]),
            ("scaling_strategy", at_rep.get("scaling_strategy")),
            ("date_strategy", at_rep.get("date_strategy")),
            ("kept_date_column", str(at_rep.get("kept_date_column"))),
            ("Transforms applied", json.dumps(at_rep.get("transforms"), default=str)),
            ("Deleted columns", json.dumps(at_rep.get("deleted_columns"))),
            ("Empty rows deleted", str(at_rep.get("empty_rows_deleted"))),
            ("Left unchanged (count)", str(len(at_rep.get("left_unchanged") or []))),
            ("Warnings", json.dumps(at_rep.get("warnings"), ensure_ascii=False)),
        ]
    )
    pdf.h3("7.1 Transformation cible Label")
    pdf.body(
        "Seule transformation appliquee: Label → Binary Encoding (malware/goodware → 0.0/1.0). "
        "Toutes les features boolean deja en 0/1: leave (skip Binary Encoding). "
        "Aucune imputation MV supplementaire (missing train/test features = 0 apres clean). "
        "scaling_strategy=none (defaut UI Auto Transform)."
    )
    pdf.h3("7.2 Decisions par colonne (resume)")
    decisions = at_rep.get("decisions") or []
    action_counts = {}
    for d in decisions:
        key = f"{d.get('action')}/{d.get('method')}"
        action_counts[key] = action_counts.get(key, 0) + 1
    pdf.kv_table([(k, str(v)) for k, v in sorted(action_counts.items())])
    label_dec = next((d for d in decisions if d.get("column") == "Label"), None)
    if label_dec:
        pdf.body("Decision Label: " + json.dumps(label_dec, ensure_ascii=False))
    pdf.h3("7.3 Logs auto-transform (echantillon + fin)")
    at_logs = artifact["auto_transform"]["logs"]
    # show beginning and end to keep PDF readable but still detailed
    head = at_logs[:40]
    tail = at_logs[-40:]
    pdf.mono_block(head + ["..."] + tail)
    pdf.body(f"Total lignes de log auto-transform: {len(at_logs)} (artifact JSON complet).")

    pdf.add_page()
    pdf.h2("8. Entrainements classification — hold-out x10")
    pdf.body(
        "Six algorithmes entraines sequentiellement sur le dataset apres clean+transform. "
        "Validation: Hold-Out Repeated x10 (test_size=0.2 sur le train plateforme). "
        "Metriques finales UI = evaluation sur le test set global (132 lignes)."
    )

    # summary table as text rows
    pdf.h3("8.1 Tableau recapitulatif")
    for i, r in enumerate(results, 1):
        algo = r["algorithm"]
        m = (r.get("result") or {}).get("metrics") or {}
        method, mean, std = holdout_stats(m)
        pdf.body(
            f"{i}. {ALGO_TITLES.get(algo, algo)} | holdout {fmt(mean)}±{fmt(std)} | "
            f"test acc={fmt(m.get('accuracy'))} prec={fmt(m.get('precision'))} "
            f"rec={fmt(m.get('recall'))} f1={fmt(m.get('f1'))} auc={fmt(m.get('roc_auc'))} | "
            f"duree={fmt(r.get('duration_seconds'),1)}s | ok={r.get('ok')}"
        )

    for i, r in enumerate(results, 1):
        algo = r["algorithm"]
        tid = r["training_id"]
        m = (r.get("result") or {}).get("metrics") or {}
        end = ends.get(algo) or {}
        start = starts.get(algo) or {}
        req = (start.get("request") or r.get("payload") or {})
        hp = end.get("hyperparameters") or {}
        val = end.get("validation") or {}
        vr = m.get("validation_results") or (val.get("validation_results") if isinstance(val, dict) else {}) or {}
        method, mean, std = holdout_stats(m)

        pdf.add_page()
        pdf.h2(f"9.{i} {ALGO_TITLES.get(algo, algo)}")
        pdf.h3("Identite & timing")
        pdf.kv_table(
            [
                ("Algorithm", algo),
                ("Training ID", tid),
                ("Dataset", ds),
                ("User ID", artifact["user_id"]),
                ("Status", end.get("status") or ("success" if r.get("ok") else "error")),
                ("Started (UTC)", start.get("started_at") or end.get("started_at")),
                ("Started (Madrid)", to_madrid(start.get("started_at") or end.get("started_at"))),
                ("Finished (UTC)", end.get("finished_at")),
                ("Finished (Madrid)", to_madrid(end.get("finished_at"))),
                ("Duration (logger)", f"{fmt(end.get('duration_seconds'),3)} s"),
                ("Duration (runner)", f"{fmt(r.get('duration_seconds'),3)} s"),
            ]
        )

        pdf.h3("Hyperparametres / request (start log)")
        # flatten request nicely
        req_rows = []
        for k in sorted(req.keys()):
            v = req[k]
            if isinstance(v, (dict, list)):
                v = json.dumps(v, ensure_ascii=False)[:300]
            req_rows.append((k, str(v)))
        pdf.kv_table(req_rows, col1=60)

        pdf.h3("Hyperparametres effectifs (end log)")
        if isinstance(hp, dict):
            hp_flat = []
            for k, v in hp.items():
                if k in ("features_used",):
                    hp_flat.append((k, f"[{len(v)} features]" if isinstance(v, list) else str(v)[:200]))
                elif isinstance(v, (dict, list)):
                    hp_flat.append((k, json.dumps(v, ensure_ascii=False, default=str)[:400]))
                else:
                    hp_flat.append((k, str(v)))
            pdf.kv_table(hp_flat[:40], col1=55)
        else:
            pdf.body(str(hp)[:800])

        pdf.h3("Methode de validation (MV hold-out)")
        pdf.kv_table(
            [
                ("Methode", method),
                ("n_repetitions", str(artifact["n_repetitions"])),
                ("test_size interne", str(vr.get("test_size") if isinstance(vr, dict) else 0.2)),
                ("mean_score", fmt(mean)),
                ("std_score", fmt(std)),
                ("best_repetition", str(vr.get("best_repetition") if isinstance(vr, dict) else "—")),
                ("best_score", fmt(vr.get("best_score") if isinstance(vr, dict) else None)),
                ("cv_train_mean", fmt((vr or {}).get("cv_train_accuracy_mean") or (vr or {}).get("cv_train_r2_mean"))),
                ("cv_train_std", fmt((vr or {}).get("cv_train_accuracy_std") or (vr or {}).get("cv_train_r2_std"))),
            ]
        )
        if isinstance(vr, dict) and vr.get("repetition_details"):
            pdf.h3("Scores par repetition")
            for det in vr["repetition_details"]:
                pdf.body(
                    f"rep {det.get('repetition')}: val={fmt(det.get('score'))} "
                    f"train={fmt(det.get('train_score'))} "
                    f"sizes={det.get('train_size')}/{det.get('validation_size')} "
                    + (f"best_C={det.get('best_C')} " if "best_C" in det else "")
                    + (f"best_iter={det.get('best_iteration')} " if "best_iteration" in det else "")
                )

        pdf.h3("Resultats test set global")
        pdf.kv_table(
            [
                ("accuracy", fmt(m.get("accuracy"))),
                ("precision", fmt(m.get("precision"))),
                ("recall", fmt(m.get("recall"))),
                ("f1", fmt(m.get("f1"))),
                ("roc_auc", fmt(m.get("roc_auc"))),
                ("train_accuracy", fmt(m.get("train_accuracy"))),
                ("log_loss", fmt(m.get("log_loss"))),
                ("n_classes", str(m.get("n_classes"))),
                ("classes", json.dumps(m.get("classes"))),
                ("confusion_matrix", json.dumps(m.get("confusion_matrix"), default=str)[:500]),
            ]
        )
        if m.get("classification_report"):
            pdf.h3("Classification report")
            cr = m["classification_report"]
            if isinstance(cr, dict):
                pdf.body(json.dumps(cr, indent=2, ensure_ascii=False)[:2500])
            else:
                pdf.mono_block(str(cr).splitlines()[:40])

        # top feature importance if present
        fi = m.get("feature_importance")
        if isinstance(fi, dict) and fi:
            items = sorted(fi.items(), key=lambda x: abs(float(x[1]) if x[1] is not None else 0), reverse=True)[:15]
            pdf.h3("Top feature importance (15)")
            for name, score in items:
                pdf.body(f"{name}: {fmt(score, 6)}")
        elif isinstance(fi, list) and fi:
            pdf.h3("Top feature importance (15)")
            for item in fi[:15]:
                pdf.body(json.dumps(item, default=str)[:200])

    pdf.add_page()
    pdf.h2("10. Conclusion")
    best = max(results, key=lambda r: (r.get("accuracy") or 0))
    pdf.body(
        f"Meilleure accuracy test: {ALGO_TITLES.get(best['algorithm'], best['algorithm'])} "
        f"= {fmt(best.get('accuracy'))} (F1={fmt(best.get('f1'))}). "
        f"Dataset final: {acs_rep['final']['train_rows']} train / {acs_rep['final']['test_rows']} test, "
        f"{acs_rep['final']['columns']} colonnes. "
        "Tous les algorithmes de classification ont ete entraines avec hold-out x10. "
        "Artifacts JSON complets (logs clean/transform, start/end training) archives sous "
        "backend/training_logs/tuandromd_pipeline/ et reports/tuandromd_pipeline/."
    )
    pdf.h3("Fichiers sources")
    pdf.mono_block(
        [
            "pipeline_artifact.json — etapes + logs clean/transform",
            "final_results.json — resultats complets par algo",
            "run_summary.jsonl / runner.log / console.log",
            "*_start_*.json / *_end_*.json — training_logger",
        ]
    )

    OUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT_PDF))
    OUT_PDF_COPY.write_bytes(OUT_PDF.read_bytes())
    print("PDF", OUT_PDF, "size", OUT_PDF.stat().st_size)
    print("COPY", OUT_PDF_COPY)


if __name__ == "__main__":
    main()
