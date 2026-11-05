# Rapport détaillé — NSL-KDD only-train · détection d'anomalies

## 1. Contexte

| Champ | Valeur |
|---|---|
| Plateforme | http://46.62.212.226 |
| Utilisateur | `cc@cc.cc` |
| Source predefined | `nslkdd_only_train_part` (125973 lignes) |
| Dataset entraînement | `nsl_only_train_anom_nov5` |
| Dataset CSV (Use Model) | `nsl_only_train_csv_nov5` (copie brute non modifiée) |
| Target | `attack_type` |
| Algorithmes | Isolation Forest + One-Class SVM |
| Éval ground-truth | attaque (`attack_type != normal`) vs anomalie prédite |
| Date | 2026-11-05 23:13 CET |

## 2. Pipeline effectué (étape par étape)

1. Dupliquer le dataset predefined **only train** → `nsl_only_train_anom_nov5`
2. Choisir / sauver la target **`attack_type`**
3. Group Optimizer : supprimer toutes les lignes sauf **`normal`** (58630 lignes attaque supprimées)
4. Supprimer la colonne **`difficulty_level`**
5. Continue (checkpoint)
6. Split **80/20 random** (seed=42) — stratifié impossible car 1 seule classe après filtre
7. Transformation (identique au run classification précédent) :
   - Label Encoding sur `attack_type`
   - One-Hot sur `protocol_type`, `service`, `flag`
8. Entraîner **Isolation Forest** puis **One-Class SVM**, sauvegarder les 2 modèles
9. Nouvelle copie predefined unmodified → `nsl_only_train_csv_nov5`
10. Télécharger CSV tel quel (`/api/download-dataset-csv`)
11. Use Model → predict-batch sur le CSV avec les 2 modèles sauvegardés
12. Évaluation ground-truth : comparer prédictions anomalie vs vraies attaques (`attack_type != normal`) → accuracy / precision / recall / F1 / etc.

## 3. Stats AVANT preprocessing

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

## 4. Split & transformation

### Split

| Champ | Valeur |
|---|---|
| Méthode | random 80/20, seed=42 |
| Train | **53874** |
| Test | **13469** |
| Total | **67343** |
| Contenu | 100% `normal` (après filtre) |

### Transformations

- attack_type → Label Encoding (1 categories)
- protocol_type → One-Hot Encoding (created 3 new columns)
- service → One-Hot Encoding (created 26 new columns)
- flag → One-Hot Encoding (created 10 new columns)
- Colonnes après transform : **78**
- Split stats post-transform : train=53874 test=13469

## 5. Isolation Forest

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

### Résultats train / test (données 100% normal)

| Split | n | n_anomalies | anomaly_rate | score_mean | score_min | score_max |
|---|---:|---:|---:|---:|---:|---:|
| train | 53874 | 2694 | 0.0500 | 0.1231 | -0.1879 | 0.1772 |
| test | 13469 | 682 | 0.0506 | 0.1232 | -0.1424 | 0.1772 |

### Évaluation labels (train set)

Non disponible / non pertinente ici : après filtre, train+test ne contiennent que `normal`, donc pas de classes positives (attaques) pour precision/recall/F1 sur le split interne.

### Sauvegarde modèle

| Champ | Valeur |
|---|---|
| model_id | `48` |
| model_name | `nsl_iso_normal_nov5` |
| algorithm | `isolation_forest` |
| model_type | `anomaly` |
| path | `/app/saved_models/6a7649c85389ffb49703be24_nsl_iso_normal_nov5_20261105_201903.joblib` |
| saved_at | 2026-11-05T20:19:03.873129 |

### Use Model — prédiction sur CSV brut (125973 lignes)

| Champ | Valeur |
|---|---|
| rows_processed | **125973** |
| n_anomaly | **56894** |
| n_normal | **69079** |
| anomaly_rate | **0.4516** (45.2%) |
| score_min / mean / max | -0.1660 / 0.0205 / 0.1512 |
| pipeline_applied | True |
| target_column (display only) | `attack_type` |
| unexpected columns ignored | `['difficulty_level']` |
| chunks | 32 × 4000 |

Note Use Model : le CSV contient encore toutes les classes d'attaque + `difficulty_level`. Le pipeline sauvegardé (label/one-hot) est réappliqué ; `difficulty_level` est ignoré ; `attack_type` n'est **pas** utilisé comme feature.

## 6. One-Class SVM

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

### Résultats train / test (données 100% normal)

