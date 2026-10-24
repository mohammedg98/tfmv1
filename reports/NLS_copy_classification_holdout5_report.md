# Rapport de résultats — dataset NLS copy

**Plateforme:** tfmv1 (`http://46.62.212.226`)  
**Utilisateur:** `cc@cc.cc`  
**Dataset:** `nls_copy` (NLS copy)  
**Type de problème:** classification multiclasse (cible `class`, 5 classes)  
**Split existant:** train 125 973 / test 22 544 / total 148 517  
**Protocole:** Hold-out répété × **5**, `test_size=0.2` sur le train (validation interne), puis évaluation finale sur le test set fixé de la plateforme  
**Date du run (Europe/Madrid):** 24 oct. 2026  
**Source des chiffres:** logs backend structurés (`backend/training_logs/`), hookés sur chaque fin d’entraînement

## 1. Vue d’ensemble

| Algorithme | Durée | Acc. holdout (mean±std) | Acc. test final | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Logistic Regression | 711.1s | 0.9893 ± 0.0005 | 0.7611 | 0.7538 | 0.7611 | 0.7229 |
| k-Nearest Neighbors (KNN) | 284.1s | 0.9921 ± 0.0005 | 0.7304 | 0.7209 | 0.7304 | 0.6805 |
| LightGBM | 17.5s | 0.9970 ± 0.0005 | 0.7588 | 0.7635 | 0.7588 | 0.7274 |
| Random Forest | 31.4s | 0.9988 ± 0.0002 | 0.7440 | 0.8044 | 0.7440 | 0.6972 |
| Neural Net (MLP / PyTorch) | 748.6s | 0.9785 ± 0.0011 | 0.7114 | 0.6694 | 0.7114 | 0.6682 |
| Support Vector Machine (SVM) | 4710.2s | 0.9921 ± 0.0004 | 0.7665 | 0.8074 | 0.7665 | 0.7315 |

**Classement par accuracy test final:**
1. **Support Vector Machine (SVM)** — 0.7665
2. **Logistic Regression** — 0.7611
3. **LightGBM** — 0.7588
4. **Random Forest** — 0.7440
5. **k-Nearest Neighbors (KNN)** — 0.7304
6. **Neural Net (MLP / PyTorch)** — 0.7114

**Classement par durée:**
1. **LightGBM** — 17.5s
2. **Random Forest** — 31.4s
3. **k-Nearest Neighbors (KNN)** — 284.1s
4. **Logistic Regression** — 711.1s
5. **Neural Net (MLP / PyTorch)** — 748.6s
6. **Support Vector Machine (SVM)** — 4710.2s

## 2. Protocole de validation commun

- **Méthode:** Hold-out (Train/Test split) répété
- **Nombre de répétitions:** 5
- **Taille de validation interne:** 20% du train (`test_size=0.2`) → ~100 778 train / ~25 195 val par répétition
- **Sélection du modèle final:** meilleure répétition holdout (selon le score de validation), puis métriques UI calculées sur le **test set global** (22 544 lignes)
- **Note:** l’accuracy holdout (~0.97–0.99) est nettement plus haute que l’accuracy test final (~0.71–0.77). Les deux sont reportées telles qu’affichées / loggées par la plateforme.

## 3. Détail par algorithme

### 3.1 Logistic Regression

- **Training ID:** `logistic_1792824556_f6646334`
- **Début (UTC):** 2026-10-24T06:49:16.723545+00:00
- **Début (Europe/Madrid):** 2026-10-24 08:49:16 UTC+02:00
- **Fin (UTC):** 2026-10-24T07:01:07.802810+00:00
- **Fin (Europe/Madrid):** 2026-10-24 09:01:07 UTC+02:00
- **Durée:** 711.079 secondes

**Validation**
- Méthode: Hold-Out Repeated (5 repetitions)
- Répétitions: 5
- test_size: 0.2
- Score holdout mean±std: **0.989268 ± 0.000546**
- Meilleure répétition: **5** (score 0.989919)

| Rep | Score val | Score train | train_size | val_size | extras |
|---:|---:|---:|---:|---:|---|
| 1 | 0.989680 | 0.989680 | 100778 | 25195 | best_C=100.000000 |
| 2 | 0.989125 | 0.990008 | 100778 | 25195 | best_C=100.000000 |
| 3 | 0.988331 | 0.990087 | 100778 | 25195 | best_C=1000.000000 |
| 4 | 0.989284 | 0.989849 | 100778 | 25195 | best_C=100.000000 |
| 5 | 0.989919 | 0.989978 | 100778 | 25195 | best_C=1000.000000 |

