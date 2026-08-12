import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  FaPlus, FaTimes, FaDatabase, FaRobot, FaSignOutAlt, 
  FaUser, FaEnvelope, FaChartLine, FaCog, FaBox,
  FaDownload, FaEye, FaStar, FaUpload, FaHistory,
  FaChartBar, FaTable, FaInfoCircle, FaExclamationTriangle,
  FaBalanceScale, FaCheck
} from "react-icons/fa";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, Alert, CircularProgress,
  Chip, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, LinearProgress, IconButton, Tabs, Tab,
  Checkbox, Snackbar
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";
import { 
  Info as InfoIcon, 
  Close as CloseIcon,
  TableChart as TableChartIcon,
  BarChart as BarChartIcon
} from "@mui/icons-material";
import "./Dashboard.css";
import { backendUrl } from "../config";
import { normalizeDatasetName, validateDatasetNameInput } from "../utils/datasetName";

/** Comparable problem family for side-by-side model evaluation */
function getComparableFamily(model) {
  const t = String(model?.model_type || "").toLowerCase();
  const a = String(model?.algorithm || "").toLowerCase();
  if (t.includes("anomaly") || a.includes("isolation") || a.includes("one_class")) {
    return "anomaly";
  }
  if (t.includes("kmean") || t.includes("cluster")) return "clustering";
  if (t.includes("regress")) return "regression";
  if (t.includes("classif")) return "classification";
  if (model?.silhouette_score != null && model.silhouette_score !== "") return "clustering";
  if (model?.r2_score != null && model.r2_score !== "" &&
      (model?.accuracy_score == null || model.accuracy_score === "")) {
    return "regression";
  }
  if (model?.accuracy_score != null && model.accuracy_score !== "") return "classification";
  return "unknown";
}

function normalizeModelDbName(name) {
  return String(name || "")
    .replace(/_numerized$/i, "")
    .replace(/_backup$/i, "")
    .replace(/_reset$/i, "")
    .toLowerCase();
}

function featureOverlap(aCols, bCols) {
  const a = new Set(aCols || []);
  const b = new Set(bCols || []);
  if (!a.size && !b.size) return 1;
  let inter = 0;
  a.forEach((c) => { if (b.has(c)) inter += 1; });
  const union = new Set([...a, ...b]).size || 1;
  return inter / union;
}

function primaryMetric(model, family) {
  if (family === "classification") {
    const v = model.accuracy_score;
    return v == null || v === "" ? null : Number(v);
  }
  if (family === "regression") {
    const v = model.r2_score;
    return v == null || v === "" ? null : Number(v);
  }
  if (family === "clustering") {
    const v = model.silhouette_score;
    return v == null || v === "" ? null : Number(v);
  }
  return null;
}

function formatPrimaryMetric(family, value) {
  if (value == null || Number.isNaN(value)) return "N/A";
  if (family === "classification") return `${(value * 100).toFixed(2)}%`;
  return value.toFixed(4);
}

const MAX_COMPARE_MODELS = 5;
const COMPARE_BAR_COLORS = ["#DE6B06", "#384850", "#0088CC", "#2e7d32", "#7b1fa2"];

const ALGORITHM_LABELS = {
  ridge: "Ridge Regression",
  logistic: "Logistic Regression",
  random_forest: "Random Forest",
  svm: "SVM",
  knn: "k-NN",
  lightgbm: "LightGBM",
  mlp: "MLP (Neural Network)",
  pytorch_mlp: "MLP (Neural Network)",
  kmeans: "K-Means",
  isolation_forest: "Isolation Forest",
  one_class_svm: "One-Class SVM",
  anomaly: "Anomaly detection",
};

function formatAlgorithmLabel(model) {
  const raw = String(model?.algorithm || model?.model_type || "").toLowerCase().trim();
  if (!raw || raw === "unknown") {
    if (String(model?.framework || "").toLowerCase() === "pytorch") {
      return ALGORITHM_LABELS.mlp;
    }
    return "Unknown algorithm";
  }
  if (ALGORITHM_LABELS[raw]) return ALGORITHM_LABELS[raw];
  // Coarse problem-family leftovers from older saves
  if (raw === "classification" || raw === "regression") {
    return "Unknown algorithm";
  }
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function validateModelGroup(models) {
  if (!models || models.length < 2) {
    return { ok: false, reason: "Select between 2 and 5 models to compare." };
  }
  if (models.length > MAX_COMPARE_MODELS) {
    return { ok: false, reason: `You can compare at most ${MAX_COMPARE_MODELS} models.` };
  }
  const ids = new Set(models.map((m) => m.id));
  if (ids.size !== models.length) {
    return { ok: false, reason: "Choose distinct models." };
  }

  const families = models.map((m) => getComparableFamily(m));
  if (families.some((f) => f === "unknown")) {
    return { ok: false, reason: "One model has an unknown type and cannot be compared safely." };
  }
  const family = families[0];
  if (families.some((f) => f !== family)) {
    const names = models.map((m, i) => `${m.model_name} (${families[i]})`).join(", ");
    return {
      ok: false,
      reason: `Incomparable problem types: ${names}. Compare only models of the same type.`,
    };
  }

  const dbs = models.map((m) => normalizeModelDbName(m.db_name));
  if (dbs.some((d) => d !== dbs[0])) {
    return {
      ok: false,
      reason: "Incomparable: models were trained on different datasets. Compare models from the same dataset.",
    };
  }

  const missing = models.filter((m) => primaryMetric(m, family) == null);
  if (missing.length) {
    return {
      ok: false,
      reason: `Missing primary metric on: ${missing.map((m) => m.model_name).join(", ")}.`,
    };
  }
  return { ok: true, family, reason: null };
}

function buildComparisonVerdict(models, family) {
  const label =
    family === "classification" ? "accuracy" :
    family === "regression" ? "R²" : "silhouette";
  const ranked = [...models].sort(
    (a, b) => (primaryMetric(b, family) ?? -Infinity) - (primaryMetric(a, family) ?? -Infinity)
  );
  const best = ranked[0];
  const second = ranked[1];
  const bestScore = primaryMetric(best, family);
  const secondScore = primaryMetric(second, family);
  const allTied = ranked.every((m) => primaryMetric(m, family) === bestScore);
  if (allTied) {
    return {
      winner: null,
      ranked,
      text: `Tie on ${label}: all selected models score ${formatPrimaryMetric(family, bestScore)}.`,
      label,
    };
  }
  const rel =
    family === "classification"
      ? `${((bestScore - secondScore) * 100).toFixed(2)} pp over next`
      : `${(bestScore - secondScore).toFixed(4)} over next`;
  return {
    winner: best,
    ranked,
    text: `${best.model_name} leads on ${label} (${formatPrimaryMetric(family, bestScore)}; ${rel}).`,
    label,
  };
}

function pairwiseFeatureOverlap(models) {
  if (!models || models.length < 2) return 1;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      sum += featureOverlap(models[i].db_columns, models[j].db_columns);
      n += 1;
    }
  }
  return n ? sum / n : 1;
}