| Split | n | n_anomalies | anomaly_rate | score_mean | score_min | score_max |
|---|---:|---:|---:|---:|---:|---:|
| train | 53874 | 2689 | 0.0499 | 23.8371 | -54.2884 | 45.0737 |
| test | 13469 | 713 | 0.0529 | 23.8290 | -55.2884 | 41.7476 |

### Évaluation labels (train set)

Non disponible / non pertinente ici : après filtre, train+test ne contiennent que `normal`, donc pas de classes positives (attaques) pour precision/recall/F1 sur le split interne.

### Sauvegarde modèle

| Champ | Valeur |
|---|---|
| model_id | `49` |
| model_name | `nsl_ocsvm_normal_nov5` |
| algorithm | `one_class_svm` |
| model_type | `anomaly` |
| path | `/app/saved_models/6a7649c85389ffb49703be24_nsl_ocsvm_normal_nov5_20261105_202020.joblib` |
| saved_at | 2026-11-05T20:20:20.170806 |

### Use Model — prédiction sur CSV brut (125973 lignes)

| Champ | Valeur |
|---|---|
| rows_processed | **125973** |
| n_anomaly | **69507** |
| n_normal | **56466** |
| anomaly_rate | **0.5518** (55.2%) |
| score_min / mean / max | -55.2884 / -13.9894 / 30.0683 |
| pipeline_applied | True |
| target_column (display only) | `attack_type` |
| unexpected columns ignored | `['difficulty_level']` |
| chunks | 32 × 4000 |

Note Use Model : le CSV contient encore toutes les classes d'attaque + `difficulty_level`. Le pipeline sauvegardé (label/one-hot) est réappliqué ; `difficulty_level` est ignoré ; `attack_type` n'est **pas** utilisé comme feature.

## 7. Évaluation ground-truth (attaque vs anomalie prédite)

Définition positive : **y_true** = `attack_type != normal` (vraie attaque) ; **y_pred** = modèle a prédit anomalie. Évalué sur les **125973** lignes du CSV brut (Use Model).

### Isolation Forest (model_id 48)

| Métrique | Valeur |
|---|---:|
| n (lignes) | **125973** |
| support_attack (y_true+) | 58630 |
| support_normal (y_true-) | 67343 |
| predicted_anomaly | 56894 |
| predicted_normal | 69079 |
| TP / FP / TN / FN | 53325 / 3569 / 63774 / 5305 |
| **Accuracy** | **0.9296** |
| **Precision** | **0.9373** |
| **Recall (sensibilité)** | **0.9095** |
| Specificity | 0.9470 |
| **F1** | **0.9232** |
| FPR | 0.0530 |
| FNR | 0.0905 |
| score_mean (vraies attaques) | -0.0697 |
| score_mean (vrais normal) | 0.0991 |

### One-Class SVM (model_id 49)

| Métrique | Valeur |
|---|---:|
| n (lignes) | **125973** |
| support_attack (y_true+) | 58630 |
| support_normal (y_true-) | 67343 |
| predicted_anomaly | 69507 |
| predicted_normal | 56466 |
| TP / FP / TN / FN | 57104 / 12403 / 54940 / 1526 |
| **Accuracy** | **0.8894** |
| **Precision** | **0.8216** |
| **Recall (sensibilité)** | **0.9740** |
| Specificity | 0.8158 |
| **F1** | **0.8913** |
| FPR | 0.1842 |
| FNR | 0.0260 |
| score_mean (vraies attaques) | -44.1465 |
| score_mean (vrais normal) | 12.2660 |

## 8. Synthèse comparative

| Modèle | Durée train | Contam./nu | Anomaly rate CSV | Accuracy | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Isolation Forest | 4.1s | contamination=0.05 | 0.4516 | **0.9296** | **0.9373** | **0.9095** | **0.9232** |
| One-Class SVM | 1m 16s | nu=0.05 | 0.5518 | **0.8894** | **0.8216** | **0.9740** | **0.8913** |

## 9. Interprétation

- Les modèles sont entraînés **uniquement sur du trafic normal** (one-class / anomaly setting).
- Sur le split interne (aussi 100% normal), le taux d'anomalies ≈ contamination/nu (~5%) : ce sont des faux positifs attendus sur le profil normal.
- Sur le CSV complet (normal + attaques), le taux d'anomalies monte fortement (IF ≈ 45.2%, OCSVM ≈ 55.2%), ce qui est cohérent avec la présence d'attaques dans le fichier brut.
- Contre la vérité terrain : Isolation Forest est plus précis (acc=0.9296, F1=0.9232, FPR=0.0530) ; One-Class SVM détecte plus d'attaques (recall=0.9740) au prix de plus de faux positifs (FPR=0.1842, precision=0.8216).

*Généré le 2026-11-05 23:13:15 CET*