**Hyperparamètres / paramètres utilisés**
- penalty=`l2`, solver=`lbfgs`, multi_class=`auto`
- best_C=`1000.0`, C_search_space=`[0.001, 0.01, 0.1, 1, 10, 100, 1000]`, selection=`validation_split`
- use_scaling (request): true (StandardScaler côté logistic)
- n_features=119, classes=['0.0', '1.0', '2.0', '3.0', '4.0']
- final_model_source=`best_holdout_repetition_5`

**Résultats finaux (métriques UI / test set)**
- **accuracy:** 0.7610894251242015
- **precision:** 0.7538030232164294
- **recall:** 0.7610894251242015
- **f1:** 0.7229124024197278
- **log_loss:** 2.8420048092143984
- **train_accuracy:** 0.9899661038476499

Confusion matrix labels: `['0.0', '1.0', '2.0', '3.0', '4.0']`

```
[6223, 1233, 4, 0, 0]
[79, 9032, 595, 1, 4]
[118, 425, 1749, 129, 0]
[3, 2741, 5, 128, 8]
[2, 35, 0, 4, 26]
```

Classification report (extrait):

| Classe | precision | recall | f1 | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.9686 | 0.8342 | 0.8964 | 7460 |
| 1.0 | 0.6707 | 0.9301 | 0.7794 | 9711 |
| 2.0 | 0.7433 | 0.7224 | 0.7327 | 2421 |
| 3.0 | 0.4885 | 0.0444 | 0.0813 | 2885 |
| 4.0 | 0.6842 | 0.3881 | 0.4952 | 67 |
| macro avg | 0.7111 | 0.5838 | 0.5970 | 22544 |
| weighted avg | 0.7538 | 0.7611 | 0.7229 | 22544 |

### 3.2 k-Nearest Neighbors (KNN)

- **Training ID:** `knn_1792825269_9b68403d`
- **Début (UTC):** 2026-10-24T07:01:09.332073+00:00
- **Début (Europe/Madrid):** 2026-10-24 09:01:09 UTC+02:00
- **Fin (UTC):** 2026-10-24T07:05:53.406878+00:00
- **Fin (Europe/Madrid):** 2026-10-24 09:05:53 UTC+02:00
- **Durée:** 284.075 secondes

**Validation**
- Méthode: Hold-Out Repeated (5 repetitions)
- Répétitions: 5
- test_size: 0.2
- Score holdout mean±std: **0.992141 ± 0.000466**
- Meilleure répétition: **5** (score 0.992538)

| Rep | Score val | Score train | train_size | val_size | extras |
|---:|---:|---:|---:|---:|---|
| 1 | 0.992300 | 0.994632 | 100778 | 25195 | — |
| 2 | 0.992260 | 0.994592 | 100778 | 25195 | — |
| 3 | 0.992379 | 0.994791 | 100778 | 25195 | — |
| 4 | 0.991228 | 0.994840 | 100778 | 25195 | — |
| 5 | 0.992538 | 0.994642 | 100778 | 25195 | — |

**Hyperparamètres / paramètres utilisés**
- n_neighbors=`5`, weights=`uniform`, metric=`minkowski`, algorithm=`auto`
- final_params=`{"n_neighbors": 5, "weights": "uniform", "algorithm": "auto", "leaf_size": 30, "p": 2, "metric": "minkowski"}`
- use_scaling: false

**Résultats finaux (métriques UI / test set)**
- **accuracy:** 0.7304382540809085
- **precision:** 0.7208918836649835
- **recall:** 0.7304382540809085
- **f1:** 0.6804770743871243
- **train_accuracy:** 0.9954355298357584

Confusion matrix labels: `['0.0', '1.0', '2.0', '3.0', '4.0']`

```
[5565, 1602, 293, 0, 0]
[131, 9438, 134, 8, 0]
[290, 681, 1450, 0, 0]
[52, 2680, 147, 6, 0]
[0, 59, 0, 0, 8]
```

Classification report (extrait):

| Classe | precision | recall | f1 | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.9217 | 0.7460 | 0.8246 | 7460 |
| 1.0 | 0.6527 | 0.9719 | 0.7809 | 9711 |
| 2.0 | 0.7164 | 0.5989 | 0.6524 | 2421 |
| 3.0 | 0.4286 | 0.0021 | 0.0041 | 2885 |
| 4.0 | 1.0000 | 0.1194 | 0.2133 | 67 |
| macro avg | 0.7439 | 0.4877 | 0.4951 | 22544 |
| weighted avg | 0.7209 | 0.7304 | 0.6805 | 22544 |

