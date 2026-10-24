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
