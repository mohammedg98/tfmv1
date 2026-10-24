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

## 1. Logistic Regression

### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm (code) | `logistic` / model_type loggé `logistic` |
| Training ID | `logistic_1792824556_f6646334` |
| Dataset | `nls_copy` |
| User ID | `6a7649c85389ffb49703be24` |
| Status | `success` / event `training_finished` |
| Started (UTC) | 2026-10-24T06:49:16.723545+00:00 |
| Started (Europe/Madrid) | 2026-10-24 08:49:16 (Europe/Madrid) |
| Finished (UTC) | 2026-10-24T07:01:07.802810+00:00 |
| Finished (Europe/Madrid) | 2026-10-24 09:01:07 (Europe/Madrid) |
| Duration | **711.079 s** (11.85 min) |
| Result timestamp | 2026-10-24T07:01:07.557951 |

### Requête / paramètres envoyés (start log)

| Paramètre request | Valeur |
|---|---|
| `C_search_space` | `None` |
| `bootstrap_params` | `None` |
| `class_weight` | `None` |
| `cv_params` | `None` |
| `date_column` | `None` |
| `l1_ratio` | `None` |
| `max_iter` | `1000` |
| `model_type` | `logistic` |
| `multi_class` | `auto` |
| `n_repetitions` | `5` |
| `n_trials` | `20` |
| `numerized_dataset_name` | `nls_copy` |
| `original_dataset_name` | `nls_copy` |
| `penalty` | `l2` |
| `random_search` | `False` |
| `random_search_seed` | `42` |
| `random_state` | `None` |
| `solver` | `lbfgs` |
| `time_series_params` | `None` |
| `training_id` | `logistic_1792824556_f6646334` |
| `use_scaling` | `True` |
| `validation_method` | `holdout` |

### Méthode de validation

| Champ | Valeur |
|---|---|
| Méthode | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score (holdout) | 0.989268 |
| std_score (holdout) | 0.000546 |
| best_repetition | 5 |
| best_score | 0.989919 |
| best_C (agrégé) | 1000.0 |

#### Détail de chaque répétition

| Rep | Score validation | Score train | train_size | val_size | test% | best_C |
|---:|---:|---:|---:|---:|---:|---|
| 1 | 0.989680 | 0.989680 | 100778 | 25195 | — | 100.000000 |
| 2 | 0.989125 | 0.990008 | 100778 | 25195 | — | 100.000000 |
| 3 | 0.988331 | 0.990087 | 100778 | 25195 | — | 1000.000000 |
| 4 | 0.989284 | 0.989849 | 100778 | 25195 | — | 100.000000 |
| 5 | 0.989919 | 0.989978 | 100778 | 25195 | — | 1000.000000 |

#### Recherche de C par répétition (Logistic)

**Répétition 1** — best_C=100.0, score=0.989680

| C | Score validation |
|---:|---:|
| 0.001 | 0.970232 |
| 0.01 | 0.978964 |
| 0.1 | 0.988688 |
| 1 | 0.989006 |
| 10 | 0.989165 |
| 100 | 0.989680 |
| 1000 | 0.989561 |

**Répétition 2** — best_C=100.0, score=0.989125

| C | Score validation |
|---:|---:|
| 0.001 | 0.970073 |
| 0.01 | 0.978647 |
| 0.1 | 0.987617 |
| 1 | 0.988569 |
| 10 | 0.988847 |
| 100 | 0.989125 |
| 1000 | 0.989045 |

**Répétition 3** — best_C=1000.0, score=0.988331

| C | Score validation |
|---:|---:|
| 0.001 | 0.970073 |
| 0.01 | 0.978448 |
| 0.1 | 0.986902 |
| 1 | 0.988013 |
| 10 | 0.988172 |
| 100 | 0.988212 |
| 1000 | 0.988331 |

**Répétition 4** — best_C=100.0, score=0.989284

| C | Score validation |
|---:|---:|
| 0.001 | 0.970669 |
| 0.01 | 0.978845 |
| 0.1 | 0.988093 |
| 1 | 0.988887 |
| 10 | 0.989244 |
| 100 | 0.989284 |
| 1000 | 0.989006 |

**Répétition 5** — best_C=1000.0, score=0.989919

| C | Score validation |
|---:|---:|
| 0.001 | 0.969438 |
| 0.01 | 0.977813 |
| 0.1 | 0.988252 |
| 1 | 0.989601 |
| 10 | 0.989760 |
| 100 | 0.989760 |
| 1000 | 0.989919 |

### Hyperparamètres & paramètres effectifs

```json
{
  "metadata": {
    "model_type": "logistic_regression",
    "C_used": 1000.0,
    "C_selection_method": "validation_split",
    "penalty": "l2",
    "solver": "lbfgs",
    "multi_class": "auto",
    "n_features": 119,
    "n_train_samples": 125973,
    "n_test_samples": 22544,
    "validation_method": "holdout",
    "class_names": [
      "0.0",
      "1.0",
      "2.0",
      "3.0",
      "4.0"
    ],
    "used_validation_model": true,
    "final_model_source": "best_holdout_repetition_5",
    "date_column_excluded": false
  },
  "best_C_used": 1000.0,
  "C_search_space": [
    0.001,
    0.01,
    0.1,
    1,
    10,
    100,
    1000
  ],
  "C_selection_method": "validation_split",
  "training_info": {
    "model_trained_once": false,
    "used_cv_best_model": false,
    "used_bootstrap_model": false,
    "used_holdout_model": true,
    "used_timeseries_model": false,
    "final_model_source": "best_holdout_repetition_5",
    "training_samples": 125973,
    "test_samples": 22544,
    "parameter_optimization": "C optimization using holdout",
    "n_repetitions": 5,
    "validation_method": "holdout",
    "date_column_excluded": false,
    "date_column": null
  }
}
```

**Features utilisées (119):**

