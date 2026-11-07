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