function Dashboard() {
  // State declarations
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [loadingDatabases, setLoadingDatabases] = useState(true);
  const [savedModels, setSavedModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [predefinedDatasets, setPredefinedDatasets] = useState([]);
  const [loadingPredefined, setLoadingPredefined] = useState(true);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    location.state?.activeTab === "models" ||
    location.state?.activeTab === "predefined" ||
    location.state?.activeTab === "databases"
      ? location.state.activeTab
      : "databases"
  );
  const [selectedPredefinedDataset, setSelectedPredefinedDataset] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [datasetName, setDatasetName] = useState("");
  const [datasetNameError, setDatasetNameError] = useState("");
  const [tableLimitExceeded, setTableLimitExceeded] = useState(false);
  const [userTableCount, setUserTableCount] = useState(0);
  const [duplicating, setDuplicating] = useState(false);
  const [localDatasetInfoText, setLocalDatasetInfoText] = useState("");

  // Nouveaux états pour la visualisation
  const [visualizationModalOpen, setVisualizationModalOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [datasetData, setDatasetData] = useState(null);
  const [loadingDatasetInfo, setLoadingDatasetInfo] = useState(false);
  const [loadingDatasetData, setLoadingDatasetData] = useState(false);
  const [visualizationTab, setVisualizationTab] = useState(0); // 0 pour stats, 1 pour data
  
  // États pour la fonctionnalité admin - FIX: Utiliser un seul state pour éviter le rafraîchissement
  const [isAdmin, setIsAdmin] = useState(false);
  const [datasetInfoModalOpen, setDatasetInfoModalOpen] = useState(false);
  const [selectedDatasetForInfo, setSelectedDatasetForInfo] = useState(null);
  const [datasetInfoText, setDatasetInfoText] = useState("");
  const [savingDatasetInfo, setSavingDatasetInfo] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Pour forcer le rafraîchissement

  // Model comparison (max 2)
  const [compareSelection, setCompareSelection] = useState([]); // model ids
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareError, setCompareError] = useState("");

  // Confirm delete dialogs (replace window.confirm)
  const [deleteDatasetDialog, setDeleteDatasetDialog] = useState(null); // dbName string
  const [deleteModelDialog, setDeleteModelDialog] = useState(null); // { id, path, name }
  const [deletingResource, setDeletingResource] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  const navigate = useNavigate();

  const showToast = (message, severity = "success") => {
    setToast({ open: true, message, severity });
  };

  // Descriptions générales
  const dashboardDescription =
    "Manage datasets and saved models. Typical path: upload or copy a dataset, open Data Preparation (Target, Clean/Split, Transform, Outliers), train a model, then use it for predictions.";

  const tabDescriptions = {
    databases: {
      description:
        "Your datasets. Upload new ones, continue preparation, reset and restart, or delete. Continue opens Data Preparation at your last stage.",
      emptyDescription:
        "No datasets yet. Upload a CSV/Excel file, or copy one from Predefined Datasets.",
    },
    predefined: {
      description:
        "Ready-made cybersecurity tabular datasets. Visualize details, then copy one to your account to start Data Preparation.",
      emptyDescription:
        "No predefined datasets yet. An admin can add them later.",
      action: "Copy a dataset, then follow Target → Clean/Split → Transform → Train → Use Model.",
    },
    models: {
      description:
        "Models you saved after training. Open Use Model for predictions, download the file, or delete unused models.",
      emptyDescription:
        "No saved models yet. Prepare a dataset, open Train Model, train, then save.",
      action: "Use a model for predictions, or remove ones you do not need.",
    },
  };

  // Fonction pour vérifier si l'utilisateur est admin
  const checkIfAdmin = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/users/check-admin`, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.is_admin || false);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      setIsAdmin(false);
    }
  };

  // Fonction pour vérifier la limite de datasets
  const checkDatasetLimit = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/check-dataset-limit`, {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error('Failed to check dataset limit');
      }
      
      const result = await response.json();
      setUserTableCount(result.count);
      setTableLimitExceeded(result.limit_reached);
      
    } catch (err) {
      console.error("Error checking dataset limit:", err);
    }
  };

