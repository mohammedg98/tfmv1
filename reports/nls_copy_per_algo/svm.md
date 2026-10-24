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
