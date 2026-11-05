#!/usr/bin/env python3
"""Build MD + PDF report for nsl_kdd_clf_nov5 holdout×5 run."""

from __future__ import annotations

import json
import statistics as st
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fpdf import FPDF

MADRID = ZoneInfo("Europe/Madrid")
LOCAL = Path("/workspace/reports/nsl_kdd_clf_nov5")
OUT_MD = LOCAL / "NSL_KDD_clf_nov5_holdout5_report.md"
OUT_PDF = Path("/opt/cursor/artifacts/NSL_KDD_clf_nov5_holdout5_report.pdf")
OUT_PDF_WS = LOCAL / "NSL_KDD_clf_nov5_holdout5_report.pdf"

# Label codes after encoding (matched by class counts)
LABEL_MAP = {
    "0": "DoS",
    "1": "normal",
    "2": "Probing",
    "3": "R2L",
    "4": "U2R",
}
ALGO_ORDER = ["logistic", "knn", "lightgbm", "random_forest", "mlp", "svm"]
ALGO_LABEL = {
    "logistic": "Logistic Regression",
    "knn": "k-Nearest Neighbors (KNN)",
    "lightgbm": "LightGBM",
    "random_forest": "Random Forest",
    "mlp": "Neural Net — MLP (PyTorch)",
    "svm": "Support Vector Machine (SVM)",
}


def load_json(p: Path):
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return None


def fmt_dur(seconds) -> str:
    if seconds is None:
        return "n/a"
    s = float(seconds)
    if s < 60:
        return f"{s:.1f}s"
    m, sec = divmod(s, 60)
    if m < 60:
        return f"{int(m)}m {sec:.0f}s ({s:.1f}s)"
    h, m = divmod(int(m), 60)
    return f"{h}h {m}m {sec:.0f}s ({s:.1f}s)"


def fmt_f(x, nd=4):
    if x is None:
        return "n/a"
    try:
        return f"{float(x):.{nd}f}"
    except Exception:
        return str(x)


def metrics_of(res: dict) -> dict:
    return ((res.get("result") or {}).get("metrics") or {})


def holdout_acc(metrics: dict) -> str:
    vr = metrics.get("validation_results") or {}
    if not isinstance(vr, dict):
        return "n/a"
    mean = vr.get("mean_score") or vr.get("cv_validation_accuracy_mean")
    std = vr.get("std_score") or vr.get("cv_validation_accuracy_std")
    if mean is not None:
        return f"{float(mean):.4f}±{float(std or 0):.4f}"
    scores = vr.get("scores") or []
    if scores and all(isinstance(x, (int, float)) for x in scores):
        mean = st.mean(scores)
        std = st.pstdev(scores) if len(scores) > 1 else 0.0
        return f"{mean:.4f}±{std:.4f}"
    return "n/a"


