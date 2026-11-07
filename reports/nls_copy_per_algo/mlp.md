## 5. Neural Net — MLP (PyTorch)

### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm (code) | `mlp` / model_type loggé `mlp` |
| Training ID | `mlp_1792825613_6266dad8` |
| Dataset | `nls_copy` |
| User ID | `6a7649c85389ffb49703be24` |
| Status | `success` / event `training_finished` |
| Started (UTC) | 2026-10-24T07:06:53.501599+00:00 |
| Started (Europe/Madrid) | 2026-10-24 09:06:53 (Europe/Madrid) |
| Finished (UTC) | 2026-10-24T07:19:22.101782+00:00 |
| Finished (Europe/Madrid) | 2026-10-24 09:19:22 (Europe/Madrid) |
| Duration | **748.600 s** (12.48 min) |
| Result timestamp | 2026-10-24T07:19:21.829832 |

### Requête / paramètres envoyés (start log)

| Paramètre request | Valeur |
|---|---|
| `activation` | `relu` |
| `batch_size` | `32` |
| `bootstrap_params` | `None` |
| `cv_params` | `None` |
| `dropout_rate` | `0.2` |
| `epochs` | `100` |
| `layers` | `[64, 32]` |
| `learning_rate` | `0.001` |
| `model_type` | `mlp` |
| `n_repetitions` | `5` |
| `numerized_dataset_name` | `nls_copy` |
| `original_dataset_name` | `nls_copy` |
| `patience` | `10` |
| `problem_type` | `auto` |
| `time_series_column` | `None` |
| `time_series_params` | `None` |
| `training_id` | `mlp_1792825613_6266dad8` |
| `use_scaling` | `True` |
| `validation_method` | `holdout` |
| `validation_split` | `0.2` |

### Méthode de validation

| Champ | Valeur |
|---|---|
| Méthode | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score (holdout) | 0.978456 |
| std_score (holdout) | 0.001115 |
| best_repetition | 3 |
| best_score | 0.979599 |

#### Détail de chaque répétition

| Rep | Score validation | Score train | train_size | val_size | test% | best_val_loss | n_classes | output_size_used |
|---:|---:|---:|---:|---:|---:|---|---|---|
| 1 | 0.978686 | — | 100778 | 25195 | 20.0 | 0.925606 | 5 | 5 |
| 2 | 0.979202 | — | 100778 | 25195 | 20.0 | 0.925139 | 5 | 5 |
| 3 | 0.979599 | — | 100778 | 25195 | 20.0 | 0.924970 | 5 | 5 |
| 4 | 0.976384 | — | 100778 | 25195 | 20.0 | 0.926934 | 5 | 5 |
| 5 | 0.978408 | — | 100778 | 25195 | 20.0 | 0.924826 | 5 | 5 |

#### Paramètres utilisés par répétition (MLP)

- Rep 1: `{"layers": [64, 32], "activation": "relu", "dropout_rate": 0.2, "learning_rate": 0.001, "batch_size": 32, "epochs": 100, "patience": 10}` | best_val_loss=0.9256059306272085 | score=0.978686
- Rep 2: `{"layers": [64, 32], "activation": "relu", "dropout_rate": 0.2, "learning_rate": 0.001, "batch_size": 32, "epochs": 100, "patience": 10}` | best_val_loss=0.925139229859263 | score=0.979202
- Rep 3: `{"layers": [64, 32], "activation": "relu", "dropout_rate": 0.2, "learning_rate": 0.001, "batch_size": 32, "epochs": 100, "patience": 10}` | best_val_loss=0.9249702927469616 | score=0.979599
- Rep 4: `{"layers": [64, 32], "activation": "relu", "dropout_rate": 0.2, "learning_rate": 0.001, "batch_size": 32, "epochs": 100, "patience": 10}` | best_val_loss=0.9269337865468362 | score=0.976384
- Rep 5: `{"layers": [64, 32], "activation": "relu", "dropout_rate": 0.2, "learning_rate": 0.001, "batch_size": 32, "epochs": 100, "patience": 10}` | best_val_loss=0.9248263185472332 | score=0.978408

#### Early stopping / historique (MLP) — résumé

| Rep | epochs run | best epoch (min val_loss) | min val_loss | last train acc | last val acc |
|---:|---:|---:|---:|---:|---:|
| 1 | 44 | 34 | 0.925606 | 0.979757 | 0.978686 |
| 2 | 19 | 9 | 0.925139 | 0.978269 | 0.979202 |
| 3 | 31 | 21 | 0.924970 | 0.979132 | 0.979599 |
| 4 | 25 | 15 | 0.926934 | 0.978656 | 0.976384 |
| 5 | 29 | 19 | 0.924826 | 0.978597 | 0.978408 |

### Hyperparamètres & paramètres effectifs

```json
{
  "layers_used": [
    64,
    32
  ],
  "activation_used": "relu",
  "dropout_rate_used": 0.2,
  "learning_rate_used": 0.001,
  "batch_size_used": 32,
  "training_info": {
    "model_trained_once": false,
    "used_cv_best_model": false,
    "used_bootstrap_model": false,
    "used_holdout_model": true,
    "used_timeseries_model": false,
    "training_samples": 125973,
    "test_samples": 22544,
    "parameter_optimization": "User parameters used - no optimization",
    "final_model_source": "best_holdout_repetition",
    "early_stopping_used": true,
    "training_id": "mlp_1792825613_6266dad8",
    "date_column_excluded": false
  }
}
```

### Métriques finales (affichage UI / test set)

| Métrique | Valeur |
|---|---:|
| accuracy | 0.711364 |
| precision | 0.669404 |
| recall | 0.711364 |
| f1 | 0.668218 |
| roc_auc | None |
| train_accuracy | 0.979623 |
| n_classes | 5 |
| classes | ['0.0', '1.0', '2.0', '3.0', '4.0'] |
| target_column | class |

### Matrice de confusion (test)

| actual \ pred | 0.0 | 1.0 | 2.0 | 3.0 | 4.0 |
|---|---:|---:|---:|---:|---:|
| **0.0** | 5427 | 1870 | 100 | 63 | 0 |
| **1.0** | 450 | 9023 | 237 | 1 | 0 |
| **2.0** | 242 | 478 | 1557 | 144 | 0 |
| **3.0** | 7 | 2844 | 4 | 30 | 0 |
| **4.0** | 4 | 63 | 0 | 0 | 0 |

### Classification report (test)

| Classe / avg | precision | recall | f1-score | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.885318 | 0.727480 | 0.798675 | 7460.0 |
| 1.0 | 0.631951 | 0.929153 | 0.752261 | 9711.0 |
| 2.0 | 0.820337 | 0.643123 | 0.721000 | 2421.0 |
| 3.0 | 0.126050 | 0.010399 | 0.019212 | 2885.0 |
| 4.0 | 0.000000 | 0.000000 | 0.000000 | 67.0 |
| accuracy | | | 0.711364 | |
| macro avg | 0.492731 | 0.462031 | 0.458230 | 22544.0 |
| weighted avg | 0.669404 | 0.711364 | 0.668218 | 22544.0 |

### training_info

```json
{
  "model_trained_once": false,
  "used_cv_best_model": false,
  "used_bootstrap_model": false,
  "used_holdout_model": true,
  "used_timeseries_model": false,
  "training_samples": 125973,
  "test_samples": 22544,
  "parameter_optimization": "User parameters used - no optimization",
  "final_model_source": "best_holdout_repetition",
  "early_stopping_used": true,
  "training_id": "mlp_1792825613_6266dad8",
  "date_column_excluded": false
}
```

---
