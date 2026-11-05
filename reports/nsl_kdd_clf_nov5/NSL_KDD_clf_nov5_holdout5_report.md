# Rapport détaillé — NSL-KDD (`nsl_kdd_clf_nov5`) classification

## Contexte commun

| Champ | Valeur |
|---|---|
| Plateforme | http://46.62.212.226 (tfmv1) |
| Utilisateur | `cc@cc.cc` |
| Source predefined | `nsl_kdd` |
| Dataset travail | `nsl_kdd_clf_nov5` |
| Cible | `attack_type` (label-encodée, 5 classes) |
| Split plateforme | train **125973** / test **22544** / total **148517** |
| Validation | **Hold-out répété × 5**, `test_size = 0.2` (interne au train) |
| Évaluation UI / finale | métriques sur le **test set global** |
| Features après transform | ~124 colonnes (one-hot protocol/service/flag inclus) |
| Date du run | 05 November 2026 19:19 CET |

### Tableau récapitulatif

| # | Algorithme | Durée | Acc. holdout mean±std | Acc. test | Precision | Recall | F1 | Train acc. |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Logistic Regression | 12m 18s (738.1s) | 0.9891±0.0004 | 0.7602 | 0.7533 | 0.7602 | 0.7208 | 0.9898 |
| 2 | k-Nearest Neighbors (KNN) | 4m 47s (287.1s) | 0.9918±0.0004 | 0.7304 | 0.7242 | 0.7304 | 0.6804 | 0.9955 |
| 3 | LightGBM | 26.7s | 0.9976±0.0005 | 0.7662 | 0.8066 | 0.7662 | 0.7336 | 0.9962 |
| 4 | Random Forest | 41.2s | 0.9987±0.0001 | 0.7539 | 0.8147 | 0.7539 | 0.7123 | 0.9999 |
| 5 | Neural Net — MLP (PyTorch) | 12m 33s (752.5s) | 0.9786±0.0005 | 0.7167 | 0.6551 | 0.7167 | 0.6696 | 0.9792 |
| 6 | Support Vector Machine (SVM) | 1h 35m 29s (5728.7s) | 0.9917±0.0003 | 0.7660 | 0.8047 | 0.7660 | 0.7310 | 0.9930 |

## 1. Stats dataset AVANT preprocessing

- Table source: `nsl_kdd`
- Lignes: **148517**
- Colonnes: **45**
- Split: `{"test": 22544, "train": 125973}`
- Target: `attack_type`

### Distribution target (avant)

| Valeur | Count | % |
|---|---:|---:|
| normal | 77054 | 51.88% |
| DoS | 53385 | 35.95% |
| Probing | 14077 | 9.48% |
| R2L | 3749 | 2.52% |
| U2R | 252 | 0.17% |

<details><summary>Liste des colonnes (avant)</summary>

```
id, duration, protocol_type, service, flag, src_bytes, dst_bytes, land, wrong_fragment, urgent, hot, num_failed_logins, logged_in, num_compromised, root_shell, su_attempted, num_root, num_file_creations, num_shells, num_access_files, num_outbound_cmds, is_host_login, is_guest_login, count, srv_count, serror_rate, srv_serror_rate, rerror_rate, srv_rerror_rate, same_srv_rate, diff_srv_rate, srv_diff_host_rate, dst_host_count, dst_host_srv_count, dst_host_same_srv_rate, dst_host_diff_srv_rate, dst_host_same_src_port_rate, dst_host_srv_diff_host_rate, dst_host_serror_rate, dst_host_srv_serror_rate, dst_host_rerror_rate, dst_host_srv_rerror_rate, attack_type, difficulty_level, split_type
```
</details>

## 2. Preprocessing effectué

- **Split**: aucune modification (déjà train/test sur le predefined)
- **Group**: suppression `num_outbound_cmds` (unique = 1 sur train) + `difficulty_level`
- **Optimize**: update-stage → data_cleaning, reset id, checkpoint
- **Transform**:
  - Label Encoding sur `attack_type` (5 catégories)
  - One-Hot Encoding sur `protocol_type` (3), `service` (70), `flag` (11)

## 3. Stats dataset APRÈS preprocessing

- Table: `nsl_kdd_clf_nov5`
- Lignes: **148517**
- Colonnes: **124**
- Split: `{"test": 22544, "train": 125973}`
- Target: `attack_type` (label-encodée)

### Distribution target (après) + mapping

| Code | Label | Count | % |
|---|---|---:|---:|
| 1 | normal | 77054 | 51.88% |
| 0 | DoS | 53385 | 35.95% |
| 2 | Probing | 14077 | 9.48% |
| 3 | R2L | 3749 | 2.52% |
| 4 | U2R | 252 | 0.17% |

<details><summary>Liste des colonnes (après)</summary>

