import React, { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import './Group_optimizer.css';
import SaveIcon from '@mui/icons-material/Save';

import { 
  Box,
  Typography, 
  Button, 
  TextField, 
  Checkbox, 
  Alert,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import { backendUrl } from "../config";
import { normalizeDatasetName, validateDatasetNameInput } from "../utils/datasetName";
import DatasetCheckpointControls from "../components/DatasetCheckpointControls";
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import HelpIcon from '@mui/icons-material/Help';
import TableChartIcon from '@mui/icons-material/TableChart';
import InfoIcon from '@mui/icons-material/Info';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import DatasetIcon from '@mui/icons-material/Dataset';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CloseIcon from '@mui/icons-material/Close';

function Group_optimizer({ embedded = false, onCheckpointReset }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { bdName, columns } = location.state || {};
  
  // États principaux
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingValues, setLoadingValues] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // États des données
  const [datasetInfo, setDatasetInfo] = useState({
    name: bdName,
    totalRows: 0,
    columns: Array.isArray(columns) ? columns : []
  });
  
  const [columnTypes, setColumnTypes] = useState({});
  const [selectedColumn, setSelectedColumn] = useState("");
  const [columnStats, setColumnStats] = useState({});
  
  // États pour les valeurs de colonne
  const [valueCounts, setValueCounts] = useState([]);
  const [selectedValues, setSelectedValues] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [valuePagination, setValuePagination] = useState({
    page: 0,
    pageSize: 150,
    totalDistinct: 0,
    hasMore: false
  });
  
  // États pour les filtres
  const [searchTerm, setSearchTerm] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isNumericColumn, setIsNumericColumn] = useState(false);
  const [minPct, setMinPct] = useState("");
  const [maxPct, setMaxPct] = useState("");
  const [selectAllGlobal, setSelectAllGlobal] = useState(false);
  
  // État pour l'erreur spécifique à l'action de remplacement
  const [replaceError, setReplaceError] = useState("");
  
  // États pour les aperçus
  const [previewRows, setPreviewRows] = useState([]);
  const [previewPagination, setPreviewPagination] = useState({
    page: 0,
    pageSize: 100,
    totalRows: 0
  });
  const [previewSearch, setPreviewSearch] = useState("");
  
  // États pour les dialogues
  const [helpOpen, setHelpOpen] = useState(false);
  const [autoHelpOpened, setAutoHelpOpened] = useState(false); // FIX: prevents re-opening after manual close
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewColumn, setPreviewColumn] = useState(null);
  
  // États pour sauvegarde
  const [copyName, setCopyName] = useState("");
  const [nameConflict, setNameConflict] = useState(false);
  const [existingTables, setExistingTables] = useState([]);
  const [datasetLimitReached, setDatasetLimitReached] = useState(false);
  const [saveCopyLoading, setSaveCopyLoading] = useState(false);
  
  // État pour les modifications
  const [hasChanges, setHasChanges] = useState(false);

  // ==================== FONCTIONS D'INITIALISATION ====================

  const loadColumnTypes = useCallback(async () => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/column-types?bdName=${encodeURIComponent(bdName)}`,
        { withCredentials: true }
      );
      
      const typesMap = {};
      if (response.data && response.data.columns) {
        response.data.columns.forEach(col => {
          typesMap[col.name] = col.type;
        });
      }
      setColumnTypes(typesMap);
      return typesMap;
    } catch (err) {
      console.error("Error loading column types:", err);
      return {};
    }
  }, [bdName]);

  const loadColumnStats = useCallback(async (columnName) => {
    if (!columnName) return;
    
    setLoadingStats(true);
    setError("");
    try {
      const response = await axios.post(
        `${backendUrl}/api/column-stats`,
        {
          bdName: bdName,
          columnIndex: columnName
        },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (response.data && typeof response.data === 'object') {
        setColumnStats(response.data);
        setIsNumericColumn(response.data.isNumeric || false);
        
        if (!response.data.isNumeric) {
          setMinValue("");
          setMaxValue("");
        }
      } else {
        setError("Received invalid statistics format from server");
      }
      
    } catch (err) {
      console.error("Error loading column stats:", err);
      let errorMessage = "Could not load column statistics";
      if (err.response?.data?.detail) {
        errorMessage = String(err.response.data.detail);
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setColumnStats({});
    } finally {
      setLoadingStats(false);
    }
  }, [bdName]);

  const loadValueCounts = useCallback(async (columnName, page = 0, search = "", min = "", max = "", pctMin = "", pctMax = "") => {
    if (!columnName) return;
    
    setLoadingValues(true);
    try {
      const payload = {
        bdName: bdName,
        column_name: columnName,
        search_term: search || "",
        min_value: min || null,
        max_value: max || null,
        min_pct: pctMin !== "" && pctMin != null ? parseFloat(pctMin) : null,
        max_pct: pctMax !== "" && pctMax != null ? parseFloat(pctMax) : null,
        page: page,
        page_size: valuePagination.pageSize
      };
      
      const response = await axios.post(
        `${backendUrl}/api/column-value-counts`,
        payload,
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      setValueCounts(response.data.value_counts || []);
      setValuePagination(prev => ({
        ...prev,
        page: response.data.page,
        totalDistinct: response.data.total_distinct,
        hasMore: response.data.has_more
      }));
      
      if (response.data.total_rows != null) {
        setDatasetInfo(prev => ({
          ...prev,
          totalRows: response.data.total_rows
        }));
      }
      
    } catch (err) {
      console.error("Error loading value counts:", err);
      setError("Could not load value distribution: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingValues(false);
    }
  }, [bdName, valuePagination.pageSize]);

  const loadColumnPreview = useCallback(async (columnName, page = 0, search = previewSearch) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/column-preview`,
        {
          bdName: bdName,
          column_name: columnName,
          page: page,
          page_size: previewPagination.pageSize,
          search_term: search || ""
        },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      setPreviewRows(response.data.rows || []);
      setPreviewPagination(prev => ({
        ...prev,
        page: response.data.page,
        totalRows: response.data.total_rows,
        pageSize: response.data.page_size
      }));
      
    } catch (err) {
      console.error("Error loading column preview:", err);
      setError("Could not load column preview");
    }
  }, [bdName, previewPagination.pageSize]);

  const checkDatasetLimit = useCallback(async () => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/check-dataset-limit`,
        { withCredentials: true }
      );
      
      setDatasetLimitReached(response.data.limit_reached);
      return response.data;
    } catch (error) {
      console.error("Error checking dataset limit:", error);
      return { limit_reached: false, count: 0 };
    }
  }, []);

  // ==================== EFFETS ====================

  useEffect(() => {
    if (!bdName) {
      navigate("/upload");
      return;
    }

    let cancelled = false;

    const initialize = async () => {
      setLoading(true);
      try {
        await loadColumnTypes();
        
        const response = await axios.get(
          `${backendUrl}/api/get-data_with-id?bdName=${encodeURIComponent(bdName)}&page=0&page_size=1`,
          { withCredentials: true }
        );
        
        if (cancelled) return;

        setDatasetInfo(prev => ({
          ...prev,
          totalRows: response.data.total_rows || 0,
          columns: response.data.columns || []
        }));
        
        if (response.data.columns && response.data.columns.length > 0) {
          setSelectedColumn((prev) => {
            if (prev && response.data.columns.includes(prev)) return prev;
            return response.data.columns[0];
          });
        }
      } catch (err) {
        console.error("Error initializing:", err);
        if (!cancelled) setError("Failed to load dataset");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initialize();
    return () => { cancelled = true; };
    // Intentionally only bdName: do NOT re-run when loadValueCounts identity changes (filter typing)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bdName, navigate]);

  // Load stats + value counts when the selected column changes (not on every keystroke)
  useEffect(() => {
    if (!selectedColumn || loading) return;
    loadColumnStats(selectedColumn);
    loadValueCounts(selectedColumn, 0, searchTerm, minValue, maxValue, minPct, maxPct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColumn, loading]);

  // Auto-open help dialog when page loads - only once!
  useEffect(() => {
    if (!loading && !helpOpen && !autoHelpOpened) {
      setHelpOpen(true);
      setAutoHelpOpened(true);
    }
  }, [loading, helpOpen, autoHelpOpened]);

  // Debounced filter reload: does NOT reset selectedColumn
  useEffect(() => {
    if (!selectedColumn || loading) return;
    
    const timer = setTimeout(() => {
      loadValueCounts(selectedColumn, 0, searchTerm, minValue, maxValue, minPct, maxPct);
    }, 500);
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, minValue, maxValue, minPct, maxPct]);

  useEffect(() => {
    if (valueCounts.length > 0 && selectAllGlobal) {
      // Si Select All global est actif, garder l'état coché
      setSelectAll(true);
    } else if (valueCounts.length > 0) {
      const allCurrentValues = valueCounts.map(v => v.value);
      const allSelected = allCurrentValues.length > 0 && 
                         allCurrentValues.every(value => selectedValues.includes(value)) &&
                         selectedValues.length >= valuePagination.totalDistinct &&
                         valuePagination.totalDistinct > 0;
      setSelectAll(allSelected || (selectAllGlobal && selectedValues.length > 0));
    } else {
      setSelectAll(false);
    }
  }, [valueCounts, selectedValues, selectAllGlobal, valuePagination.totalDistinct]);

  useEffect(() => {
    setReplaceError("");
  }, [newValue, selectedColumn]);

  // ==================== GESTIONNAIRES D'ÉVÉNEMENTS ====================

  const handleColumnChange = (event) => {
    const column = event.target.value;
    setSelectedColumn(column);
    setSelectedValues([]);
    setSelectAllGlobal(false);
    setSearchTerm("");
    setMinValue("");
    setMaxValue("");
    setMinPct("");
    setMaxPct("");
    setNewValue("");
    setReplaceError("");
    // stats + value counts are loaded by the selectedColumn effect
  };

  const handleValueSelection = (value) => {
    setSelectAllGlobal(false);
    setSelectedValues(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleSelectAll = async () => {
    if (selectAll || selectAllGlobal) {
      setSelectedValues([]);
      setSelectAllGlobal(false);
      setSelectAll(false);
      return;
    }

    // Select ALL matching values across every page (not just the current page)
    if (!selectedColumn) return;
    setLoadingValues(true);
    setReplaceError("");
    try {
      const total = Math.max(valuePagination.totalDistinct || 0, 1);
      const response = await axios.post(
        `${backendUrl}/api/column-value-counts`,
        {
          bdName,
          column_name: selectedColumn,
          search_term: searchTerm || "",
          min_value: minValue || null,
          max_value: maxValue || null,
          min_pct: minPct !== "" ? parseFloat(minPct) : null,
          max_pct: maxPct !== "" ? parseFloat(maxPct) : null,
          page: 0,
          page_size: Math.min(Math.max(total, 500), 100000),
        },
        { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
      );
      const allVals = (response.data.value_counts || []).map((v) => v.value);
      setSelectedValues(allVals);
      setSelectAllGlobal(true);
      setSelectAll(true);
      setSuccess(`Selected all ${allVals.length} matching values across the dataset`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setReplaceError(err.response?.data?.detail || "Could not select all values");
    } finally {
      setLoadingValues(false);
    }
  };

  const handleFilter = () => {
    if (!isNumericColumn) {
      setError("Range filtering is only available for numeric columns.");
      return;
    }
    
    const min = parseFloat(minValue);
    const max = parseFloat(maxValue);
    
    if (isNaN(min) && isNaN(max)) {
      setError("Please enter at least one valid numeric value for the filter.");
      return;
    }
    
    if (!isNaN(min) && !isNaN(max) && min > max) {
      setError("Minimum value cannot be greater than maximum value.");
      return;
    }
    
    loadValueCounts(selectedColumn, 0, searchTerm, minValue, maxValue);
    setSelectedValues([]);
    setError("");
  };

  const handleResetFilter = () => {
    setMinValue("");
    setMaxValue("");
    setMinPct("");
    setMaxPct("");
    setSearchTerm("");
    setSelectAllGlobal(false);
    setSelectedValues([]);
    loadValueCounts(selectedColumn, 0, "", "", "", "", "");
    setError("");
  };

  const handleApplyPctFilter = () => {
    setSelectAllGlobal(false);
    setSelectedValues([]);
    loadValueCounts(selectedColumn, 0, searchTerm, minValue, maxValue, minPct, maxPct);
  };

  const handleReplaceValues = async () => {
    setReplaceError("");
    
    if (!selectedColumn) {
      setReplaceError("Please select a column.");
      return;
    }
    
    if (selectedValues.length === 0) {
      setReplaceError("Please select at least one value to replace.");
      return;
    }
    
    let valueToSend = newValue;
    
    if (isNumericColumn) {
      if (newValue === "" || 
          newValue === null || 
          newValue === undefined ||
          newValue.toLowerCase() === "none" ||
          newValue.toLowerCase() === "null" ||
          newValue.toLowerCase() === "na" ||
          newValue.toLowerCase() === "n/a" ||
          newValue.toLowerCase() === "nan") {
        valueToSend = null;
      } 
      else {
        const numericValue = parseFloat(newValue);
        if (isNaN(numericValue)) {
          setReplaceError(
            `Cannot replace with text value '${newValue}' in numeric column '${selectedColumn}'. ` +
            `Please enter a valid number or empty value (null).`
          );
          return;
        }
        valueToSend = numericValue;
      }
    }
    
    setLoadingAction(true);
    try {
      const response = await axios.post(
        `${backendUrl}/api/replace-values`,
        {
          bdName: bdName,
          column_name: selectedColumn,
          old_values: selectedValues,
          new_value: valueToSend
        },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      setSuccess(`Successfully replaced ${response.data.affected_rows} rows!`);
      setHasChanges(true);
      setSelectedValues([]);
      setNewValue("");
      setReplaceError("");
      
      await loadColumnStats(selectedColumn);
      await loadValueCounts(selectedColumn, 0, searchTerm, minValue, maxValue);
      
      setTimeout(() => setSuccess(""), 5000);
      
    } catch (err) {
      console.error("Error replacing values:", err);
      const backendMsg = err.response?.data?.detail || "Could not replace values";
      setReplaceError(backendMsg);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteRows = async () => {
    if (!selectedColumn) {
      setReplaceError("Please select a column.");
      return;
    }
    
    if (selectedValues.length === 0) {
      setReplaceError("Please select at least one value to delete.");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete all rows containing the selected ${selectedValues.length} values?`)) {
      return;
    }
    
    setLoadingAction(true);
    try {
      const response = await axios.post(
        `${backendUrl}/api/delete-rows`,
        {
          bdName: bdName,
          column_name: selectedColumn,
          values_to_delete: selectedValues
        },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      setSuccess(`Successfully deleted ${response.data.deleted_rows} rows!`);
      setHasChanges(true);
      setSelectedValues([]);
      setReplaceError("");
      
      await loadColumnStats(selectedColumn);
      await loadValueCounts(selectedColumn, 0, searchTerm, minValue, maxValue);
      
      setDatasetInfo(prev => ({
        ...prev,
        totalRows: Math.max(0, prev.totalRows - response.data.deleted_rows)
      }));
      
      setTimeout(() => setSuccess(""), 5000);
      
    } catch (err) {
      console.error("Error deleting rows:", err);
      setReplaceError(err.response?.data?.detail || "Could not delete rows");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleOpenPreview = (columnName) => {
    setPreviewColumn(columnName);
    setPreviewSearch("");
    loadColumnPreview(columnName, 0, "");
    setPreviewDialogOpen(true);
  };

  const handleResetDatabase = async () => {
    if (!bdName) {
      setError("Database name is missing!");
      return;
    }
    
    if (!window.confirm(`Reset "${bdName}" to the last checkpoint (_reset)? Unsaved working changes will be lost.`)) return;
    
    setLoadingAction(true);
    try {
      const resetResponse = await axios.post(
        `${backendUrl}/api/dataset/reset-to-checkpoint`,
        { 
          source_db: bdName
        },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (resetResponse.data.status === "success") {
        setSuccess("Database reset successfully! Refreshing data...");
        setHasChanges(false);
        
        await loadColumnStats(selectedColumn);
        await loadValueCounts(selectedColumn, 0, searchTerm, minValue, maxValue);
        
        setTimeout(() => setSuccess(""), 5000);
      }
      
    } catch (error) {
      setError(`Reset failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSaveCopy = async (overwrite = false) => {
    const nameError = validateDatasetNameInput(copyName);
    if (nameError) {
      setError(nameError);
      return;
    }
    const normalizedName = normalizeDatasetName(copyName);
    
    setSaveCopyLoading(true);
    try {
      const response = await axios.post(
        `${backendUrl}/api/save-dataset-copy`,
        {
          source_db: bdName,
          copy_name: normalizedName,
          copy_type: "group_optimizer",
          overwrite: overwrite
        },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (response.data.status === "success") {
        setSuccess(`Dataset copy "${normalizedName}" ${response.data.action} successfully!`);
        setSaveDialogOpen(false);
        setNameConflict(false);
        setTimeout(() => setSuccess(""), 5000);
      }
    } catch (error) {
      console.error("Save copy error:", error);
      
      const errorData = error.response?.data;
      
      if (error.response?.status === 400 && errorData?.detail?.type === "name_exists") {
        setNameConflict(true);
        setExistingTables(errorData.detail.existing_tables || []);
        setError(errorData.detail.message || "This dataset name already exists");
      } 
      else if (errorData?.detail && String(errorData.detail).includes("limit")) {
        setDatasetLimitReached(true);
        setError(String(errorData.detail));
      }
      else if (errorData?.detail) {
        setError(String(errorData.detail));
      }
      else {
        setError("Failed to save copy. Please try again.");
      }
    } finally {
      setSaveCopyLoading(false);
    }
  };

  const handleContinue = async () => {
    setLoadingAction(true);
    let resetSuccess = false;
    
    try {
      await axios.post(
        `${backendUrl}/api/update-stage`,
        { bdName: bdName, newStage: "data_cleaning" },
        { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
      );

      try {
        await axios.post(
          `${backendUrl}/api/reset-id-column-sequential`,
          { bdName: bdName, idColumnName: "id" },
          { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
        );
        resetSuccess = true;
      } catch (resetError) {
        console.error("Error resetting IDs:", resetError);
      }

      await axios.post(
        `${backendUrl}/api/dataset/save-checkpoint`,
        { source_db: bdName },
        { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
      );

      await new Promise(resolve => setTimeout(resolve, 500));

      navigate("/data_preparation", {
        state: {
          bdName,
          initialTab: 2,
          columns: datasetInfo.columns,
          idsReset: resetSuccess
        }
      });

    } catch (error) {
      console.error("Continue error:", error);
      setError(`Error preparing data for next step: ${error.response?.data?.message || error.message}`);
      setLoadingAction(false);
    }
  };

  // ==================== RENDU ====================

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <CircularProgress size={60} sx={{ mb: 3 }} />
        <Typography variant="h6">Loading dataset information...</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          {bdName}
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="group_optimizer-container">
      {/* Header avec titre et actions */}
      <Box className="group_optimizer-header dp-tab-toolbar">
        <Typography variant="h6" className="group_optimizer-title dp-tab-toolbar-title" sx={{ color: '#384850', fontWeight: 700 }}>
          Groups
        </Typography>
        
        <Box className="header-actions-bar dp-tab-toolbar-actions">
            <Tooltip title="View full dataset">
              <Button 
                variant="outlined"
                startIcon={<TableChartIcon />} 
                onClick={() => setTableDialogOpen(true)}
                sx={{ height: 40, textTransform: 'none', borderColor: '#384850', color: '#384850', fontWeight: 600 }}
              >
                View Dataset
              </Button>
            </Tooltip>
            
            <Tooltip title="Help guide">
              <Button 
                variant="outlined"
                startIcon={<HelpIcon />} 
                onClick={() => {
                  setAutoHelpOpened(true);
                  setHelpOpen(true);
                }}
                sx={{ height: 40, textTransform: 'none', borderColor: '#384850', color: '#384850', fontWeight: 600 }}
              >
                Help
              </Button>
            </Tooltip>

            <DatasetCheckpointControls
              bdName={bdName}
              copyType="group_optimizer"
              disabled={loadingAction}
              showSave={false}
              onResetSuccess={async (msg) => {
                setSuccess(msg || "Database reset successfully!");
                setHasChanges(false);
                if (selectedColumn) await loadColumnStats(selectedColumn);
                onCheckpointReset?.();
                setTimeout(() => setSuccess(""), 4000);
              }}
              onError={(msg) => setError(msg)}
            />
            
            {!embedded && (
            <Tooltip title="Continue to Clean · Split · Impute">
              <Button 
                variant="contained"
                endIcon={<ArrowForwardIcon />} 
                onClick={handleContinue}
                disabled={loadingAction}
                sx={{ height: 40, textTransform: 'none', backgroundColor: '#384850', '&:hover': { backgroundColor: '#2c383f' } }}
              >
                Continue
              </Button>
            </Tooltip>
            )}
        </Box>
      </Box>

      {/* Status messages */}
      {error && (
        <Alert severity="error" className="status-alert" onClose={() => setError("")}>
          <ErrorIcon sx={{ mr: 1 }} />
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" className="status-alert" onClose={() => setSuccess("")}>
          <CheckCircleIcon sx={{ mr: 1 }} />
          {success}
        </Alert>
      )}

      {/* Dataset Info Bar - margins réduites */}
      <Paper className="dataset-info-bar" elevation={2}>
        <Grid container spacing={1} alignItems="center">
          <Grid item>
            <Chip 
              icon={<DatasetIcon />} 
              label={`Dataset: ${bdName}`} 
              sx={{ backgroundColor: 'rgba(222, 107, 6, 0.1)', color: '#DE6B06', fontWeight: 500 }}
              size="small"
            />
          </Grid>
          <Grid item>
            <Chip 
              icon={<InfoIcon />} 
              label={`${datasetInfo.totalRows.toLocaleString()} rows`} 
              variant="outlined"
              size="small"
            />
          </Grid>
          <Grid item>
            <Chip 
              icon={<TableChartIcon />} 
              label={`${datasetInfo.columns?.length || 0} columns`} 
              variant="outlined"
              size="small"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Main Content */}
      <Grid container spacing={2} className="main-content">
        {/* Left Panel - Column Selection & Stats */}
        <Grid item xs={12} md={4}>
          <Card className="left-panel-card">
            <CardContent>
              <Typography variant="h6" className="panel-title">
                <ShowChartIcon sx={{ mr: 1 }} />
                Column Analysis
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <FormControl fullWidth className="column-selector">
                <InputLabel>Select Column to Analyze</InputLabel>
                <Select
                  value={selectedColumn}
                  onChange={handleColumnChange}
                  label="Select Column to Analyze"
                >
                  {datasetInfo.columns && datasetInfo.columns.map((col) => (
                    <MenuItem key={col} value={col}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <span style={{ flex: 1 }}>{col}</span>
                        <Chip 
                          size="small" 
                          label={columnTypes[col] || 'text'} 
                          variant="outlined"
                          sx={{ ml: 1, fontSize: '0.7rem' }}
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedColumn && (
                <>
                  {loadingStats ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                      <CircularProgress size={40} />
                    </Box>
                  ) : (
                    <>
                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={6}>
                          <Paper className="stat-card" variant="outlined">
                            <Typography variant="caption" color="textSecondary">
                              Total Values
                            </Typography>
                            <Typography variant="h6">
                              {columnStats.totalRows?.toLocaleString() || '-'}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6}>
                          <Paper className="stat-card" variant="outlined">
                            <Typography variant="caption" color="textSecondary">
                              Unique Values
                            </Typography>
                            <Typography variant="h6">
                              {columnStats.uniqueValues?.toLocaleString() || '-'}
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      {columnStats.isNumeric && columnStats.min !== undefined && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Numeric Statistics
                          </Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={4}>
                              <Typography variant="caption" color="textSecondary">Min</Typography>
                              <Typography variant="body2">{columnStats.min?.toFixed(2)}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="caption" color="textSecondary">Max</Typography>
                              <Typography variant="body2">{columnStats.max?.toFixed(2)}</Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="caption" color="textSecondary">Mean</Typography>
                              <Typography variant="body2">{columnStats.mean?.toFixed(2)}</Typography>
                            </Grid>
                            {columnStats.median && (
                              <Grid item xs={4}>
                                <Typography variant="caption" color="textSecondary">Median</Typography>
                                <Typography variant="body2">{columnStats.median?.toFixed(2)}</Typography>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      )}

                      <Box sx={{ mt: 3 }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          startIcon={<VisibilityIcon />}
                          onClick={() => handleOpenPreview(selectedColumn)}
                          sx={{ 
                            mb: 1,
                            borderColor: '#DE6B06',
                            color: '#DE6B06',
                            '&:hover': {
                              borderColor: '#c55a05',
                              backgroundColor: 'rgba(222, 107, 6, 0.1)'
                            }
                          }}
                        >
                          Preview Column Values
                        </Button>
                      </Box>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Panel - Value Distribution & Actions */}
        <Grid item xs={12} md={8}>
          <Card className="right-panel-card">
            <CardContent>
              <Typography variant="h6" className="panel-title">
                <DatasetIcon sx={{ mr: 1 }} />
                Value Distribution: {selectedColumn || 'Select a column'}
              </Typography>
              
              <Divider sx={{ my: 2 }} />

              {selectedColumn ? (
                <>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={isNumericColumn ? 4 : 6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Search values"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon fontSize="small" />
                            </InputAdornment>
                          ),
                          endAdornment: searchTerm && (
                            <InputAdornment position="end">
                              <IconButton size="small" onClick={() => setSearchTerm("")}>
                                <ClearIcon fontSize="small" />
                              </IconButton>
                            </InputAdornment>
                          )
                        }}
                      />
                    </Grid>
                    
                    {isNumericColumn && (
                      <>
                        <Grid item xs={5} md={2}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Min"
                            type="number"
                            value={minValue}
                            onChange={(e) => setMinValue(e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={5} md={2}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Max"
                            type="number"
                            value={maxValue}
                            onChange={(e) => setMaxValue(e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={2} md={2}>
                          <Button
                            fullWidth
                            variant="contained"
                            onClick={handleFilter}
                            disabled={!minValue && !maxValue}
                            sx={{ 
                              height: '40px',
                              backgroundColor: '#DE6B06',
                              '&:hover': { backgroundColor: '#c55a05' }
                            }}
                          >
                            <FilterAltIcon />
                          </Button>
                        </Grid>
                      </>
                    )}
                    
                    <Grid item xs={12} md={isNumericColumn ? 2 : 6}>
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={handleResetFilter}
                        disabled={!searchTerm && !minValue && !maxValue && !minPct && !maxPct}
                        sx={{ height: '40px' }}
                      >
                        <RefreshIcon sx={{ mr: 1 }} />
                        Reset
                      </Button>
                    </Grid>
                  </Grid>

                  {/* Frequency % filter: show values below / above a share of the dataset */}
                  <Grid container spacing={1} sx={{ mt: 1, mb: 1 }} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Min frequency %"
                        value={minPct}
                        onChange={(e) => setMinPct(e.target.value)}
                        inputProps={{ min: 0, max: 100, step: 0.1 }}
                        helperText="e.g. 1 = at least 1% of rows"
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Max frequency %"
                        value={maxPct}
                        onChange={(e) => setMaxPct(e.target.value)}
                        inputProps={{ min: 0, max: 100, step: 0.1 }}
                        helperText="e.g. 1 = at most 1% of rows (rare)"
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={handleApplyPctFilter}
                        disabled={!selectedColumn || (!minPct && !maxPct)}
                        sx={{ height: 40, backgroundColor: '#DE6B06', '&:hover': { backgroundColor: '#c55a05' }, textTransform: 'none' }}
                      >
                        Filter by %
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Typography variant="caption" color="text.secondary">
                        Filter values by how frequent they are, then use Select All + Replace or Delete.
                      </Typography>
                    </Grid>
                  </Grid>

                  <TableContainer component={Paper} variant="outlined" className="value-table-container">
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox" width="50px">
                            <Tooltip title="Select ALL matching values across every page (not just this page)">
                              <Checkbox
                              checked={selectAll || selectAllGlobal}
                              onChange={handleSelectAll}
                              indeterminate={selectedValues.length > 0 && !(selectAll || selectAllGlobal)}
                              disabled={valueCounts.length === 0 && valuePagination.totalDistinct === 0}
                              sx={{ color: '#DE6B06', '&.Mui-checked': { color: '#DE6B06' } }}
                            />
                            </Tooltip>
                          </TableCell>
                          <TableCell>Value {selectAllGlobal && <Chip size="small" label="all pages" color="warning" sx={{ ml: 1 }} />}</TableCell>
                          <TableCell align="right" width="120px">Count</TableCell>
                          <TableCell align="right" width="100px">Percentage</TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {loadingValues ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                              <CircularProgress size={40} />
                            </TableCell>
                          </TableRow>
                        ) : valueCounts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                              <Typography color="textSecondary">
                                No values match the current filters
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          valueCounts.map((item) => {
                            const percentage = datasetInfo.totalRows > 0 
                              ? ((item.count / datasetInfo.totalRows) * 100).toFixed(2) 
                              : "0.00";
                            
                            return (
                              <TableRow 
                                key={item.value}
                                hover
                                selected={selectedValues.includes(item.value)}
                                className="value-table-row"
                              >
                                <TableCell padding="checkbox">
                                  <Checkbox
                                    checked={selectedValues.includes(item.value)}
                                    onChange={() => handleValueSelection(item.value)}
                                    sx={{ color: '#DE6B06', '&.Mui-checked': { color: '#DE6B06' } }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Tooltip title={item.value} placement="top">
                                    <span className="value-cell">
                                      {item.value && item.value.length > 50 
                                        ? `${item.value.substring(0, 50)}...` 
                                        : item.value || '[Empty]'}
                                    </span>
                                  </Tooltip>
                                </TableCell>
                                <TableCell align="right">{item.count.toLocaleString()}</TableCell>
                                <TableCell align="right">{percentage}%</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                      Showing {valueCounts.length} of {valuePagination.totalDistinct} distinct values
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        onClick={() => loadValueCounts(selectedColumn, valuePagination.page - 1)}
                        disabled={valuePagination.page === 0 || loadingValues}
                      >
                        Previous
                      </Button>
                      <Button
                        size="small"
                        onClick={() => loadValueCounts(selectedColumn, valuePagination.page + 1)}
                        disabled={!valuePagination.hasMore || loadingValues}
                      >
                        Next
                      </Button>
                    </Box>
                  </Box>

                  <Paper variant="outlined" sx={{ mt: 3, p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Selected: {selectedValues.length} values
                      {selectAllGlobal ? " (all matching pages)" : ""} •
                      Affecting: {selectAllGlobal
                        ? "all matching rows"
                        : valueCounts
                            .filter(v => selectedValues.includes(v.value))
                            .reduce((sum, v) => sum + v.count, 0)
                      } {selectAllGlobal ? "" : "rows"}
                    </Typography>
                    
                    {replaceError && (
                      <Alert severity="error" sx={{ mb: 2 }} onClose={() => setReplaceError("")}>
                        {replaceError}
                      </Alert>
                    )}
                    
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="New replacement value"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          placeholder="Enter new value..."
                          error={!!replaceError && replaceError.includes("Cannot replace")}
                        />
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={handleReplaceValues}
                          disabled={selectedValues.length === 0 || loadingAction}
                          sx={{ 
                            height: '40px',
                            backgroundColor: '#DE6B06',
                            '&:hover': { backgroundColor: '#c55a05' }
                          }}
                        >
                          {loadingAction ? <CircularProgress size={24} /> : 'Replace'}
                        </Button>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Button
                          fullWidth
                          variant="contained"
                          color="error"
                          onClick={handleDeleteRows}
                          disabled={selectedValues.length === 0 || loadingAction}
                          startIcon={<DeleteIcon />}
                          sx={{ height: '40px' }}
                        >
                          {loadingAction ? <CircularProgress size={24} /> : 'Delete Rows'}
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 5 }}>
                  <InfoIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                  <Typography color="textSecondary">
                    Select a column to analyze its value distribution
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ==================== DIALOGUES ==================== */}

      {/* Full Dataset Dialog */}
      <Dialog 
        open={tableDialogOpen} 
        onClose={() => setTableDialogOpen(false)} 
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: '#384850', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TableChartIcon />
            Dataset Preview: {bdName}
          </Typography>
          <IconButton onClick={() => setTableDialogOpen(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2, mt: 1 }}>
          <FullDatasetPreview 
            bdName={bdName}
            columns={datasetInfo.columns}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setTableDialogOpen(false)}
            variant="contained"
            sx={{ backgroundColor: '#384850', textTransform: 'none', fontWeight: 600, '&:hover': { backgroundColor: '#2c383f' } }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Column Preview Dialog */}
      <Dialog 
        open={previewDialogOpen} 
        onClose={() => setPreviewDialogOpen(false)} 
        maxWidth="md"
        fullWidth
        className="dialog"
      >
        <DialogTitle className="dialog-title">
          <VisibilityIcon sx={{ mr: 1 }} />
          Column Preview: {previewColumn}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Search in column"
              value={previewSearch}
              onChange={(e) => {
                setPreviewSearch(e.target.value);
                loadColumnPreview(previewColumn, 0, e.target.value);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Box>
          
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="80px">ID</TableCell>
                  <TableCell>Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>
                      {row.value === null || row.value === undefined ? (
                        <Chip label="NULL" size="small" variant="outlined" />
                      ) : (
                        String(row.value)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            <Typography variant="body2" color="textSecondary">
              Showing {previewRows.length} of {previewPagination.totalRows} rows
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                onClick={() => loadColumnPreview(previewColumn, previewPagination.page - 1, previewSearch)}
                disabled={previewPagination.page === 0}
              >
                Previous
              </Button>
              <Button
                size="small"
                onClick={() => loadColumnPreview(previewColumn, previewPagination.page + 1, previewSearch)}
                disabled={(previewPagination.page + 1) * previewPagination.pageSize >= previewPagination.totalRows}
              >
                Next
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Help Dialog */}
      <Dialog 
        open={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: '#384850', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
            <HelpIcon />
            Guide: Groups (optional)
          </Typography>
          <IconButton onClick={() => setHelpOpen(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ p: 0 }}>
            <Typography variant="body1" paragraph>
              <strong>What is this page for?</strong>
            </Typography>
            <Typography variant="body2" paragraph>
              Clean up and organize values in a column: fix inconsistent labels, replace or delete values,
              filter by frequency, and group rare categories into &quot;Other&quot;.
            </Typography>

            <Typography variant="body1" paragraph mt={2}>
              <strong>Select All</strong>
            </Typography>
            <Typography variant="body2" paragraph>
              Select All selects <strong>every matching value across all pages</strong> (not only the current page),
              then Replace / Delete applies to the full selection.
            </Typography>

            <Typography variant="body1" paragraph mt={2}>
              <strong>Frequency % filter</strong>
            </Typography>
            <Typography variant="body2" paragraph>
              Use Min / Max frequency % to keep only values that appear less (or more) often than a share of the dataset.
              Example: Max = 1% to list rare values, then Select All + Replace with &quot;Other&quot;.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom sx={{ color: '#384850', fontWeight: 700 }}>
              Step by Step
            </Typography>
            
            <Typography variant="body2" paragraph>
              <strong>1. Choose a Column</strong><br />
              Pick a column on the left. Stats show totals, unique values, and for numeric columns min/max/mean.
            </Typography>

            <Typography variant="body2" paragraph>
              <strong>2. Find values</strong><br />
              Search, range filter (numeric), or Min/Max frequency %. Check boxes, or Select All for every matching value.
            </Typography>

            <Typography variant="body2" paragraph>
              <strong>3. Act</strong><br />
              Replace or Delete selected values.
            </Typography>

            <Alert severity="info" sx={{ mt: 3 }}>
              Changes apply to the full dataset in the database. Use Reset to restore the stage start state.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setHelpOpen(false)}
            variant="contained"
            fullWidth
            size="large"
            sx={{
              backgroundColor: '#384850',
              textTransform: 'none',
              fontWeight: 700,
              '&:hover': { backgroundColor: '#2c383f' },
            }}
          >
            Got it
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save Copy Dialog */}
      <Dialog 
        open={saveDialogOpen} 
        onClose={() => {
          setSaveDialogOpen(false);
          setError("");
          setNameConflict(false);
          setDatasetLimitReached(false);
        }} 
        maxWidth="sm"
        fullWidth
        className="dialog"
      >
        <DialogTitle className="dialog-title">
          <SaveIcon sx={{ mr: 1 }} />
          Save Dataset Copy
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Save the current state with all transformations applied.
          </Typography>
          
          <TextField
            autoFocus
            fullWidth
            label="Dataset Name"
            value={copyName}
            onChange={(e) => {
              setCopyName(e.target.value);
              setNameConflict(false);
              setError("");
            }}
            variant="outlined"
            error={nameConflict}
            helperText={nameConflict ? "This name is already used" : "Enter a unique name for your dataset"}
            sx={{ mb: 2 }}
          />
          
          {nameConflict && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                Name already exists
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  size="small" 
                  variant="outlined"
                  onClick={() => {
                    const timestamp = new Date().getTime();
                    setCopyName(`${copyName}_${timestamp}`);
                    setNameConflict(false);
                  }}
                >
                  Generate unique name
                </Button>
                <Button 
                  size="small" 
                  variant="contained"
                  onClick={() => handleSaveCopy(true)}
                  disabled={saveCopyLoading}
                  sx={{ backgroundColor: '#DE6B06', '&:hover': { backgroundColor: '#c55a05' } }}
                >
                  Overwrite
                </Button>
              </Box>
            </Alert>
          )}
          
          {datasetLimitReached && (
            <Alert severity="error">
              You have reached the maximum dataset limit (10/10).
              Please delete some datasets from your dashboard.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => handleSaveCopy(false)}
            variant="contained"
            disabled={saveCopyLoading || !copyName.trim() || nameConflict || datasetLimitReached}
            sx={{ backgroundColor: '#DE6B06', '&:hover': { backgroundColor: '#c55a05' } }}
          >
            {saveCopyLoading ? <CircularProgress size={24} /> : 'Save Copy'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ==================== COMPOSANT POUR L'APERÇU COMPLET ====================

function FullDatasetPreview({ bdName, columns }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 0,
    pageSize: 50,
    totalRows: 0
  });

  useEffect(() => {
    loadPage(0);
  }, [bdName]);

  const loadPage = async (page) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${backendUrl}/api/get-data_with-id?bdName=${encodeURIComponent(bdName)}&page=${page}&page_size=${pagination.pageSize}`,
        { withCredentials: true }
      );
      
      setData(response.data);
      setPagination(prev => ({
        ...prev,
        page: response.data.page,
        totalRows: response.data.total_rows
      }));
    } catch (error) {
      console.error("Error loading preview:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '60vh' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              {data?.columns?.map((col) => (
                <TableCell key={col}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.rows?.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                {data.columns.map((col, idx) => (
                  <TableCell key={col}>
                    {row[`col${idx}`] === null || row[`col${idx}`] === undefined ? (
                      <Chip label="NULL" size="small" variant="outlined" />
                    ) : (
                      String(row[`col${idx}`])
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Typography variant="body2" color="textSecondary">
          Page {pagination.page + 1} of {Math.ceil(pagination.totalRows / pagination.pageSize)} • 
          Total: {pagination.totalRows.toLocaleString()} rows
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            onClick={() => loadPage(pagination.page - 1)}
            disabled={pagination.page === 0}
          >
            Previous
          </Button>
          <Button
            size="small"
            onClick={() => loadPage(pagination.page + 1)}
            disabled={(pagination.page + 1) * pagination.pageSize >= pagination.totalRows}
          >
            Next
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default Group_optimizer;