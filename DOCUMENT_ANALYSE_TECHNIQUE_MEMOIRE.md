# Analyse technique complète — Plateforme ML no-code pour la cybersécurité

**Document destiné au chapitre Développement du mémoire de master**  
**Périmètre :** architecture et fonctionnalités de la **version actuelle** de la plateforme uniquement.  
**Source :** code local du dépôt (pas d’historique Git).  
**Date de génération :** 11 août 2026  

---

## Périmètre et exclusions

### Inclus (plateforme actuelle)

| Couche | Éléments |
|--------|----------|
| Navigation UI | Home, Login, Signup, Dashboard, Upload, **Data Preparation** (hub), Use Model, Admin Panel |
| Hub préparation | Onglets : Target & Type → Groups → Clean·Split·Impute → Transform (+ outliers en dialog) → Train Model |
| Composants embedded | `TargetTypeTab`, `EdaTab`, `Group_optimizer`, `Data_cleaning`, `Data_transformation`, `Creat_Model`, dialogs outliers / auto-clean / auto-transform / checkpoints |
| Backend actif | Auth users, routes `/api/*` consommées par le frontend actuel, modules `auto_*`, `anomaly_train`, `transformations`, `random_search_hp`, `regex_extract_engine` |
| Infra | Docker Compose (postgres, mongo, backend, frontend/nginx), `.env` |

### Exclu volontairement (reste d’anciennes versions — hors mémoire « plateforme actuelle »)

- Pages standalone mortes ou remplacées : `Target_selection`, `Preprocessing5`
- Chaîne de navigation page-à-page legacy (`/data_cleaning` → `/outlier_manager` → …) : le **produit actuel** passe par `/data_preparation` en mode *embedded*
- Fichier orphelin `backend/api/upload.py` (jamais branché dans `main.py`)
- Endpoints backend non appelés par le frontend actuel (listés en annexe A, non décrits comme fonctionnalités du système)
- Tests CRA boilerplate non représentatifs
- Historique Git (consigne utilisateur)

> **Note pour le rédacteur :** si le mémoire doit mentionner le nettoyage technique, se limiter à une phrase du type : *« Des routes et pages héritées d’itérations antérieures subsistent dans le dépôt mais ne font pas partie du parcours utilisateur actuel centré sur Data Preparation. »*

---

# 1. ANALYSE

## 1.1 Identification du problème et des besoins

### Problème

En cybersécurité (détection d’intrusion, classification d’alertes, détection d’anomalies), les datasets sont tabulaires, souvent volumineux, déséquilibrés et sensibles. Les analystes / chercheurs ont besoin d’un **pipeline ML guidé sans code**, avec une méthodologie rigoureuse (éviter la *data leakage*), tout en permettant l’extraction de motifs (IOC, IP, hash, etc.) et l’administration multi-utilisateurs.

### Besoin couvert par le système actuel

1. Compte utilisateur isolé + session sécurisée  
2. Import de CSV/Excel/TXT ou duplication de datasets « prédéfinis » (admin)  
3. Préparation guidée anti-leakage dans un hub unique  
4. Entraînement multi-algorithmes (supervisé, anomalie, clustering)  
5. Sauvegarde de modèles et inférence unitaire / batch  
6. Administration de la plateforme  

Positionnement produit (`frontend/src/pages/Home.js`) : *Build ML models for cybersecurity data* — intrusion detection et tâches liées.

## 1.2 Modules / fonctionnalités principaux ↔ besoin utilisateur

| Module | Backend (fichiers clés) | Frontend | Besoin |
|--------|-------------------------|----------|--------|
| Authentification | `routes/user_routes.py`, `utils/auth.py` | `Login.js`, `Signup.js`, `ProtectedRoute.js`, `Navbar.js` | Accès, isolation |
| Dashboard | `/api/databases`, modèles, predefined… | `Dashboard.js` | Gérer datasets & modèles |
| Upload | `POST /api/save-to-db` (`data_managment.py`) | `UploadFile.js` | Ingestion |
| Hub Data Preparation | nombreux endpoints + auto-* | `DataPreparation.js` | Pipeline unique |
| Target & Type | `/save-target-column`, `auto_detect_target.py`, `/detect-problem-type`, `/eda-analysis` | `TargetTypeTab.js`, `EdaTab.js` | Choisir cible / unsupervised + EDA |
| Groups | `/column-stats`, `/replace-values`, `/delete-rows`… | `Group_optimizer.js` (embedded) | Regrouper / corriger catégories |
| Clean · Split · Impute | `/split-data2`, `/impute-*`, `auto_clean_split.py` | `Data_cleaning.js` + `AutoCleanSplitDialog.js` | Nettoyer sans fuite |
| Transform | `/process-numerisation`, regex, `auto_transform.py` | `Data_transformation.js` + `AutoTransformDialog.js` | Encoder / scaler / extraire |
| Outliers | `/detect-outliers*`, actions | `OutlierManagerDialog` → managers v1/v2 | Traiter outliers |
| Checkpoints / Save As | `/dataset/save-checkpoint`, `/save-dataset-copy` | `DatasetCheckpointControls`, `SaveDatasetCopyDialog` | Revenir en arrière |
| Training | `/ridge`, `/train-*`, `anomaly_train.py`, `random_search_hp.py` | `Creat_Model.js` (embedded) | Entraîner & métriques |
| Inference | `/predict`, `/predict-batch`, `transformations.py` | `use-model.js` | Utiliser le modèle |
| Administration | `/api/admin/*`, `verify_admin` | `AdminPanel.js` | Gérer users / data / models |

### Parcours utilisateur actuel (unique)

