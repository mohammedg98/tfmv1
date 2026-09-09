import React, { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { DataGrid } from "@mui/x-data-grid";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Box,
  TextField,
  Typography,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  Chip,
  LinearProgress,
  Paper,
  Grid,
  Divider,
} from "@mui/material";
import Plot from "react-plotly.js";
import { ArrowBackIos, ArrowForwardIos } from '@mui/icons-material';
import DeleteForever from '@mui/icons-material/DeleteForever';
import AutoFixHigh from '@mui/icons-material/AutoFixHigh';
import LockIcon from '@mui/icons-material/Lock';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import SaveIcon from '@mui/icons-material/Save';
import ClearIcon from '@mui/icons-material/Clear';
import { backendUrl } from "../config";
import "./Outlier_manager.css";

// ==================== UTILS ====================
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// ==================== STYLE CONSTANTS ====================
const COLORS = {
  primary: '#384850',
  primaryDark: '#2a3942',
  accent: '#DE6B06',
  accentDark: '#c55a05',
  success: '#384850',
  danger: '#b42318',
  neutral: '#DDDEDF',
  white: '#ffffff',
  dark: '#384850',
  bgLight: '#f3f4f5',
  bgSection: '#e8e9ea',
};

const sectionStyle = {
  background: COLORS.white,
  borderRadius: '2px',
  boxShadow: 'none',
  border: `1px solid ${COLORS.neutral}`,
  mb: 3,
  overflow: 'hidden',
};