const saveDatasetInfo = async (updatedText) => {
  if (!selectedDatasetForInfo) return;
  
  try {
    setSavingDatasetInfo(true);
    
    const response = await fetch(
      `${backendUrl}/api/admin/dataset-info/${selectedDatasetForInfo.table_name}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataset_info: updatedText
        })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save dataset information');
    }

    const result = await response.json();
    
    setDatasetInfoText(updatedText);
    
    if (datasetInfo && selectedDataset?.table_name === selectedDatasetForInfo.table_name) {
      setDatasetInfo({
        ...datasetInfo,
        dataset_info: updatedText,
        has_dataset_info: updatedText && updatedText.trim().length > 0
      });
    }
    
    alert(result.message || "Dataset information saved successfully");
    setDatasetInfoModalOpen(false);
    
  } catch (error) {
    console.error("Error saving dataset info:", error);
    alert(`Error: ${error.message}`);
  } finally {
    setSavingDatasetInfo(false);
  }
};

  // Fonction pour charger les informations du dataset (admin seulement) - FIXÉ
  const loadDatasetInfo = async (dataset) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/admin/dataset-info/${dataset.table_name}`,
        {
          credentials: 'include'
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Dataset info loaded from admin endpoint:", data);
        setDatasetInfoText(data.dataset_info || "");
      } else {
        console.log("No dataset info found in admin endpoint, setting empty");
        setDatasetInfoText("");
      }
    } catch (error) {
      console.error("Error loading dataset info:", error);
      setDatasetInfoText("");
    }
  };

// Fonction pour ouvrir le modal d'information admin - CORRIGÉ
const handleAddDatasetInfo = async (dataset, e) => {
  if (e) e.stopPropagation();
  
  setSelectedDatasetForInfo(dataset);
  
  // FIX: Charger les informations mais ne pas rafraîchir l'UI
  try {
    const response = await fetch(
      `${backendUrl}/api/admin/dataset-info/${dataset.table_name}`,
      {
        credentials: 'include'
      }
    );

    if (response.ok) {
      const data = await response.json();
      setDatasetInfoText(data.dataset_info || "");
    } else {
      setDatasetInfoText("");
    }
  } catch (error) {
    console.error("Error loading dataset info:", error);
    setDatasetInfoText("");
  }
  
  setDatasetInfoModalOpen(true);
};

  const handleAddInfoFromModal = async (dataset) => {
    setSelectedDatasetForInfo(dataset);
    await loadDatasetInfo(dataset);
    setDatasetInfoModalOpen(true);
    setVisualizationModalOpen(false);
  };

  const fetchDatasetMetadata = async (datasetName) => {
    try {
      console.log(`Fetching metadata for: ${datasetName}`);
      const response = await fetch(
        `${backendUrl}/api/get-database-metadata?dbName=${datasetName}`,
        {
          credentials: 'include'
        }
      );

      if (!response.ok) {
        console.warn(`Metadata not found for ${datasetName}`);
        return null;
      }

      const metadata = await response.json();
      console.log('Metadata received:', metadata);
      
      // S'assurer que has_dataset_info est toujours défini
      if (metadata.has_dataset_info === undefined && metadata.dataset_info) {
        const hasInfo = typeof metadata.dataset_info === 'string' 
          ? metadata.dataset_info.trim().length > 0
          : Boolean(metadata.dataset_info);
        
        metadata.has_dataset_info = hasInfo;
      }
      
      return metadata;
    } catch (error) {
      console.error("Error fetching metadata:", error);
      return null;
    }
  };

  // Fonction pour obtenir les données du dataset
  const fetchDatasetData = async (datasetName) => {
    try {
      console.log(`Fetching data for: ${datasetName}`);
      const response = await fetch(
        `${backendUrl}/api/get-database-data?dbName=${datasetName}`,
        {
          credentials: 'include'
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }

      const data = await response.json();
      console.log('Data received, rows:', data.rows?.length);
      return data;
    } catch (error) {
      console.error("Error fetching dataset data:", error);
      throw error;
    }
  };

  // Modal component intégré
  const CreateDatasetNameModal = ({ open, onClose, dataset, onConfirm }) => {
    const [localDatasetName, setLocalDatasetName] = useState('');
    const [localError, setLocalError] = useState('');
    const [localTableLimitExceeded, setLocalTableLimitExceeded] = useState(false);
    const [localUserTableCount, setLocalUserTableCount] = useState(0);

    useEffect(() => {
      if (open) {
        checkLocalDatasetLimit();
      }
    }, [open]);

    const checkLocalDatasetLimit = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/check-dataset-limit`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const limitInfo = await response.json();
          setLocalUserTableCount(limitInfo.count);
          setLocalTableLimitExceeded(limitInfo.limit_reached);
        }
      } catch (error) {
        console.error("Error checking dataset limit:", error);
      }
    };

   const validateName = (name) => validateDatasetNameInput(name);

    const handleNameChange = (e) => {
      const name = e.target.value;
      setLocalDatasetName(name);
      setLocalError(validateName(name));
    };

    const handleConfirm = () => {
      const validationError = validateName(localDatasetName);
      if (validationError) {
        setLocalError(validationError);
        return;
      }
      onConfirm(normalizeDatasetName(localDatasetName));
      setLocalDatasetName('');
      setLocalError('');
    };

    const handleClose = () => {
      setLocalDatasetName('');
      setLocalError('');
      onClose();
    };

    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Start from predefined dataset
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Copy of: <strong>{dataset?.table_name}</strong>
          </Typography>
          
          {localTableLimitExceeded ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              You have reached the maximum of 10 datasets ({localUserTableCount}/10).
              Delete some datasets before creating new ones.
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              Creates a personal copy and opens Data Preparation (Target → Clean/Split → Transform → Train).
            </Alert>
          )}

          <TextField
            label="Your Dataset Name"
            value={localDatasetName}
            onChange={handleNameChange}
            fullWidth
            required
            error={!!localError}
            helperText={
              localError ||
              (normalizeDatasetName(localDatasetName)
                ? `Will be saved as: ${normalizeDatasetName(localDatasetName)}`
                : "Spaces become _, capitals become lowercase")
            }
            placeholder={`e.g., My ${dataset?.table_name || "dataset"}`}
            autoFocus
            disabled={localTableLimitExceeded}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleConfirm} 
            variant="contained"
            disabled={!!localError || !localDatasetName || localTableLimitExceeded || duplicating}
          >
            {duplicating ? <CircularProgress size={20} /> : 'Create & Continue'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

const DatasetInfoAdminModal = ({ open, onClose, dataset, infoText, onSave, saving }) => {
    const customColors = {
      primary: '#003d54',
      secondary: '#384850',
      accent: '#DE6B06'
    };

    // État local uniquement - pas de synchronisation avec le parent
    const [localInfoText, setLocalInfoText] = useState('');

    // Initialiser l'état local UNIQUEMENT quand le modal s'ouvre
    useEffect(() => {
      if (open) {
        setLocalInfoText(infoText || '');
      }
    }, [open, infoText]);

    const handleClose = () => {
      onClose();
    };

    const handleSave = () => {
      // Passer le texte local à la fonction de sauvegarde
      onSave(localInfoText);
    };

    return (
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ backgroundColor: customColors.primary, color: 'white' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FaInfoCircle />
              <Typography variant="h6">
                Dataset Information - {dataset?.table_name}
              </Typography>
            </Box>
            <IconButton onClick={handleClose} size="small" sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent dividers sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Add helpful information about this dataset for users. This will be displayed 
              in the visualization modal and can include:
            </Typography>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              <li>Dataset description and purpose</li>
              <li>Important features to consider</li>
              <li>Usage recommendations</li>
              <li>Known issues or limitations</li>
              <li>Tips for better results</li>
            </ul>
          </Alert>
          
          <TextField
            label="Dataset Information"
            multiline
            rows={12}
            value={localInfoText}
            onChange={(e) => {
              setLocalInfoText(e.target.value);
            }}
            fullWidth
            variant="outlined"
            placeholder="Enter helpful information about this dataset...
            
"
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: 'monospace',
                fontSize: '0.9rem'
              }
            }}
          />
        </DialogContent>
        
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button 
            onClick={handleClose} 
            variant="outlined"
            sx={{ 
              color: customColors.secondary,
              borderColor: customColors.secondary
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained"
            disabled={saving}
            sx={{
              backgroundColor: customColors.accent,
              '&:hover': {
                backgroundColor: '#c55a05'
              }
            }}
          >
            {saving ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Saving...
              </>
            ) : (
              'Save Information'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Modal pour la visualisation du dataset - CORRIGÉ avec toutes les modifications
  const DatasetVisualizationModal = ({ 
    open, 
    onClose, 
    dataset, 
    isAdmin,
    onAddDatasetInfo,
    activeTab // Ajouté pour savoir d'où vient le dataset
  }) => {
    const handleClose = () => {
      setDatasetInfo(null);
      setDatasetData(null);
      setVisualizationTab(0);
      onClose();
    };

    const detectDataTypes = (rows, columns) => {
      if (!rows || rows.length === 0 || !columns || columns.length === 0) {
        return {};
      }
      
      const types = {};
      const sampleRow = rows[0];
      
      columns.forEach((col, index) => {
        const fieldName = `col${index}`;
        const value = sampleRow?.[fieldName];
        
        if (value === null || value === undefined || value === '') {
          types[col] = 'empty';
        } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
          types[col] = 'number';
        } else {
          types[col] = 'string';
        }
      });
      
      return types;
    };

    const handleTabChange = (event, newValue) => {
      setVisualizationTab(newValue);
    };

    // Couleurs personnalisées
    const customColors = {
      primary: '#003d54',
      secondary: '#384850',
      accent: '#DE6B06'
    };

    return (
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="xl" 
        fullWidth
        PaperProps={{
          sx: {
            height: '85vh',
            maxHeight: '85vh'
          }
        }}
      >
        <DialogTitle sx={{ backgroundColor: customColors.primary, color: 'white' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FaTable />
              <Typography variant="h6">
                Dataset: {dataset?.table_name}
              </Typography>
            </Box>
            <IconButton onClick={handleClose} size="small" sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent dividers sx={{ p: 0, overflow: 'hidden' }}>
          {loadingDatasetInfo || loadingDatasetData ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '60vh' 
            }}>
              <CircularProgress size={60} />
              <Typography variant="body1" sx={{ mt: 2 }}>
                Loading dataset information...
              </Typography>
              <LinearProgress sx={{ width: '80%', mt: 2 }} />
            </Box>
          ) : datasetData ? (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Onglets - CHANGÉ: Dataset Information et Data Preview */}
              <Paper square sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={visualizationTab} 
                  onChange={handleTabChange}
                  variant="fullWidth"
                  sx={{ 
                    '& .MuiTab-root': { 
                      minHeight: 48,
                      fontSize: '0.9rem'
                    },
                    '& .Mui-selected': {
                      color: `${customColors.accent} !important`,
                    },
                    '& .MuiTabs-indicator': {
                      backgroundColor: customColors.accent,
                    }
                  }}
                >
                  <Tab 
                    icon={<FaInfoCircle />} 
                    iconPosition="start"
                    label="Dataset Information" 
                  />
                  <Tab 
                    icon={<TableChartIcon />} 
                    iconPosition="start"
                    label="Data Preview" 
                  />
                </Tabs>
              </Paper>

              {/* Contenu des onglets */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                {visualizationTab === 0 ? (
                  // Section Dataset Information (remplace Statistics)
                  <>
                    {/* Dataset Information Section */}
                    {datasetInfo?.has_dataset_info ? (
                      <Paper 
                        elevation={1} 
                        sx={{ 
                          p: 3, 
                          mb: 3, 
                          bgcolor: '#f8f9fa',
                          borderLeft: `4px solid #DE6B06`,
                          animation: 'fadeIn 0.3s ease'
                        }}
                        className="dataset-info-section"
                      >
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#DE6B06' }}>
                          <FaInfoCircle />
                          Dataset Information
                        </Typography>
                        <Box className="dataset-info-content">
                          <Typography 
                            variant="body2" 
                            className="dataset-info-text"
                            sx={{ 
                              whiteSpace: 'pre-line',
                              lineHeight: 1.6,
                              color: '#384850'
                            }}
                          >
                            {datasetInfo.dataset_info}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#6c757d', fontStyle: 'italic' }}>
                          Added by administrator
                        </Typography>
                        {isAdmin && (
                          <Box sx={{ mt: 2 }}>
                            <Button 
                              variant="outlined" 
                              size="small" 
                              startIcon={<FaInfoCircle />}
                              onClick={() => onAddDatasetInfo(dataset)}
                            >
                              Edit Information
                            </Button>
                          </Box>
                        )}
                      </Paper>
                    ) : (
                      <Paper 
                        elevation={0} 
                        sx={{ 
                          p: 3, 
                          mb: 3, 
                          border: '2px dashed #dee2e6',
                          textAlign: 'center'
                        }}
                        className="no-dataset-info"
                      >
                        <FaInfoCircle style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.5, color: '#003d54' }} />
                        <Typography variant="body2" color="textSecondary">
                          {isAdmin ? (
                            <>
                              No additional information available for this dataset.
                              <br />
                              <Button 
                                variant="outlined" 
                                size="small" 
                                startIcon={<FaInfoCircle />}
                                onClick={() => onAddDatasetInfo(dataset)}
                                sx={{ mt: 2 }}
                              >
                                Add Information (Admin)
                              </Button>
                            </>
                          ) : (
                            "No additional information available for this dataset."
                          )}
                        </Typography>
                      </Paper>
                    )}

                    {/* Dataset Overview - SIMPLIFIÉ */}
                    <Paper elevation={1} sx={{ p: 3, mb: 3, borderLeft: `4px solid ${customColors.primary}` }}>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: customColors.primary }}>
                        <FaDatabase />
                        Dataset Overview
                      </Typography>
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
                        gap: 2 
                      }}>
                        <Paper sx={{ p: 2, borderLeft: `4px solid ${customColors.primary}` }}>
                          <Typography variant="body2" color="textSecondary">Dataset Name</Typography>
                          <Typography variant="h6" fontWeight="bold" color={customColors.primary}>{dataset?.table_name}</Typography>
                        </Paper>
                        <Paper sx={{ p: 2, borderLeft: `4px solid ${customColors.secondary}` }}>
                          <Typography variant="body2" color="textSecondary">Rows</Typography>
                          <Typography variant="h6" fontWeight="bold" color={customColors.secondary}>
                            {datasetData.rows?.length || 0}
                          </Typography>
                        </Paper>
                        <Paper sx={{ p: 2, borderLeft: `4px solid ${customColors.accent}` }}>
                          <Typography variant="body2" color="textSecondary">Columns</Typography>
                          <Typography variant="h6" fontWeight="bold" color={customColors.accent}>
                            {datasetData.columns?.length || 0}
                          </Typography>
                        </Paper>
                        {datasetInfo?.target_column && (
                          <Paper sx={{ p: 2, borderLeft: `4px solid #28a745` }}>
                            <Typography variant="body2" color="textSecondary">Target Column</Typography>
                            <Typography variant="h6" fontWeight="bold" color="#28a745">
                              {datasetInfo.target_column}
                            </Typography>
                          </Paper>
                        )}
                      </Box>
                    </Paper>

                    {/* Columns Information - SIMPLIFIÉ */}
                    <Paper elevation={1} sx={{ p: 3, mb: 3, borderLeft: `4px solid ${customColors.secondary}` }}>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: customColors.secondary }}>
                        <FaChartLine />
                        Columns ({datasetData.columns?.length || 0})
                      </Typography>
                      
                      {datasetData.columns && datasetData.columns.length > 0 ? (
                        <TableContainer sx={{ maxHeight: 300, overflow: 'auto' }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper', color: customColors.primary }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper', color: customColors.primary }}>Column Name</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper', color: customColors.primary }}>Sample Value</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {datasetData.columns.map((col, index) => {
                                const sampleValue = datasetData.rows?.[0]?.[`col${index}`];
                                const isTarget = datasetInfo?.target_column === col;
                                
                                return (
                                  <TableRow 
                                    key={index}
                                    sx={{ 
                                      '&:hover': { bgcolor: '#f5f5f5' },
                                      bgcolor: isTarget ? '#fff9f5' : 'inherit'
                                    }}
                                  >
                                    <TableCell>
                                      <Chip 
                                        label={index + 1} 
                                        size="small" 
                                        variant="outlined"
                                        sx={{ 
                                          borderColor: customColors.secondary,
                                          color: customColors.secondary
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" fontWeight={isTarget ? 'bold' : 'normal'} color={isTarget ? customColors.accent : 'inherit'}>
                                          {col}
                                        </Typography>
                                        {isTarget && (
                                          <Chip 
                                            label="TARGET" 
                                            size="small" 
                                            sx={{ 
                                              backgroundColor: customColors.accent,
                                              color: 'white',
                                              fontSize: '0.7rem'
                                            }}
                                          />
                                        )}
                                      </Box>
                                    </TableCell>
                                    <TableCell>
                                      <Typography 
                                        variant="body2" 
                                        sx={{ 
                                          maxWidth: 200,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}
                                        title={String(sampleValue || 'N/A')}
                                      >
                                        {sampleValue !== undefined && sampleValue !== null 
                                          ? String(sampleValue).length > 30 
                                            ? String(sampleValue).substring(0, 30) + '...' 
                                            : String(sampleValue)
                                          : 'N/A'}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Alert severity="warning">
                          No columns found in this dataset.
                        </Alert>
                      )}
                    </Paper>
                  </>
                ) : (
                  // Section Data Preview
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="h6" gutterBottom color={customColors.primary}>
                      <FaTable style={{ marginRight: '8px' }} />
                      Data Preview
                    </Typography>
                    
                    {datasetData.rows && datasetData.rows.length > 0 ? (
                      <Box sx={{ flex: 1, minHeight: 0 }}>
                        <div style={{ height: 400, width: '100%' }}>
                          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                            <Table stickyHeader size="small">
                              <TableHead>
                                <TableRow>
                                  {datasetData.columns.map((col, index) => (
                                    <TableCell key={index} sx={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                                      {col}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {datasetData.rows.slice(0, 100).map((row, rowIndex) => (
                                  <TableRow key={rowIndex}>
                                    {datasetData.columns.map((col, colIndex) => (
                                      <TableCell key={colIndex}>
                                        {row[`col${colIndex}`] !== null && row[`col${colIndex}`] !== undefined 
                                          ? String(row[`col${colIndex}`])
                                          : ''}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </div>
                        <Typography variant="caption" sx={{ mt: 1, display: 'block', color: customColors.secondary }}>
                          Showing {Math.min(100, datasetData.rows.length)} of {datasetData.rows.length} rows
                          {datasetData.rows.length > 100 && ' (first 100 rows shown)'}
                        </Typography>
                      </Box>
                    ) : (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        No data available for preview.
                      </Alert>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          ) : (
            <Alert severity="error" sx={{ m: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FaExclamationTriangle />
                <Typography>
                  Could not load dataset information. Please try again.
                </Typography>
              </Box>
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button 
            onClick={handleClose} 
            variant="outlined"
            sx={{ 
              color: customColors.secondary,
              borderColor: customColors.secondary,
              '&:hover': {
                borderColor: customColors.accent,
                color: customColors.accent
              }
            }}
          >
            Close
          </Button>
          {dataset && datasetData && (
            <>
              {/* Pour les datasets pré-définis: Create Model button */}
              {activeTab === 'predefined' && (
                <Button 
                  variant="contained"
                  onClick={() => {
                    handleClose();
                    handlePredefinedCreateModel(dataset);
                  }}
                  sx={{
                    backgroundColor: customColors.accent,
                    '&:hover': {
                      backgroundColor: '#c55a05'
                    }
                  }}
                >
                  Start pipeline
                </Button>
              )}
              
              {/* Pour les datasets utilisateur: Continue Working ou Start from scratch */}
              {activeTab === 'databases' && (
                <>
                  <Button 
                    variant="contained" 
                    onClick={() => {
                      handleClose();
                      handleExplore(dataset.table_name);
                    }}
                    sx={{
                      backgroundColor: customColors.secondary,
                      '&:hover': {
                        backgroundColor: '#2a3942'
                      }
                    }}
                  >
                    Continue
                  </Button>
                  <Button 
                    variant="contained"
                    onClick={() => {
                      handleClose();
                      handleCreateModel(dataset.table_name);
                    }}
                    sx={{
                      backgroundColor: customColors.primary,
                      '&:hover': {
                        backgroundColor: '#002a3a'
                      }
                    }}
                  >
                    Start from scratch
                  </Button>
                </>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>
    );
  };

  // Fetch dataset info and data for visualization - FIXÉ
  const handleVisualizeDataset = async (dataset) => {
    if (!dataset || !dataset.table_name) {
      setError("No dataset selected");
      return;
    }

    setSelectedDataset(dataset);
    setVisualizationModalOpen(true);
    setLoadingDatasetInfo(true);
    setLoadingDatasetData(true);
    setDatasetInfo(null);
    setDatasetData(null);

    try {
      console.log(`Starting visualization for dataset: ${dataset.table_name}`);
      
      // 1. Récupérer les métadonnées (incluant dataset_info)
      const metadata = await fetchDatasetMetadata(dataset.table_name);
      console.log("Metadata fetched:", metadata);
      setDatasetInfo(metadata);
      
      // 2. Récupérer les données
      const data = await fetchDatasetData(dataset.table_name);
      setDatasetData(data);
      
      console.log('Visualization data loaded successfully');
      
    } catch (error) {
      console.error("Error in handleVisualizeDataset:", error);
      setError(`Failed to load dataset: ${error.message}`);
    } finally {
      setLoadingDatasetInfo(false);
      setLoadingDatasetData(false);
    }
  };

  // Fetch saved models
  const fetchSavedModels = async (userId) => {
    try {
      const response = await fetch(`${backendUrl}/api/get-saved-models?userId=${userId}`, {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) throw new Error('Failed to fetch models');
      
      const result = await response.json();
      
      if (result.status === "success") {
        setSavedModels(result.models);
      }
    } catch (err) {
      console.error("Error:", err);
      setError(err.message);
    } finally {
      setLoadingModels(false);
    }
  };

  // Fetch predefined datasets
  const fetchPredefinedDatasets = async () => {
    try {
      console.log("🔄 Fetching predefined datasets...");
      
      const response = await fetch(`${backendUrl}/api/predefined-datasets`, {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error('Failed to fetch predefined datasets');
      }
      
      const result = await response.json();
      setPredefinedDatasets(result.datasets || []);
      
    } catch (err) {
      console.error("❌ Error fetching predefined datasets:", err);
      setPredefinedDatasets([]);
    } finally {
      setLoadingPredefined(false);
    }
  };

  // Handle create model from predefined dataset
const handleCreateFromPredefined = async (newDatasetName) => {
  try {
    setDuplicating(true);
    
    // Spaces → _, uppercase → lowercase (same as Target & Type / upload flow)
    const cleanedDatasetName = normalizeDatasetName(newDatasetName);
    const nameErr = validateDatasetNameInput(newDatasetName);
    if (nameErr) {
      throw new Error(nameErr);
    }
    
    const duplicateResponse = await fetch(`${backendUrl}/api/duplicate-predefined-dataset`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        original_table_name: selectedPredefinedDataset.table_name,
        new_dataset_name: cleanedDatasetName
      })
    });

    if (!duplicateResponse.ok) {
      const errorData = await duplicateResponse.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to duplicate dataset');
    }

    const duplicateResult = await duplicateResponse.json();
    
    await checkDatasetLimit();
    
    const dataResponse = await fetch(
      `${backendUrl}/api/get-database-data?dbName=${cleanedDatasetName}`,
      {
        credentials: 'include'
      }
    );

    if (!dataResponse.ok) {
      throw new Error('Failed to fetch duplicated dataset data');
    }

    const datasetData = await dataResponse.json();

    navigate('/data_preparation', {
      state: {
        initialTab: 0,
        bdName: cleanedDatasetName,
        isFromPredefined: true,
        originalDataset: selectedPredefinedDataset.table_name,
        duplicated: true
      }
    });

  } catch (error) {
    console.error('Error creating from predefined dataset:', error);
    setError(error.message);
    alert(`Error: ${error.message}`);
  } finally {
    setDuplicating(false);
    setCreateModalOpen(false);
    setSelectedPredefinedDataset(null);
  }
};

  // Handle predefined dataset click
  const handlePredefinedCreateModel = (dataset) => {
    setSelectedPredefinedDataset(dataset);
    setCreateModalOpen(true);
  };

  const handleDeleteModel = (modelId, modelPath, e, modelName) => {
    e.stopPropagation();
    setDeleteModelDialog({ id: modelId, path: modelPath, name: modelName || "this model" });
  };

  const confirmDeleteModel = async () => {
    if (!deleteModelDialog) return;
    const { id: modelId, path: modelPath, name } = deleteModelDialog;
    setDeletingResource(true);
    try {
      const response = await fetch(`${backendUrl}/api/delete-model`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, modelPath }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail?.message ||
            errorData.detail ||
            `Failed to delete model (status ${response.status})`
        );
      }
      setSavedModels((prev) => prev.filter((m) => m.id !== modelId));
      setCompareSelection((prev) => prev.filter((x) => x !== modelId));
      setDeleteModelDialog(null);
      showToast(`Model “${name}” deleted`, "success");
    } catch (err) {
      console.error("Delete model error:", err);
      showToast(err.message || "Deletion failed", "error");
    } finally {
      setDeletingResource(false);
    }
  };

  const toggleCompareModel = (model, e) => {
    e?.stopPropagation?.();
    setCompareError("");
    setCompareSelection((prev) => {
      if (prev.includes(model.id)) {
        return prev.filter((id) => id !== model.id);
      }
      if (prev.length >= MAX_COMPARE_MODELS) {
        setCompareError(`You can select at most ${MAX_COMPARE_MODELS} models for comparison.`);
        return prev;
      }
      if (prev.length >= 1) {
        const selected = prev
          .map((id) => savedModels.find((m) => m.id === id))
          .filter(Boolean);
        const check = validateModelGroup([...selected, model]);
        if (!check.ok) {
          setCompareError(check.reason);
          return prev;
        }
      }
      return [...prev, model.id];
    });
  };

  const openCompareDialog = () => {
    setCompareError("");
    if (compareSelection.length < 2 || compareSelection.length > MAX_COMPARE_MODELS) {
      setCompareError(`Select between 2 and ${MAX_COMPARE_MODELS} models to compare.`);
      return;
    }
    const models = compareSelection
      .map((id) => savedModels.find((m) => m.id === id))
      .filter(Boolean);
    const check = validateModelGroup(models);
    if (!check.ok) {
      setCompareError(check.reason);
      return;
    }
    setCompareOpen(true);
  };

  // Handle model usage
  const handleUseModel = (model) => {
    navigate('/use-model', {
      state: {
        id: model.id,
        modelId: model.id,
        modelName: model.model_name,
        dbName: model.db_name,
        dbColumns: model.db_columns || [],
        r2Score: model.r2_score,
        accuracyScore: model.accuracy_score,
        modelType: model.model_type,
        algorithm: model.algorithm,
        modelPath: model.model_path
      }
    });
  };

  const handleDownloadModel = async (model, e) => {
    e?.stopPropagation?.();
    if (!model?.id) return;
    try {
      const res = await fetch(
        `${backendUrl}/api/download-model?modelId=${model.id}`,
        { method: "GET", credentials: "include" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      let filename = `${model.model_name || "model"}.joblib`;
      const m = /filename="?([^"]+)"?/i.exec(cd);
      if (m?.[1]) {
        filename = m[1];
      } else if ((model.framework || "").toLowerCase() === "pytorch" ||
                 (model.model_path || "").endsWith(".pt")) {
        filename = `${model.model_name || "model"}.pt`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${filename}`, "success");
    } catch (err) {
      showToast(err.message || "Download failed", "error");
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/users/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        setUser(null);
        setDatabases([]);
        setError(null);
        window.location.href = "/login";
      } else {
        setError("Error during logout");
      }
    } catch (err) {
      setError("Error during logout");
      console.error("Logout error:", err);
    }
  };

  // Handle create model from user dataset
  const handleCreateModel = async (dbName) => {
  try {
    if (!dbName || typeof dbName !== 'string') {
      throw new Error('Database name is required');
    }

    // Existing datasets already stored as normalized lowercase names
    if (!/^[a-z_][a-z0-9_]{0,49}$/.test(dbName)) {
      throw new Error('Invalid database name.');
    }

      // 1. APPEL DIRECT à check-create-backup POUR RÉINITIALISER
      const backupResponse = await fetch(`${backendUrl}/api/check-create-backup`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bdName: dbName })
      });

      if (!backupResponse.ok) {
        let detail = "Failed to reset dataset";
        try {
          const errBody = await backupResponse.json();
          if (typeof errBody?.detail === "string") detail = errBody.detail;
          else if (errBody?.detail?.message) detail = errBody.detail.message;
        } catch (_) { /* keep default */ }
        throw new Error(detail);
      }

      const backupData = await backupResponse.json();
      console.log("Backup action:", backupData.action);

      // 3. Naviguer vers data_preparation (Target & Type)
      navigate('/data_preparation', {
        state: {
          initialTab: 0,
          bdName: dbName,
          fromDashboard: true
        }
      });

    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      setError(errorMessage);
      alert(`Operation failed: ${errorMessage}`);
    }
  };

  const handleDeleteDatabase = (dbName, e) => {
    e.stopPropagation();
    setDeleteDatasetDialog(dbName);
  };

  const confirmDeleteDatabase = async () => {
    const dbName = deleteDatasetDialog;
    if (!dbName) return;
    setDeletingResource(true);
    try {
      const response = await fetch(`${backendUrl}/api/delete-database-with-related`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbName }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail?.message ||
            errorData.detail ||
            `Failed to delete database (status ${response.status})`
        );
      }
      setDatabases((prevDbs) =>
        prevDbs.filter(
          (db) => !db.table_name.startsWith(dbName) && db.table_name !== dbName
        )
      );
      await checkDatasetLimit();
      setDeleteDatasetDialog(null);
      showToast(`Dataset “${dbName}” deleted`, "success");
    } catch (err) {
      console.error("Delete error:", err);
      showToast(err.message || "Deletion failed", "error");
    } finally {
      setDeletingResource(false);
    }
  };

  // Handle explore dataset
  const handleExplore = async (dbName) => {
    try {
      const checkNumerizedResponse = await fetch(`${backendUrl}/api/check-table-exists?tableName=${dbName}_numerized`, {
        credentials: 'include'
      });

      let tableToCheck = dbName;
      if (checkNumerizedResponse.ok) {
        const { exists } = await checkNumerizedResponse.json();
        if (exists) {
          tableToCheck = `${dbName}_numerized`;
        }
      }

      const metadataResponse = await fetch(`${backendUrl}/api/get-database-metadata?dbName=${tableToCheck}`, {
        credentials: 'include'
      });

      if (!metadataResponse.ok) {
        throw new Error('Failed to fetch database metadata');
      }

      const { stage } = await metadataResponse.json();

      // Current app: single Data Preparation hub (tabs). Old solo routes removed.
      const goPrep = (initialTab) => {
        navigate('/data_preparation', {
          state: { bdName: dbName, initialTab },
        });
      };

      switch (stage) {
        case 'target_selection':
          goPrep(0);
          break;
        case 'group_optimizer':
          goPrep(1);
          break;
        case 'data_cleaning':
        case 'outlier_manager':
          goPrep(2);
          break;
        case 'preprocessing5':
        case 'data_transformation':
        case 'outlier_manager2':
          goPrep(3);
          break;
        case 'creat_Model':
        case 'creat_model':
          goPrep(4);
          break;
        default:
          goPrep(0);
          break;
      }

    } catch (error) {
      console.error('Navigation error:', error);
      setError(error.message);
      alert(`Error: ${error.message}`);
    }
  };

  // Fetch user data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userResponse = await fetch(`${backendUrl}/api/users/me`, {
          method: "GET",
          credentials: "include",
        });

        if (userResponse.status === 403) {
          navigate("/login");
          return;
        }

        if (!userResponse.ok) {
          throw new Error(`Failed to fetch user: ${userResponse.status}`);
        }

        const userData = await userResponse.json();
        
        if (!userData.id) {
          throw new Error("User ID not found in response");
        }

        setUser(userData);
        
        await Promise.all([
          (async () => {
            const dbResponse = await fetch(`${backendUrl}/api/databases?userId=${userData.id}`, {
              method: "GET",
              credentials: "include",
            });

            if (!dbResponse.ok) {
              const errorData = await dbResponse.json().catch(() => ({}));
              throw new Error(
                `Database fetch failed: ${dbResponse.status} - ${errorData.message || 'Unknown error'}`
              );
            }

            const dbData = await dbResponse.json();
            const filteredDbs = dbData
              .filter(db => 
                !db.table_name.includes('_reset') &&
                !db.table_name.includes('_numerized') &&  
                !db.table_name.includes('_backup')
              )
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setDatabases(filteredDbs);
            setLoadingDatabases(false);
          })(),
          
          fetchSavedModels(userData.id),
          fetchPredefinedDatasets(),
          checkDatasetLimit(),
          checkIfAdmin()
        ]);

      } catch (err) {
        console.error("Error:", err);
        setError(err.message);
        if (err.message.includes("User ID not found")) {
          navigate("/login");
        }
      }
    };

    fetchData();
  }, [navigate, refreshTrigger]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        {/* Header content */}
      </header>

      <main className="dashboard-content">
        {/* Debug badge for admin */}
        {isAdmin && (
          <div style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: 'green',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 9999,
            fontWeight: 'bold'
          }}>
            ADMIN MODE
          </div>
        )}

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Dashboard Description */}
        <div className="dashboard-description">
          <div className="description-content">
            <h2>Dashboard</h2>
            <p className="description-text">{dashboardDescription}</p>
          </div>
        </div>

        {user ? (
          <div className="dashboard-sections">
            <div className="section-tabs">
              <button 
                className={`tab-btn ${activeTab === 'databases' ? 'active' : ''}`}
                onClick={() => setActiveTab('databases')}
                title={tabDescriptions.databases.description}
              >
                <FaDatabase /> My Datasets ({userTableCount}/10)
              </button>
              <button 
                className={`tab-btn ${activeTab === 'predefined' ? 'active' : ''}`}
                onClick={() => setActiveTab('predefined')}
                title={tabDescriptions.predefined.description}
              >
                <FaBox /> Predefined Datasets
              </button>
              <button 
                className={`tab-btn ${activeTab === 'models' ? 'active' : ''}`}
                onClick={() => setActiveTab('models')}
                title={tabDescriptions.models.description}
              >
                <FaRobot /> My Models ({savedModels.length})
              </button>
            </div>

            {/* Tab Description */}
            <div className="tab-description">
              <h3>{tabDescriptions[activeTab].title}</h3>
              <p>{tabDescriptions[activeTab].description}</p>
              <p className="tab-action">{tabDescriptions[activeTab].action}</p>
            </div>

            {/* MY DATASETS TAB - MODIFIÉ: Pas de bouton Visualize */}
            {activeTab === 'databases' && (
              <section className="databases-section">
                <div className="section-header">
                  <div className="section-stats">
                    <span className="stat-item">
                      <FaDatabase /> Total: {databases.length}
                    </span>
                    <span className="stat-item">
                      <FaHistory /> Limit: {userTableCount}/10
                    </span>
                  </div>
                  <button 
                    className="upload-btn"
                    onClick={() => navigate("/upload")}
                    disabled={tableLimitExceeded}
                    title={tableLimitExceeded ? "Dataset limit reached. Delete some datasets first." : "Upload a new dataset"}
                  >
                    <FaPlus /> Upload New Dataset
                  </button>
                </div>

                {tableLimitExceeded && (
                  <Alert severity="warning" className="limit-alert">
                    <strong>Dataset Limit Reached:</strong> You have reached the maximum limit of 10 datasets ({userTableCount}/10). 
                    Please delete some datasets before uploading new ones.
                  </Alert>
                )}
                
                {loadingDatabases ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading your datasets...</p>
                  </div>
                ) : databases.length > 0 ? (
                  <>
                    <div className="dataset-actions-info">
                      <p>For each dataset you can:</p>
                      <ul>
                        <li><strong>Start from scratch:</strong> reset working data and open Data Preparation</li>
                        <li><strong>Continue:</strong> resume where you left off</li>
                        <li><strong>Delete:</strong> remove the dataset</li>
                        <li><em>Predefined Datasets tab: browse ready-made sets and copy one to start</em></li>
                      </ul>
                    </div>
                    
                    <div className="cards-grid">
                      {databases.map((db) => (
                        <div key={db.table_name} className="card database-card">
                          <div className="card-header">
                            <h3 className="card-title">{db.table_name}</h3>
                            {isAdmin && (
                              <button 
                                className="icon-btn info"
                                onClick={(e) => handleAddDatasetInfo(db, e)}
                                title="Add/Edit dataset information (Admin only)"
                              >
                                <FaInfoCircle />
                              </button>
                            )}
                            <button 
                              className="icon-btn danger"
                              onClick={(e) => handleDeleteDatabase(db.table_name, e)}
                              title="Delete this dataset and all associated files"
                            >
                              <FaTimes />
                            </button>
                          </div>
                          
                          <div className="card-content">
                            <div className="database-meta">
                              <span className="meta-item">
                                <strong>Created:</strong> {new Date(db.created_at).toLocaleDateString()}
                              </span>
                          
                            </div>
                            
                            <div className="dataset-actions-description">
                              <p className="action-desc">
                                <strong>Start from scratch:</strong> reset working data and open Data Preparation from the beginning.
                              </p>
                              <p className="action-desc">
                                <strong>Continue:</strong> open Data Preparation at your last stage.
                              </p>
                            </div>
                            
                            <div className="card-actions">
                              <button 
                                className="btn primary"
                                onClick={() => handleCreateModel(db.table_name)}
                                title="Reset dataset and open Data Preparation"
                              >
                                Start from scratch
                              </button>
                              <button 
                                className="btn secondary"
                                onClick={() => handleExplore(db.table_name)}
                                title="Continue Data Preparation"
                              >
                                Continue
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <FaDatabase className="empty-icon" />
                    <h3>{tabDescriptions.databases.emptyDescription}</h3>
                    <p className="empty-instruction">
                      To begin, upload your data (CSV/Excel format) or use a predefined cybersecurity dataset.
                    </p>
                    <div className="empty-state-actions">
                      <button 
                        className="btn primary"
                        onClick={() => navigate("/upload")}
                        disabled={tableLimitExceeded}
                      >
                        <FaUpload /> Upload Dataset
                      </button>
                      <button 
                        className="btn accent"
                        onClick={() => setActiveTab('predefined')}
                      >
                        <FaBox /> Browse Predefined Datasets
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* PREDEFINED DATASETS TAB - MODIFIÉ: Avec bouton Visualize */}
            {activeTab === 'predefined' && (
              <section className="predefined-section">
                <div className="section-header">
                  <div className="section-stats">
                    <span className="stat-item">
                      <FaBox /> Available: {predefinedDatasets.length}
                    </span>
                  </div>
                </div>
                
                {tableLimitExceeded && (
                  <Alert severity="warning" className="limit-alert">
                    <strong>Dataset Limit Reached:</strong> You have reached the maximum limit of 10 datasets. 
                    Please delete some datasets before creating new ones from predefined datasets.
                  </Alert>
                )}
                
                {loadingPredefined ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading predefined datasets...</p>
                  </div>
                ) : predefinedDatasets.length > 0 ? (
                  <>
                    <div className="predefined-info">
                      <p><strong>Predefined datasets</strong></p>
                      <ul>
                        <li>Curated cybersecurity tabular sets</li>
                        <li><strong>Visualize</strong>: preview and details</li>
                        <li><strong>Start pipeline</strong>: copy to your account and open Data Preparation</li>
                        {isAdmin && (
                          <li><strong>Admin:</strong> edit the dataset notes users see</li>
                        )}
                      </ul>
                    </div>
                    
                    <div className="cards-grid">
                      {predefinedDatasets.map((dataset) => (
                        <div key={dataset.id} className="card predefined-card">
                          <div className="card-header">
                            <h3 className="card-title">
                              {dataset.table_name}
                            </h3>
                            <div className="card-header-right">
                              <span className="dataset-type">Predefined</span>
                              {isAdmin && (
                                <button 
                                  className="icon-btn info"
                                  onClick={(e) => handleAddDatasetInfo(dataset, e)}
                                  title="Add/Edit dataset information (Admin only)"
                                >
                                  <FaInfoCircle />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <div className="card-content">
                            <div className="dataset-stats">
                              <div className="stats-grid">
                                <div className="stat-item">
                                  <div className="stat-label">Rows</div>
                                  <div className="stat-value">
                                    <strong>{dataset.row_count || 0}</strong>
                                  </div>
                                </div>
                                <div className="stat-item">
                                  <div className="stat-label">Features</div>
                                  <div className="stat-value">
                                    <strong>{dataset.column_count || dataset.columns?.length || 0}</strong>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {dataset.description && (
                              <div className="dataset-description">
                                <p>{dataset.description}</p>
                              </div>
                            )}
                            
                            <div className="action-description">
                              <p className="action-text">
                                <strong>Visualize:</strong> preview rows and column info.
                              </p>
                              <p className="action-text">
                                <strong>Start pipeline:</strong> copy the dataset and open Data Preparation.
                              </p>
                              {isAdmin && (
                                <p className="action-text admin-info">
                                  <strong>Admin:</strong> use the info control to edit notes for users.
                                </p>
                              )}
                            </div>
                            
                            <div className="card-actions">
                              <button 
                                className="btn accent"
                                onClick={() => handleVisualizeDataset(dataset)}
                                title="View dataset details"
                              >
                                Visualize
                              </button>
                              <button 
                                className="btn primary"
                                onClick={() => handlePredefinedCreateModel(dataset)}
                                disabled={tableLimitExceeded}
                                title={tableLimitExceeded ? "Dataset limit reached" : "Copy dataset and open Data Preparation"}
                              >
                                Start pipeline
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <FaBox className="empty-icon" />
                    <h3>{tabDescriptions.predefined.emptyDescription}</h3>
                    <p className="empty-instruction">
                      Predefined datasets will be added by administrators.
                    </p>
                    <button 
                      className="btn primary"
                      onClick={() => setActiveTab('databases')}
                    >
                      Go to My Datasets
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* MY MODELS TAB */}
            {activeTab === 'models' && (
              <section className="models-section">
                <div className="section-header">
                  <div className="section-stats">
                    <span className="stat-item">
                      <FaRobot /> Total Models: {savedModels.length}
                    </span>
                  </div>
                </div>
                
                {loadingModels ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading your models...</p>
                  </div>
                ) : savedModels.length > 0 ? (
                  <>
                    <div className="models-info">
                      <p><strong>What you can do with saved models:</strong></p>
                      <ul>
                        <li><strong>Use Model:</strong> Make predictions on new data</li>
                        <li><strong>Download:</strong> Save the trained file (.joblib or .pt)</li>
                        <li><strong>Compare:</strong> Select 2–5 comparable models (same dataset + same problem type)</li>
                        <li><strong>Delete:</strong> Remove models you no longer need</li>
                      </ul>
                    </div>

                    <div className="compare-toolbar">
                      <span className="compare-toolbar-count">
                        {compareSelection.length}/{MAX_COMPARE_MODELS} selected for comparison
                        {compareSelection.length > 0 && compareSelection.length < 2
                          ? " · pick at least 2"
                          : ""}
                      </span>
                      <button
                        type="button"
                        className={`btn primary compare-btn ${compareSelection.length >= 2 ? "ready" : ""}`}
                        disabled={compareSelection.length < 2}
                        onClick={openCompareDialog}
                        title={
                          compareSelection.length >= 2
                            ? "Open comparison charts"
                            : "Select 2 to 5 comparable models first"
                        }
                      >
                        <FaBalanceScale /> Compare models
                      </button>
                      {compareSelection.length > 0 && (
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => {
                            setCompareSelection([]);
                            setCompareError("");
                          }}
                        >
                          Clear selection
                        </button>
                      )}
                    </div>
                    {compareError && (
                      <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setCompareError("")}>
                        {compareError}
                      </Alert>
                    )}
                    
                    <div className="cards-grid">
                      {savedModels.map((model) => {
                        const selected = compareSelection.includes(model.id);
                        const family = getComparableFamily(model);
                        const selectionFull = compareSelection.length >= MAX_COMPARE_MODELS && !selected;
                        return (
                        <div
                          key={model.id}
                          className={`card model-card ${selected ? "model-card--selected" : ""}`}
                        >
                          <div className="card-header">
                            <label className="model-compare-check" title={`Select for comparison (max ${MAX_COMPARE_MODELS})`}>
                              <Checkbox
                                size="small"
                                checked={selected}
                                disabled={selectionFull}
                                onChange={(e) => toggleCompareModel(model, e)}
                                onClick={(e) => e.stopPropagation()}
                                sx={{
                                  color: "#384850",
                                  "&.Mui-checked": { color: "#DE6B06" },
                                }}
                              />
                              <span className="model-compare-check-label">Compare</span>
                            </label>
                            <h3 className="card-title">{model.model_name || 'Unnamed model'}</h3>
                            <div className="card-header-actions">
                              <div className="score-badge">
                                {model.r2_score !== null && model.r2_score !== undefined && model.r2_score !== '' ? (
                                  <>R²: {typeof model.r2_score === 'number' ? model.r2_score.toFixed(3) : model.r2_score}</>
                                ) : model.accuracy_score !== null && model.accuracy_score !== undefined && model.accuracy_score !== '' ? (
                                  <>Accuracy: {typeof model.accuracy_score === 'number' ? (model.accuracy_score * 100).toFixed(1) + '%' : model.accuracy_score}</>
                                ) : model.silhouette_score != null && model.silhouette_score !== '' ? (
                                  <>Silhouette: {Number(model.silhouette_score).toFixed(3)}</>
                                ) : (
                                  <>Unsupervised</>
                                )}
                              </div>
                              <button 
                                className="icon-btn danger"
                                onClick={(e) => handleDeleteModel(model.id, model.model_path, e, model.model_name)}
                                title="Delete this model permanently"
                              >
                                <FaTimes />
                              </button>
                            </div>
                          </div>
                          
                          <div className="card-content">
                            <div className="model-meta">
                              <div className="meta-item">
                                <strong>Dataset:</strong> {model.db_name || 'No dataset'}
                              </div>
                              <div className="meta-item">
                                <strong>Features:</strong> {model.db_columns?.length || 0} columns
                              </div>
                              <div className="meta-item">
                                <strong>Algorithm:</strong> {formatAlgorithmLabel(model)}
                              </div>
                              <div className="meta-item">
                                <strong>Type:</strong> {model.model_type || 'Unknown'}
                                <span className="model-family-chip"> · {family}</span>
                              </div>
                              <div className="meta-item">
                                <strong>Created:</strong> {model.timestamp ? new Date(model.timestamp).toLocaleString() : 'Unknown date'}
                              </div>
                            </div>
                            
                            <div className="action-description">
                              <p className="action-text">
                                <FaEye /> <strong>Use Model:</strong> Load this model to make predictions on new data
                              </p>
                            </div>
                            
                            <div className="model-card-actions">
                              <button 
                                className="btn primary"
                                onClick={() => handleUseModel(model)}
                                title="Use this model for predictions"
                              >
                                <FaEye /> Use Model
                              </button>
                              <button
                                type="button"
                                className="btn secondary"
                                onClick={(e) => handleDownloadModel(model, e)}
                                title={
                                  (model.framework || "").toLowerCase() === "pytorch" ||
                                  (model.model_path || "").endsWith(".pt")
                                    ? "Download .pt model file"
                                    : "Download .joblib model file"
                                }
                              >
                                <FaDownload /> Download
                              </button>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <FaRobot className="empty-icon" />
                    <h3>{tabDescriptions.models.emptyDescription}</h3>
                    <p className="empty-instruction">
                      To create your first model:
                    </p>
                    <ol className="creation-steps">
                      <li>Open a dataset (upload or predefined copy)</li>
                      <li>Data Preparation: Target → Clean/Split → Transform (Outliers optional)</li>
                      <li>Train Model, then save</li>
                      <li>The model appears in this tab</li>
                    </ol>
                    <button 
                      className="btn primary"
                      onClick={() => setActiveTab('databases')}
                    >
                      Go to Datasets
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        ) : (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your dashboard...</p>
          </div>
        )}

        {/* CREATE DATASET NAME MODAL */}
        <CreateDatasetNameModal
          open={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false);
            setSelectedPredefinedDataset(null);
          }}
          dataset={selectedPredefinedDataset}
          onConfirm={handleCreateFromPredefined}
        />

        {/* DATASET VISUALIZATION MODAL - MODIFIÉ: Ajout de activeTab */}
        <DatasetVisualizationModal
          open={visualizationModalOpen}
          onClose={() => {
            setVisualizationModalOpen(false);
            setSelectedDataset(null);
          }}
          dataset={selectedDataset}
          isAdmin={isAdmin}
          onAddDatasetInfo={handleAddInfoFromModal}
          activeTab={activeTab} // Passer activeTab pour savoir quel bouton afficher
        />

       <DatasetInfoAdminModal
  open={datasetInfoModalOpen}
  onClose={() => {
    setDatasetInfoModalOpen(false);
    setSelectedDatasetForInfo(null);
    setDatasetInfoText("");
  }}
  dataset={selectedDatasetForInfo}
  infoText={datasetInfoText}
  onInfoChange={(text) => {
    // FIX: Mettre à jour directement sans causer de re-render
    setDatasetInfoText(text);
  }}
  onSave={saveDatasetInfo}
  saving={savingDatasetInfo}
/>

        {/* Delete dataset: app dialog (no browser confirm) */}
        <Dialog
          open={!!deleteDatasetDialog}
          onClose={() => !deletingResource && setDeleteDatasetDialog(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Delete dataset?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Permanently delete <strong>{deleteDatasetDialog}</strong> and its working
              copies (backup / reset). This cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDeleteDatasetDialog(null)}
              disabled={deletingResource}
            >
              Cancel
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={confirmDeleteDatabase}
              disabled={deletingResource}
            >
              {deletingResource ? "Deleting…" : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete model */}
        <Dialog
          open={!!deleteModelDialog}
          onClose={() => !deletingResource && setDeleteModelDialog(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Delete model?</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              Permanently delete <strong>{deleteModelDialog?.name}</strong>? This cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDeleteModelDialog(null)}
              disabled={deletingResource}
            >
              Cancel
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={confirmDeleteModel}
              disabled={deletingResource}
            >
              {deletingResource ? "Deleting…" : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Multi-model comparison (2–5) with charts */}
        {(() => {
          const models = compareSelection
            .map((id) => savedModels.find((m) => m.id === id))
            .filter(Boolean);
          const check = validateModelGroup(models);
          const family = check.ok ? check.family : null;
          const verdict = check.ok ? buildComparisonVerdict(models, family) : null;
          const overlap = check.ok ? pairwiseFeatureOverlap(models) : 0;
          const metricLabel =
            family === "classification" ? "Accuracy (%)" :
            family === "regression" ? "R²" :
            family === "clustering" ? "Silhouette" : "Metric";

          const chartData = check.ok
            ? models.map((m, i) => {
                const raw = primaryMetric(m, family);
                const display =
                  family === "classification" ? Number((raw * 100).toFixed(2)) : Number(raw.toFixed(4));
                return {
                  name: m.model_name?.length > 18
                    ? `${m.model_name.slice(0, 16)}…`
                    : m.model_name,
                  fullName: m.model_name,
                  value: display,
                  features: m.db_columns?.length || 0,
                  inertia: m.inertia != null ? Number(Number(m.inertia).toFixed(2)) : null,
                  color: COMPARE_BAR_COLORS[i % COMPARE_BAR_COLORS.length],
                  isWinner: verdict?.winner?.id === m.id,
                  id: m.id,
                };
              })
            : [];

          const featureChartData = check.ok
            ? models.map((m, i) => ({
                name: m.model_name?.length > 18
                  ? `${m.model_name.slice(0, 16)}…`
                  : m.model_name,
                features: m.db_columns?.length || 0,
                color: COMPARE_BAR_COLORS[i % COMPARE_BAR_COLORS.length],
              }))
            : [];

          return (
            <Dialog
              open={compareOpen}
              onClose={() => setCompareOpen(false)}
              maxWidth="lg"
              fullWidth
              className="model-compare-dialog"
            >
              <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FaBalanceScale style={{ color: "#DE6B06" }} />
                Model comparison ({models.length})
              </DialogTitle>
              <DialogContent dividers>
                {check.ok && verdict ? (
                  <>
                    <Alert
                      severity={verdict.winner ? "success" : "info"}
                      icon={verdict.winner ? <FaCheck /> : <FaInfoCircle />}
                      sx={{ mb: 2 }}
                    >
                      {verdict.text}
                    </Alert>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                      Avg. feature-set overlap: {(overlap * 100).toFixed(0)}%
                      {overlap < 0.5
                        ? " low overlap: interpret metric gaps with caution."
                        : " similar feature spaces."}
                      {" "}Same evaluation protocol is assumed across models.
                    </Typography>

                    <Typography variant="subtitle2" sx={{ mb: 1, color: "#384850", fontWeight: 700 }}>
                      Primary metric: {metricLabel}
                    </Typography>
                    <div className="cmp-chart-wrap">
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 48 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eceff1" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <RechartsTooltip
                            formatter={(v, _n, props) => [
                              family === "classification" ? `${v}%` : v,
                              props?.payload?.fullName || metricLabel,
                            ]}
                          />
                          <Legend />
                          <Bar dataKey="value" name={metricLabel} radius={[6, 6, 0, 0]}>
                            {chartData.map((entry) => (
                              <Cell
                                key={entry.id}
                                fill={entry.color}
                                stroke={entry.isWinner ? "#DE6B06" : "transparent"}
                                strokeWidth={entry.isWinner ? 3 : 0}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: "#384850", fontWeight: 700 }}>
                      Feature count
                    </Typography>
                    <div className="cmp-chart-wrap">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={featureChartData} margin={{ top: 8, right: 16, left: 8, bottom: 48 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eceff1" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <RechartsTooltip />
                          <Bar dataKey="features" name="Features" radius={[6, 6, 0, 0]}>
                            {featureChartData.map((entry, i) => (
                              <Cell key={`f-${i}`} fill={entry.color} fillOpacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {family === "clustering" && chartData.some((d) => d.inertia != null) && (
                      <>
                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: "#384850", fontWeight: 700 }}>
                          Inertia (lower is better)
                        </Typography>
                        <div className="cmp-chart-wrap">
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                              data={chartData.filter((d) => d.inertia != null)}
                              margin={{ top: 8, right: 16, left: 8, bottom: 48 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#eceff1" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <RechartsTooltip />
                              <Bar dataKey="inertia" name="Inertia" fill="#607d8b" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}

                    <div className="cmp-rank-list">
                      {(verdict.ranked || models).map((m, idx) => {
                        const isWinner = verdict.winner?.id === m.id;
                        return (
                          <div key={m.id} className={`cmp-rank-item ${isWinner ? "cmp-rank-item--winner" : ""}`}>
                            <span className="cmp-rank-pos">#{idx + 1}</span>
                            <div className="cmp-rank-body">
                              <strong>{m.model_name}</strong>
                              <span className="cmp-algo-line">
                                <em>{formatAlgorithmLabel(m)}</em>
                              </span>
                              <span>
                                {formatPrimaryMetric(family, primaryMetric(m, family))}
                                {" · "}
                                {m.framework || "N/A"}
                                {" · "}
                                {m.db_columns?.length || 0} features
                              </span>
                            </div>
                            {isWinner && <span className="cmp-winner-badge"><FaCheck /> Best</span>}
                            <button
                              type="button"
                              className="btn primary"
                              onClick={() => {
                                setCompareOpen(false);
                                handleUseModel(m);
                              }}
                            >
                              <FaEye /> Use
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Model</TableCell>
                            <TableCell>Algorithm</TableCell>
                            <TableCell>{metricLabel}</TableCell>
                            <TableCell>Features</TableCell>
                            <TableCell>Framework</TableCell>
                            <TableCell>Created</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(verdict.ranked || models).map((m) => (
                            <TableRow key={m.id} selected={verdict.winner?.id === m.id}>
                              <TableCell>{m.model_name}</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={formatAlgorithmLabel(m)}
                                  sx={{
                                    backgroundColor: "rgba(222,107,6,0.12)",
                                    color: "#DE6B06",
                                    fontWeight: 600,
                                  }}
                                />
                              </TableCell>
                              <TableCell>{formatPrimaryMetric(family, primaryMetric(m, family))}</TableCell>
                              <TableCell>{m.db_columns?.length || 0}</TableCell>
                              <TableCell>{m.framework || "N/A"}</TableCell>
                              <TableCell>
                                {m.timestamp ? new Date(m.timestamp).toLocaleString() : "N/A"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                ) : (
                  <Alert severity="error">{compareError || "Cannot compare these models."}</Alert>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setCompareOpen(false)}>Close</Button>
              </DialogActions>
            </Dialog>
          );
        })()}

        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={toast.severity}
            onClose={() => setToast((t) => ({ ...t, open: false }))}
            variant="filled"
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </main>
    </div>
  );
}

export default Dashboard;