```
Home → Signup/Login
  → Dashboard (datasets, modèles, predefined)
  → Upload  OU  Duplicate predefined
  → Data Preparation
       [0] Target & Type (+ auto-detect, EDA)
       [1] Groups (optionnel)
       [2] Clean · Split · Impute (+ auto-clean-split)
       [3] Transform (+ auto-transform, regex, outliers dialogs)
       [4] Train Model
  → Save model → Dashboard / Use Model
  → (Admin) Admin Panel
```

## 1.3 Contraintes cybersécurité ayant influencé les choix

1. **Données tabulaires cyber** — UI et heuristiques de détection de cible (`CYBER_NETWORK_HINTS` dans `auto_detect_target.py`).  
2. **Extraction d’IOC / patterns** — `regex_extract_engine.py` + jeu de test `test_data/regex_extraction_dirty_test.csv` (IP, hash, URL, CVE, chemins, syslog).  
3. **Protection ReDoS** — longueur max de pattern (500), détection de quantifiers dangereux.  
4. **Déséquilibre de classes** (fréquent en IDS) — oversampling / undersampling **sur le train uniquement**.  
5. **Doublons ambigus** — en cybersécurité un doublon peut être un événement réel → confirmation utilisateur dans `auto_clean_split`.  
6. **Sensibilité / quotas** — max 10 datasets et 20 modèles par utilisateur.  
7. **Fiabilité méthodologique** — split avant fit ; paramètres de preprocessing figés au predict (`transformations.py`).  
8. **Sécurité applicative** — bcrypt, JWT HttpOnly, rate-limit login, anti-RCE à la sauvegarde de modèle (bytes serveur uniquement).

## 1.4 Utilisateurs cibles (rôles implémentés)

Stockage : MongoDB `mern_database.users`, champ optionnel `is_admin`.

| Rôle | Création | Permissions concrètes dans le code |
|------|----------|-------------------------------------|
| **user** | Signup (défaut `is_admin` absent/false) | CRUD sur ses tables PostgreSQL (`owner_id`), ses modèles, train/predict, duplication de datasets prédéfinis ; **pas** d’accès aux routes `/api/admin/*` |
| **admin** | Promotion via Admin Panel (`PATCH .../role`) ou mise à jour Mongo manuelle | Tout ce que fait un user + stats plateforme, lister/supprimer users/datasets/models, éditer `dataset_info`, promote/demote ; ses datasets apparaissent comme **predefined** pour tous ; ne peut pas se rétrograder s’il est le dernier admin ; ne peut pas supprimer un compte admin |

Frontend : `Navbar` affiche Admin si `GET /api/users/check-admin` → `is_admin` ; `AdminPanel` refuse l’accès sinon.

## 1.5 Cas d’usage couverts (plateforme actuelle)

1. Inscription / connexion / déconnexion / vérification de session  
2. Upload CSV/XLSX/TXT → persistance PG (+ copies `_reset` / `_backup`)  
3. Duplication d’un dataset prédéfini (admin)  
4. Sélection / auto-détection de cible + EDA  
5. Regroupement / remplacement de valeurs catégorielles  
6. Nettoyage, split, imputation (manuel ou auto)  
7. Transformations (encoding, scaling, regex) + auto-transform  
8. Gestion d’outliers uni- et multivariés (dialogs)  
9. Entraînement multi-algo + random search + arrêt + polling de statut  
10. Sauvegarde modèle (fenêtre 5 min)  
11. Prédiction ligne unique + batch CSV  
12. Administration (users, datasets, models, infos)  
13. Checkpoints et Save As  

---

# 2. EXIGENCES

## 2.1 Exigences fonctionnelles

### 2.1.1 Routes API — Auth (`backend/routes/user_routes.py`, préfixe `/api/users`)

| Méthode | Path | Rôle | Entrée | Sortie |
|---------|------|------|--------|--------|
| POST | `/api/users/signup` | Créer compte | `User` : name, email, password (≥8) | 201 `{message, id}` |
| POST | `/api/users/login` | Auth + cookie | `UserLogin` | `{message}` + `Set-Cookie: jwt` |
| GET | `/api/users/me` | Profil | cookie | `{name, email, id}` |
| GET | `/api/users/current-user3` | Profil + admin | cookie | `{user_id, email, name, is_admin}` |
| POST | `/api/users/logout` | Fin session | cookie | `{message}` |
| GET | `/api/users/check-token` | Garde FE | cookie | `{valid, userId}` |
| GET | `/api/users/check-admin` | Flag admin | cookie | `{is_admin, user_id?}` |

### 2.1.2 Routes API — Métier (préfixe `/api`, `data_managment.py` + modules enregistrés)

Toutes les routes métier ci-dessous sont **consommées par le frontend actuel**. Auth typique : cookie JWT → `Depends(get_current_user2)` (retourne `user_id`).

#### Datasets & persistance

| Méthode | Path | Fonction |
|---------|------|----------|
| POST | `/save-to-db` | Créer table + metadata (quota 10) |
| GET | `/databases` | Lister datasets user |
| GET | `/get-database-data` | Aperçu données |
| GET | `/get-database-metadata` | stage, target, dataset_info… |
| GET | `/get-user-table-count` | Compteur tables |
| GET | `/check-table-exists` | Existence table |
| GET | `/check-dataset-limit` | Quota datasets |
| DELETE | `/delete-database-with-related` | Suppression dataset + satellites |
| GET | `/download-dataset-csv` | Export CSV |
| POST | `/check-create-backup` | Assurer copie backup |
| POST | `/save-dataset-copy` | Save As |
| POST | `/dataset/save-checkpoint` | Checkpoint |
| POST | `/dataset/reset-to-checkpoint` | Reset vers checkpoint |
| POST | `/create-reset-copy2` | Sync copie reset (utilisé en transform) |
| GET | `/predefined-datasets` | Catalogue datasets admin |
| POST | `/duplicate-predefined-dataset` | Copie vers espace user |