```
id, duration, src_bytes, dst_bytes, land, wrong_fragment, urgent, hot, num_failed_logins, logged_in, num_compromised, root_shell, su_attempted, num_root, num_file_creations, num_shells, num_access_files, is_host_login, is_guest_login, count, srv_count, serror_rate, srv_serror_rate, rerror_rate, srv_rerror_rate, same_srv_rate, diff_srv_rate, srv_diff_host_rate, dst_host_count, dst_host_srv_count, dst_host_same_srv_rate, dst_host_diff_srv_rate, dst_host_same_src_port_rate, dst_host_srv_diff_host_rate, dst_host_serror_rate, dst_host_srv_serror_rate, dst_host_rerror_rate, dst_host_srv_rerror_rate, attack_type, split_type, protocol_type_icmp, protocol_type_tcp, protocol_type_udp, service_aol, service_auth, service_bgp, service_courier, service_csnet_ns, service_ctf, service_daytime, service_discard, service_domain, service_domain_u, service_echo, service_eco_i, service_ecr_i, service_efs, service_exec, service_finger, service_ftp, service_ftp_data, service_gopher, service_harvest, service_hostnames, service_http, service_http_2784, service_http_443, service_http_8001, service_imap4, service_irc, service_iso_tsap, service_klogin, service_kshell, service_ldap, service_link, service_login, service_mtp, service_name, service_netbios_dgm, service_netbios_ns, service_netbios_ssn, service_netstat, service_nnsp, service_nntp, service_ntp_u, service_other, service_pm_dump, service_pop_2, service_pop_3, service_printer, service_private, service_red_i, service_remote_job, service_rje, service_shell, service_smtp, service_sql_net, service_ssh, service_sunrpc, service_supdup, service_systat, service_telnet, service_tftp_u, service_tim_i, service_time, service_urh_i, service_urp_i, service_uucp, service_uucp_path, service_vmnet, service_whois, service_x11, service_z39_50, flag_oth, flag_rej, flag_rsto, flag_rstos0, flag_rstr, flag_s0, flag_s1, flag_s2, flag_s3, flag_sf, flag_sh
```
</details>

## 4. Résultats détaillés par algorithme

### Logistic Regression

#### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm | `logistic` |
| Training ID | `logistic_1793895037_4640faf2` |
| Dataset | `nsl_kdd_clf_nov5` |
| Status | `success` |
| Finished (Europe/Madrid) | 2026-11-05 17:22:55 CET |
| Duration | **12m 18s (738.1s)** |
| Validation | holdout × 5 |

#### Métriques finales (test set global)

| Métrique | Valeur |
|---|---:|
| Accuracy | 0.7602 |
| Precision | 0.7533 |
| Recall | 0.7602 |
| F1 | 0.7208 |
| ROC-AUC | n/a |
| Train accuracy | 0.9898 |

#### Validation holdout × 5

| Champ | Valeur |
|---|---|
| Method | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score | 0.9891 |
| std_score | 0.0004 |
| best_repetition | 2 |
| best_score | 0.9899 |
| cv_train_accuracy mean±std | 0.9898±0.0001 |

Scores par répétition:

```
0.9892, 0.9899, 0.9889, 0.9886, 0.9891
```

Détail des répétitions:

```json
[
  {
    "repetition": 1,
    "score": 0.9891645167692003,
    "train_score": 0.9897497469685844,
    "best_C": 1000.0,
    "train_size": 100778,
    "validation_size": 25195,
    "C_search_details": [
      {
        "C": 0.001,
        "score": 0.9696368327049018
      },
      {
        "C": 0.01,
        "score": 0.9781702718793411
      },
      {
        "C": 0.1,
        "score": 0.9878150426671959
      },
      {
        "C": 1,
        "score": 0.9889263742806113
      },
      {
        "C": 10,
        "score": 0.9889263742806113
      },
      {
        "C": 100,
        "score": 0.9890454455249057
      },
      {
        "C": 1000,
        "score": 0.9891645167692003
      }
    ]
  },
  {
    "repetition": 2,
    "score": 0.9899186346497321,
    "train_score": 0.9898192065728632,
    "best_C": 100.0,
    "train_size": 100778,
    "validation_size": 25195,
    "C_search_details": [
      {
        "C": 0.001,
        "score": 0.9704703314149633
      },
      {
        "C": 0.01,
        "score": 0.9801944830323477
      },
      {
        "C": 0.1,
        "score": 0.9887676126215519
      },
      {
        "C": 1,
        "score": 0.9892835880134947
      },
      {
        "C": 10,
        "score": 0.9895614209168486
      },
      {
        "C": 100,
        "score": 0.9899186346497321
      },
      {
        "C": 1000,
        "score": 0.9897598729906728
      }
    ]
  },
  {
    "repetition": 3,
    "score": 0.9889263742806113,
    "train_score": 0.9898489749746968,
    "best_C": 100.0,
    "train_size": 100778,
    "validation_size": 25195,
    "C_search_details": [
      {
        "C": 0.001,
        "score": 0.9703909505854336
      },
      {
        "C": 0.01,
        "score": 0.9783290335384005
      },
      {
        "C": 0.1,
        "score": 0.9883310180591387
      },
      {
        "C": 1,
        "score": 0.9887279222067871
      },
      {
        "C": 10,
        "score": 0.9886088509624925
      },
      {
        "C": 100,
        "score": 0.9889263742806113
      },
      {
        "C": 1000,
        "score": 0.9886088509624925
      }
    ]
  },
  {
    "repetition": 4,
    "score": 0.9885691605477277,
    "train_score": 0.9897100557661395,
    "best_C": 1.0,
    "train_size": 100778,
    "validation_size": 25195,
    "C_search_details": [
      {
        "C": 0.001,
        "score": 0.9687239531653106
      },
      {
        "C": 0.01,
        "score": 0.9767017265330423
      },
      {
        "C": 0.1,
        "score": 0.9870609247866641
      },
      {
        "C": 1,
        "score": 0.9885691605477277
      },
      {
        "C": 10,
        "score": 0.9883310180591387
      },
      {
        "C": 100,
        "score": 0.9883707084739035
      },
      {
        "C": 1000,
        "score": 0.9882516372296091
      }
    ]
  },
  {
    "repetition": 5,
    "score": 0.9890851359396706,
    "train_score": 0.9900871221893667,
    "best_C": 10.0,
    "train_size": 100778,
    "validation_size": 25195,
    "C_search_details": [
      {
        "C": 0.001,
        "score": 0.9692796189720183
      },
      {
        "C": 0.01,
        "score": 0.978448104782695
      },
      {
        "C": 0.1,
        "score": 0.9878944234967255
      },
      {
        "C": 1,
        "score": 0.9886485413772574
      },
      {
        "C": 10,
        "score": 0.9890851359396706
      },
      {
        "C": 100,
        "score": 0.9890851359396706
      },
      {
        "C": 1000,
        "score": 0.9889660646953761
      }
    ]
  }
]
```

