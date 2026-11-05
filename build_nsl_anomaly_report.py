#!/usr/bin/env python3
"""Detailed MD+PDF report for NSL only-train anomaly pipeline (Use Model = kddtest)."""

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

    # Prefer kddtest Use Model results; fall back to legacy train-CSV artifacts if needed
    kdd_stats = load("kddtest_stats.json") or {}
    pred_iso = load("predict_kddtest_isolation_forest.json") or {}
    pred_ocs = load("predict_kddtest_one_class_svm.json") or {}
    eval_iso = load("eval_kddtest_isolation_forest.json") or {}
    eval_ocs = load("eval_kddtest_one_class_svm.json") or {}
    eval_sum = load("eval_kddtest_summary.json") or {}
    if not eval_iso and isinstance(eval_sum.get("isolation_forest"), dict):
        eval_iso = eval_sum["isolation_forest"]
    if not eval_ocs and isinstance(eval_sum.get("one_class_svm"), dict):
        eval_ocs = eval_sum["one_class_svm"]
    if not pred_iso and eval_iso:
        pred_iso = {
            "rows_processed": eval_iso.get("n"),
            "n_anomaly": eval_iso.get("predicted_anomaly"),
            "n_normal": eval_iso.get("predicted_normal"),
            "anomaly_rate": eval_iso.get("anomaly_rate"),
            "score_min": eval_iso.get("score_min"),
            "score_mean": eval_iso.get("score_mean"),
            "score_max": eval_iso.get("score_max"),
            "pipeline_applied": True,
            "target_column": "attack_type",
            "unexpected_columns_ignored": ["difficulty_level"],
            "chunks": eval_iso.get("chunks"),
        }
    if not pred_ocs and eval_ocs:
        pred_ocs = {
            "rows_processed": eval_ocs.get("n"),
            "n_anomaly": eval_ocs.get("predicted_anomaly"),
            "n_normal": eval_ocs.get("predicted_normal"),
            "anomaly_rate": eval_ocs.get("anomaly_rate"),
            "score_min": eval_ocs.get("score_min"),
            "score_mean": eval_ocs.get("score_mean"),
            "score_max": eval_ocs.get("score_max"),
            "pipeline_applied": True,
            "target_column": "attack_type",
            "unexpected_columns_ignored": ["difficulty_level"],
            "chunks": eval_ocs.get("chunks"),
        }

    kdd_n = kdd_stats.get("n_rows") or eval_iso.get("n") or eval_ocs.get("n") or 22544
    kdd_normal = kdd_stats.get("n_normal")
    kdd_attack = kdd_stats.get("n_attack")

    lines: list[str] = []
    lines.append("# Rapport détaillé — NSL-KDD only-train · détection d'anomalies\n")
    lines.append("## 1. Contexte\n")
    lines.append("| Champ | Valeur |")
    lines.append("|---|---|")
    lines.append("| Plateforme | http://46.62.212.226 |")
    lines.append("| Utilisateur | `cc@cc.cc` |")
    lines.append("| Source predefined (train) | `nslkdd_only_train_part` (125973 lignes) |")
    lines.append("| Dataset entraînement | `nsl_only_train_anom_nov5` (normals only) |")
    lines.append(
        f"| Dataset Use Model | **`kddtest`** (My Datasets, **{kdd_n}** lignes — partie test) |"
    )
    lines.append("| Target | `attack_type` |")
    lines.append("| Algorithmes | Isolation Forest + One-Class SVM |")
    lines.append("| Éval ground-truth | attaque (`attack_type != normal`) vs anomalie prédite |")
    lines.append(f"| Date | {datetime.now(MADRID).strftime('%Y-%m-%d %H:%M %Z')} |")
    lines.append("")

    lines.append("## 2. Pipeline effectué (étape par étape)\n")
    lines.append("1. Dupliquer le dataset predefined **only train** → `nsl_only_train_anom_nov5`")
    lines.append("2. Choisir / sauver la target **`attack_type`**")
    lines.append("3. Group Optimizer : supprimer toutes les lignes sauf **`normal`** (58630 lignes attaque supprimées)")
    lines.append("4. Supprimer la colonne **`difficulty_level`**")
    lines.append("5. Continue (checkpoint)")
    lines.append("6. Split **80/20 random** (seed=42) — stratifié impossible car 1 seule classe après filtre")
    lines.append("7. Transformation :")
    lines.append("   - Label Encoding sur `attack_type`")
    lines.append("   - One-Hot sur `protocol_type`, `service`, `flag`")
    lines.append("8. Entraîner **Isolation Forest** puis **One-Class SVM**, sauvegarder les 2 modèles")
    lines.append("9. Prendre le dataset My Datasets **`kddtest`** (partie test, non utilisé pour l'entraînement)")
    lines.append("10. Télécharger CSV tel quel (`/api/download-dataset-csv?dbName=kddtest`)")
    lines.append("11. Use Model → predict-batch sur **kddtest** avec les 2 modèles sauvegardés")
    lines.append(
        "12. Évaluation ground-truth sur **kddtest** : anomalie prédite vs "
        "`attack_type != normal` → accuracy / precision / recall / F1 / etc."
    )
    lines.append("")

    lines.append("## 3. Stats AVANT preprocessing (dataset d'entraînement)\n")
    tgt = (before.get("target") or {})
    lines.append(f"- Target metadata: `{json.dumps(tgt, ensure_ascii=False)}`")
    vc = before.get("attack_type_values") or {}
    if isinstance(vc, dict) and vc.get("value_counts"):
        lines.append(
            f"- Distinct attack_type: **{vc.get('total_distinct')}** / rows **{vc.get('total_rows')}**"
        )
        lines.append("")
        lines.append("| Valeur | Count |")
        lines.append("|---|---:|")
        for it in vc.get("value_counts") or []:
            lines.append(f"| {it.get('value')} | {it.get('count')} |")
    lines.append("")
    lines.append("Filtre appliqué ensuite : garder uniquement `attack_type = normal`.")
    lines.append("")

    lines.append("## 4. Split & transformation (entraînement)\n")
    lines.append("### Split\n")
    lines.append("| Champ | Valeur |")
    lines.append("|---|---|")
    lines.append("| Méthode | random 80/20, seed=42 |")
    lines.append(f"| Train | **{split.get('train_count')}** |")
    lines.append(f"| Test (interne, normals) | **{split.get('test_count')}** |")
    lines.append(f"| Total | **{split.get('total_rows')}** |")
    lines.append("| Contenu | 100% `normal` (après filtre) |")
    lines.append("")
    lines.append("### Transformations\n")
    for t in transform.get("transformations") or []:
        lines.append(f"- {t}")
    cols = transform.get("new_columns") or []
    lines.append(f"- Colonnes après transform : **{len(cols)}**")
    after_split = (after.get("split") or {})
    lines.append(
        f"- Split stats post-transform : train={after_split.get('train_count')} "
        f"test={after_split.get('test_count')}"
    )
    lines.append("")

    lines.append("## 5. Dataset Use Model — `kddtest` (My Datasets)\n")
    lines.append("| Champ | Valeur |")
    lines.append("|---|---|")
    lines.append("| Nom | `kddtest` |")
    lines.append("| Source | My Datasets (partie test) |")
    lines.append(f"| Lignes | **{kdd_n}** |")
    lines.append(f"| Colonnes CSV | **{kdd_stats.get('n_columns', 43)}** |")
    lines.append(f"| Normal | **{kdd_normal}** |")
    lines.append(f"| Attaques | **{kdd_attack}** |")
    lines.append(f"| Taux d'attaque | **{fmt(kdd_stats.get('attack_rate'))}** |")
    lines.append("")
    vc_kdd = kdd_stats.get("attack_type_value_counts") or {}
    if vc_kdd:
        lines.append("### Distribution `attack_type` (kddtest)\n")
        lines.append("| Valeur | Count |")
        lines.append("|---|---:|")
        for val, cnt in list(vc_kdd.items())[:40]:
            lines.append(f"| {val} | {cnt} |")
        if len(vc_kdd) > 40:
            lines.append(f"| … | ({len(vc_kdd) - 40} labels supplémentaires) |")
        lines.append("")
    lines.append(
        "Note : `kddtest` n'a **pas** servi à l'entraînement. Les modèles "
        "(entraînés uniquement sur du trafic normal du train) sont appliqués ici via Use Model.\n"
    )

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
        lines.append("### Résultats train / test interne (données 100% normal)\n")
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
        lines.append("### Évaluation labels (split interne)\n")
        lines.append(
            "Non pertinente ici : après filtre, train+test ne contiennent que `normal`, "
            "donc pas de classes positives (attaques) pour precision/recall/F1 sur le split interne. "
            "L'évaluation réelle est faite sur **kddtest** (section 8).\n"
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
        lines.append(f"### Use Model — prédiction sur `kddtest` ({kdd_n} lignes)\n")
        lines.append("| Champ | Valeur |")
        lines.append("|---|---|")
        lines.append(f"| rows_processed | **{pred_obj.get('rows_processed')}** |")
        lines.append(f"| n_anomaly | **{pred_obj.get('n_anomaly')}** |")
        lines.append(f"| n_normal | **{pred_obj.get('n_normal')}** |")
        lines.append(
            f"| anomaly_rate | **{fmt(pred_obj.get('anomaly_rate'))}** "
            f"({fmt(100*(pred_obj.get('anomaly_rate') or 0),1)}%) |"
        )
        lines.append(
            f"| score_min / mean / max | {fmt(pred_obj.get('score_min'))} / "
            f"{fmt(pred_obj.get('score_mean'))} / {fmt(pred_obj.get('score_max'))} |"
        )
        lines.append(f"| pipeline_applied | {pred_obj.get('pipeline_applied')} |")
        lines.append(f"| target_column (display only) | `{pred_obj.get('target_column')}` |")
        lines.append(
            f"| unexpected columns ignored | `{pred_obj.get('unexpected_columns_ignored')}` |"
        )
        lines.append(f"| chunks | {pred_obj.get('chunks')} × 4000 |")
        lines.append("")
        lines.append(
            "Note Use Model : `kddtest` contient normal + attaques + `difficulty_level`. "
            "Le pipeline sauvegardé (label/one-hot) est réappliqué ; `difficulty_level` est ignoré ; "
            "`attack_type` n'est **pas** utilisé comme feature.\n"
        )

    section_algo("6. Isolation Forest", iso, save_iso, pred_iso)
    section_algo("7. One-Class SVM", ocs, save_ocs, pred_ocs)

    def eval_block(title: str, e: dict):
        if not e:
            lines.append(f"### {title}\n")
            lines.append("Métriques non disponibles.\n")
            return
        lines.append(f"### {title}\n")
        lines.append("| Métrique | Valeur |")
        lines.append("|---|---:|")
        lines.append(f"| n (lignes) | **{e.get('n')}** |")
        lines.append(f"| support_attack (y_true+) | {e.get('support_attack')} |")
        lines.append(f"| support_normal (y_true-) | {e.get('support_normal')} |")
        lines.append(f"| predicted_anomaly | {e.get('predicted_anomaly')} |")
        lines.append(f"| predicted_normal | {e.get('predicted_normal')} |")
        lines.append(
            f"| TP / FP / TN / FN | {e.get('tp')} / {e.get('fp')} / {e.get('tn')} / {e.get('fn')} |"
        )
        lines.append(f"| **Accuracy** | **{fmt(e.get('accuracy'))}** |")
        lines.append(f"| **Precision** | **{fmt(e.get('precision'))}** |")
        lines.append(f"| **Recall (sensibilité)** | **{fmt(e.get('recall'))}** |")
        lines.append(f"| Specificity | {fmt(e.get('specificity'))} |")
        lines.append(f"| **F1** | **{fmt(e.get('f1'))}** |")
        lines.append(f"| FPR | {fmt(e.get('false_positive_rate'))} |")
        lines.append(f"| FNR | {fmt(e.get('false_negative_rate'))} |")
        lines.append(f"| score_mean (vraies attaques) | {fmt(e.get('score_mean_true_attack'))} |")
        lines.append(f"| score_mean (vrais normal) | {fmt(e.get('score_mean_true_normal'))} |")
        lines.append("")

    lines.append("## 8. Évaluation ground-truth sur `kddtest`\n")
    lines.append(
        "Définition positive : **y_true** = `attack_type != normal` (vraie attaque) ; "
        f"**y_pred** = modèle a prédit anomalie. Évalué sur les **{kdd_n}** lignes de `kddtest`.\n"
    )
    eval_block("Isolation Forest (model_id 48)", eval_iso)
    eval_block("One-Class SVM (model_id 49)", eval_ocs)

    fam_sum = load("family_detection_kddtest_summary.json") or {}
    fam_iso = load("family_detection_kddtest_isolation_forest.json") or {}
    fam_ocs = load("family_detection_kddtest_one_class_svm.json") or {}
    table_89 = fam_sum.get("table_8_9") or []

    lines.append("## 9. Table 8.9 — Détection par famille d'attaque (`kddtest`)\n")
    lines.append(
        "Taxonomie NSL-KDD : **DoS / Probe / R2L / U2R**. "
        "Pour chaque famille : *support* = nb de lignes de cette famille dans `kddtest` ; "
        "*détectées* = nb prédites anomalie ; *taux* = détectées / support.\n"
    )
    lines.append(
        "| Famille | Support | IF détectées | IF taux | OCSVM détectées | OCSVM taux |"
    )
    lines.append("|---|---:|---:|---:|---:|---:|")
    for row in table_89:
        lines.append(
            f"| {row.get('family')} | {row.get('support')} | "
            f"**{row.get('isolation_forest_detected')}** | "
            f"**{fmt(row.get('isolation_forest_detection_rate'))}** | "
            f"**{row.get('one_class_svm_detected')}** | "
            f"**{fmt(row.get('one_class_svm_detection_rate'))}** |"
        )
    # totals
    if fam_iso.get("all_attacks") and fam_ocs.get("all_attacks"):
        ai = fam_iso["all_attacks"]
        ao = fam_ocs["all_attacks"]
        lines.append(
            f"| **Toutes attaques** | **{ai.get('support')}** | "
            f"**{ai.get('detected')}** | **{fmt(ai.get('detection_rate'))}** | "
            f"**{ao.get('detected')}** | **{fmt(ao.get('detection_rate'))}** |"
        )
    lines.append("")
    # Normal FP context
    ni = fam_iso.get("normal") or {}
    no = fam_ocs.get("normal") or {}
    lines.append("### Normal (faux positifs)\n")
    lines.append("| Modèle | Support normal | Correct normal (TN) | Faux positifs | TNR |")
    lines.append("|---|---:|---:|---:|---:|")
    lines.append(
        f"| Isolation Forest | {ni.get('support')} | {ni.get('correct_normal')} | "
        f"{ni.get('false_positive')} | {fmt(ni.get('true_negative_rate'))} |"
    )
    lines.append(
        f"| One-Class SVM | {no.get('support')} | {no.get('correct_normal')} | "
        f"{no.get('false_positive')} | {fmt(no.get('true_negative_rate'))} |"
    )
    lines.append("")
    lines.append("### Fichiers de prédiction Use Model (pour recalcul)\n")
    lines.append(
        "Colonnes : `row_index`, `attack_type`, `attack_family`, `predicted_label`, "
        "`is_anomaly`, `anomaly_score`.\n"
    )
    lines.append(
        "- Isolation Forest : "
        "http://46.62.212.226/predictions_kddtest_isolation_forest.csv"
    )
    lines.append(
        "- One-Class SVM : "
        "http://46.62.212.226/predictions_kddtest_one_class_svm.csv"
    )
    lines.append("")

    # optional compact by-label top misses for thesis discussion
    def top_by_family(fam_obj: dict, family: str, limit: int = 8):
        rows = [
            r
            for r in (fam_obj.get("by_attack_type") or [])
            if r.get("family") == family
        ]
        rows = sorted(rows, key=lambda r: (-(r.get("support") or 0), r.get("attack_type") or ""))
        return rows[:limit]

    lines.append("### Détail par `attack_type` (support ≥ 1, top par famille)\n")
    for fam in ("DoS", "Probe", "R2L", "U2R"):
        lines.append(f"#### {fam}\n")
        lines.append(
            "| attack_type | Support | IF détectées | IF taux | OCSVM détectées | OCSVM taux |"
        )
        lines.append("|---|---:|---:|---:|---:|---:|")
        iso_map = {r["attack_type"]: r for r in top_by_family(fam_iso, fam, 50)}
        ocs_map = {r["attack_type"]: r for r in top_by_family(fam_ocs, fam, 50)}
        labels = sorted(
            set(iso_map) | set(ocs_map),
            key=lambda x: (-(iso_map.get(x, {}).get("support") or 0), x),
        )
        for lab in labels:
            ri = iso_map.get(lab) or {}
            ro = ocs_map.get(lab) or {}
            lines.append(
                f"| {lab} | {ri.get('support') or ro.get('support')} | "
                f"{ri.get('detected')} | {fmt(ri.get('detection_rate'))} | "
                f"{ro.get('detected')} | {fmt(ro.get('detection_rate'))} |"
            )
        lines.append("")

    lines.append("## 10. Synthèse comparative\n")
    lines.append(
        "| Modèle | Durée train | Contam./nu | Anomaly rate (kddtest) | "
        "Accuracy | Precision | Recall | F1 |"
    )
    lines.append("|---|---:|---:|---:|---:|---:|---:|---:|")
    lines.append(
        f"| Isolation Forest | {fmt_dur(iso.get('duration_seconds'))} | contamination=0.05 | "
        f"{fmt(pred_iso.get('anomaly_rate'))} | "
        f"**{fmt(eval_iso.get('accuracy'))}** | **{fmt(eval_iso.get('precision'))}** | "
        f"**{fmt(eval_iso.get('recall'))}** | **{fmt(eval_iso.get('f1'))}** |"
    )
    lines.append(
        f"| One-Class SVM | {fmt_dur(ocs.get('duration_seconds'))} | nu=0.05 | "
        f"{fmt(pred_ocs.get('anomaly_rate'))} | "
        f"**{fmt(eval_ocs.get('accuracy'))}** | **{fmt(eval_ocs.get('precision'))}** | "
        f"**{fmt(eval_ocs.get('recall'))}** | **{fmt(eval_ocs.get('f1'))}** |"
    )
    lines.append("")
    lines.append("## 11. Interprétation\n")
    lines.append(
        "- Les modèles sont entraînés **uniquement sur du trafic normal** (only-train filtré)."
    )
    lines.append(
        "- Sur le split interne (aussi 100% normal), le taux d'anomalies ≈ contamination/nu (~5%) : "
        "faux positifs attendus sur le profil normal."
    )
    lines.append(
        f"- Sur **`kddtest`** (hold-out / partie test réelle : "
        f"{kdd_normal} normal + {kdd_attack} attaques), "
        f"IF anomaly_rate ≈ {fmt(100*(pred_iso.get('anomaly_rate') or 0),1)}%, "
        f"OCSVM ≈ {fmt(100*(pred_ocs.get('anomaly_rate') or 0),1)}%."
    )
    lines.append(
        f"- Contre la vérité terrain sur kddtest : Isolation Forest "
        f"(acc={fmt(eval_iso.get('accuracy'))}, F1={fmt(eval_iso.get('f1'))}, "
        f"FPR={fmt(eval_iso.get('false_positive_rate'))}) ; "
        f"One-Class SVM "
        f"(acc={fmt(eval_ocs.get('accuracy'))}, recall={fmt(eval_ocs.get('recall'))}, "
        f"FPR={fmt(eval_ocs.get('false_positive_rate'))}, "
        f"precision={fmt(eval_ocs.get('precision'))})."
    )
    # family interpretation for thesis Table 8.9 discussion
    if table_89:
        def rate(tag_key):
            return {r["family"]: r.get(tag_key) for r in table_89}

        if_r = rate("isolation_forest_detection_rate")
        oc_r = rate("one_class_svm_detection_rate")
        lines.append(
            f"- Table 8.9 : Probe très bien détecté (IF {fmt(if_r.get('Probe'))}, "
            f"OCSVM {fmt(oc_r.get('Probe'))}) ; DoS correct "
            f"(IF {fmt(if_r.get('DoS'))}, OCSVM {fmt(oc_r.get('DoS'))}) ; "
            f"R2L/U2R nettement plus faibles pour IF "
            f"(R2L {fmt(if_r.get('R2L'))}, U2R {fmt(if_r.get('U2R'))}) "
            f"alors qu'OCSVM les récupère mieux "
            f"(R2L {fmt(oc_r.get('R2L'))}, U2R {fmt(oc_r.get('U2R'))})."
        )
    lines.append("")
    lines.append(f"*Généré le {datetime.now(MADRID).strftime('%Y-%m-%d %H:%M:%S %Z')}*\n")
    return "\n".join(lines)


class PDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 11)
        self.cell(0, 7, "NSL only-train anomaly detection report", ln=1)
        self.set_font("Helvetica", "", 8)
        self.cell(
            0,
            5,
            "train=nsl_only_train_anom_nov5 / UseModel=kddtest / IF+OCSVM / cc@cc.cc",
            ln=1,
        )
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
