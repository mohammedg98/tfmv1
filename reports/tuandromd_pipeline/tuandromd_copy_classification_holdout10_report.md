# Rapport détaillé — tuandromd copy (classification)

## Contexte commun

| Champ | Valeur |
|---|---|
| Plateforme | http://46.62.212.226 (tfmv1) |
| Utilisateur | `cc@cc.cc` |
| Dataset | `tuandromd_copy_20261026_160844` (copie de predefined `tuandromd`) |
| Cible | `Label` (malware / goodware ; « normal » = goodware dans ce dataset) |
| Split plateforme | train **850** / test **132** / total **982** |
| Validation | **Hold-out répété × 10**, test_size interne = 0.2 |
| Features finales | ~199 colonnes numériques (booléennes 0/1) |
| Date du run | 2026-10-26 17:08:43 CET → 2026-10-26 17:10:06 CET |

### Tableau récapitulatif

| # | Algorithme | Acc. holdout mean±std | Acc. test | Precision | Recall | F1 | ROC-AUC | Durée |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Logistic Regression | 0.9541±0.0090 | 0.9470 | 0.9504 | 0.9470 | 0.9480 | 0.9829 | 5.0s |
| 2 | k-Nearest Neighbors (KNN) | 0.9288±0.0225 | 0.9394 | 0.9417 | 0.9394 | 0.9402 | 0.9717 | 5.1s |
| 3 | LightGBM | 0.9718±0.0073 | 0.9545 | 0.9545 | 0.9545 | 0.9545 | 0.9913 | 5.0s |
| 4 | Random Forest | 0.9776±0.0111 | 0.9621 | 0.9620 | 0.9621 | 0.9612 | — | 10.1s |
| 5 | Neural Net — MLP (PyTorch) | 0.9547±0.0151 | 0.9318 | 0.9441 | 0.9318 | 0.9347 | 0.9877 | 20.1s |
| 6 | Support Vector Machine (SVM) | 0.9500±0.0185 | 0.9697 | 0.9712 | 0.9697 | 0.9701 | — | 5.0s |