#### Target, EDA, types

| Méthode | Path | Fonction |
|---------|------|----------|
| POST | `/save-target-column` | Persister cible (ou `no-target-column`) |
| GET | `/get-target-column`, `/get-target-column2` | Lire cible |
| GET | `/get-target-type` | Type cible pour train |
| GET | `/detect-problem-type` | classif / régression / unsupervised |
| GET | `/analyze-column-types` | Types colonnes SQL |
| GET | `/column-types` | Types pour Groups |
| POST | `/auto-detect-target/start` | Job suggestion cible |
| GET | `/auto-detect-target/status/{job_id}` | Statut job |
| POST | `/eda-analysis` | EDA serveur |

#### Groups

| Méthode | Path | Fonction |
|---------|------|----------|
| POST | `/column-stats` | Stats colonne |
| POST | `/column-value-counts` | Fréquences (paginé) |
| POST | `/column-preview` | Aperçu |
| POST | `/replace-values` | Remplacement valeurs |
| POST | `/delete-rows` | Suppression lignes sélectionnées |
| POST | `/reset-id-column-sequential` | Réindexation id |
| GET | `/get-data_with-id` | Grille paginée avec id |

#### Clean / Split / Impute

| Méthode | Path | Fonction |
|---------|------|----------|
| POST | `/split-data2` | Split random/stratified + balance optionnel |
| GET | `/get-split-info`, `/get-split-stats2` | Infos split |
| GET | `/get-stats`, `/detect-empty-like-values` | Stats vides |
| GET | `/get-data-paginated` | Grille cleaning |
| POST | `/update-rows-batch` | Édition cellules |
| POST | `/delete-rows-paginated`, `/delete-filtered-rows` | Suppressions |
| GET | `/get-filtered-rows-preview` | Preview suppressions (limit 100) |
| POST | `/impute-missing-values` | Imputation |
| GET | `/get-imputation-preview` | Preview imputation |
| POST | `/auto-clean-split/start` | Pipeline auto |
| POST | `/auto-clean-split/continue` | Réponse doublons |
| GET | `/auto-clean-split/status/{job_id}` | Statut |
| POST | `/update-stage` | Avancer stage metadata |

#### Transform / regex / numerisation

| Méthode | Path | Fonction |
|---------|------|----------|
| POST | `/process-numerisation` | Appliquer configs encoding/scaling |
| GET | `/check-numerized` | Existence version numerized |
| POST | `/synchronize-numerized-to-original-complete` | Sync |
| GET | `/get-data-paginatedd` | Grille transform |
| GET | `/get-column-statss`, `/get-global-statistics` | Stats transform |
| GET | `/count-empty-rows` | Compteur vides |
| POST | `/delete-rows-with-empty-values` | Drop lignes vides |
| POST | `/delete-column` | Drop colonne |
| POST | `/update-applied-actions` | Mettre à jour pipeline |
| GET | `/get-applied-actions` | *(disponible ; pipeline aussi via metadata/modèle)* |
| POST | `/test-regex-pattern` | Test pattern |
| POST | `/regex-extract` | Extraction colonne |
| POST | `/auto-transform/start` + status | Auto-transform |

#### Outliers

| Méthode | Path | Fonction |
|---------|------|----------|
| POST | `/detect-outliers` | Multivarié |
| POST | `/get-outliers-data`, `/delete-outliers` | Détail / suppression |
| POST | `/get-paginated-data` | Pagination outliers |
| POST | `/detect-outliers-manager` | Univarié |
| POST | `/apply-single-outlier-action`, `/apply-bulk-outlier-action` | Actions |
| POST | `/check-column-type`, `/get-column-stats`, `/get-column-values` | Support UI |
| POST | `/save-modification-history` | Historique |
| GET | `/get-modification-history` | Lire historique |

#### Training & modèles

| Méthode | Path | Fonction |
|---------|------|----------|
| POST | `/ridge` | Ridge |
| POST | `/train-logistic-regression` | Logistic |
| POST | `/train-random-forest` | RF |
| POST | `/train-svm` | SVM |
| POST | `/train-knn` | KNN |
| POST | `/train-lightgbm` | LightGBM |
| POST | `/train-mlp-pytorch` | MLP PyTorch |
| POST | `/train-kmeans` | K-Means |
| POST | `/train-anomaly` | IsolationForest / One-Class SVM |
| POST | `/stop-training` | Arrêt |
| GET | `/training-status/{training_id}` | Polling |
| DELETE | `/training-status/{training_id}` | Cleanup FE |
| POST | `/save-model` | Persister modèle (TTL 5 min) |
| GET | `/get-saved-models` | Liste |
| GET | `/download-model` | Téléchargement |
| DELETE | `/delete-model` | Suppression |
| GET | `/check-model-limit` | Quota 20 |
| GET | `/get-data` | Sample pour UI train |

#### Inference

| Méthode | Path | Fonction |
|---------|------|----------|
| GET | `/model-inference-info` | Schéma formulaire |
| GET | `/sample-row` | Exemple ligne |
| POST | `/predict` | Prédiction unitaire |
| POST | `/predict-batch` | Batch CSV |
| GET | `/predict-batch-preview` | Pages résultats |
| GET | `/predict-batch-download` | Download résultats |

#### Admin (`Depends(verify_admin)`)