#### Classification report

```json
{
  "0.0": {
    "precision": 0.972757162987318,
    "recall": 0.833065164923572,
    "f1-score": 0.8975081256771398,
    "support": 7458.0
  },
  "1.0": {
    "precision": 0.6688653375824501,
    "recall": 0.9293584594789414,
    "f1-score": 0.7778831235993794,
    "support": 9711.0
  },
  "2.0": {
    "precision": 0.7335811648079306,
    "recall": 0.7335811648079306,
    "f1-score": 0.7335811648079306,
    "support": 2421.0
  },
  "3.0": {
    "precision": 0.47393364928909953,
    "recall": 0.03631082062454612,
    "f1-score": 0.06745362563237774,
    "support": 2754.0
  },
  "4.0": {
    "precision": 0.75,
    "recall": 0.12,
    "f1-score": 0.20689655172413793,
    "support": 200.0
  },
  "accuracy": 0.7602022711142654,
  "macro avg": {
    "precision": 0.7198274629333596,
    "recall": 0.530463121966998,
    "f1-score": 0.5366645182881931,
    "support": 22544.0
  },
  "weighted avg": {
    "precision": 0.7532553000782812,
    "recall": 0.7602022711142654,
    "f1-score": 0.7208474631791199,
    "support": 22544.0
  }
}
```

#### Confusion matrix

```json
{"matrix": [[6213, 1241, 4, 0, 0], [58, 9025, 621, 2, 5], [111, 430, 1776, 104, 0], [2, 2631, 18, 100, 3], [3, 166, 2, 5, 24]], "labels": ["0.0", "1.0", "2.0", "3.0", "4.0"]}
```

#### Top 20 feature importance

| Feature | Score |
|---|---:|
| is_guest_login | 5.681170 |
| num_file_creations | 4.800850 |
| duration | 4.104335 |
| hot | 3.876986 |
| dst_host_same_srv_rate | 2.437966 |
| wrong_fragment | 2.399829 |
| count | 2.053977 |
| service_private | 1.748518 |
| srv_count | 1.745379 |
| num_compromised | 1.533459 |
| num_root | 1.520706 |
| dst_host_serror_rate | 1.518697 |
| same_srv_rate | 1.426766 |
| flag_s0 | 1.425033 |
| serror_rate | 1.396234 |
| protocol_type_udp | 1.371588 |
| dst_host_srv_count | 1.323634 |
| flag_sf | 1.263353 |
| dst_host_rerror_rate | 1.227879 |
| service_http | 1.212854 |

### k-Nearest Neighbors (KNN)

#### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm | `knn` |
| Training ID | `knn_1793895775_a5a566f4` |
| Dataset | `nsl_kdd_clf_nov5` |
| Status | `success` |
| Finished (Europe/Madrid) | 2026-11-05 17:27:42 CET |
| Duration | **4m 47s (287.1s)** |
| Validation | holdout × 5 |

#### Métriques finales (test set global)

| Métrique | Valeur |
|---|---:|
| Accuracy | 0.7304 |
| Precision | 0.7242 |
| Recall | 0.7304 |
| F1 | 0.6804 |
| ROC-AUC | n/a |
| Train accuracy | 0.9955 |

#### Validation holdout × 5

| Champ | Valeur |
|---|---|
| Method | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score | 0.9918 |
| std_score | 0.0004 |
| best_repetition | 3 |
| best_score | 0.9923 |
| cv_train_accuracy mean±std | n/a±n/a |

Détail des répétitions:

