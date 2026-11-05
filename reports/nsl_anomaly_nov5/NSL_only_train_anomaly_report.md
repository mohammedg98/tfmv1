# Rapport détaillé — NSL-KDD only-train · détection d'anomalies

## 1. Contexte

| Champ | Valeur |
|---|---|
| Plateforme | http://46.62.212.226 |
| Utilisateur | `cc@cc.cc` |
| Source predefined (train) | `nslkdd_only_train_part` (125973 lignes) |
| Dataset entraînement | `nsl_only_train_anom_nov5` (normals only) |
| Dataset Use Model | **`kddtest`** (My Datasets, **22544** lignes — partie test) |
| Target | `attack_type` |
| Algorithmes | Isolation Forest + One-Class SVM |
| Éval ground-truth | attaque (`attack_type != normal`) vs anomalie prédite |
| Date | 2026-11-06 00:02 CET |

## 2. Pipeline effectué (étape par étape)

1. Dupliquer le dataset predefined **only train** → `nsl_only_train_anom_nov5`
2. Choisir / sauver la target **`attack_type`**
3. Group Optimizer : supprimer toutes les lignes sauf **`normal`** (58630 lignes attaque supprimées)
4. Supprimer la colonne **`difficulty_level`**
5. Continue (checkpoint)
6. Split **80/20 random** (seed=42) — stratifié impossible car 1 seule classe après filtre
7. Transformation :
   - Label Encoding sur `attack_type`
   - One-Hot sur `protocol_type`, `service`, `flag`
