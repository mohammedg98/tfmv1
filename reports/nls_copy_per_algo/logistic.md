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