```json
[
  {
    "repetition": 1,
    "score": 0.9922206787060924,
    "train_score": 0.9947111472742066,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0
  },
  {
    "repetition": 2,
    "score": 0.9911887279222068,
    "train_score": 0.9946913016729841,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0
  },
  {
    "repetition": 3,
    "score": 0.992339749950387,
    "train_score": 0.9946119192680942,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0
  },
  {
    "repetition": 4,
    "score": 0.9917443937289144,
    "train_score": 0.9951080592986564,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0
  },
  {
    "repetition": 5,
    "score": 0.9915062512403254,
    "train_score": 0.9948798348845979,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0
  }
]
```

#### Classification report

```json
{
  "0.0": {
    "precision": 0.9212050984936269,
    "recall": 0.7461786001609011,
    "f1-score": 0.8245055189273279,
    "support": 7458.0
  },
  "1.0": {
    "precision": 0.6525195271998341,
    "recall": 0.9720935022139842,
    "f1-score": 0.7808751757796344,
    "support": 9711.0
  },
  "2.0": {
    "precision": 0.7184707050645481,
    "recall": 0.5976869062370921,
    "f1-score": 0.6525366403607666,
    "support": 2421.0
  },
  "3.0": {
    "precision": 0.42857142857142855,
    "recall": 0.002178649237472767,
    "f1-score": 0.004335260115606936,
    "support": 2754.0
  },
  "4.0": {
    "precision": 1.0,
    "recall": 0.04,
    "f1-score": 0.07692307692307693,
    "support": 200.0
  },
  "accuracy": 0.7303938963804116,
  "macro avg": {
    "precision": 0.7441533518658875,
    "recall": 0.47162753156989,
    "f1-score": 0.46783513442128266,
    "support": 22544.0
  },
  "weighted avg": {
    "precision": 0.7242134512264923,
    "recall": 0.7303938963804116,
    "f1-score": 0.6804185645942359,
    "support": 22544.0
  }
}
```

#### Confusion matrix

```json
{"matrix": [[5565, 1600, 293, 0, 0], [130, 9440, 133, 8, 0], [294, 680, 1447, 0, 0], [2, 2628, 118, 6, 0], [50, 119, 23, 0, 8]], "labels": ["0.0", "1.0", "2.0", "3.0", "4.0"]}
```

#### Top 20 feature importance

| Feature | Score |
|---|---:|
| src_bytes | 0.593282 |
| dst_bytes | 0.406408 |
| duration | 0.000263 |
| count | 0.000012 |
| dst_host_srv_count | 0.000011 |
| dst_host_count | 0.000010 |
| srv_count | 0.000007 |
| num_root | 0.000002 |
| num_compromised | 0.000002 |
| hot | 0.000000 |
| flag_sf | 0.000000 |
| logged_in | 0.000000 |
| num_file_creations | 0.000000 |
| service_http | 0.000000 |
| dst_host_same_srv_rate | 0.000000 |
| flag_s0 | 0.000000 |
| srv_serror_rate | 0.000000 |
| serror_rate | 0.000000 |
| dst_host_srv_serror_rate | 0.000000 |
| dst_host_serror_rate | 0.000000 |

### LightGBM

#### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm | `lightgbm` |
| Training ID | `lightgbm_1793896062_6a51ad1f` |
| Dataset | `nsl_kdd_clf_nov5` |
| Status | `success` |
| Finished (Europe/Madrid) | 2026-11-05 17:28:09 CET |
| Duration | **26.7s** |
| Validation | holdout × 5 |

#### Métriques finales (test set global)

| Métrique | Valeur |
|---|---:|
| Accuracy | 0.7662 |
| Precision | 0.8066 |
| Recall | 0.7662 |
| F1 | 0.7336 |
| ROC-AUC | n/a |
| Train accuracy | 0.9962 |

#### Validation holdout × 5

| Champ | Valeur |
|---|---|
| Method | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score | 0.9976 |
| std_score | 0.0005 |
| best_repetition | 3 |
| best_score | 0.9983 |
| cv_train_accuracy mean±std | n/a±n/a |

Détail des répétitions:

```json
[
  {
    "repetition": 1,
    "score": 0.9979757888469935,
    "train_score": 0.9991267935462105,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "best_iteration": 27
  },
  {
    "repetition": 2,
    "score": 0.9976582655288748,
    "train_score": 0.9992359443529342,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "best_iteration": 26
  },
  {
    "repetition": 3,
    "score": 0.9982536217503473,
    "train_score": 0.9992557899541566,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "best_iteration": 28
  },
  {
    "repetition": 4,
    "score": 0.9968644572335781,
    "train_score": 0.9983428922979222,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "best_iteration": 27
  },
  {
    "repetition": 5,
    "score": 0.9973804326255209,
    "train_score": 0.9989382603345969,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "best_iteration": 24
  }
]
```

#### Classification report