const sectionHeaderStyle = {
  background: COLORS.primary,
  px: 2.5,
  py: 1.5,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

const sectionBodyStyle = {
  p: 2.5,
};

// Reusable section header component
const SectionHeader = ({ icon, title, infoTitle, infoContent, badge }) => (
  <Box sx={sectionHeaderStyle}>
    <Typography variant="subtitle1" sx={{ color: COLORS.white, fontWeight: 700, flex: 1 }}>
      {title}
    </Typography>
    {badge && (
      <Chip
        label={badge}
        size="small"
        sx={{ bgcolor: COLORS.accent, color: COLORS.white, fontWeight: 700, fontSize: '0.75rem' }}
      />
    )}
    {infoTitle && (
      <Tooltip title={
        <Box sx={{ maxWidth: 280, p: 0.5 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>{infoTitle}</Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>{infoContent}</Typography>
        </Box>
      } arrow placement="left">
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: COLORS.white } }}>
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}
  </Box>
);

// Step indicator for guiding users
const WorkflowSteps = ({ currentStep }) => {
  const steps = [
    { label: 'Select column' },
    { label: 'Choose method' },
    { label: 'Detect' },
    { label: 'Apply actions' },
  ];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0, mb: 3, border: `1px solid ${COLORS.neutral}`, borderRadius: '2px' }}>
      {steps.map((step, idx) => {
        const isActive = currentStep === idx;
        const isDone = currentStep > idx;
        return (
          <Box key={idx} sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            py: 1.2,
            px: 1,
            background: isActive ? COLORS.accent : isDone ? COLORS.primary : COLORS.white,
            borderRight: idx < steps.length - 1 ? `1px solid ${COLORS.neutral}` : 'none',
          }}>
            <Typography variant="caption" sx={{
              fontWeight: isActive ? 700 : 500,
              color: isActive || isDone ? COLORS.white : COLORS.primary,
            }}>
              {step.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

function Outlier_manager({ embedded = false, bdName: bdNameProp = null, onClose = null } = {}) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [data, setData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [outlierMethod, setOutlierMethod] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [isNumericColumn, setIsNumericColumn] = useState(false);
  const [isIntegerColumn, setIsIntegerColumn] = useState(false);
  const [isBooleanColumn, setIsBooleanColumn] = useState(false);
  const [columnDataType, setColumnDataType] = useState(null);
  const [modificationsLog, setModificationsLog] = useState([]);
  const [transformationType, setTransformationType] = useState("log");
  const location = useLocation();
  const navigate = useNavigate();
  const bdName = bdNameProp ?? location.state?.bdName;
  const [modifiedRows, setModifiedRows] = useState([]);
  const [visualizationKey, setVisualizationKey] = useState(0);
  const [modifiedZScoreThreshold, setModifiedZScoreThreshold] = useState(3.5);
  const [detectedOutliers, setDetectedOutliers] = useState([]);
  const [outlierStats, setOutlierStats] = useState(null);
  const [openVisualizationDialog, setOpenVisualizationDialog] = useState(false);
  const [openHelpDialog, setOpenHelpDialog] = useState(false);
  const [firstTimeOpen, setFirstTimeOpen] = useState(true);
  const [modificationHistory, setModificationHistory] = useState([]);
  const [columnTypeError, setColumnTypeError] = useState("");

  // ==================== ÉTAT POUR LE RESET ====================
  const [resetting, setResetting] = useState(false);

  // ==================== ÉTATS POUR VISUALISATIONS ====================
  const [columnValues, setColumnValues] = useState({
    values: [],
    bins: [],
    stats: null,
    loading: false
  });

  // ==================== ÉTATS DE CHARGEMENT ET PAGINATION ====================
  const [loading, setLoading] = useState({
    data: false,
    stats: false,
    outliers: false,
    columnType: false,
    action: false,
    visualization: false
  });
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 50
  });
  const [rowCount, setRowCount] = useState(0);

  // ==================== ÉTATS POUR STATISTIQUES ====================
  const [columnStats, setColumnStats] = useState({
    all: null,
    train: null
  });

  // ==================== ÉTATS POUR SAUVEGARDE ====================
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [nameConflict, setNameConflict] = useState(false);
  const [existingTables, setExistingTables] = useState([]);
  const [datasetLimitReached, setDatasetLimitReached] = useState(false);
  const [saveCopyLoading, setSaveCopyLoading] = useState(false);
  const [datasetCount, setDatasetCount] = useState(0);

  // ==================== ÉTATS POUR LA PAGINATION DES OUTLIERS ====================
  const [outlierPaginationModel, setOutlierPaginationModel] = useState({
    page: 0,
    pageSize: 100
  });
  const [allOutlierIds, setAllOutlierIds] = useState([]);
  const [unmodifiedOutlierIds, setUnmodifiedOutlierIds] = useState([]);
  const [outlierRowCount, setOutlierRowCount] = useState(0);

  // ==================== CALCUL DU STEP ACTIF ====================
  const getWorkflowStep = () => {
    if (detectedOutliers.length > 0) return 3;
    if (outlierMethod && selectedColumn && isNumericColumn) return 2;
    if (selectedColumn && isNumericColumn) return 1;
    return 0;
  };

  // ==================== FONCTIONS API ====================

  const checkDatasetLimit = async () => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/check-dataset-limit`,
        { withCredentials: true }
      );
      setDatasetLimitReached(response.data.limit_reached);
      setDatasetCount(response.data.count);
      return response.data;
    } catch (error) {
      console.error("Error checking dataset limit:", error);
      return { limit_reached: false, count: 0 };
    }
  };

  const fetchColumnValues = useCallback(async () => {
    if (!selectedColumn || !isNumericColumn) return;

    setLoading(prev => ({ ...prev, visualization: true }));
    try {
      const response = await axios.post(
        `${backendUrl}/api/get-column-values`,
        { bdName, columnIndex: selectedColumn },
        { withCredentials: true }
      );

      setColumnValues({
        values: response.data.values || [],
        bins: response.data.bins || [],
        stats: response.data.stats
      });

      if (response.data.stats) {
        setColumnStats(prev => ({ ...prev, all: response.data.stats }));
      }
    } catch (error) {
      console.error("Error fetching column values:", error);
    } finally {
      setLoading(prev => ({ ...prev, visualization: false }));
    }
  }, [bdName, selectedColumn, isNumericColumn]);

  // ==================== CHARGEMENT DES DONNÉES PAGINÉES ====================
  const fetchPaginatedData = useCallback(async (page, pageSize) => {
    if (!bdName) return;

    setLoading(prev => ({ ...prev, data: true }));
    try {
      const response = await axios.post(
        `${backendUrl}/api/get-paginated-data`,
        { bdName, page, pageSize },
        { withCredentials: true }
      );

      if (response.data) {
        const { rows: fetchedRows, total, columns: backendColumns } = response.data;

        if (!Array.isArray(fetchedRows)) {
          setRows([]);
          setRowCount(0);
          return;
        }

        const transformedRows = fetchedRows.map((row, index) => ({
          ...row,
          id: row.id || (page * pageSize) + index + 1
        }));

        const columnsList = Array.isArray(backendColumns) ? backendColumns : [];
        const gridColumns = columnsList.map((colName, index) => ({
          field: `col${index}`,
          headerName: colName,
          width: colName === 'id' ? 100 : 150,
          editable: false
        }));

        setColumns(gridColumns);
        setRows(transformedRows);
        setRowCount(total || 0);
        setData({ name: bdName, columns: columnsList });
      }
    } catch (error) {
      console.error("❌ Error:", error);
    } finally {
      setLoading(prev => ({ ...prev, data: false }));
    }
  }, [bdName]);

  // ==================== HISTORIQUE DES MODIFICATIONS ====================
  const loadModificationHistory = async () => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/get-modification-history?bdName=${bdName}`,
        { withCredentials: true }
      );
      if (response.data && response.data.history) {
        setModificationHistory(response.data.history);
      }
    } catch (error) {
      console.log("No modification history found or error loading:", error);
      setModificationHistory([]);
    }
  };

  // ==================== VÉRIFICATION DU TYPE DE COLONNE ====================
  const checkColumnType = useCallback(async (columnIndex) => {
    if (!bdName || !columnIndex) return;

    setLoading(prev => ({ ...prev, columnType: true }));
    setColumnTypeError("");
    try {
      const response = await axios.post(
        `${backendUrl}/api/check-column-type`,
        { bdName, columnIndex },
        { withCredentials: true }
      );
      
      // Check if column is boolean
      if (response.data.isBoolean === true) {
        setIsBooleanColumn(true);
        setIsNumericColumn(false);
        setIsIntegerColumn(false);
        setColumnDataType(response.data.data_type || 'boolean');
        setColumnTypeError(`Column "${data?.columns[columnIndex - 1]}" is a BOOLEAN column. Boolean columns cannot be used for outlier detection.`);
        setSelectedColumn(null);
        alert(`Column "${data?.columns[columnIndex - 1]}" is a BOOLEAN column.\n\nBoolean columns cannot be used for outlier detection because they only contain two values (True/False).\n\nPlease select a numeric column for outlier analysis.`);
        return;
      }
      
      setIsBooleanColumn(false);
      setIsNumericColumn(response.data.isNumeric);
      setIsIntegerColumn(response.data.isInteger);
      setColumnDataType(response.data.data_type || 'unknown');
      
      if (!response.data.isNumeric) {
        setColumnTypeError(`Selected column is not numeric (type: ${response.data.data_type || 'unknown'}). Please select a numeric column.`);
      } else {
        setColumnTypeError("");
      }
    } catch (error) {
      console.error("Error checking column type:", error);
      setColumnTypeError("Error checking column type. Please try again.");
    } finally {
      setLoading(prev => ({ ...prev, columnType: false }));
    }
  }, [bdName, data]);

  // ==================== STATISTIQUES DE COLONNE ====================
  const fetchColumnStats = useCallback(async (columnIndex, useTrainOnly = false) => {
    if (!bdName || !columnIndex) return;

    setLoading(prev => ({ ...prev, stats: true }));
    try {
      const response = await axios.post(
        `${backendUrl}/api/get-column-stats`,
        { bdName, columnIndex, useTrainOnly },
        { withCredentials: true }
      );

      if (useTrainOnly) {
        setColumnStats(prev => ({ ...prev, train: response.data }));
      } else {
        setColumnStats(prev => ({ ...prev, all: response.data }));
      }
    } catch (error) {
      console.error("Error fetching column stats:", error);
    } finally {
      setLoading(prev => ({ ...prev, stats: false }));
    }
  }, [bdName]);

  // ==================== VERSIONS DEBOUNCÉES ====================
  const debouncedFetchColumnStats = useCallback(
    debounce((columnIndex, useTrainOnly) => {
      fetchColumnStats(columnIndex, useTrainOnly);
    }, 300),
    [fetchColumnStats]
  );

  const debouncedFetchColumnValues = useCallback(
    debounce(() => {
      fetchColumnValues();
    }, 300),
    [fetchColumnValues]
  );

  // ==================== DÉTECTION DES OUTLIERS AVEC PAGINATION SERVEUR ====================
  const detectOutliers = useCallback(async (page = 0) => {
    if (!isNumericColumn || !outlierMethod || !selectedColumn) {
      alert("Please select a numeric column and a detection method");
      return;
    }

    if (isBooleanColumn) {
      alert("Boolean columns cannot be used for outlier detection. Please select a numeric column.");
      return;
    }

    console.log(`Using DB index: ${selectedColumn}, page: ${page}, pageSize: ${outlierPaginationModel.pageSize}`);

    setLoading(prev => ({ ...prev, outliers: true }));
    try {
      const response = await axios.post(
        `${backendUrl}/api/detect-outliers-manager`,
        {
          bdName,
          columnIndex: selectedColumn,
          method: outlierMethod,
          threshold: outlierMethod === "modified_zscore" ? modifiedZScoreThreshold : 3.5,
          page: page,
          pageSize: outlierPaginationModel.pageSize
        },
        { withCredentials: true }
      );

      // Check if there's an error about boolean columns
      if (response.data.stats && response.data.stats.error) {
        alert(response.data.stats.error);
        setDetectedOutliers([]);
        setAllOutlierIds([]);
        setUnmodifiedOutlierIds([]);
        setOutlierRowCount(0);
        setOutlierStats(null);
        return;
      }

      const transformedOutliers = (response.data.outliers || []).map((outlier, index) => ({
        ...outlier,
        id: outlier.id || `outlier-${index}-${Date.now()}`,
        is_modified: !!outlier.is_modified,
        modification_info: outlier.modification_info || null,
      }));

      setDetectedOutliers(transformedOutliers);
      setAllOutlierIds(response.data.all_outlier_ids || []);
      setUnmodifiedOutlierIds(
        response.data.unmodified_outlier_ids ||
          (response.data.all_outlier_ids || []).filter((id) => {
            const row = transformedOutliers.find((o) => o.id === id);
            return row ? !row.is_modified : true;
          })
      );
      setOutlierRowCount(response.data.total || 0);
      setOutlierStats(response.data.stats);

      if (response.data.total === 0) {
        alert(`No outliers detected in this column using the ${outlierMethod} method.`);
      }

      console.log(` Détecté ${response.data.total} outliers au total, affichage ${transformedOutliers.length} sur la page ${page}`);
    } catch (error) {
      console.error("Error detecting outliers:", error);
      const errorMessage = error.response?.data?.detail || "Error detecting outliers";
      if (errorMessage.toLowerCase().includes("boolean")) {
        alert("Boolean columns cannot be used for outlier detection. Please select a numeric column.");
        setSelectedColumn(null);
        setIsNumericColumn(false);
        setIsBooleanColumn(true);
      } else {
        alert(errorMessage);
      }
    } finally {
      setLoading(prev => ({ ...prev, outliers: false }));
    }
  }, [bdName, selectedColumn, outlierMethod, modifiedZScoreThreshold, isNumericColumn, isBooleanColumn, outlierPaginationModel.pageSize]);

  // ==================== GESTIONNAIRE DE CHANGEMENT DE PAGE POUR LES OUTLIERS ====================
  const handleOutlierPageChange = (newModel) => {
    console.log("📄 Outlier page change requested:", newModel);
    setOutlierPaginationModel(newModel);
    detectOutliers(newModel.page);
  };

  // ==================== SAUVEGARDE DANS L'HISTORIQUE ====================
  const saveModificationToHistory = async (rowId, columnIndex, actionType, originalValue, newValue) => {
    const columnName = columns.find(c => c.field === `col${columnIndex - 1}`)?.headerName || `Column ${columnIndex}`;

    const isBulk = Array.isArray(rowId);

    const modification = isBulk
      ? rowId
      : [{
          rowId,
          columnIndex,
          columnName,
          actionType,
          originalValue,
          newValue,
          timestamp: new Date().toISOString()
        }];

    try {
      const response = await axios.post(
        `${backendUrl}/api/save-modification-history`,
        { bdName, modification },
        { withCredentials: true }
      );

      if (response.status === 200) {
        setModificationHistory(prev => [...prev, ...modification]);
        return true;
      }
    } catch (error) {
      console.error("Error saving modification history:", error);
    }
    return false;
  };

  // ==================== ACTION SUR UN SEUL OUTLIER ====================
  const applySingleAction = useCallback(async (rowId, action, localTransformType = null) => {
    setLoading(prev => ({ ...prev, action: true }));
    try {
      const response = await axios.post(
        `${backendUrl}/api/apply-single-outlier-action`,
        {
          bdName,
          rowId,
          action,
          transformType: localTransformType || transformationType,
          columnIndex: selectedColumn
        },
        { withCredentials: true }
      );

      if (response.data.success) {
        setRows(prevRows => {
          const newRowsMap = new Map(
            response.data.newRows.map(row => [row.id, row])
          );
          return prevRows.map(row => newRowsMap.get(row.id) || row);
        });

        setProcessedData(prev => {
          if (!prev) return prev;
          const newRowsMap = new Map(
            response.data.newRows.map(row => [row.id, row])
          );
          return prev.map(row => newRowsMap.get(row.id) || row);
        });

        const mod = response.data.modification;
        setModifiedRows(prev => [...prev, mod]);
        setModificationsLog(prev => [...prev, `${action} applied to row ${mod.id}`]);

        if (action !== "delete") {
          await saveModificationToHistory(
            mod.id,
            selectedColumn - 1,
            action,
            mod.originalValue,
            mod.modifiedValue
          );
        }

        // Verrouillage immédiat côté UI (sans attendre le re-detect)
        const modInfo = {
          rowId: mod.id,
          columnIndex: selectedColumn - 1,
          actionType: action,
          originalValue: mod.originalValue,
          modifiedValue: mod.modifiedValue,
          newValue: mod.modifiedValue,
        };
        setDetectedOutliers((prev) =>
          prev.map((o) =>
            o.id === rowId
              ? { ...o, is_modified: true, modification_info: modInfo }
              : o
          )
        );
        setUnmodifiedOutlierIds((prev) => prev.filter((id) => id !== rowId));

        if (action === "delete" || action === "replace") {
          debouncedFetchColumnStats(selectedColumn, true);
          debouncedFetchColumnValues();
          detectOutliers(outlierPaginationModel.page);
        } else {
          detectOutliers(outlierPaginationModel.page);
        }

        alert(`Successfully ${action}ed outlier`);
      }
    } catch (error) {
      console.error("Error applying single action:", error);
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  }, [bdName, selectedColumn, transformationType, debouncedFetchColumnStats, debouncedFetchColumnValues, saveModificationToHistory, outlierPaginationModel.page]);

  // ==================== ACTION EN MASSE ====================
  const applyBulkAction = useCallback(async (action, transformType = null) => {
    const idsToProcess = unmodifiedOutlierIds;

    if (!idsToProcess.length) {
      alert("No unmodified outliers to process");
      return;
    }

    setLoading(prev => ({ ...prev, action: true }));
    try {
      const response = await axios.post(
        `${backendUrl}/api/apply-bulk-outlier-action`,
        {
          bdName,
          outlierIds: idsToProcess,
          action,
          transformType: transformType || transformationType,
          columnIndex: selectedColumn
        },
        { withCredentials: true }
      );

      if (response.data.success) {
        setRows(prevRows => {
          const newRowsMap = new Map(
            response.data.newRows.map(row => [row.id, row])
          );
          return prevRows.map(row => newRowsMap.get(row.id) || row);
        });

        response.data.modifications.forEach(mod => {
          setModifiedRows(prev => [...prev, mod]);
          setModificationsLog(prev => [...prev, `${action} applied to row ${mod.id}`]);
        });

        for (const mod of response.data.modifications) {
          if (action !== "delete") {
            await saveModificationToHistory(
              mod.id,
              selectedColumn - 1,
              action,
              mod.originalValue,
              mod.modifiedValue
            );
          }
        }

        const modifiedIds = new Set(
          (response.data.modifications || []).map((m) => m.id)
        );
        setDetectedOutliers((prev) =>
          prev.map((o) => {
            if (!modifiedIds.has(o.id)) return o;
            const mod = response.data.modifications.find((m) => m.id === o.id);
            return {
              ...o,
              is_modified: true,
              modification_info: mod
                ? {
                    rowId: mod.id,
                    columnIndex: selectedColumn - 1,
                    actionType: action,
                    originalValue: mod.originalValue,
                    modifiedValue: mod.modifiedValue,
                    newValue: mod.modifiedValue,
                  }
                : o.modification_info,
            };
          })
        );
        setUnmodifiedOutlierIds((prev) => prev.filter((id) => !modifiedIds.has(id)));

        if (action === "replace") {
          debouncedFetchColumnStats(selectedColumn, true);
          debouncedFetchColumnValues();
        }

        if (action === "delete") {
          setDetectedOutliers([]);
          setAllOutlierIds([]);
          setUnmodifiedOutlierIds([]);
          setOutlierRowCount(0);
          setOutlierStats(null);
          setOutlierPaginationModel(prev => ({ ...prev, page: 0 }));
        } else {
          setOutlierPaginationModel(prev => ({ ...prev, page: 0 }));
          detectOutliers(0);
        }

        setVisualizationKey(prev => prev + 1);

        alert(response.data.message || `Successfully ${action}ed outliers`);
      } else {
        alert(response.data.message || "Bulk action failed");
      }
    } catch (error) {
      console.error("Error applying bulk action:", error);
      alert("Error applying action");
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  }, [bdName, unmodifiedOutlierIds, allOutlierIds, selectedColumn, transformationType, debouncedFetchColumnStats, debouncedFetchColumnValues, saveModificationToHistory, detectOutliers, outlierPaginationModel.page]);

  // ==================== FONCTIONS DE VÉRIFICATION ====================
  // is_modified vient du backend (detect-outliers-manager): plus de .some() sur tout l'historique
  const isOutlierModified = (outlier) => !!outlier?.is_modified;

  const getCellModificationInfo = (outlier) => outlier?.modification_info || null;

  // ==================== FONCTIONS DE SAUVEGARDE DE COPIE ====================
  const handleSaveCopy = async (overwrite = false) => {
    if (!copyName.trim()) {
      setError("Please enter a valid name for your copy");
      return;
    }

    try {
      setSaveCopyLoading(true);
      setError("");

      const response = await axios.post(
        `${backendUrl}/api/save-dataset-copy`,
        {
          source_db: bdName,
          copy_name: copyName.trim(),
          copy_type: "outlier_manager",
          overwrite: overwrite
        },
        { withCredentials: true }
      );

      if (response.data.status === "success") {
        setSuccess(`Dataset copy "${copyName}" ${response.data.action} successfully!`);
        setSaveDialogOpen(false);
        setNameConflict(false);
        setDatasetLimitReached(false);
        setTimeout(() => setSuccess(""), 5000);
      }
    } catch (error) {
      console.error("Save copy error:", error);
      const errorData = error.response?.data;

      if (error.response?.status === 400 && errorData?.detail?.type === "name_exists") {
        setNameConflict(true);
        setExistingTables(errorData.detail.existing_tables || []);
        setError(errorData.detail.message || "This dataset name already exists");
      } else if (errorData?.detail && String(errorData.detail).includes("Dataset limit reached")) {
        setDatasetLimitReached(true);
        setError(String(errorData.detail));
      } else if (errorData?.detail) {
        setError(String(errorData.detail));
      } else {
        setError("Failed to save copy. Please try again.");
      }
      setTimeout(() => setError(""), 8000);
    } finally {
      setSaveCopyLoading(false);
    }
  };

  // ==================== EFFETS ====================
  useEffect(() => {
    if (!bdName) {
      if (!embedded) {
        navigate("/upload");
      }
      return;
    }

    const initializeData = async () => {
      setIsInitialized(false);
      await fetchPaginatedData(paginationModel.page, paginationModel.pageSize);
      await loadModificationHistory();
      setIsInitialized(true);
    };

    initializeData();
  }, [bdName, navigate, embedded]);

  useEffect(() => {
    if (selectedColumn && isNumericColumn && !isBooleanColumn) {
      fetchColumnStats(selectedColumn, true);
    }
  }, [selectedColumn, isNumericColumn, isBooleanColumn, fetchColumnStats]);

  useEffect(() => {
    if (selectedColumn) {
      checkColumnType(selectedColumn);
    } else {
      setIsNumericColumn(false);
      setIsIntegerColumn(false);
      setIsBooleanColumn(false);
      setColumnTypeError("");
    }
  }, [selectedColumn, checkColumnType]);

  useEffect(() => {
    if (selectedColumn && isNumericColumn && !isBooleanColumn) {
      fetchColumnValues();
    }
  }, [selectedColumn, isNumericColumn, isBooleanColumn, fetchColumnValues]);

  useEffect(() => {
    if (firstTimeOpen && data) {
      if (!embedded) {
        setOpenHelpDialog(true);
      }
      setFirstTimeOpen(false);
    }
  }, [data, firstTimeOpen, embedded]);

  useEffect(() => {
    if (saveDialogOpen && bdName) {
      const defaultName = `${bdName}_outlier_cleaned`;
      setCopyName(defaultName);
      checkDatasetLimit();
    }
  }, [saveDialogOpen, bdName]);

  // ==================== COMPOSANTS ====================

  const InfoButton = ({ title, content }) => (
    <Tooltip title={
      <Box sx={{ maxWidth: 300, p: 0.5 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>{title}</Typography>
        <Typography variant="body2" sx={{ lineHeight: 1.5 }}>{content}</Typography>
      </Box>
    } arrow placement="top">
      <IconButton size="small" sx={{ color: 'primary.main', ml: 0.5 }}>
        <InfoIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  const StatItem = ({ label, value }) => (
    <Box>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body1" fontWeight="500">{value}</Typography>
    </Box>
  );

  // ==================== COMPOSANT POUR LES ACTIONS SUR OUTLIER ====================
  const OutlierActionsCell = ({ row, disabled = false }) => {
    const [localTransformationType, setLocalTransformationType] = useState("log");

    const rowId = row.id;
    const isModified = isOutlierModified(row);
    const modificationInfo = isModified ? getCellModificationInfo(row) : null;

    const handleSingleAction = async (action, transformType) => {
      if (isModified) {
        alert("This outlier has already been modified and cannot be modified again.");
        return;
      }
      await applySingleAction(rowId, action, transformType || localTransformationType);
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {isModified ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockIcon color="disabled" fontSize="small" />
            <Tooltip title={
              modificationInfo?.modifiedValue === "DELETED"
                ? "Row has been deleted"
                : `Modified: ${modificationInfo?.originalValue} → ${modificationInfo?.modifiedValue}`
            }>
              <Chip
                label={modificationInfo?.modifiedValue === "DELETED" ? "Deleted" : "Modified"}
                size="small"
                color={modificationInfo?.modifiedValue === "DELETED" ? "error" : "warning"}
                variant="outlined"
                icon={modificationInfo?.modifiedValue === "DELETED" ? <DeleteForever /> : <WarningIcon />}
              />
            </Tooltip>
          </Box>
        ) : (
          <>
            <Tooltip title="Delete this row permanently">
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => handleSingleAction("delete")}
                  sx={{ minWidth: '32px', px: 1 }}
                  disabled={disabled || loading.action || resetting}
                >
                  <DeleteForever fontSize="small" />
                </Button>
              </span>
            </Tooltip>

            <Tooltip title="Replace with training median value">
              <span>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  onClick={() => handleSingleAction("replace")}
                  sx={{ minWidth: '32px', px: 1 }}
                  disabled={disabled || loading.action || resetting}
                >
                  <AutoFixHigh fontSize="small" />
                </Button>
              </span>
            </Tooltip>

            {/* Transform group: button + select visually linked */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              border: `1.5px solid`,
              borderColor: 'secondary.main',
              borderRadius: '6px',
              overflow: 'hidden',
              opacity: disabled || loading.action || resetting ? 0.5 : 1,
            }}>
              <Tooltip title="Apply the selected transformation to this value">
                <span>
                  <Button
                    variant="contained"
                    color="secondary"
                    size="small"
                    onClick={() => handleSingleAction("transform", localTransformationType)}
                    sx={{
                      minWidth: '32px',
                      px: 1,
                      borderRadius: 0,
                      boxShadow: 'none',
                      borderRight: '1px solid rgba(255,255,255,0.3)',
                    }}
                    disabled={disabled || loading.action || resetting}
                  >
                    <AutoFixHigh fontSize="small" />
                  </Button>
                </span>
              </Tooltip>
              <Select
                value={localTransformationType}
                onChange={(e) => setLocalTransformationType(e.target.value)}
                size="small"
                sx={{
                  height: '32px',
                  minWidth: 80,
                  fontSize: '0.75rem',
                  borderRadius: 0,
                  bgcolor: 'rgba(156,39,176,0.07)',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& .MuiSelect-select': { py: '4px', px: '6px' },
                }}
                disabled={disabled || loading.action || resetting}
              >
                <MenuItem value="log">Log</MenuItem>
                <MenuItem value="sqrt">Sqrt</MenuItem>
                <MenuItem value="boxcox">Box-Cox</MenuItem>
              </Select>
            </Box>
          </>
        )}
      </div>
    );
  };

  // ==================== COMPOSANT STATISTIQUES ====================
  const StatisticsCard = () => {
    if (!columnValues.stats) return null;
    const stats = columnValues.stats;

    return (
      <Paper sx={{ ...sectionStyle, mb: 3 }}>
        <SectionHeader
          title="Descriptive Statistics"
          infoTitle="These numbers"
          infoContent="They are computed only on training rows. Test rows are not used, so later scoring on test stays honest."
        />
        <Box sx={sectionBodyStyle}>
          <Alert severity="info" icon={false} className="outlier-alert" sx={{ mb: 2 }}>
            <Typography variant="body2">
              These figures use the training rows only. The test rows are left aside on purpose.
            </Typography>
          </Alert>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {[
              { label: 'Sample size (train)', value: stats.sampleSize.toLocaleString() },
              { label: 'Mean (train)', value: stats.mean.toFixed(4) },
              { label: 'Median (train)', value: stats.median.toFixed(4) },
              { label: 'Std deviation (train)', value: stats.stdDev.toFixed(4) },
              { label: 'Minimum (train)', value: stats.min.toFixed(4) },
              { label: 'Maximum (train)', value: stats.max.toFixed(4) },
              { label: 'Q1, 25th percentile (train)', value: stats.q1.toFixed(4) },
              { label: 'Q3, 75th percentile (train)', value: stats.q3.toFixed(4) },
            ].map(({ label, value }) => (
              <Box key={label} sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                py: 0.75,
                px: 1,
                borderBottom: '1px solid #c8c9ca',
              }}>
                <Typography variant="body2" sx={{ color: COLORS.primary }}>{label}</Typography>
                <Typography variant="body2" sx={{ color: COLORS.primary, fontWeight: 700 }}>{value}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>
    );
  };

  // ==================== VISUALISATIONS ====================
  const renderHistogram = () => {
    if (!columnValues.bins || columnValues.bins.length === 0) {
      return <Alert severity="info">No data available for histogram</Alert>;
    }

    return (
      <Plot
        key={`histogram-${visualizationKey}`}
        data={[{
          x: columnValues.bins.map(b => b.bin_center),
          y: columnValues.bins.map(b => b.count),
          type: "bar",
          name: "Distribution",
          marker: { color: "#636efa" },
          opacity: 0.7,
          text: columnValues.bins.map(b =>
            `Range: ${b.bin_start.toFixed(2)} - ${b.bin_end.toFixed(2)}<br>Count: ${b.count}`
          ),
          hoverinfo: 'text'
        }]}
        layout={{
          margin: { t: 40, b: 50, l: 60, r: 30 },
          height: 350,
          xaxis: { title: "Value Ranges" },
          yaxis: { title: "Frequency" },
          title: { text: `Histogram (${columnValues.stats?.sampleSize.toLocaleString()} values)` }
        }}
      />
    );
  };

  const renderBoxplot = () => {
    if (!columnValues.values || columnValues.values.length === 0) {
      return <Alert severity="info">No data available for boxplot</Alert>;
    }

    return (
      <Plot
        key={`boxplot-${visualizationKey}`}
        data={[{
          y: columnValues.values,
          type: "box",
          name: "Distribution",
          marker: { color: "#00cc96" }
        }]}
        layout={{
          margin: { t: 40, b: 50, l: 60, r: 30 },
          height: 350,
          yaxis: { title: "Values" },
          title: { text: `Box Plot (n=${columnValues.values.length.toLocaleString()})` }
        }}
      />
    );
  };

  const renderScatterplot = () => {
    if (!columnValues.values || columnValues.values.length === 0) {
      return <Alert severity="info">No data available for scatter plot</Alert>;
    }

    const sampleSize = Math.min(1000, columnValues.values.length);
    const step = Math.floor(columnValues.values.length / sampleSize);
    const sampledValues = [];
    for (let i = 0; i < columnValues.values.length; i += step) {
      sampledValues.push(columnValues.values[i]);
    }

    return (
      <Plot
        key={`scatter-${visualizationKey}`}
        data={[{
          x: Array.from({ length: sampledValues.length }, (_, i) => i + 1),
          y: sampledValues,
          mode: "markers",
          type: "scatter",
          name: "Values",
          marker: { color: "#ef553b", size: 6, opacity: 0.6 }
        }]}
        layout={{
          margin: { t: 40, b: 50, l: 60, r: 30 },
          height: 350,
          xaxis: { title: "Index" },
          yaxis: { title: "Value" },
          title: { text: `Scatter Plot (sample of ${sampledValues.length} points)` }
        }}
      />
    );
  };

  const renderVisualizationButton = () => {
    if (selectedColumn === null) return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Select a numeric column to view visualizations
      </Alert>
    );

    if (isBooleanColumn) {
      return (
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>Boolean columns cannot be visualized for outlier detection.</strong> 
          Please select a numeric column.
        </Alert>
      );
    }

    const columnName = columns.find(c => c.field === `col${selectedColumn - 1}`)?.headerName || `Column ${selectedColumn}`;

    if (!columnValues.values || columnValues.values.length === 0) return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        No valid numeric data in {columnName}
      </Alert>
    );

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setOpenVisualizationDialog(true)}
          disabled={loading.visualization || resetting || isBooleanColumn}
          sx={{ minWidth: '200px', background: COLORS.primary, boxShadow: 'none', borderRadius: '2px' }}
        >
          {loading.visualization ? "Loading..." : "Show Advanced Visualizations"}
        </Button>
        <InfoButton
          title="Charts"
          content="Charts use every row, not only the page you see in the table."
        />
      </Box>
    );
  };

  // ==================== DIALOGUE DE VISUALISATION ====================
  const VisualizationDialog = ({ open, onClose }) => {
    const columnName = columns.find(c => c.field === `col${selectedColumn - 1}`)?.headerName || `Column ${selectedColumn}`;
    const [activeVisualization, setActiveVisualization] = useState(0);

    const visualizations = [
      {
        title: "Histogram",
        description: "How often each range of values appears.",
        component: renderHistogram()
      },
      {
        title: "Box plot",
        description: "Median, quartiles, and extreme points.",
        component: renderBoxplot()
      },
      {
        title: "Scatter",
        description: "Each point is one value, so you see the spread.",
        component: renderScatterplot()
      }
    ];

    const handleNext = () => setActiveVisualization(prev => (prev + 1) % visualizations.length);
    const handlePrev = () => setActiveVisualization(prev => (prev - 1 + visualizations.length) % visualizations.length);

    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper" PaperProps={{ className: "outlier-dialog" }}>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <span>Visualizations for <strong>{columnName}</strong></span>
            </Box>
            <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {activeVisualization + 1} / {visualizations.length}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Box mb={2}>
            <Typography variant="h6">{visualizations[activeVisualization].title}</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {visualizations[activeVisualization].description}
            </Typography>
          </Box>

          <Box sx={{ position: 'relative', minHeight: '400px', bgcolor: '#fafafa', borderRadius: 2, p: 2 }}>
            {loading.visualization ? (
              <Box sx={{ width: '100%', textAlign: 'center' }}>
                <LinearProgress />
                <Typography sx={{ mt: 2 }}>Loading visualization data...</Typography>
              </Box>
            ) : (
              visualizations[activeVisualization].component
            )}

            <IconButton
              onClick={handlePrev}
              sx={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                backgroundColor: 'rgba(255,255,255,0.9)',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.1)' },
                boxShadow: 1
              }}
            >
              <ArrowBackIos />
            </IconButton>

            <IconButton
              onClick={handleNext}
              sx={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                backgroundColor: 'rgba(255,255,255,0.9)',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.1)' },
                boxShadow: 1
              }}
            >
              <ArrowForwardIos />
            </IconButton>
          </Box>
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {visualizations.map((viz, index) => (
              <Button
                key={index}
                size="small"
                variant={activeVisualization === index ? "contained" : "outlined"}
                onClick={() => setActiveVisualization(index)}
                sx={{
                  textTransform: 'none',
                  borderRadius: '2px',
                  boxShadow: 'none',
                  bgcolor: activeVisualization === index ? COLORS.primary : undefined,
                  borderColor: COLORS.primary,
                  color: activeVisualization === index ? '#fff' : COLORS.primary,
                }}
              >
                {viz.title}
              </Button>
            ))}
          </Box>
          <Button onClick={onClose} variant="contained" color="primary">Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  // ==================== DIALOGUE D'AIDE ====================
  const HelpDialog = ({ open, onClose }) => (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ className: "outlier-dialog" }}>
      <DialogTitle>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>Guide: Outliers (one column)</Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" paragraph>
          An outlier is an extreme number, far from the rest of the column. This page finds them in one numeric column at a time, then lets you delete the row, replace the value, or transform it.
        </Typography>
        <Typography variant="body2" paragraph>
          How to run it: pick a numeric column, pick a method, click Detect Outliers, then use the buttons on each row (or the bulk buttons).
        </Typography>
        <Typography variant="body2" paragraph>
          Thresholds (mean, median, IQR) are computed on the training set only, then used to flag values. Test rows can be shown as outliers but they are never changed. That way the test set stays a real check for the model.
        </Typography>
        <Typography variant="body2" paragraph>
          True/false columns cannot be used here: they only have two values.
        </Typography>

        <Typography variant="subtitle1" sx={{ color: COLORS.primary, fontWeight: 700, mt: 2, mb: 1 }}>
          Methods
        </Typography>
        <Typography variant="body2" paragraph>
          Z-Score: flags values more than 3 standard deviations from the mean. Fits data that looks roughly bell-shaped.
        </Typography>
        <Typography variant="body2" paragraph>
          IQR: flags values outside Q1 minus 1.5 times IQR and Q3 plus 1.5 times IQR. Better when the column is skewed.
        </Typography>
        <Typography variant="body2" paragraph>
          Modified Z-Score: uses the median and MAD, so a few already-extreme values do not pull the threshold.
        </Typography>

        <Typography variant="subtitle1" sx={{ color: COLORS.primary, fontWeight: 700, mt: 2, mb: 1 }}>
          Actions
        </Typography>
        <Typography variant="body2" paragraph>
          Delete removes the row. Replace puts the training median in that cell. Transform applies Log, Sqrt, or Box-Cox (the type is next to the button).
          The same actions exist in bulk for every unmodified outlier on train.
        </Typography>
        <Typography variant="body2">
          Data loads page by page. Charts use all data but are cached after the first load. Bulk actions run as one SQL query.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          color="primary"
          variant="contained"
          fullWidth
          size="large"
          sx={{ backgroundColor: COLORS.primary, textTransform: 'none', fontWeight: 700, '&:hover': { backgroundColor: '#2a3942' } }}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );

  // ==================== DIALOGUE DE SAUVEGARDE DE COPIE ====================
  const SaveCopyDialog = ({ open, onClose }) => {
    const [localCopyName, setLocalCopyName] = useState("");
    const [localNameConflict, setLocalNameConflict] = useState(false);
    const [localExistingTables, setLocalExistingTables] = useState([]);
    const [localDatasetLimitReached, setLocalDatasetLimitReached] = useState(false);
    const [localError, setLocalError] = useState("");
    const [localSaveLoading, setLocalSaveLoading] = useState(false);
    const [localSuccess, setLocalSuccess] = useState("");
    const [localDatasetCount, setLocalDatasetCount] = useState(0);

    const checkLocalDatasetLimit = async () => {
      try {
        const response = await axios.get(
          `${backendUrl}/api/check-dataset-limit`,
          { withCredentials: true }
        );
        setLocalDatasetLimitReached(response.data.limit_reached);
        setLocalDatasetCount(response.data.count);
        return response.data;
      } catch (error) {
        console.error("Error checking dataset limit:", error);
        return { limit_reached: false, count: 0 };
      }
    };

    useEffect(() => {
      if (open && bdName) {
        const defaultName = `${bdName}_outlier_cleaned`;
        setLocalCopyName(defaultName);
        checkLocalDatasetLimit();
      }
    }, [open, bdName]);

    const handleLocalSaveCopy = async (overwrite = false) => {
      if (!localCopyName.trim()) {
        setLocalError("Please enter a valid name for your copy");
        return;
      }

      try {
        setLocalSaveLoading(true);
        setLocalError("");

        const response = await axios.post(
          `${backendUrl}/api/save-dataset-copy`,
          {
            source_db: bdName,
            copy_name: localCopyName.trim(),
            copy_type: "outlier_manager",
            overwrite: overwrite
          },
          { withCredentials: true }
        );

        if (response.data.status === "success") {
          setLocalSuccess(`Dataset copy "${localCopyName}" ${response.data.action} successfully!`);
          setSuccess(`Dataset copy "${localCopyName}" ${response.data.action} successfully!`);
          setTimeout(() => {
            onClose();
            setLocalSuccess("");
            setSuccess("");
          }, 2000);
        }
      } catch (error) {
        console.error("Save copy error:", error);
        const errorData = error.response?.data;

        if (error.response?.status === 400 && errorData?.detail?.type === "name_exists") {
          setLocalNameConflict(true);
          setLocalExistingTables(errorData.detail.existing_tables || []);
          setLocalError(errorData.detail.message || "This dataset name already exists");
        } else if (errorData?.detail && String(errorData.detail).includes("Dataset limit reached")) {
          setLocalDatasetLimitReached(true);
          setLocalError(String(errorData.detail));
        } else if (errorData?.detail) {
          setLocalError(String(errorData.detail));
        } else {
          setLocalError("Failed to save copy. Please try again.");
        }

        setTimeout(() => setLocalError(""), 8000);
      } finally {
        setLocalSaveLoading(false);
      }
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ className: "outlier-dialog" }}>
        <DialogTitle>
          <SaveIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Save Dataset Copy
        </DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Save the current state of your dataset with all outlier transformations applied.
          </Typography>

          <TextField
            autoFocus
            fullWidth
            label="Dataset Name"
            value={localCopyName}
            onChange={(e) => {
              setLocalCopyName(e.target.value);
              setLocalNameConflict(false);
              setLocalDatasetLimitReached(false);
              setLocalError("");
            }}
            variant="outlined"
            sx={{ mt: 1 }}
            helperText={localNameConflict ? "This name is already used" : "Enter a name for your dataset"}
            error={localNameConflict}
          />

          {localNameConflict && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                Dataset Name Already Exists
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                The name "<strong>{localCopyName}</strong>" is already used. You can:
              </Typography>

              {localExistingTables.length > 0 && (
                <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight="600" sx={{ mb: 1 }}>
                    Existing datasets:
                  </Typography>
                  {localExistingTables.map((table, index) => (
                    <Typography key={index} variant="body2" sx={{ fontSize: '0.8rem', ml: 1 }}>
                      • {table}
                    </Typography>
                  ))}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    const timestamp = new Date().getTime();
                    setLocalCopyName(`${localCopyName}_${timestamp}`);
                    setLocalNameConflict(false);
                    setLocalError("");
                  }}
                  sx={{ flex: 1 }}
                >
                  Generate New Name
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="warning"
                  onClick={() => handleLocalSaveCopy(true)}
                  disabled={localSaveLoading || resetting}
                  sx={{ flex: 1 }}
                >
                  {localSaveLoading ? "Overwriting..." : "Overwrite Existing"}
                </Button>
              </Box>
            </Alert>
          )}

          {localDatasetLimitReached && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                Maximum Datasets Reached (10/10)
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                You have reached the maximum number of datasets. Choose an option:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    window.open("/dashboard", "_blank");
                    setLocalError("Please delete some datasets in the dashboard, then refresh this page and try again.");
                  }}
                  disabled={resetting}
                >
                  Open Dashboard to Delete Datasets
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="warning"
                  onClick={() => {
                    if (localNameConflict) {
                      handleLocalSaveCopy(true);
                    } else {
                      setLocalError("To overwrite, please use an existing dataset name.");
                      setLocalNameConflict(true);
                    }
                  }}
                  disabled={localSaveLoading || resetting}
                >
                  {localSaveLoading ? "Overwriting..." : "Overwrite Existing Dataset"}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => window.location.reload()}
                  sx={{ mt: 1 }}
                  disabled={resetting}
                >
                  Refresh Page After Deletion
                </Button>
              </Box>
            </Alert>
          )}

          {localError && !localNameConflict && !localDatasetLimitReached && (
            <Alert severity="error" sx={{ mt: 2 }}>{localError}</Alert>
          )}

          {localSuccess && (
            <Alert severity="success" icon={false} className="outlier-alert" sx={{ mt: 2 }}>{localSuccess}</Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={onClose} startIcon={<ClearIcon />} disabled={resetting}>
            Cancel
          </Button>
          {!localNameConflict && !localDatasetLimitReached && (
            <Button
              onClick={() => handleLocalSaveCopy(false)}
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={localSaveLoading || !localCopyName.trim() || resetting}
              sx={{ bgcolor: COLORS.accent, '&:hover': { bgcolor: COLORS.accentDark } }}
            >
              {localSaveLoading ? "Saving..." : "Save Copy"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    );
  };

  const handlePageChange = (newModel) => {
    setPaginationModel(newModel);
    fetchPaginatedData(newModel.page, newModel.pageSize);
  };

  // ==================== GESTION DE L'ÉTAPE SUIVANTE ====================
  const handleNext = async () => {
    if (!processedData && rows.length > 0) {
      const shouldContinue = window.confirm(
        "Are you sure you want to continue without processing the data? Click OK to continue or Cancel to stay."
      );
      if (!shouldContinue) return;
    }

    try {
      await axios.post(
        `${backendUrl}/api/update-stage`,
        { bdName, newStage: "data_transformation" },
        { withCredentials: true }
      );

      try {
        await axios.post(
          `${backendUrl}/api/dataset/save-checkpoint`,
          { source_db: bdName },
          { withCredentials: true }
        );
        console.log("Checkpoint saved for next stage");
      } catch (error) {
        console.warn("⚠️ Checkpoint save failed:", error);
      }

      navigate("/data_transformation", {
        state: { bdName, processedData: processedData || rows, columns }
      });

    } catch (error) {
      console.error("Continue error:", error);
      alert(`Error: ${error.response?.data?.message || error.message}`);
    }
  };

  // ==================== RENDU PRINCIPAL ====================

  if (!data && loading.data) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading data...</Typography>
      </Box>
    );
  }

  const unmodifiedCount =
    outlierStats?.unmodified_count ??
    unmodifiedOutlierIds.length;

  return (
    <div className="container">
      {/* Global progress bar */}
      {(loading.data || loading.stats || loading.outliers || loading.action || loading.visualization || resetting) && (
        <LinearProgress sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }} />
      )}

      <VisualizationDialog
        open={openVisualizationDialog}
        onClose={() => setOpenVisualizationDialog(false)}
      />
      <HelpDialog
        open={openHelpDialog}
        onClose={() => setOpenHelpDialog(false)}
      />
      <SaveCopyDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
      />

      {/* Reset progress bar */}
      {resetting && (
        <Box sx={{ width: '100%', mb: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            Resetting dataset… Please wait.
          </Typography>
        </Box>
      )}

      {/* ===== TOP NAVBAR ===== */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 3,
        p: 2,
        background: COLORS.primary,
        borderRadius: '2px',
        boxShadow: 'none',
        flexWrap: 'wrap',
        gap: 1.5,
      }}>
        {/* Left: back + title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {!embedded && (
          <Tooltip title="Back to Clean · Split · Impute">
            <span>
              <Button
                variant="contained"
                startIcon={<ArrowBackIos sx={{ fontSize: '14px' }} />}
                onClick={() => navigate("/data_cleaning", {
                  state: { bdName, processedData: rows, columns: data?.columns }
                })}
                disabled={resetting || loading.action}
                sx={{
                  bgcolor: COLORS.accent,
                  '&:hover': { bgcolor: COLORS.accentDark },
                  fontWeight: 600,
                  minWidth: 160,
                }}
              >
                Clean · Split
              </Button>
            </span>
          </Tooltip>
          )}
          <Box>
            <Typography variant="h6" sx={{ color: COLORS.white, fontWeight: 700, lineHeight: 1.2 }}>
              Outlier Manager
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
              {bdName}
            </Typography>
          </Box>
        </Box>

        {/* Right: actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            onClick={() => setOpenHelpDialog(true)}
            disabled={resetting}
            sx={{ color: COLORS.white, borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: COLORS.white }, borderRadius: '2px' }}
          >
            Help
          </Button>

          {!embedded && (
          <Button
            variant="outlined"
            startIcon={<SaveIcon />}
            onClick={() => setSaveDialogOpen(true)}
            disabled={resetting}
            sx={{ color: COLORS.white, borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: COLORS.white } }}
          >
            Save Copy
          </Button>
          )}

          {embedded && onClose && (
            <Button
              variant="contained"
              color="success"
              onClick={onClose}
              sx={{ fontWeight: 700 }}
            >
              Done
            </Button>
          )}

          {!embedded && (
          <Button
            variant="contained"
            color="success"
            onClick={handleNext}
            endIcon={<ArrowForwardIos sx={{ fontSize: '14px' }} />}
            disabled={resetting || loading.action}
            sx={{ fontWeight: 700 }}
          >
            {loading.action ? "Processing…" : "Next Step"}
          </Button>
          )}
        </Box>
      </Box>

      {/* ===== SUCCESS / MODIFICATION PROTECTION ALERT ===== */}
      {success && (
        <Alert severity="success" icon={false} className="outlier-alert" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {modificationHistory.length > 0 && (
        <Alert
          severity="info"
          icon={false}
          className="outlier-alert"
          sx={{ mb: 2 }}
        >
          <Typography variant="body2">
            <strong>These cells are locked:</strong> {modificationHistory.length} value{modificationHistory.length > 1 ? 's have' : ' has'} already been changed and will not be changed again.
          </Typography>
        </Alert>
      )}

      {/* ===== WORKFLOW STEP INDICATOR ===== */}
      {!embedded && <WorkflowSteps currentStep={getWorkflowStep()} />}

      {/* ===== SECTION 1: DATA PREVIEW ===== */}
      <Paper sx={sectionStyle}>
        <SectionHeader
          icon={undefined}
          title="Data Preview"
          badge={rowCount ? `${rowCount.toLocaleString()} rows` : undefined}
          infoTitle="Data Table"
          infoContent="The table loads page by page. Pick a numeric column below to start."
        />
        <Box sx={sectionBodyStyle}>
          <div style={{ height: 380, width: '100%' }}>
            {isInitialized ? (
              <DataGrid
                rows={rows}
                columns={columns}
                getRowId={(row) => row.id}
                paginationMode="server"
                rowCount={rowCount}
                paginationModel={paginationModel}
                onPaginationModelChange={handlePageChange}
                pageSizeOptions={[25, 50, 100]}
                loading={loading.data || resetting}
              />
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            )}
          </div>
        </Box>
      </Paper>

      {/* ===== SECTION 2: COLUMN SELECTION ===== */}
      <Paper sx={sectionStyle}>
        <SectionHeader
          icon={undefined}
          title="Step 1: Select a Column for Analysis"
          infoTitle="Column Selection"
          infoContent="Choose a numeric column to analyze for outliers. Boolean columns (True/False) are automatically blocked. Columns used for train/test splitting are also disabled."
        />
        <Box sx={sectionBodyStyle}>
          <FormControl fullWidth>
            <InputLabel>Choose a numeric column</InputLabel>
            <Select
              value={selectedColumn ?? ''}
              onChange={async (e) => {
                const selectedIndex = e.target.value !== '' ? parseInt(e.target.value) : null;
                
                if (selectedIndex) {
                  // Check column type before selecting
                  setLoading(prev => ({ ...prev, columnType: true }));
                  setColumnTypeError("");
                  try {
                    const response = await axios.post(
                      `${backendUrl}/api/check-column-type`,
                      { bdName, columnIndex: selectedIndex },
                      { withCredentials: true }
                    );
                    
                    // If boolean, show alert and prevent selection
                    if (response.data.isBoolean === true) {
                      const colName = data?.columns[selectedIndex - 1] || `Column ${selectedIndex}`;
                      alert(`❌ Column "${colName}" is a BOOLEAN column.\n\nBoolean columns cannot be used for outlier detection because they only contain two values (True/False).\n\nPlease select a numeric column.`);
                      setSelectedColumn(null);
                      setIsNumericColumn(false);
                      setIsBooleanColumn(true);
                      setColumnTypeError(`"${colName}" is boolean: not supported`);
                      setLoading(prev => ({ ...prev, columnType: false }));
                      return;
                    }
                    
                    setIsBooleanColumn(false);
                    setIsNumericColumn(response.data.isNumeric);
                    setIsIntegerColumn(response.data.isInteger);
                    setColumnDataType(response.data.data_type || 'unknown');
                    
                    if (!response.data.isNumeric) {
                      setColumnTypeError(`Selected column is not numeric (type: ${response.data.data_type || 'unknown'})`);
                    } else {
                      setColumnTypeError("");
                    }
                  } catch (error) {
                    console.error("Error checking column type:", error);
                    setColumnTypeError("Error checking column type");
                  } finally {
                    setLoading(prev => ({ ...prev, columnType: false }));
                  }
                }
                
                setSelectedColumn(selectedIndex);
                setDetectedOutliers([]);
                setAllOutlierIds([]);
                setOutlierRowCount(0);
                setOutlierStats(null);
              }}
              label="Choose a numeric column"
              disabled={loading.columnType || resetting}
            >
              <MenuItem value="">Select a column</MenuItem>
              {data?.columns.map((colName, index) => {
                const dbIndex = index + 1;
                const isSplitColumn = colName.toLowerCase().includes('split');
                return (
                  <MenuItem key={index} value={dbIndex} disabled={isSplitColumn}>
                    {colName} {isSplitColumn && " (Split column: disabled)"}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          {loading.columnType && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">Checking column type…</Typography>
            </Box>
          )}

          {isBooleanColumn && (
            <Alert severity="error" icon={false} className="outlier-alert" sx={{ mt: 2 }}>
              <strong>True/false column:</strong> {columnTypeError || "Outlier detection needs a numeric column, not true/false."}
            </Alert>
          )}

          {selectedColumn !== null && !isNumericColumn && !isBooleanColumn && !loading.columnType && (
            <Alert severity="warning" icon={false} className="outlier-alert" sx={{ mt: 2 }}>
              This column is not numeric. Pick a numeric column to find outliers.
            </Alert>
          )}

          {selectedColumn !== null && isNumericColumn && !isBooleanColumn && !loading.columnType && (
            <Alert severity="success" icon={false} className="outlier-alert" sx={{ mt: 2 }}>
              This column is numeric.
            </Alert>
          )}
        </Box>
      </Paper>

      {/* ===== SECTIONS SHOWN ONLY WHEN NUMERIC COLUMN IS SELECTED ===== */}
      {selectedColumn !== null && isNumericColumn && !isBooleanColumn && (
        <>
          {/* Statistics */}
          <StatisticsCard />

          {/* Visualization */}
          <Paper sx={sectionStyle}>
            <SectionHeader
              title="Data Visualization"
              infoTitle="Charts"
              infoContent="Charts use every row, not only the current table page. Look at them before you pick a detection method."
            />
            <Box sx={sectionBodyStyle}>
              {renderVisualizationButton()}
            </Box>
          </Paper>

          {/* ===== SECTION 3: METHOD SELECTION ===== */}
          <Paper sx={sectionStyle}>
            <SectionHeader
              title="Step 2: Choose a Detection Method"
              infoTitle="Detection Methods"
              infoContent="Each method uses different math to define what counts as an outlier. IQR is recommended as a first try because it works well for skewed data. Use Modified Z-Score for data that already has some outliers."
            />
            <Box sx={sectionBodyStyle}>
                <Alert severity="info" icon={false} className="outlier-alert" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    If you are not sure, start with IQR. It works well on most tables.
                  </Typography>
                </Alert>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Detection Method</InputLabel>
                <Select
                  value={outlierMethod || ''}
                  onChange={(e) => setOutlierMethod(e.target.value || null)}
                  label="Detection Method"
                  disabled={!isNumericColumn || isBooleanColumn || resetting}
                >
                  <MenuItem value="">Select a method</MenuItem>
                  <MenuItem value="zscore">Z-Score: Flags values more than 3 std deviations from the mean</MenuItem>
                  <MenuItem value="iqr">IQR (Interquartile Range): Flags values outside Q1−1.5×IQR and Q3+1.5×IQR</MenuItem>
                  <MenuItem value="modified_zscore">Modified Z-Score: Uses median + MAD, robust to existing outliers</MenuItem>
                </Select>
              </FormControl>

              {outlierMethod === "modified_zscore" && (
                <Box sx={{
                  p: 2,
                  bgcolor: COLORS.bgSection,
                  borderRadius: '8px',
                  border: `1px solid ${COLORS.neutral}`,
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Sensitivity
                    </Typography>
                    <InfoButton
                      title="Threshold Setting"
                      content="Lower (2.5) flags more rows. Higher (4.5) flags fewer. 3.5 is a good start."
                    />
                  </Box>
                  <FormControl fullWidth size="small">
                    <InputLabel>Threshold value</InputLabel>
                    <Select
                      value={modifiedZScoreThreshold}
                      onChange={(e) => setModifiedZScoreThreshold(parseFloat(e.target.value))}
                      label="Threshold value"
                      disabled={resetting || isBooleanColumn}
                    >
                      <MenuItem value={2.5}>2.5: More sensitive (detects more outliers)</MenuItem>
                      <MenuItem value={3.0}>3.0</MenuItem>
                      <MenuItem value={3.5}>3.5: Default (recommended)</MenuItem>
                      <MenuItem value={4.0}>4.0</MenuItem>
                      <MenuItem value={4.5}>4.5: Less sensitive (detects fewer outliers)</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}
            </Box>
          </Paper>

          {/* ===== SECTION 4: DETECT BUTTON ===== */}
          <Paper sx={sectionStyle}>
            <SectionHeader
              title="Step 3: Run Outlier Detection"
              infoTitle="Detect Outliers"
              infoContent="Click to scan your entire dataset using the selected method. Parameters (mean, median, IQR) are calculated on the training split only to avoid data leakage. Results are paginated for performance."
            />
            <Box sx={sectionBodyStyle}>
              {!outlierMethod && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Please select a detection method above before running detection.
                </Alert>
              )}
              {isBooleanColumn && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <strong>Boolean column selected.</strong> Outlier detection is not available for boolean columns.
                </Alert>
              )}
              <Button
                variant="contained"
                onClick={() => detectOutliers(0)}
                disabled={!isNumericColumn || isBooleanColumn || !outlierMethod || loading.outliers || resetting}
                startIcon={loading.outliers ? <CircularProgress size={16} color="inherit" /> : undefined}
                size="large"
                sx={{
                  background: COLORS.primary,
                  fontWeight: 700,
                  px: 4,
                  py: 1.2,
                  '&:hover': { background: COLORS.primaryDark },
                }}
              >
                {loading.outliers ? "Detecting…" : "Detect Outliers"}
              </Button>
            </Box>
          </Paper>

          {/* ===== SECTION 5: RESULTS ===== */}
          {detectedOutliers.length > 0 && (
            <Paper sx={sectionStyle}>
              <SectionHeader
                icon={<WarningIcon />}
                title="Step 4: Review & Fix Detected Outliers"
                badge={`${outlierRowCount} found`}
                infoTitle="Detected Outliers"
                infoContent="Each row below is an outlier. Use the action buttons on each row for individual fixes, or use the bulk action buttons at the bottom to process all unmodified outliers at once. Once a row is modified, it is locked."
              />
              <Box sx={sectionBodyStyle}>

                {/* Stats summary */}
                {outlierStats && (
                  <Box sx={{
                    display: 'flex',
                    gap: 3,
                    mb: 2.5,
                    p: 2,
                    bgcolor: COLORS.bgSection,
                    borderRadius: '8px',
                    flexWrap: 'wrap',
                    border: `1px solid ${COLORS.neutral}`,
                  }}>
                    <StatItem label="Detection Method" value={outlierStats.method} />
                    <StatItem label="Threshold" value={outlierStats.threshold} />
                    <StatItem label="Outliers Found" value={outlierStats.count} />
                    <StatItem label="% of Data" value={`${(outlierStats.percentage * 100).toFixed(2)}%`} />
                    {((outlierStats?.modified_count ?? 0) > 0 || modificationHistory.length > 0) && (
                      <>
                        <StatItem
                          label="Already Modified"
                          value={outlierStats?.modified_count ?? 0}
                        />
                        <StatItem label="Still Unmodified" value={unmodifiedCount} />
                      </>
                    )}
                  </Box>
                )}

                {/* Legend for action buttons */}
                <Box sx={{
                  display: 'flex',
                  gap: 2,
                  mb: 2,
                  p: 1.5,
                  bgcolor: '#fff8f0',
                  borderRadius: '8px',
                  border: `1px dashed ${COLORS.accent}`,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: COLORS.accent }}>
                    ROW ACTIONS:
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DeleteForever fontSize="small" color="error" />
                    <Typography variant="caption">Delete row</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AutoFixHigh fontSize="small" color="primary" />
                    <Typography variant="caption">Replace with median</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', border: '1.5px solid purple',
                      borderRadius: '6px', overflow: 'hidden', height: 24,
                    }}>
                      <AutoFixHigh fontSize="small" sx={{ color: 'purple', px: 0.5 }} />
                      <Typography variant="caption" sx={{ px: 0.5, bgcolor: 'rgba(156,39,176,0.07)', borderLeft: '1px solid rgba(156,39,176,0.3)' }}>
                        Log ▾
                      </Typography>
                    </Box>
                    <Typography variant="caption">Transform (select type next to button)</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LockIcon fontSize="small" color="disabled" />
                    <Typography variant="caption">Already modified (locked)</Typography>
                  </Box>
                </Box>

                {/* Outlier DataGrid */}
                <div style={{ height: 400, width: '100%', marginBottom: '24px' }}>
                  <DataGrid
                    rows={detectedOutliers}
                    getRowId={(row) => row.id}
                    columns={[
                      {
                        field: 'actions',
                        headerName: 'Actions',
                        width: 420,
                        renderCell: (params) => <OutlierActionsCell row={params.row} disabled={resetting} />,
                        sortable: false,
                        filterable: false
                      },
                      ...columns.map((col, idx) => {
                        return {
                          ...col,
                          width: col.headerName === 'id' ? 100 : 150,
                          cellClassName: (params) => {
                            if (col.field === 'id') return '';
                            const colName = col.headerName;
                            const realColumnIndex = data?.columns.findIndex(c => c === colName);
                            if (realColumnIndex !== -1 && (realColumnIndex + 1) === selectedColumn) {
                              return 'highlighted-column';
                            }
                            return '';
                          }
                        };
                      })
                    ]}
                    paginationMode="server"
                    paginationModel={outlierPaginationModel}
                    onPaginationModelChange={handleOutlierPageChange}
                    pageSizeOptions={[25, 50, 100, 250, 500]}
                    rowCount={outlierRowCount}
                    loading={loading.outliers || loading.action || resetting}
                  />
                </div>

                {/* ===== BULK ACTIONS ===== */}
                <Divider sx={{ mb: 2.5 }}>
                  <Typography variant="caption" sx={{ px: 1, color: COLORS.accent, fontWeight: 700, letterSpacing: '0.05em' }}>
                    BULK ACTIONS: apply to all {unmodifiedCount} unchanged outliers in training rows
                  </Typography>
                </Divider>

                <Alert severity="info" icon={false} className="outlier-alert" sx={{ mb: 2 }}>
                  <Typography variant="caption">
                    These buttons change training rows only. Test rows stay as they are, so the later test remains a real check.
                  </Typography>
                </Alert>

                <Box sx={{
                  display: 'flex',
                  gap: 2,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                }}>
                  {/* Bulk Delete */}
                  <Tooltip title="Permanently delete all unmodified outlier rows from the dataset">
                    <span>
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<DeleteForever />}
                        onClick={() => applyBulkAction("delete")}
                        disabled={resetting || loading.action || unmodifiedCount === 0 || isBooleanColumn}
                        sx={{ minWidth: 220 }}
                      >
                        Delete All Unmodified ({unmodifiedCount})
                      </Button>
                    </span>
                  </Tooltip>

                  {/* Bulk Replace */}
                  <Tooltip title="Replace all unmodified outlier values with the training set median">
                    <span>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AutoFixHigh />}
                        onClick={() => applyBulkAction("replace")}
                        disabled={resetting || loading.action || unmodifiedCount === 0 || isBooleanColumn}
                        sx={{ minWidth: 260 }}
                      >
                        Replace All Unmodified with Median ({unmodifiedCount})
                      </Button>
                    </span>
                  </Tooltip>

                  {/* Bulk Transform: button + select grouped visually */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.75,
                    border: `2px solid`,
                    borderColor: 'secondary.main',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    minWidth: 240,
                    bgcolor: COLORS.white,
                  }}>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1.5,
                      pt: 1,
                      pb: 0.5,
                      bgcolor: 'rgba(156,39,176,0.06)',
                    }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: COLORS.primary }}>
                        Transform type
                      </Typography>
                    </Box>
                    <Box sx={{ px: 1.5, pb: 0.5 }}>
                      <FormControl fullWidth size="small">
                        <Select
                          value={transformationType}
                          onChange={(e) => setTransformationType(e.target.value)}
                          disabled={resetting || loading.action || isBooleanColumn}
                          sx={{ bgcolor: COLORS.white, '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}
                        >
                          <MenuItem value="log">Log: ln(x), reduces large values</MenuItem>
                          <MenuItem value="sqrt">Sqrt: √x, moderate reduction</MenuItem>
                          <MenuItem value="boxcox">Box-Cox: power transform</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={<AutoFixHigh />}
                      onClick={() => applyBulkAction("transform")}
                      disabled={resetting || loading.action || unmodifiedCount === 0 || isBooleanColumn}
                      sx={{
                        borderRadius: 0,
                        boxShadow: 'none',
                        py: 1,
                        fontWeight: 600,
                      }}
                    >
                      Transform All Unmodified ({unmodifiedCount})
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}
        </>
      )}

      {/* ===== MODIFICATIONS LOG ===== */}
      {modificationsLog.length > 0 && (
        <Paper sx={sectionStyle} className="modifications-log">
          <SectionHeader
            icon={undefined}
            title="Session Modifications Log"
            badge={`${modificationsLog.length}`}
            infoTitle="Modifications Log"
            infoContent="This log tracks all changes made to your data during this session. Only the last 10 actions are shown."
          />
          <Box sx={sectionBodyStyle}>
            <List dense>
              {modificationsLog.slice(-10).map((log, index) => (
                <ListItem key={index} className="modifications-log-item">
                  <ListItemText primary={log} />
                </ListItem>
              ))}
            </List>
          </Box>
        </Paper>
      )}

      {/* ===== MODIFICATION RESULTS ===== */}
      {modifiedRows.length > 0 && (
        <Paper sx={sectionStyle}>
          <SectionHeader
            icon={undefined}
            title="Modification Results"
            badge={`${modifiedRows.length}`}
            infoTitle="Modification Results"
            infoContent="Detailed view of all modifications applied to your data during this session. Up to 20 recent changes are shown."
          />
          <Box sx={sectionBodyStyle}>
            <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#f9f9f9', maxHeight: 400, overflow: 'auto' }}>
              <List dense>
                {modifiedRows.slice(-20).map((row, index) => (
                  <ListItem key={index} sx={{ py: 1 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body1" component="div">
                          <strong>Row {row.id}</strong>: {row.modifiedColumn || 'Unknown column'}:
                          {row.action === "delete" ? (
                            <>
                              <span style={{ textDecoration: 'line-through', color: 'red', margin: '0 8px' }}>
                                {row.originalValue !== null && row.originalValue !== undefined
                                  ? row.originalValue.toString() : 'N/A'}
                              </span>
                              <span style={{ color: 'red', marginLeft: '8px', fontWeight: 'bold' }}>
                                → DELETED
                              </span>
                            </>
                          ) : (
                            <>
                              <span style={{ textDecoration: 'line-through', color: 'red', margin: '0 8px' }}>
                                {row.originalValue !== null && row.originalValue !== undefined
                                  ? row.originalValue.toString() : 'N/A'}
                              </span>
                              →
                              <span style={{ color: 'green', marginLeft: '8px' }}>
                                {row.modifiedValue !== null && row.modifiedValue !== undefined
                                  ? row.modifiedValue.toString() : 'N/A'}
                              </span>
                            </>
                          )}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary">
                          Action: {row.action || 'Unknown action'}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Box>
        </Paper>
      )}

      {/* ===== BOTTOM NAV ===== */}
      {!embedded && (
      <Paper sx={{ p: 2, background: COLORS.white, border: `1px solid ${COLORS.neutral}`, borderRadius: '2px', boxShadow: 'none' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Tooltip title="Back to Clean · Split · Impute">
            <span>
              <Button
                variant="contained"
                startIcon={<ArrowBackIos sx={{ fontSize: '14px' }} />}
                onClick={() => navigate("/data_cleaning", {
                  state: { bdName, processedData: rows, columns: data?.columns }
                })}
                disabled={resetting || loading.action}
                sx={{ bgcolor: COLORS.accent, '&:hover': { bgcolor: COLORS.accentDark }, fontWeight: 600 }}
              >
                ← Clean · Split
              </Button>
            </span>
          </Tooltip>

          <Button
            variant="contained"
            color="success"
            onClick={handleNext}
            endIcon={<ArrowForwardIos sx={{ fontSize: '14px' }} />}
            disabled={resetting || loading.action}
            sx={{ fontWeight: 700 }}
          >
            {loading.action ? "Processing…" : "Next Step →"}
          </Button>
        </Box>
      </Paper>
      )}
    </div>
  );
}

export default Outlier_manager;