| Méthode | Path | Fonction |
|---------|------|----------|
| GET | `/admin/platform-stats` | Stats globales |
| GET | `/admin/users` | Liste users |
| PATCH | `/admin/users/{user_id}/role` | Promote/demote |
| DELETE | `/admin/users/{user_id}` | Supprimer user |
| GET | `/admin/datasets` | Tous datasets |
| DELETE | `/admin/datasets` | Supprimer dataset |
| GET | `/admin/models` | Tous modèles |
| DELETE | `/admin/models` | Supprimer modèle |
| GET/POST | `/admin/dataset-info/{dataset_name}` | Lire/écrire infos dataset |

#### Racine

| Méthode | Path | Fonction |
|---------|------|----------|
| GET | `/` | `{"message": "Bienvenue sur l'API"}` (`main.py`) |

### 2.1.3 Frontend actuel ↔ consommation API

| Surface UI | Fichier(s) | Routes principales |
|------------|------------|-------------------|
| Garde | `ProtectedRoute.js` | `check-token` |
| Navbar | `Navbar.js` | `me`, `check-admin`, `logout` |
| Home | `Home.js` | `me` |
| Login / Signup | `Login.js`, `Signup.js` | `login`, `signup` |
| Dashboard | `Dashboard.js` | databases, models, predefined, delete, duplicate, limits, metadata… |
| Upload | `UploadFile.js` | `get-user-table-count`, `save-to-db` ×3 |
| Data Preparation shell | `DataPreparation.js` | metadata, split-stats, download CSV, admin notes |
| Target & Type | `TargetTypeTab.js` | analyze-column-types, save-target, detect-problem-type, auto-detect-* |
| EDA | `EdaTab.js` | `eda-analysis`, `get-data_with-id` |
| Groups | `Group_optimizer.js` | column-*, replace, delete-rows, checkpoint, save-copy |
| Clean/Split | `Data_cleaning.js` + `AutoCleanSplitDialog` | split, impute, paginated, auto-clean-split |
| Transform | `Data_transformation.js` + `AutoTransformDialog` | numerisation, regex, auto-transform, sync |
| Outliers | `OutlierManagerDialog` + managers | detect-outliers*, apply-*, history |
| Train | `Creat_Model.js` | train-*, training-status, save-model, stop |
| Use model | `use-model.js` | inference-info, predict, predict-batch* |
| Admin | `AdminPanel.js` | `/api/admin/*`, `current-user3` |
| Checkpoints / Save As | composants dédiés | checkpoint, save-dataset-copy, check-dataset-limit |

### 2.1.4 Validations de données

#### Backend (Pydantic / règles métier)

| Élément | Règles | Fichier |
|---------|--------|---------|
| `User` / `UserLogin` | `EmailStr` ; password ≥ 8 | `models/user.py`, `user_routes.py` |
| `SplitDataRequest` | `trainSize` ∈ [0.1, 0.9] ; enums split/balance | `data_managment.py` |
| `NumerisationRequest` | `bdName`, `configurations: List[dict]` | idem |
| `SaveDataRequest` | colonnes/lignes ; normalisation nom table ; validation noms colonnes | idem |
| Hyperparams train | bornes par algo (ex. logistic `max_iter` 100–10000) | idem |
| `TrainAnomalyRequest` | contamination, nu, n_estimators bornés | `anomaly_train.py` |
| AutoClean / AutoTransform / AutoDetect | bodies dédiés | modules `auto_*.py` |
| Predict threshold | clamp [0.01, 0.99] | `predict` |
| Regex | pattern ≤ 500 ; ReDoS checks | `regex_extract_engine.py` |
| Quotas | 10 datasets ; 20 modèles | `save-to-db`, `save-model` |

#### Frontend

| Élément | Règles | Fichier |
|---------|--------|---------|
| Signup | password ≥ 8, confirmation | `Signup.js` |
| Upload | ext xlsx\|csv\|txt ; magic XLSX `PK` ; ≤ 200 Mo ; noms colonnes regex ; `id` réservé | `UploadFile.js` |
| Nom dataset | regex + max ~50 normalisé ; mots SQL réservés | `utils/datasetName.js` |
| Split UI | 10–90 % | `Data_cleaning` |
| Random Search | trials 1–50 ; train &lt; 10 000 rows | `Creat_Model` |
| Outliers | contamination 0.01–0.5 | `Outlier_manager2` |
| Regex UI | pattern ≤ 500 | `Data_transformation` |

## 2.2 Exigences non fonctionnelles

### Limites hardcodées (plateforme actuelle)

| Limite | Valeur | Où |
|--------|--------|-----|
| Datasets / user | 10 | backend + Upload/Dashboard/Save As |
| Modèles / user | 20 | `save-model`, Creat_Model |
| Taille upload | 200 Mo | UploadFile |
| Fenêtre save modèle | 5 minutes | `PENDING_SAVE_TTL_SECONDS` |
| Rate-limit login | 5 / 5 min / IP | `utils/auth.py` |
| JWT TTL | 24 h | `ACCESS_TOKEN_EXPIRE_MINUTES` |
| Random Search | &lt; 10 000 rows train ; ≤ 50 trials | `random_search_hp.py` |
| Downsample prédictions API | 3000 points | `pack_predictions_for_response` |
| One-hot max classes (auto) | 10 | `auto_transform.py` |
| Pool PG | 1–10 connexions | `database.py` / `init_connection_pool` |
| Compare modèles Dashboard | 2–5 | `Dashboard.js` |

### Performance