```json
{
  "0.0": {
    "precision": 0.9617521028408189,
    "recall": 0.8125502815768303,
    "f1-score": 0.8808779707827604,
    "support": 7458.0
  },
  "1.0": {
    "precision": 0.6770487064604712,
    "recall": 0.9647822057460612,
    "f1-score": 0.7957025776041445,
    "support": 9711.0
  },
  "2.0": {
    "precision": 0.7861153649821337,
    "recall": 0.6361007847996696,
    "f1-score": 0.7031963470319634,
    "support": 2421.0
  },
  "3.0": {
    "precision": 0.9130434782608695,
    "recall": 0.10675381263616558,
    "f1-score": 0.19115734720416125,
    "support": 2754.0
  },
  "4.0": {
    "precision": 0.08870967741935484,
    "recall": 0.055,
    "f1-score": 0.06790123456790123,
    "support": 200.0
  },
  "accuracy": 0.7662349183818311,
  "macro avg": {
    "precision": 0.6853338659927297,
    "recall": 0.5150374169517454,
    "f1-score": 0.5277670954381862,
    "support": 22544.0
  },
  "weighted avg": {
    "precision": 0.8065567842734438,
    "recall": 0.7662349183818311,
    "f1-score": 0.7336374012814896,
    "support": 22544.0
  }
}
```

#### Confusion matrix

```json
{"matrix": [[6060, 1181, 213, 0, 4], [75, 9369, 201, 1, 65], [164, 701, 1540, 13, 3], [0, 2416, 3, 294, 41], [2, 171, 2, 14, 11]], "labels": ["0.0", "1.0", "2.0", "3.0", "4.0"]}
```

#### Top 20 feature importance

| Feature | Score |
|---|---:|
| src_bytes | 0.146458 |
| dst_host_count | 0.074583 |
| dst_host_srv_count | 0.063750 |
| dst_bytes | 0.048750 |
| dst_host_same_src_port_rate | 0.046875 |
| dst_host_same_srv_rate | 0.044583 |
| dst_host_diff_srv_rate | 0.044167 |
| dst_host_serror_rate | 0.034792 |
| duration | 0.030208 |
| dst_host_rerror_rate | 0.028125 |
| num_compromised | 0.026667 |
| count | 0.025208 |
| diff_srv_rate | 0.025208 |
| dst_host_srv_diff_host_rate | 0.020625 |
| hot | 0.020208 |
| service_private | 0.019583 |
| dst_host_srv_serror_rate | 0.018958 |
| service_http | 0.018542 |
| num_file_creations | 0.017917 |
| service_ftp_data | 0.017083 |

### Random Forest

#### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm | `random_forest` |
| Training ID | `random_forest_1793896089_4a8c3414` |
| Dataset | `nsl_kdd_clf_nov5` |
| Status | `success` |
| Finished (Europe/Madrid) | 2026-11-05 17:28:50 CET |
| Duration | **41.2s** |
| Validation | holdout × 5 |

#### Métriques finales (test set global)

| Métrique | Valeur |
|---|---:|
| Accuracy | 0.7539 |
| Precision | 0.8147 |
| Recall | 0.7539 |
| F1 | 0.7123 |
| ROC-AUC | n/a |
| Train accuracy | 0.9999 |

#### Validation holdout × 5

| Champ | Valeur |
|---|---|
| Method | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score | 0.9987 |
| std_score | 0.0001 |
| best_repetition | 5 |
| best_score | 0.9988 |
| cv_train_accuracy mean±std | n/a±n/a |

Détail des répétitions:

```json
[
  {
    "repetition": 1,
    "score": 0.9986108354832308,
    "train_score": 0.999960308797555,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "random_state": 0
  },
  {
    "repetition": 2,
    "score": 0.998809287557055,
    "train_score": 0.9999702315981662,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "random_state": 1
  },
  {
    "repetition": 3,
    "score": 0.9986505258979956,
    "train_score": 0.999960308797555,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "random_state": 2
  },
  {
    "repetition": 4,
    "score": 0.9987695971422902,
    "train_score": 0.9999503859969437,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "random_state": 3
  },
  {
    "repetition": 5,
    "score": 0.9988489779718198,
    "train_score": 0.999960308797555,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "random_state": 4
  }
]
```

#### Classification report

```json
{
  "0.0": {
    "precision": 0.9624512353706112,
    "recall": 0.7939125770984178,
    "f1-score": 0.8700955180014696,
    "support": 7458.0
  },
  "1.0": {
    "precision": 0.6506090427362191,
    "recall": 0.9735351663062507,
    "f1-score": 0.7799686494513653,
    "support": 9711.0
  },
  "2.0": {
    "precision": 0.8639534883720931,
    "recall": 0.6137959520859149,
    "f1-score": 0.7177010383965226,
    "support": 2421.0
  },
  "3.0": {
    "precision": 0.9851851851851852,
    "recall": 0.048293391430646336,
    "f1-score": 0.09207338179300796,
    "support": 2754.0
  },
  "4.0": {
    "precision": 0.3333333333333333,
    "recall": 0.01,
    "f1-score": 0.019417475728155338,
    "support": 200.0
  },
  "accuracy": 0.7539034776437189,
  "macro avg": {
    "precision": 0.7591064569994883,
    "recall": 0.48790741738424587,
    "f1-score": 0.49585121267410415,
    "support": 22544.0
  },
  "weighted avg": {
    "precision": 0.8147411191190981,
    "recall": 0.7539034776437189,
    "f1-score": 0.7123161697408945,
    "support": 22544.0
  }
}
```

#### Confusion matrix

