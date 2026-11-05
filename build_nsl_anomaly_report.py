#!/usr/bin/env python3
"""Detailed MD+PDF report for NSL only-train anomaly pipeline."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fpdf import FPDF

MADRID = ZoneInfo("Europe/Madrid")
BASE = Path("/workspace/reports/nsl_anomaly_nov5")
OUT_MD = BASE / "NSL_only_train_anomaly_report.md"
OUT_PDF = Path("/opt/cursor/artifacts/NSL_only_train_anomaly_report.pdf")
OUT_PDF_WS = BASE / "NSL_only_train_anomaly_report.pdf"


def load(name: str):
    p = BASE / name
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def fmt(x, nd=4):
    if x is None:
        return "n/a"
    try:
        return f"{float(x):.{nd}f}"
    except Exception:
        return str(x)


def fmt_dur(s):
    if s is None:
        return "n/a"
    s = float(s)
    if s < 60:
        return f"{s:.1f}s"
    m, sec = divmod(s, 60)
    if m < 60:
        return f"{int(m)}m {sec:.0f}s"
    h, m = divmod(int(m), 60)
    return f"{h}h {m}m"


def build_md() -> str:
    before = load("before_filter_stats.json") or {}
    after = load("after_preprocess_stats.json") or {}
    split = load("split_stats.json") or {}
    transform = load("transform_result.json") or {}
    iso = load("train_isolation_forest.json") or {}
    ocs = load("train_one_class_svm.json") or {}
    save_iso = load("save_isolation_forest.json") or {}
    save_ocs = load("save_one_class_svm.json") or {}
    pred_iso = load("predict_full_isolation_forest.json") or {}
    pred_ocs = load("predict_full_one_class_svm.json") or {}

    lines: list[str] = []
    lines.append("# Rapport détaillé — NSL-KDD only-train · détection d'anomalies\n")
    lines.append("## 1. Contexte\n")
    lines.append("| Champ | Valeur |")
    lines.append("|---|---|")
    lines.append("| Plateforme | http://46.62.212.226 |")
    lines.append("| Utilisateur | `cc@cc.cc` |")
    lines.append("| Source predefined | `nslkdd_only_train_part` (125973 lignes) |")
    lines.append("| Dataset entraînement | `nsl_only_train_anom_nov5` |")
    lines.append("| Dataset CSV (Use Model) | `nsl_only_train_csv_nov5` (copie brute non modifiée) |")
    lines.append("| Target | `attack_type` |")
    lines.append("| Algorithmes | Isolation Forest + One-Class SVM |")
    lines.append(f"| Date | {datetime.now(MADRID).strftime('%Y-%m-%d %H:%M %Z')} |")
    lines.append("")

    lines.append("## 2. Pipeline effectué (étape par étape)\n")
    lines.append("1. Dupliquer le dataset predefined **only train** → `nsl_only_train_anom_nov5`")
    lines.append("2. Choisir / sauver la target **`attack_type`**")
    lines.append("3. Group Optimizer : supprimer toutes les lignes sauf **`normal`** (58630 lignes attaque supprimées)")
    lines.append("4. Supprimer la colonne **`difficulty_level`**")
    lines.append("5. Continue (checkpoint)")
    lines.append("6. Split **80/20 random** (seed=42) — stratifié impossible car 1 seule classe après filtre")
    lines.append("7. Transformation (identique au run classification précédent) :")
    lines.append("   - Label Encoding sur `attack_type`")
    lines.append("   - One-Hot sur `protocol_type`, `service`, `flag`")
    lines.append("8. Entraîner **Isolation Forest** puis **One-Class SVM**, sauvegarder les 2 modèles")
    lines.append("9. Nouvelle copie predefined unmodified → `nsl_only_train_csv_nov5`")
    lines.append("10. Télécharger CSV tel quel (`/api/download-dataset-csv`)")
    lines.append("11. Use Model → predict-batch sur le CSV avec les 2 modèles sauvegardés")
    lines.append("")

    lines.append("## 3. Stats AVANT preprocessing\n")
    tgt = (before.get("target") or {})
    lines.append(f"- Target metadata: `{json.dumps(tgt, ensure_ascii=False)}`")
    vc = before.get("attack_type_values") or {}
    if isinstance(vc, dict) and vc.get("value_counts"):
        lines.append(f"- Distinct attack_type: **{vc.get('total_distinct')}** / rows **{vc.get('total_rows')}**")
        lines.append("")
        lines.append("| Valeur | Count |")
        lines.append("|---|---:|")
        for it in vc.get("value_counts") or []:
            lines.append(f"| {it.get('value')} | {it.get('count')} |")
    lines.append("")
    lines.append("Filtre appliqué ensuite : garder uniquement `attack_type = normal`.")
    lines.append("")

    lines.append("## 4. Split & transformation\n")
    lines.append("### Split\n")
    lines.append("| Champ | Valeur |")
    lines.append("|---|---|")
    lines.append("| Méthode | random 80/20, seed=42 |")
    lines.append(f"| Train | **{split.get('train_count')}** |")
    lines.append(f"| Test | **{split.get('test_count')}** |")
    lines.append(f"| Total | **{split.get('total_rows')}** |")
    lines.append("| Contenu | 100% `normal` (après filtre) |")
    lines.append("")
    lines.append("### Transformations\n")
    for t in transform.get("transformations") or []:
        lines.append(f"- {t}")
    cols = transform.get("new_columns") or []
    lines.append(f"- Colonnes après transform : **{len(cols)}**")
    after_split = (after.get("split") or {})
    lines.append(f"- Split stats post-transform : train={after_split.get('train_count')} test={after_split.get('test_count')}")
    lines.append("")

    def section_algo(title: str, train_obj: dict, save_obj: dict, pred_obj: dict):
        lines.append(f"## {title}\n")
        m = ((train_obj.get("result") or {}).get("metrics") or {})
        params = m.get("params") or train_obj.get("hyperparameters") or {}
        lines.append("### Hyperparamètres\n")
        lines.append("| Paramètre | Valeur |")
        lines.append("|---|---|")
        for k, v in params.items():
            lines.append(f"| `{k}` | `{v}` |")
        lines.append("")
        lines.append("### Identité training\n")
        lines.append("| Champ | Valeur |")
        lines.append("|---|---|")
        lines.append(f"| Training ID | `{train_obj.get('training_id')}` |")
        lines.append(f"| Durée | {fmt_dur(train_obj.get('duration_seconds'))} |")
        lines.append(f"| Finished | {train_obj.get('finished_at')} |")
        lines.append(f"| n_features | {m.get('n_features')} |")
        lines.append(f"| target_excluded | `{m.get('target_excluded')}` |")
        lines.append(f"| anti_leakage | {m.get('anti_leakage')} |")
        lines.append("")
        lines.append("### Résultats train / test (données 100% normal)\n")
        lines.append("| Split | n | n_anomalies | anomaly_rate | score_mean | score_min | score_max |")
        lines.append("|---|---:|---:|---:|---:|---:|---:|")
        for split_name in ("train", "test"):
            s = m.get(split_name) or {}
            lines.append(
                f"| {split_name} | {s.get('n_samples')} | {s.get('n_anomalies')} | "
                f"{fmt(s.get('anomaly_rate'))} | {fmt(s.get('score_mean'))} | "
                f"{fmt(s.get('score_min'))} | {fmt(s.get('score_max'))} |"
            )
        lines.append("")
        le = m.get("label_evaluation")
        lines.append("### Évaluation labels (train set)\n")
        if le:
            lines.append("```json")
            lines.append(json.dumps(le, indent=2, ensure_ascii=False, default=str)[:3000])
            lines.append("```\n")
        else:
            lines.append(
                "Non disponible / non pertinente ici : après filtre, train+test ne contiennent que `normal`, "
                "donc pas de classes positives (attaques) pour precision/recall/F1 sur le split interne.\n"
            )
        lines.append("### Sauvegarde modèle\n")
        lines.append("| Champ | Valeur |")
        lines.append("|---|---|")
        lines.append(f"| model_id | `{save_obj.get('model_id')}` |")
        lines.append(f"| model_name | `{save_obj.get('model_name')}` |")
        lines.append(f"| algorithm | `{save_obj.get('algorithm')}` |")
        lines.append(f"| model_type | `{save_obj.get('model_type')}` |")
        lines.append(f"| path | `{save_obj.get('model_path')}` |")
        lines.append(f"| saved_at | {save_obj.get('saved_at')} |")
        lines.append("")
        lines.append("### Use Model — prédiction sur CSV brut (125973 lignes)\n")
        lines.append("| Champ | Valeur |")
        lines.append("|---|---|")
        lines.append(f"| rows_processed | **{pred_obj.get('rows_processed')}** |")
        lines.append(f"| n_anomaly | **{pred_obj.get('n_anomaly')}** |")
        lines.append(f"| n_normal | **{pred_obj.get('n_normal')}** |")
        lines.append(f"| anomaly_rate | **{fmt(pred_obj.get('anomaly_rate'))}** ({fmt(100*(pred_obj.get('anomaly_rate') or 0),1)}%) |")
        lines.append(f"| score_min / mean / max | {fmt(pred_obj.get('score_min'))} / {fmt(pred_obj.get('score_mean'))} / {fmt(pred_obj.get('score_max'))} |")
        lines.append(f"| pipeline_applied | {pred_obj.get('pipeline_applied')} |")
        lines.append(f"| target_column (display only) | `{pred_obj.get('target_column')}` |")
        lines.append(f"| unexpected columns ignored | `{pred_obj.get('unexpected_columns_ignored')}` |")
        lines.append(f"| chunks | {pred_obj.get('chunks')} × 4000 |")
        lines.append("")
        lines.append(
            "Note Use Model : le CSV contient encore toutes les classes d'attaque + `difficulty_level`. "
            "Le pipeline sauvegardé (label/one-hot) est réappliqué ; `difficulty_level` est ignoré ; "
            "`attack_type` n'est **pas** utilisé comme feature.\n"
        )

    section_algo(
        "5. Isolation Forest",
        iso,
        save_iso,
        pred_iso,
    )
    section_algo(
        "6. One-Class SVM",
        ocs,
        save_ocs,
        pred_ocs,
    )

    lines.append("## 7. Synthèse comparative\n")
    lines.append("| Modèle | Durée train | Contam./nu | Anomaly rate (train normals) | Anomaly rate (CSV full) | Anomalies CSV |")
    lines.append("|---|---:|---:|---:|---:|---:|")
    iso_m = ((iso.get("result") or {}).get("metrics") or {})
    ocs_m = ((ocs.get("result") or {}).get("metrics") or {})
    lines.append(
        f"| Isolation Forest | {fmt_dur(iso.get('duration_seconds'))} | contamination=0.05 | "
        f"{fmt((iso_m.get('train') or {}).get('anomaly_rate'))} | "
        f"{fmt(pred_iso.get('anomaly_rate'))} | {pred_iso.get('n_anomaly')} |"
    )
    lines.append(
        f"| One-Class SVM | {fmt_dur(ocs.get('duration_seconds'))} | nu=0.05 | "
        f"{fmt((ocs_m.get('train') or {}).get('anomaly_rate'))} | "
        f"{fmt(pred_ocs.get('anomaly_rate'))} | {pred_ocs.get('n_anomaly')} |"
    )
    lines.append("")
    lines.append("## 8. Interprétation\n")
    lines.append(
        "- Les modèles sont entraînés **uniquement sur du trafic normal** (one-class / anomaly setting)."
    )
    lines.append(
        "- Sur le split interne (aussi 100% normal), le taux d'anomalies ≈ contamination/nu (~5%) : "
        "ce sont des faux positifs attendus sur le profil normal."
    )
    lines.append(
        "- Sur le CSV complet (normal + attaques), le taux d'anomalies monte fortement "
        f"(IF ≈ {fmt(100*(pred_iso.get('anomaly_rate') or 0),1)}%, "
        f"OCSVM ≈ {fmt(100*(pred_ocs.get('anomaly_rate') or 0),1)}%), "
        "ce qui est cohérent avec la présence d'attaques dans le fichier brut."
    )
    lines.append(
        "- OCSVM est plus agressif que Isolation Forest sur ce CSV (plus d'anomalies déclarées)."
    )
    lines.append("")
    lines.append(f"*Généré le {datetime.now(MADRID).strftime('%Y-%m-%d %H:%M:%S %Z')}*\n")
    return "\n".join(lines)


class PDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 11)
        self.cell(0, 7, "NSL only-train anomaly detection report", ln=1)
        self.set_font("Helvetica", "", 8)
        self.cell(0, 5, "nsl_only_train_anom_nov5 / IsolationForest + OneClassSVM / cc@cc.cc", ln=1)
        self.ln(1)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 8, f"page {self.page_no()}", align="C")


def md_to_pdf(md: str, path: Path) -> None:
    pdf = PDF()
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    pdf.set_font("Courier", size=7.5)
    for line in md.splitlines():
        safe = (
            line.replace("**", "")
            .replace("`", "")
            .encode("latin-1", "replace")
            .decode("latin-1")
        )
        pdf.multi_cell(0, 3.6, safe)
    path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(path))


def main():
    BASE.mkdir(parents=True, exist_ok=True)
    md = build_md()
    OUT_MD.write_text(md, encoding="utf-8")
    print("Wrote", OUT_MD, "chars", len(md))
    md_to_pdf(md, OUT_PDF)
    md_to_pdf(md, OUT_PDF_WS)
    print("Wrote", OUT_PDF)
    print("Wrote", OUT_PDF_WS)


if __name__ == "__main__":
    main()