### 3.3 LightGBM

- **Training ID:** `lightgbm_1792825556_1083687e`
- **Début (UTC):** 2026-10-24T07:05:56.898682+00:00
- **Début (Europe/Madrid):** 2026-10-24 09:05:56 UTC+02:00
- **Fin (UTC):** 2026-10-24T07:06:14.367334+00:00
- **Fin (Europe/Madrid):** 2026-10-24 09:06:14 UTC+02:00
- **Durée:** 17.469 secondes

**Validation**
- Méthode: Hold-Out Repeated (5 repetitions)
- Répétitions: 5
- test_size: 0.2
- Score holdout mean±std: **0.997023 ± 0.000470**
- Meilleure répétition: **5** (score 0.997539)

| Rep | Score val | Score train | train_size | val_size | extras |
|---:|---:|---:|---:|---:|---|
| 1 | 0.997500 | 0.998571 | 100778 | 25195 | best_iteration=22 |
| 2 | 0.996984 | 0.998621 | 100778 | 25195 | best_iteration=33 |
| 3 | 0.996825 | 0.998105 | 100778 | 25195 | best_iteration=24 |
| 4 | 0.996269 | 0.998234 | 100778 | 25195 | best_iteration=27 |
| 5 | 0.997539 | 0.998690 | 100778 | 25195 | best_iteration=24 |

**Hyperparamètres / paramètres utilisés**
- objective=`multiclass`, boosting=`gbdt`, n_estimators=`100`, lr=`0.1`
- final_params=`{"boosting_type": "gbdt", "num_leaves": 31, "learning_rate": 0.1, "n_estimators": 100, "max_depth": -1, "min_child_samples": 20, "subsample": 1.0, "colsample_bytree": 1.0, "reg_alpha": 0.0, "reg_lambda": 0.0, "random_state": 42, "n_jobs": -1, "verbose": -1, "objective": "multiclass", "num_class": 5, "early_stopping_rounds": 10}`

**Résultats finaux (métriques UI / test set)**
- **accuracy:** 0.7588271823988645
- **precision:** 0.7635061045301584
- **recall:** 0.7588271823988645
- **f1:** 0.7274319356416892
- **train_accuracy:** 0.9983409143229105

Confusion matrix labels: `['0.0', '1.0', '2.0', '3.0', '4.0']`

```
[6047, 801, 193, 213, 206]
[74, 9422, 201, 4, 10]
[163, 798, 1391, 7, 62]
[0, 2625, 7, 244, 9]
[0, 55, 0, 9, 3]
```

Classification report (extrait):

| Classe | precision | recall | f1 | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.9623 | 0.8106 | 0.8799 | 7460 |
| 1.0 | 0.6877 | 0.9702 | 0.8049 | 9711 |
| 2.0 | 0.7762 | 0.5746 | 0.6603 | 2421 |
| 3.0 | 0.5115 | 0.0846 | 0.1452 | 2885 |
| 4.0 | 0.0103 | 0.0448 | 0.0168 | 67 |
| macro avg | 0.5896 | 0.4969 | 0.5014 | 22544 |
| weighted avg | 0.7635 | 0.7588 | 0.7274 | 22544 |

### 3.4 Random Forest

- **Training ID:** `random_forest_1792825577_516a6ea2`
- **Début (UTC):** 2026-10-24T07:06:17.058532+00:00
- **Début (Europe/Madrid):** 2026-10-24 09:06:17 UTC+02:00
- **Fin (UTC):** 2026-10-24T07:06:48.428198+00:00
- **Fin (Europe/Madrid):** 2026-10-24 09:06:48 UTC+02:00
- **Durée:** 31.370 secondes

**Validation**
- Méthode: Hold-Out Repeated (5 repetitions)
- Répétitions: 5
- test_size: 0.2
- Score holdout mean±std: **0.998833 ± 0.000203**
- Meilleure répétition: **1** (score 0.999167)

| Rep | Score val | Score train | train_size | val_size | extras |
|---:|---:|---:|---:|---:|---|
| 1 | 0.999167 | 0.999970 | 100778 | 25195 | random_state=0 |
| 2 | 0.998730 | 0.999960 | 100778 | 25195 | random_state=1 |
| 3 | 0.998651 | 0.999970 | 100778 | 25195 | random_state=2 |
| 4 | 0.998968 | 0.999931 | 100778 | 25195 | random_state=3 |
| 5 | 0.998651 | 0.999960 | 100778 | 25195 | random_state=4 |