```json
{"matrix": [[5921, 1492, 45, 0, 0], [67, 9454, 188, 0, 2], [164, 771, 1486, 0, 0], [0, 2618, 1, 133, 2], [0, 196, 0, 2, 2]], "labels": ["0.0", "1.0", "2.0", "3.0", "4.0"]}
```

#### Top 20 feature importance

| Feature | Score |
|---|---:|
| src_bytes | 0.126667 |
| diff_srv_rate | 0.095010 |
| same_srv_rate | 0.063555 |
| dst_bytes | 0.061892 |
| count | 0.053983 |
| dst_host_srv_serror_rate | 0.048510 |
| dst_host_diff_srv_rate | 0.040296 |
| flag_s0 | 0.038158 |
| serror_rate | 0.037876 |
| dst_host_same_srv_rate | 0.037551 |
| dst_host_serror_rate | 0.035867 |
| flag_sf | 0.033982 |
| dst_host_srv_count | 0.031551 |
| dst_host_same_src_port_rate | 0.031216 |
| srv_count | 0.021542 |
| dst_host_count | 0.021068 |
| protocol_type_icmp | 0.019705 |
| dst_host_srv_diff_host_rate | 0.019323 |
| dst_host_rerror_rate | 0.019182 |
| service_http | 0.018770 |

### Neural Net — MLP (PyTorch)

#### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm | `mlp` |
| Training ID | `mlp_1793896130_34cc480d` |
| Dataset | `nsl_kdd_clf_nov5` |
| Status | `success` |
| Finished (Europe/Madrid) | 2026-11-05 17:41:22 CET |
| Duration | **12m 33s (752.5s)** |
| Validation | holdout × 5 |

#### Métriques finales (test set global)

| Métrique | Valeur |
|---|---:|
| Accuracy | 0.7167 |
| Precision | 0.6551 |
| Recall | 0.7167 |
| F1 | 0.6696 |
| ROC-AUC | n/a |
| Train accuracy | 0.9792 |

#### Validation holdout × 5

| Champ | Valeur |
|---|---|
| Method | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score | 0.9786 |
| std_score | 0.0005 |
| best_repetition | 5 |
| best_score | 0.9794 |
| cv_train_accuracy mean±std | n/a±n/a |

Scores par répétition:

```
0.9786, 0.9779, 0.9787, 0.9784, 0.9794
```

Détail des répétitions:

```json
[
  {
    "repetition": 1,
    "score": 0.9786465568565191,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "best_val_loss": 0.9239418578587915,
    "parameters_used": {
      "layers": [
        64,
        32
      ],
      "activation": "relu",
      "dropout_rate": 0.2,
      "learning_rate": 0.001,
      "batch_size": 32,
      "epochs": 100,
      "patience": 10
    },
    "training_history": {
      "epoch": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30
      ],
      "loss": [
        0.9430721063956362,
        0.9278478608253672,
        0.9274747149810734,
        0.9271307373153809,
        0.9273911706699444,
        0.9269614525442595,
        0.926727380432994,
        0.9266943795428949,
        0.9263676692584538,
        0.9264625899929737,
        0.9264648859540962,
        0.9263588577877396,
        0.9262881746020334,
        0.9263697516961003,
        0.9265709895793722,
        0.9265688701243657,
        0.9264089514385008,
        0.9261950328796774,
        0.92642991071884,
        0.9259704223909627,
        0.926208046086903,
        0.9261405254025915,
        0.9261537498834364,
        0.9261123986226127,
        0.9261042711840711,
        0.9265011699223004,
        0.9263029527781528,
        0.9264305433639046,
        0.926117337538545,
        0.9260596936427891
      ],
      "val_loss": [
        0.9259339783891465,
        0.9258325050619534,
        0.9250569831996145,
        0.9250687165543257,
        0.9253369950756096,
        0.9245394001690304,
        0.9245690765303264,
        0.9244513260842695,
        0.9243863305015965,
        0.9245120734916743,
        0.9248061790048047,
        0.9252517491206452,
        0.9240343479533876,
        0.9249152102293441,
        0.9254770845523735,
        0.9255572563316359,
        0.924310178424565,
        0.9245346180572707,
        0.9241682775154499,
        0.9239418578587915,
        0.9242748814600047,
        0.9239575416470691,
        0.9245996456625064,
        0.9249784453280934,
        0.9245170258605119,
        0.9244940092081493,
        0.9244148442091793,
        0.9245427498199514,
        0.9242726961282729,
        0.9261461546695949
      ],
      "accuracy": [
        0.9666296215443847,
        0.9770187937843577,
        0.9773859374069738,
        0.977723312627756,
        0.9774454742106412,
        0.977882077437536,
        0.9780706106491496,
        0.9781103018515946,
        0.9784575998729882,
        0.9783484490662645,
        0.9783484490662645,
        0.9784575998729882,
        0.9785270594772668,
        0.9784278314711544,
        0.978249221060152,
        0.9782392982595408,
        0.9784278314711544,
        0.9786362102839905,
        0.978368294667487,
        0.9788842802992717,
        0.978616364682768,
        0.9786362102839905,
        0.9786659786858243,
        0.978695747087658,
        0.9787056698882692,
        0.978328603465042,
        0.9785171366766556,
        0.9783881402687095,
        0.9786759014864356,
        0.9787453610907142
      ],
      "val_accuracy": [
        0.9787259376860489,
        0.9792816034927565,
        0.9797181980551697,
        0.9796785076404049,
        0.9793609843222861,
        0.9803135542766422,
        0.9802341734471125,
        0.9803929351061719,
        0.9804723159357015,
        0.9803135542766422,
        0.9800357213732883,
        0.9797181980551697,
        0.9807898392538202,
        0.9798372692994641,
        0.9788846993451081,
        0.9792419130779917,
        0.9805120063504663,
        0.9802341734471125,
        0.9806310775947609,
        0.9808692200833499,
        0.9805120063504663,
        0.9808692200833499,
        0.9801547926175829,
        0.9798372692994641,
        0.9803135542766422,
        0.9803135542766422,
        0.9803929351061719,
        0.9804723159357015,
        0.9805516967652312,
        0.9786465568565191
      ],
      "mse": [],
      "val_mse": []
    },
    "n_classes": 5,
    "output_size_used": 5
  },
  {
    "repetition": 2,
    "score": 0.9778527485612225,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0,
    "best_val_loss": 0.925259946442521,
    "parameters_used": {
      "layers": [
        64,
        32
      ],
      "activation": "relu",
      "dropout_rate": 0.2,
      "learning_rate": 0.001,
      "batch_size": 32,
      "epochs": 100,
      "patience": 10
    },
    "training_history": {
      "epoch": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30
      ],
      "loss": [
        0.9424523856818289,
        0.9280759162718679,
        0.9275361258917986,
        0.9269379509990741,
        0.9268839624605677,
        0.9268164761060901,
        0.9268932465194991,
        0.9266443919737101,
        0.9266695748882207,
        0.9267402966408729,
        0.9264368701031768,
        0.9266353510601862,
        0.926610096225963,
        0.9261468276489432,
        0.926029372348701,
        0.9261673857663296,
        0.9263326445665662,
        0.9262118411387313,
        0.9260603172813292,
        0.9259559659041477,
        0.9262431625142767,
        0.926194370527513,
        0.9262215202829265,
        0.926475764340574,
        0.9263124541481739,
        0.9266531353099595,
        0.9269051286969774,
        0.9260354190955418,
        0.9258715405647094,
        0.9264458732588514
      ],
      "val_loss": [
        0.9287322851891886,
        0.9270095342159934,
        0.9262150999287997,
        0.9262060809215872,
        0.9257884175987039,
        0.9272272663708835,
        0.9256521544018348,
        0.925808844132943,
        0.9258312811996284,
        0.9254198213209351,
        0.9255177429115566,
        0.927273750489703,
        0.9256368093108298,
        0.9256305807330917,
        0.9256428976857631,
        0.9257115556503435,
        0.925668740272522,
        0.925452796763242,
        0.9254613828980798,
        0.925259946442521,
        0.9265250528253811,
        0.9255552145336611,
        0.9255655826522046,
        0.9255590944873078,
        0.9257271872032349,
        0.9252922983911449,
        0.9255271826785906,
        0.9252756481725182,
        0.9256478609558987,
        0.9269702695574782
      ],
      "accuracy": [
        0.9687034868721348,
        0.9768798745758003,
        0.9773462462045288,
        0.9778523090357022,
        0.9779813054436484,
        0.9779614598424259,
        0.9779316914405922,
        0.9781698386552621,
        0.9781301474528171,
        0.9780805334497609,
        0.9784079858699319,
        0.9781400702534283,
        0.9781698386552621,
        0.9787155926888805,
        0.9788346662962154,
        0.9786858242870468,
        0.9784774454742107,
        0.9785766734803231,
        0.9787552838913255,
        0.9788743574986605,
        0.9785965190815455,
        0.9785965190815455,
        0.9785667506797119,
        0.9783385262656532,
        0.9785369822778781,
        0.9781698386552621,
        0.9778721546369247,
        0.9787949750937704,
        0.9789438171029391,
        0.9783881402687095
      ],
      "val_accuracy": [
        0.9762651319706291,
        0.9778924389759873,
        0.9787656281008137,
        0.9786465568565191,
        0.9790037705894027,
        0.9775352252431038,
        0.9791228418
… truncated …
```

#### Classification report

```json
{
  "0.0": {
    "precision": 0.8867528271405493,
    "recall": 0.7359882005899705,
    "f1-score": 0.80436694021102,
    "support": 7458.0
  },
  "1.0": {
    "precision": 0.6243595069934912,
    "recall": 0.9285346514262177,
    "f1-score": 0.7466567300128348,
    "support": 9711.0
  },
  "2.0": {
    "precision": 0.8640167364016736,
    "recall": 0.6823626600578273,
    "f1-score": 0.7625201938610663,
    "support": 2421.0
  },
  "3.0": {
    "precision": 0.0,
    "recall": 0.0,
    "f1-score": 0.0,
    "support": 2754.0
  },
  "4.0": {
    "precision": 0.0,
    "recall": 0.0,
    "f1-score": 0.0,
    "support": 200.0
  },
  "accuracy": 0.7167317246273953,
  "macro avg": {
    "precision": 0.4750258141071428,
    "recall": 0.4693771024148031,
    "f1-score": 0.4627087728169842,
    "support": 22544.0
  },
  "weighted avg": {
    "precision": 0.6550897035156343,
    "recall": 0.7167317246273953,
    "f1-score": 0.6696155755228028,
    "support": 22544.0
  }
}
```