- Pagination des grilles (25/50/100)  
- Stats SQL avec `LIMIT` sur échantillons (auto-clean / auto-transform / auto-detect)  
- Jobs longs en **threads** + polling HTTP (pas WebSocket)  
- Training via `BackgroundTasks` + dict `active_trainings` + polling `/training-status`  
- Downsample des séries pour JSON / viz  
- Proxy CRA en dev ; Nginx en prod  

### Sécurité

| Mécanisme | Détail |
|-----------|--------|
| Hash password | `bcrypt` (`gensalt` + `hashpw`) |
| JWT | `python-jose`, **HS256**, claim `userId`, secret `JWT_SECRET`, 24 h |
| Stockage token | Cookie `jwt` **HttpOnly**, `SameSite=Lax`, `Secure` si `COOKIE_SECURE=true` |
| CORS | `http://localhost:3000`, `http://127.0.0.1:3000` (`main.py`) — à adapter en prod |
| Ownership | `owner_id` + `assert_owns_table` |
| Save modèle | bytes **uniquement serveur** (anti pickle client / RCE) |
| Upload FE | types + magic bytes XLSX ; parsing client puis JSON vers API |

### Gestion des erreurs

- Exceptions FastAPI `HTTPException` : 400, 401, 403, 404, 422, 429, 500  
- Corps standard : `{ "detail": "..." }`  
- Training stoppé : statut poll avec message d’erreur utilisateur  

## 2.3 Standards et versions

- Style API REST / RPC (`/train-*`, ressources `/admin/users`)  
- OpenAPI généré par FastAPI (`/docs`)  
- Naming : snake_case Python ; camelCase fréquent côté JSON FE (`bdName`, `trainSize`)  
- Structure monorepo `backend/` + `frontend/`  

**Versions principales** (`backend/requirements.txt`, `frontend/package.json`) :

- FastAPI 0.115.14, Uvicorn 0.34.0, Pydantic 2.11.7  
- pandas 2.2.3, scikit-learn 1.6.1, LightGBM 4.6.0, PyTorch 2.8.0  
- pymongo 4.13.2, psycopg2-binary 2.9.10, bcrypt 4.3.0, python-jose 3.4.0  
- React 18.2, MUI 7.x, axios 1.8.4, react-router-dom 6.29, CRA/craco  

---

# 3. CONCEPTION

## 3.1 Architecture réelle

```
┌─────────────────────────────────────────────────────────────┐
│  Navigateur (React SPA)                                     │
│  Dev : :3000  |  Prod : :80 (Nginx static + proxy /api/)    │
└────────────┬────────────────────────────────────▲───────────┘
             │ HTTP/JSON + Cookie JWT               │
             ▼                                      │
┌────────────────────────┐              ┌──────────┴──────────┐
│ FastAPI (Uvicorn :8000)│──────────────│ Filesystem          │
│ main.py + routers      │              │ saved_models/*.joblib│
└───────┬──────────┬─────┘              │              *.pt   │
        │          │                    └─────────────────────┘
        ▼          ▼
┌──────────────┐ ┌────────────────┐
│ PostgreSQL   │ │ MongoDB        │
│ :5432        │ │ :27017         │
│ datasets +   │ │ users          │
│ metadata +   │ │ (is_admin)     │
│ saved_models │ │                │
│ (table méta) │ │                │
└──────────────┘ └────────────────┘
```

**Services Docker** (`docker-compose.yml`) : `postgres`, `mongo`, `backend`, `frontend`.  
**Protocoles :** HTTP ; cookies ; volumes `pgdata`, `mongodata`.  
**Nginx** (`nginx-1.27.4/conf/nginx.conf`) : SPA `try_files` + `location /api/` → backend (nom de conteneur hardcodé `v2-backend-1` — à aligner avec le projet Compose).

## 3.2 Structure des dossiers (périmètre actuel)

```
/
├── docker-compose.yml
├── .env                          # variables (secrets hors mémoire)
├── backend/
│   ├── main.py                   # App, CORS, include routers
│   ├── data_managment.py         # Cœur métier + routes /api
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── anomaly_train.py          # IsolationForest / OC-SVM
│   ├── auto_clean_split.py       # Auto clean→split→impute→balance
│   ├── auto_transform.py         # Auto encoding/scaling
│   ├── auto_detect_target.py     # Suggestion de cible
│   ├── transformations.py        # Replay preprocessing au predict
│   ├── random_search_hp.py       # Random search HP
│   ├── regex_extract_engine.py   # Extraction regex / IOC
│   ├── models/user.py
│   ├── routes/user_routes.py
│   └── utils/auth.py, database.py
├── frontend/
│   ├── src/
│   │   ├── App.js, config.js, ProtectedRoute.js
│   │   ├── components/           # Navbar, dialogs, checkpoints
│   │   ├── pages/
│   │   │   ├── Home, Login, Signup, Dashboard, UploadFile
│   │   │   ├── DataPreparation.js          # HUB
│   │   │   ├── data_preparation/           # TargetTypeTab, EdaTab
│   │   │   ├── Group_optimizer, Data_cleaning, Data_transformation
│   │   │   ├── Creat_Model, use-model, AdminPanel
│   │   │   └── Outlier_manager, Outlier_manager2  # via dialogs
│   │   └── utils/datasetName.js
│   ├── Dockerfile
│   └── package.json
├── nginx-1.27.4/conf/nginx.conf
├── saved_models/                 # artefacts entraînés
└── test_data/                    # CSV validation regex
```

## 3.3 Schéma des bases de données

### MongoDB — base `mern_database`

**Collection `users`** (seule collection métier utilisée) :