8. Entraîner **Isolation Forest** puis **One-Class SVM**, sauvegarder les 2 modèles
9. Prendre le dataset My Datasets **`kddtest`** (partie test, non utilisé pour l'entraînement)
10. Télécharger CSV tel quel (`/api/download-dataset-csv?dbName=kddtest`)
11. Use Model → predict-batch sur **kddtest** avec les 2 modèles sauvegardés
12. Évaluation ground-truth sur **kddtest** : anomalie prédite vs `attack_type != normal` → accuracy / precision / recall / F1 / etc.

## 3. Stats AVANT preprocessing (dataset d'entraînement)

- Target metadata: `{"target_column": "attack_type", "model_type": "supervised", "is_unsupervised": false}`
- Distinct attack_type: **23** / rows **125973**

| Valeur | Count |
|---|---:|
| normal | 67343 |
| neptune | 41214 |
| satan | 3633 |
| ipsweep | 3599 |
| portsweep | 2931 |
| smurf | 2646 |
| nmap | 1493 |
| back | 956 |
| teardrop | 892 |
| warezclient | 890 |
| pod | 201 |
| guess_passwd | 53 |
| buffer_overflow | 30 |
| warezmaster | 20 |
| land | 18 |
| imap | 11 |
| rootkit | 10 |
| loadmodule | 9 |
| ftp_write | 8 |
| multihop | 7 |
| phf | 4 |
| perl | 3 |
| spy | 2 |

Filtre appliqué ensuite : garder uniquement `attack_type = normal`.

## 4. Split & transformation (entraînement)

### Split

| Champ | Valeur |
|---|---|
| Méthode | random 80/20, seed=42 |
| Train | **53874** |
| Test (interne, normals) | **13469** |
| Total | **67343** |
| Contenu | 100% `normal` (après filtre) |

### Transformations

- attack_type → Label Encoding (1 categories)
- protocol_type → One-Hot Encoding (created 3 new columns)
- service → One-Hot Encoding (created 26 new columns)
- flag → One-Hot Encoding (created 10 new columns)
- Colonnes après transform : **78**
- Split stats post-transform : train=53874 test=13469

## 5. Dataset Use Model — `kddtest` (My Datasets)

| Champ | Valeur |
|---|---|
| Nom | `kddtest` |
| Source | My Datasets (partie test) |
| Lignes | **22544** |
| Colonnes CSV | **43** |
| Normal | **9711** |
| Attaques | **12833** |
| Taux d'attaque | **0.5692** |

### Distribution `attack_type` (kddtest)

| Valeur | Count |
|---|---:|
| normal | 9711 |
| neptune | 4657 |
| guess_passwd | 1231 |
| mscan | 996 |
| warezmaster | 944 |
| apache2 | 737 |
| satan | 735 |
| processtable | 685 |
| smurf | 665 |
| back | 359 |
| snmpguess | 331 |
| saint | 319 |
| mailbomb | 293 |
| snmpgetattack | 178 |
| portsweep | 157 |
| ipsweep | 141 |
| httptunnel | 133 |
| nmap | 73 |
| pod | 41 |
| buffer_overflow | 20 |
| multihop | 18 |
| named | 17 |
| ps | 15 |
| sendmail | 14 |
| rootkit | 13 |
| xterm | 13 |
| teardrop | 12 |
| xlock | 9 |
| land | 7 |
| xsnoop | 4 |
| ftp_write | 3 |
| loadmodule | 2 |
| perl | 2 |
| phf | 2 |
| sqlattack | 2 |
| udpstorm | 2 |
| worm | 2 |
| imap | 1 |

Note : `kddtest` n'a **pas** servi à l'entraînement. Les modèles (entraînés uniquement sur du trafic normal du train) sont appliqués ici via Use Model.

## 6. Isolation Forest

### Hyperparamètres

| Paramètre | Valeur |
|---|---|
| `algorithm` | `isolation_forest` |
| `use_scaling` | `True` |
| `random_state` | `42` |
| `n_estimators` | `100` |
| `contamination` | `0.05` |
| `max_samples` | `auto` |
| `max_features` | `1.0` |
| `bootstrap` | `False` |

### Identité training

| Champ | Valeur |
|---|---|
| Training ID | `isolation_forest_1793909939_4e37cca5` |
| Durée | 4.1s |
| Finished | 2026-11-05 21:19:03 CET |
| n_features | 77 |
| target_excluded | `attack_type` |
| anti_leakage | {'fit_scope': 'train_only', 'scaler_scope': 'train_only', 'test_used_for_fit': False, 'labels_used_for_fit': False, 'labels_fit_note': 'Unsupervised fit on train features only.'} |

### Résultats train / test interne (données 100% normal)

| Split | n | n_anomalies | anomaly_rate | score_mean | score_min | score_max |
|---|---:|---:|---:|---:|---:|---:|
| train | 53874 | 2694 | 0.0500 | 0.1231 | -0.1879 | 0.1772 |
| test | 13469 | 682 | 0.0506 | 0.1232 | -0.1424 | 0.1772 |

### Évaluation labels (split interne)

Non pertinente ici : après filtre, train+test ne contiennent que `normal`, donc pas de classes positives (attaques) pour precision/recall/F1 sur le split interne. L'évaluation réelle est faite sur **kddtest** (section 8).

### Sauvegarde modèle

| Champ | Valeur |
|---|---|
| model_id | `48` |
| model_name | `nsl_iso_normal_nov5` |
| algorithm | `isolation_forest` |
| model_type | `anomaly` |
| path | `/app/saved_models/6a7649c85389ffb49703be24_nsl_iso_normal_nov5_20261105_201903.joblib` |
| saved_at | 2026-11-05T20:19:03.873129 |

### Use Model — prédiction sur `kddtest` (22544 lignes)

| Champ | Valeur |
|---|---|
| rows_processed | **22544** |
| n_anomaly | **9410** |
| n_normal | **13134** |
| anomaly_rate | **0.4174** (41.7%) |
| score_min / mean / max | -0.1501 / 0.0306 / 0.1512 |
| pipeline_applied | True |
| target_column (display only) | `attack_type` |
| unexpected columns ignored | `['difficulty_level']` |
| chunks | 6 × 4000 |

Note Use Model : `kddtest` contient normal + attaques + `difficulty_level`. Le pipeline sauvegardé (label/one-hot) est réappliqué ; `difficulty_level` est ignoré ; `attack_type` n'est **pas** utilisé comme feature.

## 7. One-Class SVM

### Hyperparamètres

| Paramètre | Valeur |
|---|---|
| `algorithm` | `one_class_svm` |
| `use_scaling` | `True` |
| `random_state` | `42` |
| `kernel` | `rbf` |
| `nu` | `0.05` |
| `gamma` | `scale` |
| `degree` | `3` |
| `coef0` | `0.0` |
| `train_on_normals_only` | `False` |
| `normals_filter_applied` | `False` |

### Identité training

| Champ | Valeur |
|---|---|
| Training ID | `one_class_svm_1793909943_5ee4c743` |
| Durée | 1m 16s |
| Finished | 2026-11-05 21:20:20 CET |
| n_features | 77 |
| target_excluded | `attack_type` |
| anti_leakage | {'fit_scope': 'train_only', 'scaler_scope': 'train_only', 'test_used_for_fit': False, 'labels_used_for_fit': False, 'labels_fit_note': 'Unsupervised fit on train features only.'} |

### Résultats train / test interne (données 100% normal)

| Split | n | n_anomalies | anomaly_rate | score_mean | score_min | score_max |
|---|---:|---:|---:|---:|---:|---:|
| train | 53874 | 2689 | 0.0499 | 23.8371 | -54.2884 | 45.0737 |
| test | 13469 | 713 | 0.0529 | 23.8290 | -55.2884 | 41.7476 |

### Évaluation labels (split interne)

Non pertinente ici : après filtre, train+test ne contiennent que `normal`, donc pas de classes positives (attaques) pour precision/recall/F1 sur le split interne. L'évaluation réelle est faite sur **kddtest** (section 8).

### Sauvegarde modèle

| Champ | Valeur |
|---|---|
| model_id | `49` |
| model_name | `nsl_ocsvm_normal_nov5` |
| algorithm | `one_class_svm` |
| model_type | `anomaly` |
| path | `/app/saved_models/6a7649c85389ffb49703be24_nsl_ocsvm_normal_nov5_20261105_202020.joblib` |
| saved_at | 2026-11-05T20:20:20.170806 |

### Use Model — prédiction sur `kddtest` (22544 lignes)

| Champ | Valeur |
|---|---|
| rows_processed | **22544** |
| n_anomaly | **12590** |
| n_normal | **9954** |
| anomaly_rate | **0.5585** (55.8%) |
| score_min / mean / max | -55.2884 / -11.4838 / 27.7045 |
| pipeline_applied | True |
| target_column (display only) | `attack_type` |
| unexpected columns ignored | `['difficulty_level']` |
| chunks | 6 × 4000 |

Note Use Model : `kddtest` contient normal + attaques + `difficulty_level`. Le pipeline sauvegardé (label/one-hot) est réappliqué ; `difficulty_level` est ignoré ; `attack_type` n'est **pas** utilisé comme feature.

## 8. Évaluation ground-truth sur `kddtest`

Définition positive : **y_true** = `attack_type != normal` (vraie attaque) ; **y_pred** = modèle a prédit anomalie. Évalué sur les **22544** lignes de `kddtest`.

### Isolation Forest (model_id 48)

| Métrique | Valeur |
|---|---:|
| n (lignes) | **22544** |
| support_attack (y_true+) | 12833 |
| support_normal (y_true-) | 9711 |
| predicted_anomaly | 9410 |
| predicted_normal | 13134 |
| TP / FP / TN / FN | 8735 / 675 / 9036 / 4098 |
| **Accuracy** | **0.7883** |
| **Precision** | **0.9283** |
| **Recall (sensibilité)** | **0.6807** |
| Specificity | 0.9305 |
| **F1** | **0.7854** |
| FPR | 0.0695 |
| FNR | 0.3193 |
| score_mean (vraies attaques) | -0.0307 |
| score_mean (vrais normal) | 0.1117 |

### One-Class SVM (model_id 49)

| Métrique | Valeur |
|---|---:|
| n (lignes) | **22544** |
| support_attack (y_true+) | 12833 |
| support_normal (y_true-) | 9711 |
| predicted_anomaly | 12590 |
| predicted_normal | 9954 |
| TP / FP / TN / FN | 11190 / 1400 / 8311 / 1643 |
| **Accuracy** | **0.8650** |
| **Precision** | **0.8888** |
| **Recall (sensibilité)** | **0.8720** |
| Specificity | 0.8558 |
| **F1** | **0.8803** |
| FPR | 0.1442 |
| FNR | 0.1280 |
| score_mean (vraies attaques) | -30.0909 |
| score_mean (vrais normal) | 13.1053 |

## 9. Synthèse comparative

| Modèle | Durée train | Contam./nu | Anomaly rate (kddtest) | Accuracy | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Isolation Forest | 4.1s | contamination=0.05 | 0.4174 | **0.7883** | **0.9283** | **0.6807** | **0.7854** |
| One-Class SVM | 1m 16s | nu=0.05 | 0.5585 | **0.8650** | **0.8888** | **0.8720** | **0.8803** |

## 10. Interprétation

- Les modèles sont entraînés **uniquement sur du trafic normal** (only-train filtré).
- Sur le split interne (aussi 100% normal), le taux d'anomalies ≈ contamination/nu (~5%) : faux positifs attendus sur le profil normal.
- Sur **`kddtest`** (hold-out / partie test réelle : 9711 normal + 12833 attaques), IF anomaly_rate ≈ 41.7%, OCSVM ≈ 55.8%.
- Contre la vérité terrain sur kddtest : Isolation Forest (acc=0.7883, F1=0.7854, FPR=0.0695) ; One-Class SVM (acc=0.8650, recall=0.8720, FPR=0.1442, precision=0.8888).

*Généré le 2026-11-06 00:02:30 CET*