**Hyperparamètres / paramètres utilisés**
- final_params=`{"n_estimators": 100, "max_depth": null, "min_samples_split": 2, "min_samples_leaf": 1, "max_features": "sqrt", "bootstrap": true, "oob_score": false, "n_jobs": -1, "random_state": null, "criterion": "gini"}`
- user_parameters_used=`true`

**Résultats finaux (métriques UI / test set)**
- **accuracy:** 0.7440117104329311
- **precision:** 0.8043565129703331
- **recall:** 0.7440117104329311
- **f1:** 0.6971761083927924
- **train_accuracy:** 0.999944432537131

Confusion matrix labels: `['0.0', '1.0', '2.0', '3.0', '4.0']`

```
[5821, 1544, 95, 0, 0]
[67, 9458, 185, 0, 1]
[161, 802, 1458, 0, 0]
[0, 2847, 3, 34, 1]
[0, 62, 0, 3, 2]
```

Classification report (extrait):

| Classe | precision | recall | f1 | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.9623 | 0.7803 | 0.8618 | 7460 |
| 1.0 | 0.6428 | 0.9739 | 0.7745 | 9711 |
| 2.0 | 0.8374 | 0.6022 | 0.7006 | 2421 |
| 3.0 | 0.9189 | 0.0118 | 0.0233 | 2885 |
| 4.0 | 0.5000 | 0.0299 | 0.0563 | 67 |
| macro avg | 0.7723 | 0.4796 | 0.4833 | 22544 |
| weighted avg | 0.8044 | 0.7440 | 0.6972 | 22544 |

### 3.5 Neural Net (MLP / PyTorch)

- **Training ID:** `mlp_1792825613_6266dad8`
- **Début (UTC):** 2026-10-24T07:06:53.501599+00:00
- **Début (Europe/Madrid):** 2026-10-24 09:06:53 UTC+02:00
- **Fin (UTC):** 2026-10-24T07:19:22.101782+00:00
- **Fin (Europe/Madrid):** 2026-10-24 09:19:22 UTC+02:00
- **Durée:** 748.600 secondes

**Validation**
- Méthode: Hold-Out Repeated (5 repetitions)
- Répétitions: 5
- test_size: 0.2
- Score holdout mean±std: **0.978456 ± 0.001115**
- Meilleure répétition: **3** (score 0.979599)

| Rep | Score val | Score train | train_size | val_size | extras |
|---:|---:|---:|---:|---:|---|
| 1 | 0.978686 | — | 100778 | 25195 | best_val_loss=0.925606 |
| 2 | 0.979202 | — | 100778 | 25195 | best_val_loss=0.925139 |
| 3 | 0.979599 | — | 100778 | 25195 | best_val_loss=0.924970 |
| 4 | 0.976384 | — | 100778 | 25195 | best_val_loss=0.926934 |
| 5 | 0.978408 | — | 100778 | 25195 | best_val_loss=0.924826 |

**Hyperparamètres / paramètres utilisés**
- layers=`[64, 32]`, activation=`relu`, dropout=`0.2`
- learning_rate=`0.001`, batch_size=`32`, epochs=100, patience=10
- use_scaling: true

**Résultats finaux (métriques UI / test set)**
- **accuracy:** 0.7113644428672817
- **precision:** 0.6694039888172627
- **recall:** 0.7113644428672817
- **f1:** 0.6682176726012637
- **train_accuracy:** 0.9796226175450294

Confusion matrix labels: `['0.0', '1.0', '2.0', '3.0', '4.0']`

```
[5427, 1870, 100, 63, 0]
[450, 9023, 237, 1, 0]
[242, 478, 1557, 144, 0]
[7, 2844, 4, 30, 0]
[4, 63, 0, 0, 0]
```

Classification report (extrait):

| Classe | precision | recall | f1 | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.8853 | 0.7275 | 0.7987 | 7460 |
| 1.0 | 0.6320 | 0.9292 | 0.7523 | 9711 |
| 2.0 | 0.8203 | 0.6431 | 0.7210 | 2421 |
| 3.0 | 0.1261 | 0.0104 | 0.0192 | 2885 |
| 4.0 | 0.0000 | 0.0000 | 0.0000 | 67 |
| macro avg | 0.4927 | 0.4620 | 0.4582 | 22544 |
| weighted avg | 0.6694 | 0.7114 | 0.6682 | 22544 |