| Champ | Type | Rôle |
|-------|------|------|
| `_id` | ObjectId | Identifiant |
| `name` | string | Nom affiché |
| `email` | string | Unique (contrôle applicatif) |
| `password` | string | Hash bcrypt |
| `is_admin` | bool (opt.) | Rôle |
| `created_at` / `createdAt` | opt. | Stats admin |

### PostgreSQL

#### Table `user_tables_metadata`

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | SERIAL PK | |
| `table_name` | VARCHAR(255) | |
| `owner_id` | VARCHAR(255) | = id Mongo |
| `columns` | JSONB | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `target_column` | VARCHAR(255) | ou `no-target-column` |
| `model_type` | VARCHAR(50) | |
| `applied_actions` | JSONB | pipeline preprocessing |
| `stage` | VARCHAR(50) | défaut `target_selection` |
| `updated_at` | TIMESTAMPTZ | |
| `modification_history` | JSONB | outliers / actions |
| `dataset_info` | texte/JSON | notes admin |
| UNIQUE | `(table_name, owner_id)` | |

#### Table `user_saved_models`

| Colonne | Type |
|---------|------|
| `id` | SERIAL PK |
| `user_id` | VARCHAR(255) |
| `model_name` | VARCHAR(255) |
| `db_name` | VARCHAR(255) |
| `model_path` | TEXT UNIQUE |
| `db_columns` | TEXT[] |
| `r2_score`, `accuracy_score`, `silhouette_score`, `inertia` | FLOAT |
| `framework` | VARCHAR(50) |
| `model_type` | VARCHAR(50) |
| `algorithm` | VARCHAR(100) |
| `has_visualization_data` | BOOLEAN |
| `applied_actions` | JSONB |
| `raw_input_columns` | TEXT[] |
| `created_at` | TIMESTAMPTZ |
| UNIQUE `(user_id, model_name)` ; INDEX sur `user_id`, `model_type` |

#### Tables dynamiques utilisateur

Une table SQL par dataset (nom normalisé) + satellites :

- `{name}` — données de travail  
- `{name}_reset` — checkpoint / reset  
- `{name}_backup` — backup upload  
- `{name}_numerized` — version transformée  

Colonnes techniques fréquentes : `id`, `split_type` (`train`/`test`).

## 3.4 Diagramme d’interactions (fonctionnalité type)

```
[React UI] --credentials:include--> [FastAPI]
                                      |-- JWT cookie --> user_id
                                      |-- PostgreSQL (data + metadata)
                                      |-- MongoDB (users / is_admin)
                                      '-- filesystem (modèles)
[React UI] <-- JSON (+ Set-Cookie login)
```

Exemple **Train** : Creat_Model → POST `/train-*` → BackgroundTasks → PG lecture train/test → fit → pending_save (RAM 5 min) → FE poll `/training-status` → POST `/save-model` → fichier + ligne `user_saved_models`.

Exemple **Predict** : use-model → charge modèle + `applied_actions` → `transformations.py` (params figés) → prédiction.

## 3.5 Choix techniques (raisons visibles dans le code)

| Choix | Pourquoi (concret) |
|-------|---------------------|
| FastAPI | Routes async, Pydantic, BackgroundTasks, OpenAPI |
| React + MUI | Hub à onglets, DataGrid, dialogs |
| PostgreSQL | Tables dynamiques + stats/impute/split en SQL |
| MongoDB | Users légers (DB nommée `mern_database`) |
| JWT cookie HttpOnly | Réduit vol de token via XSS vs localStorage |
| joblib + torch | Sklearn vs MLP |
| Modules `auto_*` | Automatisation guidée sans remplacer le manuel |
| `transformations.py` | Une seule source de vérité train↔predict |
| Polling | Compatible Nginx ; pas de stack WS |
| Dual-DB | Auth documentaire vs data relationnelle |

**Non retenus (et pourquoi ce n’est pas dans l’archi actuelle) :** Celery/Redis (jobs in-memory), WebSocket, ORM lourd, validation magic-bytes exhaustive côté serveur sur upload JSON.

## 3.6 Design patterns

| Pattern | Où |
|---------|-----|
| Dependency Injection | `Depends(get_current_user2)`, `verify_admin` |
| APIRouter / register_* | `user_routes`, `register_auto_*_routes`, `register_anomaly_routes` |
| Context manager pool | `get_db_connection()` |
| Job + polling | `auto_*_jobs`, `active_trainings` |
| Facade replay | `transformations.apply_actions_*` |
| Composite UI / Hub | `DataPreparation` embed des pages |
| Protected route | `ProtectedRoute` + Outlet |

---

# 4. IMPLÉMENTATION

## 4.1 Flux techniques par module majeur

### Auth

1. Signup → validation email/password → bcrypt → insert Mongo  
2. Login → rate-limit IP → verify bcrypt → JWT HS256 → cookie HttpOnly 24 h  
3. Requêtes API → lecture cookie → `verify_token` → `userId`  
4. Logout → suppression cookie  
5. FE : `ProtectedRoute` appelle `check-token`  

**Fichiers :** `user_routes.py`, `auth.py`, `Login.js`, `Signup.js`, `ProtectedRoute.js`

### Upload

1. FE parse fichier (CSV/XLSX/TXT), validations taille/types/magic  
2. Vérifie quota  
3. Trois `POST /save-to-db` : `{name}`, `{name}_reset`, `{name}_backup`  
4. Backend : normalisation nom, détection types PG (`TEXT`/`BOOLEAN`/`INTEGER`/`BIGINT`/`FLOAT8`), CREATE TABLE, INSERT, metadata `owner_id`  
5. Navigation vers `/data_preparation`  

**Fichiers :** `UploadFile.js`, `save-to-db` dans `data_managment.py`

