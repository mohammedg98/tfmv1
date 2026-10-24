# Rapport détaillé — NLS copy (classification)

## Contexte commun

| Champ | Valeur |
|---|---|
| Plateforme | http://46.62.212.226 (tfmv1) |
| Utilisateur | `cc@cc.cc` |
| Dataset | `nls_copy` (NLS copy) |
| Cible | `class` (5 classes: 0.0 … 4.0) |
| Split plateforme | train **125973** / test **22544** / total **148517** |
| Validation | **Hold-out répété × 5**, `test_size = 0.2` (interne au train) |
| Évaluation UI / finale | métriques sur le **test set global** (22544 lignes) |
| Features | ~119 colonnes numériques (one-hot services/flags inclus) |
| Date du run | 24 octobre 2026 |

### Tableau récapitulatif

| # | Algorithme | Début (Madrid) | Fin (Madrid) | Durée | Acc. holdout mean±std | Acc. test | Precision | Recall | F1 | Train acc. |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Logistic Regression | 2026-10-24 08:49:16 (Europe/Madrid) | 2026-10-24 09:01:07 (Europe/Madrid) | 711.1s | 0.9893±0.0005 | 0.7611 | 0.7538 | 0.7611 | 0.7229 | 0.9900 |
| 2 | k-Nearest Neighbors (KNN) | 2026-10-24 09:01:09 (Europe/Madrid) | 2026-10-24 09:05:53 (Europe/Madrid) | 284.1s | 0.9921±0.0005 | 0.7304 | 0.7209 | 0.7304 | 0.6805 | 0.9954 |
| 3 | LightGBM | 2026-10-24 09:05:56 (Europe/Madrid) | 2026-10-24 09:06:14 (Europe/Madrid) | 17.5s | 0.9970±0.0005 | 0.7588 | 0.7635 | 0.7588 | 0.7274 | 0.9983 |
| 4 | Random Forest | 2026-10-24 09:06:17 (Europe/Madrid) | 2026-10-24 09:06:48 (Europe/Madrid) | 31.4s | 0.9988±0.0002 | 0.7440 | 0.8044 | 0.7440 | 0.6972 | 0.9999 |
| 5 | Neural Net — MLP (PyTorch) | 2026-10-24 09:06:53 (Europe/Madrid) | 2026-10-24 09:19:22 (Europe/Madrid) | 748.6s | 0.9785±0.0011 | 0.7114 | 0.6694 | 0.7114 | 0.6682 | 0.9796 |
| 6 | Support Vector Machine (SVM) | 2026-10-24 09:19:25 (Europe/Madrid) | 2026-10-24 10:37:55 (Europe/Madrid) | 4710.2s | 0.9921±0.0004 | 0.7665 | 0.8074 | 0.7665 | 0.7315 | 0.9929 |

---