#### Confusion matrix

```json
{"matrix": [[5489, 1937, 32, 0, 0], [471, 9017, 223, 0, 0], [229, 540, 1652, 0, 0], [1, 2748, 5, 0, 0], [0, 200, 0, 0, 0]], "labels": ["0.0", "1.0", "2.0", "3.0", "4.0"]}
```

### Support Vector Machine (SVM)

#### Identité & timing

| Champ | Valeur |
|---|---|
| Algorithm | `svm` |
| Training ID | `svm_1793896882_9ca87471` |
| Dataset | `nsl_kdd_clf_nov5` |
| Status | `success` |
| Finished (Europe/Madrid) | 2026-11-05 19:16:51 CET |
| Duration | **1h 35m 29s (5728.7s)** |
| Validation | holdout × 5 |

#### Métriques finales (test set global)

| Métrique | Valeur |
|---|---:|
| Accuracy | 0.7660 |
| Precision | 0.8047 |
| Recall | 0.7660 |
| F1 | 0.7310 |
| ROC-AUC | n/a |
| Train accuracy | 0.9930 |

#### Validation holdout × 5

| Champ | Valeur |
|---|---|
| Method | Hold-Out Repeated (5 repetitions) |
| n_repetitions | 5 |
| test_size | 0.2 |
| mean_score | 0.9917 |
| std_score | 0.0003 |
| best_repetition | 4 |
| best_score | 0.9921 |
| cv_train_accuracy mean±std | n/a±n/a |

Détail des répétitions:

```json
[
  {
    "repetition": 1,
    "score": 0.9911887279222068,
    "train_score": 0.9931135763757963,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0
  },
  {
    "repetition": 2,
    "score": 0.991863464973209,
    "train_score": 0.9933120323880212,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0
  },
  {
    "repetition": 3,
    "score": 0.99162532248462,
    "train_score": 0.9929051975629601,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0
  },
  {
    "repetition": 4,
    "score": 0.9920619170470332,
    "train_score": 0.9929250431641826,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0
  },
  {
    "repetition": 5,
    "score": 0.9919825362175034,
    "train_score": 0.992855583559904,
    "train_size": 100778,
    "validation_size": 25195,
    "test_size_percent": 20.0
  }
]
```

#### Classification report

```json
{
  "0.0": {
    "precision": 0.9045834534447967,
    "recall": 0.8415124698310539,
    "f1-score": 0.8719088635732147,
    "support": 7458.0
  },
  "1.0": {
    "precision": 0.683931144308789,
    "recall": 0.9287406034393986,
    "f1-score": 0.7877543890296096,
    "support": 9711.0
  },
  "2.0": {
    "precision": 0.7948839412600663,
    "recall": 0.6931020239570426,
    "f1-score": 0.7405119152691968,
    "support": 2421.0
  },
  "3.0": {
    "precision": 0.9825783972125436,
    "recall": 0.10239651416122005,
    "f1-score": 0.1854653074646498,
    "support": 2754.0
  },
  "4.0": {
    "precision": 0.6190476190476191,
    "recall": 0.065,
    "f1-score": 0.11764705882352941,
    "support": 200.0
  },
  "accuracy": 0.7659687721788503,
  "macro avg": {
    "precision": 0.7970049110547629,
    "recall": 0.5261503222777429,
    "f1-score": 0.5406575068320401,
    "support": 22544.0
  },
  "weighted avg": {
    "precision": 0.8047499640568413,
    "recall": 0.7659687721788503,
    "f1-score": 0.7309997955901637,
    "support": 22544.0
  }
}
```

#### Confusion matrix

```json
{"matrix": [[6276, 1154, 28, 0, 0], [310, 9019, 376, 1, 5], [350, 393, 1678, 0, 0], [2, 2454, 13, 282, 3], [0, 167, 16, 4, 13]], "labels": ["0.0", "1.0", "2.0", "3.0", "4.0"]}
```

#### Top 20 feature importance

| Feature | Score |
|---|---:|
| hot | 1471.709831 |
| is_guest_login | 1241.518212 |
| service_ftp | 1025.479770 |
| service_ftp_data | 720.018568 |
| su_attempted | 625.334043 |
| dst_host_same_src_port_rate | 564.019291 |
| root_shell | 465.543388 |
| num_file_creations | 413.222796 |
| num_root | 379.610186 |
| num_access_files | 366.114983 |
| num_compromised | 364.092913 |
| logged_in | 351.717782 |
| urgent | 340.856068 |
| num_failed_logins | 310.382384 |
| dst_host_count | 304.571337 |
| service_telnet | 300.644967 |
| flag_sf | 294.177896 |
| same_srv_rate | 289.994516 |
| num_shells | 286.320644 |
| src_bytes | 284.574685 |

---

*Généré le 2026-11-05 19:19:41 CET*