`flag_sh`, `duration`, `protocol_type`, `src_bytes`, `dst_bytes`, `land`, `wrong_fragment`, `urgent`, `hot`, `num_failed_logins`, `logged_in`, `num_compromised`, `root_shell`, `su_attempted`, `num_root`, `num_file_creations`, `num_shells`, `num_access_files`, `is_host_login`, `is_guest_login`, `count`, `srv_count`, `serror_rate`, `srv_serror_rate`, `rerror_rate`, `srv_rerror_rate`, `same_srv_rate`, `diff_srv_rate`, `srv_diff_host_rate`, `dst_host_count`, `dst_host_srv_count`, `dst_host_same_srv_rate`, `dst_host_diff_srv_rate`, `dst_host_same_src_port_rate`, `dst_host_srv_diff_host_rate`, `dst_host_serror_rate`, `dst_host_srv_serror_rate`, `dst_host_rerror_rate`, `dst_host_srv_rerror_rate`, `service_aol`, `service_auth`, `service_bgp`, `service_courier`, `service_csnet_ns`, `service_ctf`, `service_daytime`, `service_discard`, `service_domain`, `service_domain_u`, `service_echo`, `service_eco_i`, `service_ecr_i`, `service_efs`, `service_exec`, `service_finger`, `service_ftp`, `service_ftp_data`, `service_gopher`, `service_harvest`, `service_hostnames`, `service_http`, `service_http_2784`, `service_http_443`, `service_http_8001`, `service_imap4`, `service_irc`, `service_iso_tsap`, `service_klogin`, `service_kshell`, `service_ldap`, `service_link`, `service_login`, `service_mtp`, `service_name`, `service_netbios_dgm`, `service_netbios_ns`, `service_netbios_ssn`, `service_netstat`, `service_nnsp`, `service_nntp`, `service_ntp_u`, `service_other`, `service_pm_dump`, `service_pop_2`, `service_pop_3`, `service_printer`, `service_private`, `service_red_i`, `service_remote_job`, `service_rje`, `service_shell`, `service_smtp`, `service_sql_net`, `service_ssh`, `service_sunrpc`, `service_supdup`, `service_systat`, `service_telnet`, `service_tftp_u`, `service_tim_i`, `service_time`, `service_urh_i`, `service_urp_i`, `service_uucp`, `service_uucp_path`, `service_vmnet`, `service_whois`, `service_x11`, `service_z39_50`, `flag_oth`, `flag_rej`, `flag_rsto`, `flag_rstos0`, `flag_rstr`, `flag_s0`, `flag_s1`, `flag_s2`, `flag_s3`, `flag_sf`

### Métriques finales (affichage UI / test set)

| Métrique | Valeur |
|---|---:|
| accuracy | 0.761089 |
| precision | 0.753803 |
| recall | 0.761089 |
| f1 | 0.722912 |
| roc_auc | None |
| log_loss | 2.842005 |
| train_accuracy | 0.989966 |
| final_test.accuracy | 0.761089 |
| final_test.precision | 0.753803 |
| final_test.recall | 0.761089 |
| final_test.f1 | 0.722912 |
| final_train.accuracy | 0.989966 |
| n_classes | 5 |
| classes | ['0.0', '1.0', '2.0', '3.0', '4.0'] |
| target_column | class |

### Matrice de confusion (test)

| actual \ pred | 0.0 | 1.0 | 2.0 | 3.0 | 4.0 |
|---|---:|---:|---:|---:|---:|
| **0.0** | 6223 | 1233 | 4 | 0 | 0 |
| **1.0** | 79 | 9032 | 595 | 1 | 4 |
| **2.0** | 118 | 425 | 1749 | 129 | 0 |
| **3.0** | 3 | 2741 | 5 | 128 | 8 |
| **4.0** | 2 | 35 | 0 | 4 | 26 |

### Classification report (test)

| Classe / avg | precision | recall | f1-score | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.968560 | 0.834182 | 0.896363 | 7460.0 |
| 1.0 | 0.670726 | 0.930079 | 0.779393 | 9711.0 |
| 2.0 | 0.743306 | 0.722429 | 0.732719 | 2421.0 |
| 3.0 | 0.488550 | 0.044367 | 0.081347 | 2885.0 |
| 4.0 | 0.684211 | 0.388060 | 0.495238 | 67.0 |
| accuracy | | | 0.761089 | |
| macro avg | 0.711071 | 0.583823 | 0.597012 | 22544.0 |
| weighted avg | 0.753803 | 0.761089 | 0.722912 | 22544.0 |

### Feature importance (top 20)

| Rang | Feature | Importance |
|---:|---|---:|
| 1 | `is_guest_login` | 5.291409 |
| 2 | `num_file_creations` | 5.025860 |
| 3 | `duration` | 3.999612 |
| 4 | `hot` | 3.904614 |
| 5 | `protocol_type` | 2.671285 |
| 6 | `wrong_fragment` | 2.420069 |
| 7 | `dst_host_same_srv_rate` | 2.275400 |
| 8 | `count` | 2.016701 |
| 9 | `srv_count` | 1.945216 |
| 10 | `service_private` | 1.636728 |
| 11 | `same_srv_rate` | 1.620601 |
| 12 | `num_root` | 1.557458 |
| 13 | `service_eco_i` | 1.488315 |
| 14 | `dst_host_serror_rate` | 1.410893 |
| 15 | `flag_sf` | 1.402888 |
| 16 | `serror_rate` | 1.392022 |
| 17 | `flag_s0` | 1.321427 |
| 18 | `srv_serror_rate` | 1.267117 |
| 19 | `num_compromised` | 1.187302 |
| 20 | `dst_host_srv_count` | 1.132245 |

### training_info

```json
{
  "model_trained_once": false,
  "used_cv_best_model": false,
  "used_bootstrap_model": false,
  "used_holdout_model": true,
  "used_timeseries_model": false,
  "final_model_source": "best_holdout_repetition_5",
  "training_samples": 125973,
  "test_samples": 22544,
  "parameter_optimization": "C optimization using holdout",
  "n_repetitions": 5,
  "validation_method": "holdout",
  "date_column_excluded": false,
  "date_column": null
}
```

---

## 2. k-Nearest Neighbors (KNN)

### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm (code) | `knn` / model_type loggé `knn` |
| Training ID | `knn_1792825269_9b68403d` |
| Dataset | `nls_copy` |
| User ID | `6a7649c85389ffb49703be24` |
| Status | `success` / event `training_finished` |
| Started (UTC) | 2026-10-24T07:01:09.332073+00:00 |
| Started (Europe/Madrid) | 2026-10-24 09:01:09 (Europe/Madrid) |
| Finished (UTC) | 2026-10-24T07:05:53.406878+00:00 |
| Finished (Europe/Madrid) | 2026-10-24 09:05:53 (Europe/Madrid) |
| Duration | **284.075 s** (4.73 min) |
| Result timestamp | 2026-10-24T07:05:53.034722 |

### Requête / paramètres envoyés (start log)