### Target & Type (+ EDA)

1. `analyze-column-types` + preview paginée  
2. Option auto-detect (job thread + poll status)  
3. Confirm → `save-target-column` (colonne ou `no-target-column`)  
4. `detect-problem-type` pour orienter la suite  
5. EDA optionnelle via `eda-analysis` (respect train si split présent)  

**Fichiers :** `TargetTypeTab.js`, `EdaTab.js`, `auto_detect_target.py`

### Groups

1. Charger types / stats / value counts  
2. Remplacer ou supprimer valeurs  
3. Checkpoint / Save As possibles  
4. Unlock suite pipeline  

**Fichiers :** `Group_optimizer.js` (mode `embedded`)

### Clean · Split · Impute

1. Édition / suppression lignes-colonnes  
2. `split-data2` : ajoute `split_type` ; random ou stratified ; balance **train only**  
3. Imputation : stats fit sur train, apply train+test  
4. Ou pipeline `auto-clean-split` (clean → split → impute → balance) avec éventuelle question doublons  

**Fichiers :** `Data_cleaning.js`, `AutoCleanSplitDialog.js`, `auto_clean_split.py`, helpers oversample/undersample

### Transform (+ outliers)

1. Configurations par colonne → `process_numerisation` → table `_numerized` + `applied_actions`  
2. Fit Standard/MinMax/Frequency préférentiellement sur **train** si `split_type` existe  
3. Regex extract (moteur unifié, ReDoS-safe)  
4. Auto-transform (job + poll)  
5. Outliers via dialogs (univarié / multivarié) sans quitter le hub  

**Fichiers :** `Data_transformation.js`, `auto_transform.py`, `regex_extract_engine.py`, `OutlierManagerDialog.js`

### Training

1. Vérification split / type problème / quota modèles  
2. POST algo avec `training_id`  
3. Worker asynchrone : lit features hors cible ; option Random Search sur `X_train` ; fit final ; métriques test  
4. Modèle sérialisé base64 → `pending_save_models` (TTL 5 min)  
5. FE poll `/training-status` ; stop via flag  
6. `save-model` : lit pending serveur, écrit fichier, insert PG + snapshot `applied_actions`  

**Algorithmes :** Ridge, Logistic, Random Forest, SVM, KNN, LightGBM, MLP PyTorch, K-Means, Isolation Forest, One-Class SVM  

**Fichiers :** `Creat_Model.js`, endpoints train dans `data_managment.py`, `anomaly_train.py`, `random_search_hp.py`

### Prediction

1. `model-inference-info` → champs bruts attendus  
2. `predict` : charge modèle + pipeline → `transformations.apply_actions_*` → matrice features → predict / proba + threshold  
3. Batch CSV : upload → preview paginé → download  

**Fichiers :** `use-model.js`, `transformations.py`, routes predict

### Admin

1. Vérif `is_admin`  
2. CRUD users / datasets / models + stats + dataset_info  

**Fichiers :** `AdminPanel.js`, bloc `/admin/*` dans `data_managment.py`

## 4.2 Difficultés techniques et solutions (périmètre actuel)

| Difficulté | Solution implémentée |
|------------|----------------------|
| Data leakage | Split avant transforms ; impute/balance/scaler fit train ; predict rejoue params figés |
| Encoding booléens → NaN | `_encode_column_to_binary`, `_normalize_category_key` |
| RCE via pickle client | Store serveur `pending_save_models` 5 min |
| Arrêt training / Future | Flags `training_stop_flags` ; ne pas cancel le Future |
| Deadlock DROP TABLE (auto-transform) | Fermeture connexion / batch unique de numerisation |
| Gros payloads métriques | Downsample 3000 points |
| Doublons cyber ambigus | Job `awaiting_input` + continue |
| Sync numerized ↔ original | `synchronize-numerized-to-original-complete` |
| Quotas multi-tenant | COUNT avant insert |

## 4.3 Exécution du pipeline ML

| Aspect | Implémentation |
|--------|----------------|
| Mode | **Asynchrone** (`BackgroundTasks` / threads pour auto-*) |
| Feedback UI | **Polling HTTP** (`/training-status`, `/auto-*/status`) |
| Stop | Flag partagé lu dans les boucles d’entraînement |
| Persistance résultat | RAM courte (pending save) puis disque + PG |
| Pas utilisé | WebSocket, SSE, Celery, Redis |

## 4.4 Historique Git / bugs architecturaux

Non analysé (consigne : code local uniquement).

---

# 5. TESTS

## 5.1 Tests automatisés

| Type | État |
|------|------|
| Backend (pytest) | **Absent** dans le dépôt |
| Frontend (Jest) | Uniquement boilerplate CRA non aligné avec l’app |
| E2E | **Absent** |
| CI/CD | **Absent** |

## 5.2 Validation manuelle / artefacts présents

- `test_data/regex_extraction_dirty_test.csv` : scénarios d’extraction (IP, hash, URL, CVE, lignes vides, multi-match…)  
- Dossier `saved_models/` : traces d’entraînements manuels (fichiers `.joblib` / `.pt`)  
- **Aucun fichier consolidé de métriques** (accuracy/F1 sur un benchmark cyber officiel) versionné dans le repo  

> Pour le mémoire : indiquer que la validation a été réalisée de façon **manuelle** via l’UI (upload → préparation → train → predict), et annexer les captures / tableaux de métriques obtenus hors dépôt si disponibles.

## 5.3 Prévention de la data leakage — vérification dans le code