### 3.6 Support Vector Machine (SVM)

- **Training ID:** `svm_1792826365_45f08639`
- **Début (UTC):** 2026-10-24T07:19:25.469590+00:00
- **Début (Europe/Madrid):** 2026-10-24 09:19:25 UTC+02:00
- **Fin (UTC):** 2026-10-24T08:37:55.684371+00:00
- **Fin (Europe/Madrid):** 2026-10-24 10:37:55 UTC+02:00
- **Durée:** 4710.215 secondes

**Validation**
- Méthode: Hold-Out Repeated (5 repetitions)
- Répétitions: 5
- test_size: 0.2
- Score holdout mean±std: **0.992078 ± 0.000401**
- Meilleure répétition: **2** (score 0.992697)

| Rep | Score val | Score train | train_size | val_size | extras |
|---:|---:|---:|---:|---:|---|
| 1 | 0.991903 | 0.992925 | 100778 | 25195 | — |
| 2 | 0.992697 | 0.992578 | 100778 | 25195 | — |
| 3 | 0.992141 | 0.993004 | 100778 | 25195 | — |
| 4 | 0.991467 | 0.993024 | 100778 | 25195 | — |
| 5 | 0.992181 | 0.992846 | 100778 | 25195 | — |

**Hyperparamètres / paramètres utilisés**
- kernel=`rbf`, C=`1.0`, gamma=`scale`, degree=`3`
- final_params=`{"kernel": "rbf", "C": 1.0, "gamma": "scale", "degree": 3, "shrinking": true, "probability": false}`
- feature_scaling: StandardScaler applied (d’après training_info)

**Résultats finaux (métriques UI / test set)**
- **accuracy:** 0.7665010645848119
- **precision:** 0.8074083923632219
- **recall:** 0.7665010645848119
- **f1:** 0.7315381107114077
- **train_accuracy:** 0.992903241170727

Confusion matrix labels: `['0.0', '1.0', '2.0', '3.0', '4.0']`

```
[6279, 1154, 27, 0, 0]
[293, 9021, 391, 1, 5]
[349, 387, 1685, 0, 0]
[2, 2583, 15, 282, 3]
[0, 37, 13, 4, 13]
```

Classification report (extrait):

| Classe | precision | recall | f1 | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.9070 | 0.8417 | 0.8731 | 7460 |
| 1.0 | 0.6843 | 0.9289 | 0.7881 | 9711 |
| 2.0 | 0.7907 | 0.6960 | 0.7403 | 2421 |
| 3.0 | 0.9826 | 0.0977 | 0.1778 | 2885 |
| 4.0 | 0.6190 | 0.1940 | 0.2955 | 67 |
| macro avg | 0.7967 | 0.5517 | 0.5750 | 22544 |
| weighted avg | 0.8074 | 0.7665 | 0.7315 | 22544 |

## 4. Synthèse / observations

- **Meilleure accuracy test:** SVM (0.7665), suivi de Logistic (0.7611) et LightGBM (0.7588).
- **Plus rapide:** LightGBM (~20s), puis Random Forest (~36s).
- **Plus lent:** SVM (~4713s ≈ 1h18), puis MLP (~752s) et Logistic (~713s, C-search sur grille).
- **Écart holdout vs test:** tous les modèles affichent ~98–99% en holdout interne mais ~71–77% sur le test fixé — à garder en tête pour l’interprétation (distribution / définition du score holdout vs métriques finales UI).
- **Classes rares:** les rapports montrent de mauvaises performances sur les classes minoritaires (ex. classe `4.0`, parfois `3.0`), ce qui tire le F1 vers le bas.

## 5. Fichiers de logs

Sur le serveur (`/root/tfmv1/backend/training_logs/`):

- `logistic`: training_id `logistic_1792824556_f6646334`, durée 711.1s
- `knn`: training_id `knn_1792825269_9b68403d`, durée 284.1s
- `lightgbm`: training_id `lightgbm_1792825556_1083687e`, durée 17.5s
- `random_forest`: training_id `random_forest_1792825577_516a6ea2`, durée 31.4s
- `mlp`: training_id `mlp_1792825613_6266dad8`, durée 748.6s
- `svm`: training_id `svm_1792826365_45f08639`, durée 4710.2s
- Index JSONL: `training_runs.jsonl`
- Résumé run: `nls_copy_run_summary.jsonl`, `nls_copy_final_results.json`

---
*Rapport généré automatiquement à partir des logs de training backend.*