| Paramètre request | Valeur |
|---|---|
| `algorithm` | `auto` |
| `bootstrap_params` | `None` |
| `cv_params` | `None` |
| `final_training_on_all_data` | `False` |
| `leaf_size` | `30` |
| `metric` | `minkowski` |
| `model_type` | `knn` |
| `n_neighbors` | `5` |
| `n_repetitions` | `5` |
| `n_trials` | `20` |
| `numerized_dataset_name` | `nls_copy` |
| `original_dataset_name` | `nls_copy` |
| `p` | `2` |
| `random_search` | `False` |
| `random_search_seed` | `42` |
| `time_series_column` | `None` |
| `time_series_params` | `None` |
| `training_id` | `knn_1792825269_9b68403d` |
| `use_scaling` | `False` |
| `validation_method` | `holdout` |
| `weights` | `uniform` |

### Méthode de validation

| Champ | Valeur |
|---|---|
| Méthode | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score (holdout) | 0.992141 |
| std_score (holdout) | 0.000466 |
| best_repetition | 5 |
| best_score | 0.992538 |

#### Détail de chaque répétition

| Rep | Score validation | Score train | train_size | val_size | test% |  |
|---:|---:|---:|---:|---:|---:|
| 1 | 0.992300 | 0.994632 | 100778 | 25195 | 20.0 |  |
| 2 | 0.992260 | 0.994592 | 100778 | 25195 | 20.0 |  |
| 3 | 0.992379 | 0.994791 | 100778 | 25195 | 20.0 |  |
| 4 | 0.991228 | 0.994840 | 100778 | 25195 | 20.0 |  |
| 5 | 0.992538 | 0.994642 | 100778 | 25195 | 20.0 |  |

### Hyperparamètres & paramètres effectifs

```json
{
  "n_neighbors_used": 5,
  "weights_used": "uniform",
  "metric_used": "minkowski",
  "algorithm_used": "auto",
  "final_params_used": {
    "n_neighbors": 5,
    "weights": "uniform",
    "algorithm": "auto",
    "leaf_size": 30,
    "p": 2,
    "metric": "minkowski"
  },
  "training_info": {
    "final_training_data": "train_only",
    "all_data_samples": 125973,
    "train_samples_used": 125973,
    "test_samples_used": 0,
    "final_model_trained_on": "train_data_only",
    "n_repetitions": 5,
    "validation_method": "holdout",
    "date_column_excluded": false,
    "scaling_applied": false,
    "model_trained_once": false,
    "used_cv_best_model": false,
    "used_bootstrap_model": false,
    "used_holdout_repeated_model": true,
    "used_timeseries_model": false,
    "final_model_source": "best_holdout_fold_5",
    "training_samples": 125973,
    "test_samples": 22544,
    "feature_scaling": "No scaling applied",
    "parameter_optimization": "User parameters used - no optimization"
  }
}
```

**Features utilisées (119):**

`duration`, `protocol_type`, `src_bytes`, `dst_bytes`, `land`, `wrong_fragment`, `urgent`, `hot`, `num_failed_logins`, `logged_in`, `num_compromised`, `root_shell`, `su_attempted`, `num_root`, `num_file_creations`, `num_shells`, `num_access_files`, `is_host_login`, `is_guest_login`, `count`, `srv_count`, `serror_rate`, `srv_serror_rate`, `rerror_rate`, `srv_rerror_rate`, `same_srv_rate`, `diff_srv_rate`, `srv_diff_host_rate`, `dst_host_count`, `dst_host_srv_count`, `dst_host_same_srv_rate`, `dst_host_diff_srv_rate`, `dst_host_same_src_port_rate`, `dst_host_srv_diff_host_rate`, `dst_host_serror_rate`, `dst_host_srv_serror_rate`, `dst_host_rerror_rate`, `dst_host_srv_rerror_rate`, `service_aol`, `service_auth`, `service_bgp`, `service_courier`, `service_csnet_ns`, `service_ctf`, `service_daytime`, `service_discard`, `service_domain`, `service_domain_u`, `service_echo`, `service_eco_i`, `service_ecr_i`, `service_efs`, `service_exec`, `service_finger`, `service_ftp`, `service_ftp_data`, `service_gopher`, `service_harvest`, `service_hostnames`, `service_http`, `service_http_2784`, `service_http_443`, `service_http_8001`, `service_imap4`, `service_irc`, `service_iso_tsap`, `service_klogin`, `service_kshell`, `service_ldap`, `service_link`, `service_login`, `service_mtp`, `service_name`, `service_netbios_dgm`, `service_netbios_ns`, `service_netbios_ssn`, `service_netstat`, `service_nnsp`, `service_nntp`, `service_ntp_u`, `service_other`, `service_pm_dump`, `service_pop_2`, `service_pop_3`, `service_printer`, `service_private`, `service_red_i`, `service_remote_job`, `service_rje`, `service_shell`, `service_smtp`, `service_sql_net`, `service_ssh`, `service_sunrpc`, `service_supdup`, `service_systat`, `service_telnet`, `service_tftp_u`, `service_tim_i`, `service_time`, `service_urh_i`, `service_urp_i`, `service_uucp`, `service_uucp_path`, `service_vmnet`, `service_whois`, `service_x11`, `service_z39_50`, `flag_oth`, `flag_rej`, `flag_rsto`, `flag_rstos0`, `flag_rstr`, `flag_s0`, `flag_s1`, `flag_s2`, `flag_s3`, `flag_sf`, `flag_sh`

### Métriques finales (affichage UI / test set)

| Métrique | Valeur |
|---|---:|
| accuracy | 0.730438 |
| precision | 0.720892 |
| recall | 0.730438 |
| f1 | 0.680477 |
| roc_auc | None |
| train_accuracy | 0.995436 |
| final_test.accuracy | 0.730438 |
| final_test.precision | 0.720892 |
| final_test.recall | 0.730438 |
| final_test.f1 | 0.680477 |
| final_train.accuracy | 0.995436 |
| n_classes | 5 |
| classes | ['0.0', '1.0', '2.0', '3.0', '4.0'] |
| target_column | class |
| effective_n_neighbors | 5 |

### Matrice de confusion (test)

| actual \ pred | 0.0 | 1.0 | 2.0 | 3.0 | 4.0 |
|---|---:|---:|---:|---:|---:|
| **0.0** | 5565 | 1602 | 293 | 0 | 0 |
| **1.0** | 131 | 9438 | 134 | 8 | 0 |
| **2.0** | 290 | 681 | 1450 | 0 | 0 |
| **3.0** | 52 | 2680 | 147 | 6 | 0 |
| **4.0** | 0 | 59 | 0 | 0 | 8 |

### Classification report (test)