| Étape | Mécanisme | Localisation |
|-------|-----------|--------------|
| Split avant transform | Colonne `split_type` via `split-data2` / auto-clean-split | `data_managment.py`, `auto_clean_split.py` |
| Imputation | Fit stats sur `WHERE split_type='train'` | auto-clean-split, `/impute-missing-values` |
| Balancing | Oversample / undersample **train only** | helpers + commentaires anti-leakage |
| Encoding / scaling | Fit préférentiel train si split présent | `process_numerisation` |
| Entraînement | Fit sur train ; métriques sur test ; anomaly **exige** un split | endpoints train, `anomaly_train.py` |
| Inférence | **Aucun re-fit** : params dans `applied_actions` | `transformations.py` |
| Warning | Sans split, auto-transform peut fit sur table entière | `auto_transform.py` |

**Nuances à mentionner honnêtement :**  
- Imputation NaN dans anomaly : médiane par partition (amélioration possible = médiane train seule)  
- Certains encodages catégoriels peuvent voir des catégories globales selon le chemin  
- Frequency encoding : support train OK ; replay predict à vérifier si utilisé  

---

# 6. DÉPLOIEMENT

## 6.1 Environnement

| Aspect | État d’après le code |
|--------|----------------------|
| Dev | React `:3000`, API `:8000`, PG `:5432`, Mongo `:27017` |
| Prod prévue | Docker Compose + Nginx `:80` |
| URL publique | **Non présente** dans le code (à documenter selon votre serveur) |
| Méthode | Copie du code local vers le serveur (sans Git), puis build/run |

## 6.2 Fichiers de configuration présents

| Fichier | Rôle |
|---------|------|
| `docker-compose.yml` | Orchestration 4 services |
| `backend/Dockerfile` | Python 3.10-slim, uvicorn `:8000` |
| `frontend/Dockerfile` | Build Node 18 → image Nginx |
| `nginx-1.27.4/conf/nginx.conf` | SPA + proxy `/api/` |
| `.env` | Secrets / config |
| `.env.example` | **Absent** |
| CI/CD | **Absent** |
| README déploiement racine | **Absent** (README frontend = template CRA) |

## 6.3 Infrastructure

- **4 conteneurs** : postgres:15, mongo:6, backend, frontend  
- **Ports** : 5432, 27017, 8000, 80  
- **Volumes** : `pgdata`, `mongodata`  
- **Modèles** : fichiers sous `saved_models/` (pas de volume nommé dédié dans compose — point d’attention prod)

## 6.4 Étapes de déploiement from scratch (déduites du repo)

1. Copier le projet sur le serveur  
2. Renseigner `.env` (voir variables ci-dessous)  
3. Aligner `nginx.conf` `proxy_pass` sur le vrai nom du conteneur backend  
4. Adapter CORS dans `main.py` si le front n’est plus `localhost:3000`  
5. `docker compose up -d --build`  
6. Créer un premier admin (signup puis `is_admin: true` en Mongo, ou promotion si un admin existe)  
7. Uploader les datasets prédéfinis avec le compte admin  

**Dev local sans Docker :** services PG+Mongo, lancer uvicorn backend, `npm start` frontend.

## 6.5 Variables d’environnement (noms — pas les valeurs)

| Variable | Rôle |
|----------|------|
| `JWT_SECRET` | Clé de signature JWT |
| `COOKIE_SECURE` | Cookie Secure (HTTPS) |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Auth PG |
| `POSTGRES_HOST`, `POSTGRES_PORT` | Connexion PG |
| `MONGO_URI` | Connexion Mongo |
| `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, `MONGO_INITDB_DATABASE` | Init conteneur Mongo |
| `REACT_APP_BACKEND_URL`, `REACT_APP_FRONTEND_URL` | URLs front (si utilisées) |
| `FAST_REFRESH`, `WDS_SOCKET_PORT` | Dev webpack |

## 6.6 Stratégie données en production

| Sujet | État dans le code |
|-------|-------------------|
| Backups automatiques PG/Mongo | **Non** (volumes Docker seulement) |
| Migrations de schéma | Pas d’Alembic — `CREATE TABLE IF NOT EXISTS` + `ALTER` runtime |
| Modèles | Fichiers disque + métadonnées PG ; pending save 5 min en RAM |
| Datasets | Tables dynamiques + `_reset` / `_backup` / `_numerized` |

---

# Annexes

## Annexe A — Éléments exclus de cette analyse (legacy / morts)

Documentés ici uniquement pour traçabilité ; **ne font pas partie de la plateforme actuelle** décrite ci-dessus.

**Pages / routes FE :** `Target_selection`, `Preprocessing5`, navigation standalone page-à-page hors hub.  

**Fichier backend mort :** `backend/api/upload.py`.  

**Endpoints non consommés par le FE actuel (exemples) :**  
`/auto-clean`, `/create-reset-copy` (+3..6), `/update-data*`, `/get-data2|3|4`, `/group-rare-categories`, `/validate-timeseries-split`, `/restore-from-backup`, `/reset-dataset-complete`, `/create-empty-numerized`, `/debug-id-format`, `/detect-column-types`, `/rename-column`, `/prepare-table-columns`, `/get-predefined-dataset-stats`, `/synchronize-numerized-to-original` (sans `-complete`), `/api/users/current-user`, etc.

## Annexe B — Informations manquantes à compléter par l’auteur du mémoire

1. URL / IP publique du serveur de production  
2. Procédure exacte de copie locale → serveur  
3. CORS / HTTPS réellement configurés en prod  
4. Tableaux de métriques expérimentales (accuracy, precision, recall, F1) sur datasets cyber  
5. Mode de création du premier compte admin en production  

---

*Fin du document — Analyse technique plateforme actuelle (hors legacy).*