def build_md(stats: dict, results: list) -> str:
    before = (stats or {}).get("before_source") or {}
    after = (stats or {}).get("after_working") or {}
    by_algo = {r.get("algorithm"): r for r in results}
    ordered = [by_algo[a] for a in ALGO_ORDER if a in by_algo]

    lines: list[str] = []
    lines.append("# Rapport détaillé — NSL-KDD (`nsl_kdd_clf_nov5`) classification\n")
    lines.append("## Contexte commun\n")
    lines.append("| Champ | Valeur |")
    lines.append("|---|---|")
    lines.append("| Plateforme | http://46.62.212.226 (tfmv1) |")
    lines.append("| Utilisateur | `cc@cc.cc` |")
    lines.append("| Source predefined | `nsl_kdd` |")
    lines.append("| Dataset travail | `nsl_kdd_clf_nov5` |")
    lines.append("| Cible | `attack_type` (label-encodée, 5 classes) |")
    lines.append(
        f"| Split plateforme | train **{before.get('split',{}).get('train')}** / "
        f"test **{before.get('split',{}).get('test')}** / total **{before.get('rows')}** |"
    )
    lines.append("| Validation | **Hold-out répété × 5**, `test_size = 0.2` (interne au train) |")
    lines.append("| Évaluation UI / finale | métriques sur le **test set global** |")
    lines.append(
        f"| Features après transform | ~{after.get('n_columns')} colonnes "
        "(one-hot protocol/service/flag inclus) |"
    )
    lines.append(f"| Date du run | {datetime.now(MADRID).strftime('%d %B %Y %H:%M %Z')} |")
    lines.append("")

    lines.append("### Tableau récapitulatif\n")
    lines.append(
        "| # | Algorithme | Durée | Acc. holdout mean±std | Acc. test | Precision | Recall | F1 | Train acc. |"
    )
    lines.append("|---:|---|---:|---:|---:|---:|---:|---:|---:|")
    for i, res in enumerate(ordered, 1):
        m = metrics_of(res)
        lines.append(
            f"| {i} | {ALGO_LABEL.get(res.get('algorithm'), res.get('algorithm'))} | "
            f"{fmt_dur(res.get('duration_seconds'))} | {holdout_acc(m)} | "
            f"{fmt_f(res.get('accuracy') or m.get('accuracy'))} | "
            f"{fmt_f(res.get('precision') or m.get('precision'))} | "
            f"{fmt_f(res.get('recall') or m.get('recall'))} | "
            f"{fmt_f(res.get('f1') or m.get('f1'))} | "
            f"{fmt_f(m.get('train_accuracy'))} |"
        )
    lines.append("")

    # ---- BEFORE ----
    lines.append("## 1. Stats dataset AVANT preprocessing\n")
    lines.append(f"- Table source: `{before.get('table')}`")
    lines.append(f"- Lignes: **{before.get('rows')}**")
    lines.append(f"- Colonnes: **{before.get('n_columns')}**")
    lines.append(f"- Split: `{json.dumps(before.get('split'))}`")
    lines.append(f"- Target: `{before.get('target')}`")
    lines.append("")
    lines.append("### Distribution target (avant)\n")
    lines.append("| Valeur | Count | % |")
    lines.append("|---|---:|---:|")
    total = float(before.get("rows") or 1)
    for d in before.get("target_distribution") or []:
        pct = 100.0 * d["count"] / total
        lines.append(f"| {d['value']} | {d['count']} | {pct:.2f}% |")
    lines.append("")
    cols = before.get("columns") or []
    if cols:
        lines.append("<details><summary>Liste des colonnes (avant)</summary>\n")
        lines.append("```")
        lines.append(", ".join(cols))
        lines.append("```")
        lines.append("</details>\n")

    # ---- PREPROCESS ----
    lines.append("## 2. Preprocessing effectué\n")
    lines.append("- **Split**: aucune modification (déjà train/test sur le predefined)")
    lines.append("- **Group**: suppression `num_outbound_cmds` (unique = 1 sur train) + `difficulty_level`")
    lines.append("- **Optimize**: update-stage → data_cleaning, reset id, checkpoint")
    lines.append("- **Transform**:")
    lines.append("  - Label Encoding sur `attack_type` (5 catégories)")
    lines.append("  - One-Hot Encoding sur `protocol_type` (3), `service` (70), `flag` (11)")
    lines.append("")

    # ---- AFTER ----
    lines.append("## 3. Stats dataset APRÈS preprocessing\n")
    lines.append(f"- Table: `{after.get('table')}`")
    lines.append(f"- Lignes: **{after.get('rows')}**")
    lines.append(f"- Colonnes: **{after.get('n_columns')}**")
    lines.append(f"- Split: `{json.dumps(after.get('split'))}`")
    lines.append(f"- Target: `{after.get('target')}` (label-encodée)")
    lines.append("")
    lines.append("### Distribution target (après) + mapping\n")
    lines.append("| Code | Label | Count | % |")
    lines.append("|---|---|---:|---:|")
    total_a = float(after.get("rows") or 1)
    for d in after.get("target_distribution") or []:
        code = str(d["value"])
        pct = 100.0 * d["count"] / total_a
        lines.append(f"| {code} | {LABEL_MAP.get(code, '?')} | {d['count']} | {pct:.2f}% |")
    lines.append("")
    cols_a = after.get("columns") or []
    if cols_a:
        lines.append("<details><summary>Liste des colonnes (après)</summary>\n")
        lines.append("```")
        lines.append(", ".join(cols_a))
        lines.append("```")
        lines.append("</details>\n")

    # ---- PER ALGO ----
    lines.append("## 4. Résultats détaillés par algorithme\n")
    for res in ordered:
        algo = res.get("algorithm")
        m = metrics_of(res)
        vr = m.get("validation_results") or {}
        lines.append(f"### {ALGO_LABEL.get(algo, algo)}\n")
        lines.append("#### Identité & timing\n")
        lines.append("| Champ | Valeur |")
        lines.append("|---|---|")
        lines.append(f"| Algorithm | `{algo}` |")
        lines.append(f"| Training ID | `{res.get('training_id')}` |")
        lines.append(f"| Dataset | `{res.get('dataset')}` |")
        lines.append(f"| Status | `{'success' if res.get('ok') else 'failed'}` |")
        lines.append(f"| Finished (Europe/Madrid) | {res.get('finished_at')} |")
        lines.append(f"| Duration | **{fmt_dur(res.get('duration_seconds'))}** |")
        lines.append(f"| Validation | {res.get('validation_method')} × {res.get('n_repetitions')} |")
        if res.get("error"):
            lines.append(f"| Error | {res.get('error')} |")
        lines.append("")

        lines.append("#### Métriques finales (test set global)\n")
        lines.append("| Métrique | Valeur |")
        lines.append("|---|---:|")
        lines.append(f"| Accuracy | {fmt_f(res.get('accuracy') or m.get('accuracy'))} |")
        lines.append(f"| Precision | {fmt_f(res.get('precision') or m.get('precision'))} |")
        lines.append(f"| Recall | {fmt_f(res.get('recall') or m.get('recall'))} |")
        lines.append(f"| F1 | {fmt_f(res.get('f1') or m.get('f1'))} |")
        lines.append(f"| ROC-AUC | {fmt_f(res.get('roc_auc') or m.get('roc_auc'))} |")
        lines.append(f"| Train accuracy | {fmt_f(m.get('train_accuracy'))} |")
        lines.append("")

        lines.append("#### Validation holdout × 5\n")
        lines.append("| Champ | Valeur |")
        lines.append("|---|---|")
        lines.append(f"| Method | {vr.get('method')} |")
        lines.append(f"| n_repetitions | {vr.get('n_repetitions')} |")
        lines.append(f"| test_size | {vr.get('test_size')} |")
        lines.append(f"| mean_score | {fmt_f(vr.get('mean_score'))} |")
        lines.append(f"| std_score | {fmt_f(vr.get('std_score'))} |")
        lines.append(f"| best_repetition | {vr.get('best_repetition')} |")
        lines.append(f"| best_score | {fmt_f(vr.get('best_score'))} |")
        lines.append(
            f"| cv_train_accuracy mean±std | "
            f"{fmt_f(vr.get('cv_train_accuracy_mean'))}±{fmt_f(vr.get('cv_train_accuracy_std'))} |"
        )
        lines.append("")

        scores = vr.get("scores") or []
        if scores:
            lines.append("Scores par répétition:\n")
            lines.append("```")
            lines.append(", ".join(fmt_f(s) for s in scores))
            lines.append("```\n")

        holdout_details = vr.get("holdout_details") or vr.get("repetition_details") or []
        if holdout_details:
            lines.append("Détail des répétitions:\n")
            lines.append("```json")
            dump = json.dumps(holdout_details, indent=2, ensure_ascii=False, default=str)
            lines.append(dump[:8000] + ("\n… truncated …" if len(dump) > 8000 else ""))
            lines.append("```\n")

        cr = m.get("classification_report")
        if cr:
            lines.append("#### Classification report\n")
            lines.append("```json")
            lines.append(json.dumps(cr, indent=2, ensure_ascii=False, default=str)[:8000])
            lines.append("```\n")

        cm = m.get("confusion_matrix")
        if cm is not None:
            lines.append("#### Confusion matrix\n")
            lines.append("```json")
            lines.append(json.dumps(cm, ensure_ascii=False, default=str)[:4000])
            lines.append("```\n")

        # Top FI if present
        fi = m.get("feature_importance")
        if isinstance(fi, dict) and fi:
            top = sorted(fi.items(), key=lambda kv: abs(float(kv[1] or 0)), reverse=True)[:20]
            lines.append("#### Top 20 feature importance\n")
            lines.append("| Feature | Score |")
            lines.append("|---|---:|")
            for name, score in top:
                lines.append(f"| {name} | {fmt_f(score, 6)} |")
            lines.append("")

    lines.append("---\n")
    lines.append(f"*Généré le {datetime.now(MADRID).strftime('%Y-%m-%d %H:%M:%S %Z')}*\n")
    return "\n".join(lines)


class PDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 11)
        self.cell(0, 7, "NSL-KDD classification report (holdout x5)", ln=1)
        self.set_font("Helvetica", "", 8)
        self.cell(0, 5, "nsl_kdd_clf_nov5 / cc@cc.cc / 46.62.212.226", ln=1)
        self.ln(1)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 8, f"page {self.page_no()}", align="C")


def md_to_pdf(md_text: str, pdf_path: Path) -> None:
    pdf = PDF()
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    pdf.set_font("Courier", size=7.5)
    for line in md_text.splitlines():
        # strip markdown-ish noise for readability in PDF
        safe = (
            line.replace("**", "")
            .replace("`", "")
            .replace("|---|---|", "-" * 40)
            .replace("|---:|", "|" )
        )
        safe = safe.encode("latin-1", "replace").decode("latin-1")
        pdf.multi_cell(0, 3.6, safe)
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(pdf_path))


def main():
    stats = load_json(LOCAL / "sql_stats.json") or {}
    results = load_json(LOCAL / "final_results.json") or []
    if not results:
        summary = LOCAL / "run_summary.jsonl"
        if summary.exists():
            results = [
                json.loads(l) for l in summary.read_text(encoding="utf-8").splitlines() if l.strip()
            ]

    LOCAL.mkdir(parents=True, exist_ok=True)
    md = build_md(stats, results)
    OUT_MD.write_text(md, encoding="utf-8")
    print("Wrote", OUT_MD, "chars", len(md))
    md_to_pdf(md, OUT_PDF)
    print("Wrote", OUT_PDF)
    md_to_pdf(md, OUT_PDF_WS)
    print("Wrote", OUT_PDF_WS)


if __name__ == "__main__":
    main()