| Classe / avg | precision | recall | f1-score | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.921663 | 0.745979 | 0.824567 | 7460.0 |
| 1.0 | 0.652697 | 0.971888 | 0.780936 | 9711.0 |
| 2.0 | 0.716403 | 0.598926 | 0.652418 | 2421.0 |
| 3.0 | 0.428571 | 0.002080 | 0.004139 | 2885.0 |
| 4.0 | 1.000000 | 0.119403 | 0.213333 | 67.0 |
| accuracy | | | 0.730438 | |
| macro avg | 0.743867 | 0.487655 | 0.495079 | 22544.0 |
| weighted avg | 0.720892 | 0.730438 | 0.680477 | 22544.0 |

### Feature importance (top 20)

| Rang | Feature | Importance |
|---:|---|---:|
| 1 | `src_bytes` | 0.593282 |
| 2 | `dst_bytes` | 0.406408 |
| 3 | `duration` | 0.000263 |
| 4 | `count` | 0.000012 |
| 5 | `dst_host_srv_count` | 0.000011 |
| 6 | `dst_host_count` | 0.000010 |
| 7 | `srv_count` | 0.000007 |
| 8 | `num_root` | 0.000002 |
| 9 | `num_compromised` | 0.000002 |
| 10 | `hot` | 0.000000 |
| 11 | `flag_sf` | 0.000000 |
| 12 | `logged_in` | 0.000000 |
| 13 | `num_file_creations` | 0.000000 |
| 14 | `service_http` | 0.000000 |
| 15 | `dst_host_same_srv_rate` | 0.000000 |
| 16 | `flag_s0` | 0.000000 |
| 17 | `srv_serror_rate` | 0.000000 |
| 18 | `serror_rate` | 0.000000 |
| 19 | `dst_host_srv_serror_rate` | 0.000000 |
| 20 | `dst_host_serror_rate` | 0.000000 |

### training_info

```json
{
  "final_training_data": "train_only",
  "all_data_samples": 125973,
  "train_samples_used": 125973,
  "test_samples_used": 0,
  "final_model_trained_on": "train_data_only",
  "n_repetitions": 5,
  "validation_method": "holdout",
  "date_column_excluded": false,
  "scaling_applied": false,
  "model_trained_once": false,
  "used_cv_best_model": false,
  "used_bootstrap_model": false,
  "used_holdout_repeated_model": true,
  "used_timeseries_model": false,
  "final_model_source": "best_holdout_fold_5",
  "training_samples": 125973,
  "test_samples": 22544,
  "feature_scaling": "No scaling applied",
  "parameter_optimization": "User parameters used - no optimization"
}
```

---

## 3. LightGBM

### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm (code) | `lightgbm` / model_type loggé `lightgbm` |
| Training ID | `lightgbm_1792825556_1083687e` |
| Dataset | `nls_copy` |
| User ID | `6a7649c85389ffb49703be24` |
| Status | `success` / event `training_finished` |
| Started (UTC) | 2026-10-24T07:05:56.898682+00:00 |
| Started (Europe/Madrid) | 2026-10-24 09:05:56 (Europe/Madrid) |
| Finished (UTC) | 2026-10-24T07:06:14.367334+00:00 |
| Finished (Europe/Madrid) | 2026-10-24 09:06:14 (Europe/Madrid) |
| Duration | **17.469 s** (0.29 min) |
| Result timestamp | 2026-10-24T07:06:14.150870 |

### Requête / paramètres envoyés (start log)

| Paramètre request | Valeur |
|---|---|
| `boosting_type` | `gbdt` |
| `bootstrap_params` | `None` |
| `colsample_bytree` | `1.0` |
| `cv_params` | `None` |
| `early_stopping_rounds` | `10` |
| `final_training_on_all_data` | `False` |
| `learning_rate` | `0.1` |
| `max_depth` | `-1` |
| `min_child_samples` | `20` |
| `model_type` | `lightgbm` |
| `n_estimators` | `100` |
| `n_jobs` | `-1` |
| `n_repetitions` | `5` |
| `n_trials` | `20` |
| `num_leaves` | `31` |
| `numerized_dataset_name` | `nls_copy` |
| `objective` | `None` |
| `original_dataset_name` | `nls_copy` |
| `random_search` | `False` |
| `random_search_seed` | `42` |
| `random_state` | `42` |
| `reg_alpha` | `0.0` |
| `reg_lambda` | `0.0` |
| `subsample` | `1.0` |
| `time_series_column` | `None` |
| `time_series_params` | `None` |
| `training_id` | `lightgbm_1792825556_1083687e` |
| `validation_method` | `holdout` |
| `verbose` | `-1` |

### Méthode de validation

| Champ | Valeur |
|---|---|
| Méthode | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score (holdout) | 0.997023 |
| std_score (holdout) | 0.000470 |
| best_repetition | 5 |
| best_score | 0.997539 |

#### Détail de chaque répétition

| Rep | Score validation | Score train | train_size | val_size | test% | best_iteration |
|---:|---:|---:|---:|---:|---:|---|
| 1 | 0.997500 | 0.998571 | 100778 | 25195 | 20.0 | 22 |
| 2 | 0.996984 | 0.998621 | 100778 | 25195 | 20.0 | 33 |
| 3 | 0.996825 | 0.998105 | 100778 | 25195 | 20.0 | 24 |
| 4 | 0.996269 | 0.998234 | 100778 | 25195 | 20.0 | 27 |
| 5 | 0.997539 | 0.998690 | 100778 | 25195 | 20.0 | 24 |

### Hyperparamètres & paramètres effectifs

```json
{
  "objective_used": "multiclass",
  "boosting_type_used": "gbdt",
  "n_estimators_used": 100,
  "learning_rate_used": 0.1,
  "final_params_used": {
    "boosting_type": "gbdt",
    "num_leaves": 31,
    "learning_rate": 0.1,
    "n_estimators": 100,
    "max_depth": -1,
    "min_child_samples": 20,
    "subsample": 1.0,
    "colsample_bytree": 1.0,
    "reg_alpha": 0.0,
    "reg_lambda": 0.0,
    "random_state": 42,
    "n_jobs": -1,
    "verbose": -1,
    "objective": "multiclass",
    "num_class": 5,
    "early_stopping_rounds": 10
  },
  "training_info": {
    "final_training_data": "train_only",
    "all_data_samples": 125973,
    "train_samples_used": 125973,
    "test_samples_used": 0,
    "final_model_trained_on": "train_data_only",
    "n_repetitions": 5,
    "validation_method": "holdout",
    "date_column_excluded": false,
    "early_stopping_used": true,
    "best_iteration": 0,
    "model_trained_once": false,
    "used_cv_best_model": false,
    "used_bootstrap_model": false,
    "used_holdout_repeated_model": true,
    "used_timeseries_model": false,
    "final_model_source": "best_holdout_fold_5",
    "training_samples": 125973,
    "test_samples": 22544,
    "parameter_optimization": "User parameters used - no optimization"
  }
}
```

