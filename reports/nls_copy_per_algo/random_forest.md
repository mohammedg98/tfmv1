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