**Features utilisées (119):**

`duration`, `protocol_type`, `src_bytes`, `dst_bytes`, `land`, `wrong_fragment`, `urgent`, `hot`, `num_failed_logins`, `logged_in`, `num_compromised`, `root_shell`, `su_attempted`, `num_root`, `num_file_creations`, `num_shells`, `num_access_files`, `is_host_login`, `is_guest_login`, `count`, `srv_count`, `serror_rate`, `srv_serror_rate`, `rerror_rate`, `srv_rerror_rate`, `same_srv_rate`, `diff_srv_rate`, `srv_diff_host_rate`, `dst_host_count`, `dst_host_srv_count`, `dst_host_same_srv_rate`, `dst_host_diff_srv_rate`, `dst_host_same_src_port_rate`, `dst_host_srv_diff_host_rate`, `dst_host_serror_rate`, `dst_host_srv_serror_rate`, `dst_host_rerror_rate`, `dst_host_srv_rerror_rate`, `service_aol`, `service_auth`, `service_bgp`, `service_courier`, `service_csnet_ns`, `service_ctf`, `service_daytime`, `service_discard`, `service_domain`, `service_domain_u`, `service_echo`, `service_eco_i`, `service_ecr_i`, `service_efs`, `service_exec`, `service_finger`, `service_ftp`, `service_ftp_data`, `service_gopher`, `service_harvest`, `service_hostnames`, `service_http`, `service_http_2784`, `service_http_443`, `service_http_8001`, `service_imap4`, `service_irc`, `service_iso_tsap`, `service_klogin`, `service_kshell`, `service_ldap`, `service_link`, `service_login`, `service_mtp`, `service_name`, `service_netbios_dgm`, `service_netbios_ns`, `service_netbios_ssn`, `service_netstat`, `service_nnsp`, `service_nntp`, `service_ntp_u`, `service_other`, `service_pm_dump`, `service_pop_2`, `service_pop_3`, `service_printer`, `service_private`, `service_red_i`, `service_remote_job`, `service_rje`, `service_shell`, `service_smtp`, `service_sql_net`, `service_ssh`, `service_sunrpc`, `service_supdup`, `service_systat`, `service_telnet`, `service_tftp_u`, `service_tim_i`, `service_time`, `service_urh_i`, `service_urp_i`, `service_uucp`, `service_uucp_path`, `service_vmnet`, `service_whois`, `service_x11`, `service_z39_50`, `flag_oth`, `flag_rej`, `flag_rsto`, `flag_rstos0`, `flag_rstr`, `flag_s0`, `flag_s1`, `flag_s2`, `flag_s3`, `flag_sf`, `flag_sh`

### Métriques finales (affichage UI / test set)

| Métrique | Valeur |
|---|---:|
| accuracy | 0.758827 |
| precision | 0.763506 |
| recall | 0.758827 |
| f1 | 0.727432 |
| roc_auc | None |
| train_accuracy | 0.998341 |
| final_test.accuracy | 0.758827 |
| final_test.precision | 0.763506 |
| final_test.recall | 0.758827 |
| final_test.f1 | 0.727432 |
| final_train.accuracy | 0.998341 |
| n_classes | 5 |
| classes | ['0.0', '1.0', '2.0', '3.0', '4.0'] |
| target_column | class |
| best_iteration | 0 |

### Matrice de confusion (test)

| actual \ pred | 0.0 | 1.0 | 2.0 | 3.0 | 4.0 |
|---|---:|---:|---:|---:|---:|
| **0.0** | 6047 | 801 | 193 | 213 | 206 |
| **1.0** | 74 | 9422 | 201 | 4 | 10 |
| **2.0** | 163 | 798 | 1391 | 7 | 62 |
| **3.0** | 0 | 2625 | 7 | 244 | 9 |
| **4.0** | 0 | 55 | 0 | 9 | 3 |

### Classification report (test)

| Classe / avg | precision | recall | f1-score | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.962285 | 0.810590 | 0.879948 | 7460.0 |
| 1.0 | 0.687687 | 0.970240 | 0.804886 | 9711.0 |
| 2.0 | 0.776228 | 0.574556 | 0.660337 | 2421.0 |
| 3.0 | 0.511530 | 0.084575 | 0.145152 | 2885.0 |
| 4.0 | 0.010345 | 0.044776 | 0.016807 | 67.0 |
| accuracy | | | 0.758827 | |
| macro avg | 0.589615 | 0.496947 | 0.501426 | 22544.0 |
| weighted avg | 0.763506 | 0.758827 | 0.727432 | 22544.0 |

### Feature importance (top 20)

| Rang | Feature | Importance |
|---:|---|---:|
| 1 | `src_bytes` | 0.153846 |
| 2 | `dst_host_count` | 0.077692 |
| 3 | `dst_bytes` | 0.065641 |
| 4 | `dst_host_srv_count` | 0.064615 |
| 5 | `dst_host_same_src_port_rate` | 0.048205 |
| 6 | `dst_host_same_srv_rate` | 0.042564 |
| 7 | `dst_host_diff_srv_rate` | 0.037179 |
| 8 | `dst_host_serror_rate` | 0.036667 |
| 9 | `count` | 0.030513 |
| 10 | `duration` | 0.029231 |
| 11 | `dst_host_rerror_rate` | 0.026667 |
| 12 | `dst_host_srv_diff_host_rate` | 0.024103 |
| 13 | `diff_srv_rate` | 0.021795 |
| 14 | `dst_host_srv_serror_rate` | 0.020513 |
| 15 | `service_http` | 0.020256 |
| 16 | `hot` | 0.020000 |
| 17 | `service_ftp_data` | 0.018462 |
| 18 | `wrong_fragment` | 0.017436 |
| 19 | `service_private` | 0.016923 |
| 20 | `srv_count` | 0.015641 |

### training_info

```json
{
  "final_training_data": "train_only",
  "all_data_samples": 125973,
  "train_samples_used": 125973,
  "test_samples_used": 0,
  "final_model_trained_on": "train_data_only",
  "n_repetitions": 5,
  "validation_method": "holdout",
  "date_column_excluded": false,
  "early_stopping_used": true,
  "best_iteration": 0,
  "model_trained_once": false,
  "used_cv_best_model": false,
  "used_bootstrap_model": false,
  "used_holdout_repeated_model": true,
  "used_timeseries_model": false,
  "final_model_source": "best_holdout_fold_5",
  "training_samples": 125973,
  "test_samples": 22544,
  "parameter_optimization": "User parameters used - no optimization"
}
```

---

## 4. Random Forest

### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm (code) | `random_forest` / model_type loggé `random_forest` |
| Training ID | `random_forest_1792825577_516a6ea2` |
| Dataset | `nls_copy` |
| User ID | `6a7649c85389ffb49703be24` |
| Status | `success` / event `training_finished` |
| Started (UTC) | 2026-10-24T07:06:17.058532+00:00 |
| Started (Europe/Madrid) | 2026-10-24 09:06:17 (Europe/Madrid) |
| Finished (UTC) | 2026-10-24T07:06:48.428198+00:00 |
| Finished (Europe/Madrid) | 2026-10-24 09:06:48 (Europe/Madrid) |
| Duration | **31.370 s** (0.52 min) |
| Result timestamp | 2026-10-24T07:06:48.273604 |

### Requête / paramètres envoyés (start log)

| Paramètre request | Valeur |
|---|---|
| `bootstrap` | `True` |
| `bootstrap_params` | `None` |
| `criterion` | `gini` |
| `cv_params` | `None` |
| `final_training_on_all_data` | `False` |
| `max_depth` | `None` |
| `max_features` | `sqrt` |
| `min_samples_leaf` | `1` |
| `min_samples_split` | `2` |
| `model_type` | `random_forest` |
| `n_estimators` | `100` |
| `n_jobs` | `-1` |
| `n_repetitions` | `5` |
| `n_trials` | `20` |
| `numerized_dataset_name` | `nls_copy` |
| `oob_score` | `False` |
| `original_dataset_name` | `nls_copy` |
| `random_search` | `False` |
| `random_search_seed` | `42` |
| `time_series_column` | `None` |
| `time_series_params` | `None` |
| `training_id` | `random_forest_1792825577_516a6ea2` |
| `validation_method` | `holdout` |

### Méthode de validation

| Champ | Valeur |
|---|---|
| Méthode | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score (holdout) | 0.998833 |
| std_score (holdout) | 0.000203 |
| best_repetition | 1 |
| best_score | 0.999167 |

#### Détail de chaque répétition

| Rep | Score validation | Score train | train_size | val_size | test% | random_state |
|---:|---:|---:|---:|---:|---:|---|
| 1 | 0.999167 | 0.999970 | 100778 | 25195 | 20.0 | 0 |
| 2 | 0.998730 | 0.999960 | 100778 | 25195 | 20.0 | 1 |
| 3 | 0.998651 | 0.999970 | 100778 | 25195 | 20.0 | 2 |
| 4 | 0.998968 | 0.999931 | 100778 | 25195 | 20.0 | 3 |
| 5 | 0.998651 | 0.999960 | 100778 | 25195 | 20.0 | 4 |

### Hyperparamètres & paramètres effectifs

```json
{
  "final_params_used": {
    "n_estimators": 100,
    "max_depth": null,
    "min_samples_split": 2,
    "min_samples_leaf": 1,
    "max_features": "sqrt",
    "bootstrap": true,
    "oob_score": false,
    "n_jobs": -1,
    "random_state": null,
    "criterion": "gini"
  },
  "user_parameters_used": true,
  "training_info": {
    "final_training_data": "train_only",
    "all_data_samples": 125973,
    "train_samples_used": 125973,
    "test_samples_used": 0,
    "final_model_trained_on": "train_data_only",
    "n_repetitions": 5,
    "validation_method": "holdout",
    "date_column_excluded": false,
    "final_training_on_all_data": false,
    "training_samples": 125973,
    "test_samples": 22544,
    "final_model_samples": 125973
  }
}
```

**Features utilisées (119):**

`duration`, `protocol_type`, `src_bytes`, `dst_bytes`, `land`, `wrong_fragment`, `urgent`, `hot`, `num_failed_logins`, `logged_in`, `num_compromised`, `root_shell`, `su_attempted`, `num_root`, `num_file_creations`, `num_shells`, `num_access_files`, `is_host_login`, `is_guest_login`, `count`, `srv_count`, `serror_rate`, `srv_serror_rate`, `rerror_rate`, `srv_rerror_rate`, `same_srv_rate`, `diff_srv_rate`, `srv_diff_host_rate`, `dst_host_count`, `dst_host_srv_count`, `dst_host_same_srv_rate`, `dst_host_diff_srv_rate`, `dst_host_same_src_port_rate`, `dst_host_srv_diff_host_rate`, `dst_host_serror_rate`, `dst_host_srv_serror_rate`, `dst_host_rerror_rate`, `dst_host_srv_rerror_rate`, `service_aol`, `service_auth`, `service_bgp`, `service_courier`, `service_csnet_ns`, `service_ctf`, `service_daytime`, `service_discard`, `service_domain`, `service_domain_u`, `service_echo`, `service_eco_i`, `service_ecr_i`, `service_efs`, `service_exec`, `service_finger`, `service_ftp`, `service_ftp_data`, `service_gopher`, `service_harvest`, `service_hostnames`, `service_http`, `service_http_2784`, `service_http_443`, `service_http_8001`, `service_imap4`, `service_irc`, `service_iso_tsap`, `service_klogin`, `service_kshell`, `service_ldap`, `service_link`, `service_login`, `service_mtp`, `service_name`, `service_netbios_dgm`, `service_netbios_ns`, `service_netbios_ssn`, `service_netstat`, `service_nnsp`, `service_nntp`, `service_ntp_u`, `service_other`, `service_pm_dump`, `service_pop_2`, `service_pop_3`, `service_printer`, `service_private`, `service_red_i`, `service_remote_job`, `service_rje`, `service_shell`, `service_smtp`, `service_sql_net`, `service_ssh`, `service_sunrpc`, `service_supdup`, `service_systat`, `service_telnet`, `service_tftp_u`, `service_tim_i`, `service_time`, `service_urh_i`, `service_urp_i`, `service_uucp`, `service_uucp_path`, `service_vmnet`, `service_whois`, `service_x11`, `service_z39_50`, `flag_oth`, `flag_rej`, `flag_rsto`, `flag_rstos0`, `flag_rstr`, `flag_s0`, `flag_s1`, `flag_s2`, `flag_s3`, `flag_sf`, `flag_sh`

### Métriques finales (affichage UI / test set)

| Métrique | Valeur |
|---|---:|
| accuracy | 0.744012 |
| precision | 0.804357 |
| recall | 0.744012 |
| f1 | 0.697176 |
| train_accuracy | 0.999944 |
| final_test.accuracy | 0.744012 |
| final_test.precision | 0.804357 |
| final_test.recall | 0.744012 |
| final_test.f1 | 0.697176 |
| final_train.accuracy | 0.999944 |
| n_classes | 5 |
| classes | ['0.0', '1.0', '2.0', '3.0', '4.0'] |
| target_column | class |

### Matrice de confusion (test)

| actual \ pred | 0.0 | 1.0 | 2.0 | 3.0 | 4.0 |
|---|---:|---:|---:|---:|---:|
| **0.0** | 5821 | 1544 | 95 | 0 | 0 |
| **1.0** | 67 | 9458 | 185 | 0 | 1 |
| **2.0** | 161 | 802 | 1458 | 0 | 0 |
| **3.0** | 0 | 2847 | 3 | 34 | 1 |
| **4.0** | 0 | 62 | 0 | 3 | 2 |

### Classification report (test)

| Classe / avg | precision | recall | f1-score | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.962308 | 0.780295 | 0.861796 | 7460.0 |
| 1.0 | 0.642833 | 0.973947 | 0.774484 | 9711.0 |
| 2.0 | 0.837450 | 0.602230 | 0.700625 | 2421.0 |
| 3.0 | 0.918919 | 0.011785 | 0.023272 | 2885.0 |
| 4.0 | 0.500000 | 0.029851 | 0.056338 | 67.0 |
| accuracy | | | 0.744012 | |
| macro avg | 0.772302 | 0.479622 | 0.483303 | 22544.0 |
| weighted avg | 0.804357 | 0.744012 | 0.697176 | 22544.0 |

### Feature importance (top 20)

| Rang | Feature | Importance |
|---:|---|---:|
| 1 | `src_bytes` | 0.121809 |
| 2 | `dst_bytes` | 0.073984 |
| 3 | `count` | 0.061095 |
| 4 | `diff_srv_rate` | 0.060343 |
| 5 | `same_srv_rate` | 0.057296 |
| 6 | `flag_sf` | 0.049856 |
| 7 | `serror_rate` | 0.044551 |
| 8 | `dst_host_diff_srv_rate` | 0.041200 |
| 9 | `logged_in` | 0.036941 |
| 10 | `dst_host_srv_count` | 0.035836 |
| 11 | `dst_host_serror_rate` | 0.032275 |
| 12 | `dst_host_same_src_port_rate` | 0.032245 |
| 13 | `dst_host_srv_serror_rate` | 0.030660 |
| 14 | `srv_serror_rate` | 0.028885 |
| 15 | `dst_host_same_srv_rate` | 0.028851 |
| 16 | `protocol_type` | 0.025905 |
| 17 | `dst_host_count` | 0.024906 |
| 18 | `dst_host_srv_diff_host_rate` | 0.022539 |
| 19 | `flag_s0` | 0.020992 |
| 20 | `srv_count` | 0.017697 |

### training_info

```json
{
  "final_training_data": "train_only",
  "all_data_samples": 125973,
  "train_samples_used": 125973,
  "test_samples_used": 0,
  "final_model_trained_on": "train_data_only",
  "n_repetitions": 5,
  "validation_method": "holdout",
  "date_column_excluded": false,
  "final_training_on_all_data": false,
  "training_samples": 125973,
  "test_samples": 22544,
  "final_model_samples": 125973
}
```

---

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

## 6. Support Vector Machine (SVM)

### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm (code) | `svm` / model_type loggé `svm` |
| Training ID | `svm_1792826365_45f08639` |
| Dataset | `nls_copy` |
| User ID | `6a7649c85389ffb49703be24` |
| Status | `success` / event `training_finished` |
| Started (UTC) | 2026-10-24T07:19:25.469590+00:00 |
| Started (Europe/Madrid) | 2026-10-24 09:19:25 (Europe/Madrid) |
| Finished (UTC) | 2026-10-24T08:37:55.684371+00:00 |
| Finished (Europe/Madrid) | 2026-10-24 10:37:55 (Europe/Madrid) |
| Duration | **4710.215 s** (78.50 min) |
| Result timestamp | 2026-10-24T08:37:55.457878 |

### Requête / paramètres envoyés (start log)

| Paramètre request | Valeur |
|---|---|
| `C` | `1.0` |
| `bootstrap_params` | `None` |
| `cv_params` | `None` |
| `degree` | `3` |
| `final_training_on_all_data` | `False` |
| `gamma` | `scale` |
| `kernel` | `rbf` |
| `model_type` | `svm` |
| `n_repetitions` | `5` |
| `n_trials` | `20` |
| `numerized_dataset_name` | `nls_copy` |
| `original_dataset_name` | `nls_copy` |
| `probability` | `False` |
| `random_search` | `False` |
| `random_search_seed` | `42` |
| `random_state` | `None` |
| `shrinking` | `True` |
| `time_series_column` | `None` |
| `time_series_params` | `None` |
| `training_id` | `svm_1792826365_45f08639` |
| `validation_method` | `holdout` |

### Méthode de validation

| Champ | Valeur |
|---|---|
| Méthode | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score (holdout) | 0.992078 |
| std_score (holdout) | 0.000401 |
| best_repetition | 2 |
| best_score | 0.992697 |

#### Détail de chaque répétition

| Rep | Score validation | Score train | train_size | val_size | test% |  |
|---:|---:|---:|---:|---:|---:|
| 1 | 0.991903 | 0.992925 | 100778 | 25195 | 20.0 |  |
| 2 | 0.992697 | 0.992578 | 100778 | 25195 | 20.0 |  |
| 3 | 0.992141 | 0.993004 | 100778 | 25195 | 20.0 |  |
| 4 | 0.991467 | 0.993024 | 100778 | 25195 | 20.0 |  |
| 5 | 0.992181 | 0.992846 | 100778 | 25195 | 20.0 |  |

### Hyperparamètres & paramètres effectifs

```json
{
  "kernel_used": "rbf",
  "C_used": 1.0,
  "gamma_used": "scale",
  "degree_used": 3,
  "final_params_used": {
    "kernel": "rbf",
    "C": 1.0,
    "gamma": "scale",
    "degree": 3,
    "shrinking": true,
    "probability": false
  },
  "user_parameters_used": true,
  "training_info": {
    "final_training_data": "train_only",
    "all_data_samples": 125973,
    "train_samples_used": 125973,
    "test_samples_used": 0,
    "final_model_trained_on": "train_data_only",
    "n_repetitions": 5,
    "validation_method": "holdout",
    "date_column_excluded": false,
    "final_training_on_all_data": false,
    "training_samples": 125973,
    "test_samples": 22544,
    "final_model_samples": 125973,
    "feature_scaling": "StandardScaler applied",
    "parameter_optimization": "User parameters used - no optimization",
    "final_model_source": "best_validation_model"
  }
}
```

**Features utilisées (119):**

`duration`, `protocol_type`, `src_bytes`, `dst_bytes`, `land`, `wrong_fragment`, `urgent`, `hot`, `num_failed_logins`, `logged_in`, `num_compromised`, `root_shell`, `su_attempted`, `num_root`, `num_file_creations`, `num_shells`, `num_access_files`, `is_host_login`, `is_guest_login`, `count`, `srv_count`, `serror_rate`, `srv_serror_rate`, `rerror_rate`, `srv_rerror_rate`, `same_srv_rate`, `diff_srv_rate`, `srv_diff_host_rate`, `dst_host_count`, `dst_host_srv_count`, `dst_host_same_srv_rate`, `dst_host_diff_srv_rate`, `dst_host_same_src_port_rate`, `dst_host_srv_diff_host_rate`, `dst_host_serror_rate`, `dst_host_srv_serror_rate`, `dst_host_rerror_rate`, `dst_host_srv_rerror_rate`, `service_aol`, `service_auth`, `service_bgp`, `service_courier`, `service_csnet_ns`, `service_ctf`, `service_daytime`, `service_discard`, `service_domain`, `service_domain_u`, `service_echo`, `service_eco_i`, `service_ecr_i`, `service_efs`, `service_exec`, `service_finger`, `service_ftp`, `service_ftp_data`, `service_gopher`, `service_harvest`, `service_hostnames`, `service_http`, `service_http_2784`, `service_http_443`, `service_http_8001`, `service_imap4`, `service_irc`, `service_iso_tsap`, `service_klogin`, `service_kshell`, `service_ldap`, `service_link`, `service_login`, `service_mtp`, `service_name`, `service_netbios_dgm`, `service_netbios_ns`, `service_netbios_ssn`, `service_netstat`, `service_nnsp`, `service_nntp`, `service_ntp_u`, `service_other`, `service_pm_dump`, `service_pop_2`, `service_pop_3`, `service_printer`, `service_private`, `service_red_i`, `service_remote_job`, `service_rje`, `service_shell`, `service_smtp`, `service_sql_net`, `service_ssh`, `service_sunrpc`, `service_supdup`, `service_systat`, `service_telnet`, `service_tftp_u`, `service_tim_i`, `service_time`, `service_urh_i`, `service_urp_i`, `service_uucp`, `service_uucp_path`, `service_vmnet`, `service_whois`, `service_x11`, `service_z39_50`, `flag_oth`, `flag_rej`, `flag_rsto`, `flag_rstos0`, `flag_rstr`, `flag_s0`, `flag_s1`, `flag_s2`, `flag_s3`, `flag_sf`, `flag_sh`

### Métriques finales (affichage UI / test set)

| Métrique | Valeur |
|---|---:|
| accuracy | 0.766501 |
| precision | 0.807408 |
| recall | 0.766501 |
| f1 | 0.731538 |
| train_accuracy | 0.992903 |
| final_test.accuracy | 0.766501 |
| final_test.precision | 0.807408 |
| final_test.recall | 0.766501 |
| final_test.f1 | 0.731538 |
| final_train.accuracy | 0.992903 |
| n_classes | 5 |
| classes | ['0.0', '1.0', '2.0', '3.0', '4.0'] |
| target_column | class |
| n_support_vectors | 5393 |

### Matrice de confusion (test)

| actual \ pred | 0.0 | 1.0 | 2.0 | 3.0 | 4.0 |
|---|---:|---:|---:|---:|---:|
| **0.0** | 6279 | 1154 | 27 | 0 | 0 |
| **1.0** | 293 | 9021 | 391 | 1 | 5 |
| **2.0** | 349 | 387 | 1685 | 0 | 0 |
| **3.0** | 2 | 2583 | 15 | 282 | 3 |
| **4.0** | 0 | 37 | 13 | 4 | 13 |

### Classification report (test)

| Classe / avg | precision | recall | f1-score | support |
|---|---:|---:|---:|---:|
| 0.0 | 0.906977 | 0.841689 | 0.873114 | 7460.0 |
| 1.0 | 0.684342 | 0.928947 | 0.788101 | 9711.0 |
| 2.0 | 0.790709 | 0.695993 | 0.740334 | 2421.0 |
| 3.0 | 0.982578 | 0.097747 | 0.177806 | 2885.0 |
| 4.0 | 0.619048 | 0.194030 | 0.295455 | 67.0 |
| accuracy | | | 0.766501 | |
| macro avg | 0.796731 | 0.551681 | 0.574962 | 22544.0 |
| weighted avg | 0.807408 | 0.766501 | 0.731538 | 22544.0 |

### Feature importance (top 20)

| Rang | Feature | Importance |
|---:|---|---:|
| 1 | `hot` | 1464.678472 |
| 2 | `is_guest_login` | 1236.899419 |
| 3 | `service_ftp` | 1021.050264 |
| 4 | `service_ftp_data` | 710.875742 |
| 5 | `su_attempted` | 624.257416 |
| 6 | `dst_host_same_src_port_rate` | 561.815144 |
| 7 | `root_shell` | 476.308749 |
| 8 | `num_file_creations` | 417.137197 |
| 9 | `num_root` | 382.544840 |
| 10 | `num_access_files` | 368.607253 |
| 11 | `num_compromised` | 366.877657 |
| 12 | `urgent` | 347.681874 |
| 13 | `logged_in` | 347.229525 |
| 14 | `num_failed_logins` | 318.748998 |
| 15 | `service_telnet` | 310.686871 |
| 16 | `num_shells` | 301.769223 |
| 17 | `dst_host_count` | 299.628242 |
| 18 | `flag_sf` | 293.202187 |
| 19 | `same_srv_rate` | 289.260342 |
| 20 | `src_bytes` | 284.151515 |

### training_info

```json
{
  "final_training_data": "train_only",
  "all_data_samples": 125973,
  "train_samples_used": 125973,
  "test_samples_used": 0,
  "final_model_trained_on": "train_data_only",
  "n_repetitions": 5,
  "validation_method": "holdout",
  "date_column_excluded": false,
  "final_training_on_all_data": false,
  "training_samples": 125973,
  "test_samples": 22544,
  "final_model_samples": 125973,
  "feature_scaling": "StandardScaler applied",
  "parameter_optimization": "User parameters used - no optimization",
  "final_model_source": "best_validation_model"
}
```

---

## Synthèse finale

**Meilleure accuracy test:** Support Vector Machine (SVM) (0.7665)

**Plus rapide:** LightGBM (17.5s)

**Plus lent:** Support Vector Machine (SVM) (4710.2s)

Logs bruts serveur: `/root/tfmv1/backend/training_logs/`
