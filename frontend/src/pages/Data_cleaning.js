import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { DataGrid } from "@mui/x-data-grid";
import './Data_cleaning.css';
import SaveIcon from '@mui/icons-material/Save';
import ClearIcon from '@mui/icons-material/Clear';

import {
  Dialog,
  TextField,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Button,
  Box,
  Chip,
  Alert,
  Snackbar,
  Tooltip,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Checkbox,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from "@mui/material";
import {
  HelpOutline,
  Refresh,
  Close,
  Delete,
  Save,
  NavigateNext,
  NavigateBefore,
  AutoFixNormal,
  FilterList,
  Warning,
  PlayArrow,
  CheckCircle,
  Visibility,
  AutoFixHigh,
} from "@mui/icons-material";

import { backendUrl } from "../config";
import { normalizeDatasetName, validateDatasetNameInput } from "../utils/datasetName";
import AutoCleanSplitDialog from "../components/AutoCleanSplitDialog";
import DatasetCheckpointControls from "../components/DatasetCheckpointControls";
import "./Data_cleaning.css";

const MISSING_VALUES = ['nan', 'nat', 'null', 'none', 'na', 'NA', 'n/a', 'missing', 'unknown', '-', '--', '?', ''];

function Data_cleaning({ embedded = false, onSplitChange, onGoToGroups, onCheckpointReset }) {
  // États existants
  const [data, setData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [originalDataRows, setOriginalDataRows] = useState([]);
  const [emptyRowsCount, setEmptyRowsCount] = useState(0);
  const [duplicatedRowsCount, setDuplicatedRowsCount] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const bdName = location.state?.bdName;
  const [modifications, setModifications] = useState(new Map());
  const [selectedRows, setSelectedRows] = useState([]);
  const [isSaved, setIsSaved] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });
  const [openHelpDialog, setOpenHelpDialog] = useState(false);
  const [stats, setStats] = useState({ totalRows: 0, totalColumns: 0 });
  const [targetColumn, setTargetColumn] = useState(null);
  const [availableTargetColumns, setAvailableTargetColumns] = useState([]);
  const [isSupervised, setIsSupervised] = useState(false);
  const [cellEditInProgress, setCellEditInProgress] = useState(false);
  const [checkingSplitStatus, setCheckingSplitStatus] = useState(false);
  const [openSplitDialog, setOpenSplitDialog] = useState(false);
  const [openAutoCleanSplit, setOpenAutoCleanSplit] = useState(false);
  const [emptyLikeFindings, setEmptyLikeFindings] = useState([]);
  const [emptyLikeTokens, setEmptyLikeTokens] = useState(MISSING_VALUES.filter(Boolean));

  const [openSaveConfirmDialog, setOpenSaveConfirmDialog] = useState(false);
  const [openEmptyValuesDialog, setOpenEmptyValuesDialog] = useState(false);
  const [hasValidSplit, setHasValidSplit] = useState(false);
  const [splitColumnStatus, setSplitColumnStatus] = useState({
    exists: false,
    hasValues: false,
    trainCount: 0,
    testCount: 0
  });
const [autoHelpOpened, setAutoHelpOpened] = useState(false); 
  const [splitConfig, setSplitConfig] = useState({
    trainSize: 70,
    splitMethod: "random",
    useSeed: false,
    seedValue: 42,
    balanceClasses: false,
    balanceMethod: "oversampling",
    targetColumn: null,
  });
  const [splitCompleted, setSplitCompleted] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitStats, setSplitStats] = useState(null);
  const [imputationMethod, setImputationMethod] = useState("");
  const [openImputationDialog, setOpenImputationDialog] = useState(false);
  const [ignoreOutliersForMean, setIgnoreOutliersForMean] = useState(true);
  const [selectedColumnsForImputation, setSelectedColumnsForImputation] = useState([]);

  const [datasetInfo, setDatasetInfo] = useState(null);
  const [imputationPreview, setImputationPreview] = useState(null);
  const [applyingImputation, setApplyingImputation] = useState(false);
  const [openDeleteWarningDialog, setOpenDeleteWarningDialog] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState(null);
  const [deleteColumnDialogOpen, setDeleteColumnDialogOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState(null);
  const [isDeletingColumn, setIsDeletingColumn] = useState(false);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState(1);

  // États pour la pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRows, setTotalRows] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // États pour la sauvegarde de copie
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [nameConflict, setNameConflict] = useState(false);
  const [existingTables, setExistingTables] = useState([]);
  const [overwriteMode, setOverwriteMode] = useState(false);
  const [datasetLimitReached, setDatasetLimitReached] = useState(false);
  const [datasetCount, setDatasetCount] = useState(0);
  const [saveCopyLoading, setSaveCopyLoading] = useState(false); 
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");











 const fetchSplitStats = useCallback(async () => {
  if (!bdName) return false;
  
  try {
    console.log("📊 Fetching split stats for entire dataset:", bdName);
    const response = await axios.get(
      `${backendUrl}/api/get-split-stats2`,
      { 
        params: { bdName },
        withCredentials: true 
      }
    );
    
    console.log("📊 Split stats response:", response.data);
    
    if (response.data.exists) {
      const valid = response.data.train_count > 0;
      const newSplitStatus = {
        exists: true,
        hasValues: response.data.train_count > 0 || response.data.test_count > 0,
        trainCount: response.data.train_count,
        testCount: response.data.test_count,
        validationCount: response.data.validation_count || 0,
        totalRows: response.data.total_rows,
        message: `Found ${response.data.train_count} train, ${response.data.test_count} test rows`
      };
      
      setSplitColumnStatus(newSplitStatus);
      setHasValidSplit(valid);
      setSplitCompleted(valid);
      
      console.log("✅ Split stats updated:", newSplitStatus);
      return valid;
    } else {
      setSplitColumnStatus({
        exists: false,
        hasValues: false,
        trainCount: 0,
        testCount: 0,
        totalRows: 0,
        message: "No split_type column found"
      });
      setHasValidSplit(false);
      setSplitCompleted(false);
      return false;
    }
  } catch (error) {
    console.error("Error fetching split stats:", error);
    return false;
  }
}, [bdName]);

// Load split status once per dataset (not on every splitCompleted flip)
useEffect(() => {
  if (bdName) {
    fetchSplitStats();
  }
}, [bdName, fetchSplitStats]);
useEffect(() => {
  // Only auto-open once when page loads and help hasn't been auto-opened yet
  if (!loading && !openHelpDialog && !autoHelpOpened) {
    setOpenHelpDialog(true);
    setAutoHelpOpened(true);
  }
}, [loading, openHelpDialog, autoHelpOpened]);
  const showSnackbar = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

 const isMissingValue = useCallback((value, columnField) => {
  // Ignorer la colonne split_type pour la détection des valeurs vides
  if (columnField && columnField.includes('split_type')) {
    return false;
  }
  
  // Cas spéciaux
  if (value === false) return false;
  if (value === 0) return false;
  
  // Valeurs null/undefined
  if (value === null || value === undefined) return true;
  
  // Chaînes vides ou composées uniquement d'espaces
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return true;
    
    // Valeurs comme 'nan', 'null', 'none', etc.
    const lowercased = trimmed.toLowerCase();
    return MISSING_VALUES.includes(lowercased);
  }
  
  // Pour les nombres, vérifier s'ils sont NaN
  if (typeof value === 'number' && isNaN(value)) return true;
  
  // Pour les objets, vérifier s'ils sont null
  if (typeof value === 'object' && value === null) return true;
  
  return false;
}, []);

  // ==================== CONVERSION DES DONNÉES ====================

  const convertToGridFormat = useCallback((backendData) => {
    if (!backendData || !backendData.columns || !backendData.rows) {
      console.error("❌ Invalid data format in convertToGridFormat:", backendData);
      return { columns: [], rows: [] };
    }

    console.log("🔄 Converting data with columns:", backendData.columns);
    console.log("🔄 Rows count:", backendData.rows.length);
    console.log("🔄 Sample raw row:", backendData.rows[0]);

    // Filtrer les lignes null/undefined
    const validRows = backendData.rows.filter(row => row !== null && row !== undefined);
    
    if (validRows.length === 0) {
      console.warn("⚠️ No valid rows found");
      return { columns: [], rows: [] };
    }

    // Créer les colonnes pour le DataGrid
    const gridColumns = backendData.columns.map((colName, index) => {
      const field = `col${index}`;
      const isSplitType = colName.toLowerCase().includes('split_type');
      
      return {
        field: field,
        headerName: colName,
        width: 150,
        editable: !isSplitType && colName !== 'id',
        type: 'string',
        renderCell: (params) => {
          const value = params.value;
          
          if (value === null || value === undefined) {
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Chip 
                  label="NULL" 
                  size="small" 
                  variant="outlined"
                  sx={{ backgroundColor: '#f5f5f5' }}
                />
              </Box>
            );
          }
          
          if (typeof value === 'boolean') {
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
                <Chip 
                  label={value ? 'TRUE' : 'FALSE'} 
                  color={value ? 'success' : 'default'}
                  size="small"
                  variant="outlined"
                />
              </Box>
            );
          }
          
          if (isSplitType) {
            let chipColor = 'default';
            if (value === 'train') chipColor = 'primary';
            else if (value === 'test') chipColor = 'secondary';
            else if (value === 'validation') chipColor = 'success';
            
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
                <Chip 
                  label={value?.toUpperCase() || 'N/A'} 
                  color={chipColor}
                  size="small" 
                  sx={{ 
                    fontWeight: 'bold',
                    minWidth: '60px'
                  }}
                />
              </Box>
            );
          }
          
          if (colName === 'id') {
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Chip 
                  label={`ID: ${value}`} 
                  size="small" 
                  color="primary"
                  variant="outlined"
                />
              </Box>
            );
          }
          
          // Vérifier si c'est une valeur manquante
          const isMissing = isMissingValue(value, field);
          
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Typography sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {String(value)}
              </Typography>
              {isMissing && <Warning color="warning" sx={{ fontSize: 16, ml: 1 }} />}
            </Box>
          );
        }
      };
    });

    // Créer les lignes pour le DataGrid avec des IDs garantis uniques
    const gridRows = validRows.map((row, rowIndex) => {
      // S'assurer que l'ID est valide
      let rowId;
      if (row && row.id !== undefined && row.id !== null) {
        rowId = row.id;
      } else {
        // Générer un ID unique basé sur l'index
        rowId = `row-${Date.now()}-${rowIndex}`;
      }
      
      const rowData = { 
        id: rowId,
        originalId: row?.id,
        _originalIndex: rowIndex
      };

      backendData.columns.forEach((colName, colIndex) => {
        const colKey = `col${colIndex}`;
        let value = row && row[colName] !== undefined ? row[colName] : null;
        
        // IMPORTANT: Conserver les valeurs telles quelles pour la détection des vides
        // Ne pas convertir les chaînes vides en null
        if (typeof value === 'string') {
          if (value.toLowerCase() === 'true') {
            rowData[colKey] = true;
          } else if (value.toLowerCase() === 'false') {
            rowData[colKey] = false;
          } else {
            rowData[colKey] = value; // Garder la valeur originale, même si c'est une chaîne vide
          }
        } else {
          rowData[colKey] = value;
        }
      });

      return rowData;
    });

    console.log(`✅ Converted ${gridRows.length} rows for grid`);
    if (gridRows.length > 0) {
      console.log("📋 Sample converted row:", gridRows[0]);
      
      // Vérifier les valeurs vides dans la première ligne
      const firstRow = gridRows[0];
      const emptyColumns = backendData.columns.filter((colName, idx) => {
        const value = firstRow[`col${idx}`];
        return isMissingValue(value, `col${idx}`);
      });
      console.log("📋 Empty columns in first row:", emptyColumns);
    }

    return { columns: gridColumns, rows: gridRows };
  }, [isMissingValue]);

  // ==================== FONCTIONS DE CHARGEMENT DES DONNÉES ====================

const fetchStats = useCallback(async () => {
  if (!bdName) return null;
  
  try {
    console.log("📊 Fetching stats for:", bdName);
    const response = await axios.get(
      `${backendUrl}/api/get-stats`,
      { 
        params: { bdName },
        withCredentials: true 
      }
    );
    
    console.log("📊 Stats response:", response.data);
    
    setStats({
      totalRows: response.data.total_rows,
      totalColumns: response.data.total_columns
    });
    setEmptyRowsCount(response.data.empty_count);
    setDuplicatedRowsCount(response.data.duplicate_count);

    // Empty-like scan can be slow on huge tables: do not block the UI on it
    axios
      .get(`${backendUrl}/api/detect-empty-like-values`, {
        params: { bdName },
        withCredentials: true,
      })
      .then((el) => {
        setEmptyLikeTokens(el.data?.tokens || []);
        setEmptyLikeFindings(el.data?.findings || []);
      })
      .catch((elErr) => {
        console.warn("empty-like detection failed:", elErr);
      });

    return response.data;
  } catch (error) {
    console.error("Error fetching stats:", error);
    return null;
  }
}, [bdName]);

  const fetchPaginatedData = useCallback(async (pageNum = 1, filterType = selectedFilter) => {
    if (!bdName) return;
    
    console.log(`📊 Fetching page ${pageNum} with filter: ${filterType || 'none'}`);
    setIsLoadingMore(true);
    if (pageNum === 1) setLoading(true);
    
    try {
        const response = await axios.get(
            `${backendUrl}/api/get-data-paginated`,
            {
                params: {
                    bdName,
                    page: pageNum,
                    page_size: pageSize,
                    filter_type: filterType
                },
                withCredentials: true
            }
        );
        
        if (response.data && response.data.rows) {
            const { columns: gridColumns, rows: gridRows } = convertToGridFormat(response.data);
            setRows(gridRows);
            setOriginalDataRows(gridRows);
            setColumns(gridColumns);
            setData(response.data);
            
            // Utiliser les métadonnées de pagination renvoyées par le backend
            const pagination = response.data.pagination;
            setTotalRows(pagination.total_rows);
            setHasMore(pagination.has_next);
            setPage(pagination.current_page);
            
            await fetchStats();
        } else {
            showSnackbar("Invalid data format received", "error");
        }
    } catch (error) {
        console.error("❌ Error fetching paginated data:", error);
        showSnackbar("Error loading data: " + (error.response?.data?.detail || error.message), "error");
    } finally {
        setLoading(false);
        setIsLoadingMore(false);
    }
}, [bdName, pageSize, selectedFilter, convertToGridFormat, fetchStats]);
  // ==================== USE EFFECTS ====================

  useEffect(() => {
    if (!bdName) {
      console.log("🚫 No bdName, redirecting to upload");
      navigate("/upload");
      return;
    }
    
    console.log("🚀 Initializing Data_cleaning for:", bdName);
    console.log("📍 Location state:", location.state);
    
    fetchPaginatedData(1, null);
  }, [bdName, navigate]);

  useEffect(() => {
    if (bdName && selectedFilter !== undefined) {
      console.log("🔄 Filter changed to:", selectedFilter);
      fetchPaginatedData(1, selectedFilter);
    }
  }, [selectedFilter]);

  useEffect(() => {
    if (rows.length > 0) {
      console.log("✅ Data loaded successfully!");
      console.log("📋 Number of rows in state:", rows.length);
      console.log("📋 Number of columns in state:", columns.length);
      console.log("📋 Sample row:", rows[0]);
      console.log("📋 Sample column:", columns[0]);
      
      // Diagnostic des valeurs vides
      const emptyCheck = rows.slice(0, 5).map(row => {
        const emptyCols = columns.filter(col => isMissingValue(row[col.field], col.field));
        return {
          rowId: row.id,
          emptyColumns: emptyCols.map(c => c.headerName),
          values: emptyCols.map(c => row[c.field])
        };
      });
      console.log("📋 Empty values diagnostic (first 5 rows):", emptyCheck);
      
    } else if (!loading) {
      console.warn("⚠️ No rows loaded, but loading is false");
      console.log("Current state:", { 
        bdName, 
        page, 
        pageSize, 
        selectedFilter,
        totalRows 
      });
    }
  }, [rows, columns, loading, bdName, page, pageSize, selectedFilter, totalRows, isMissingValue]);

  useEffect(() => {
    if (splitCompleted) {
      setCurrentWorkflowStep(3);
    } else if (emptyRowsCount === 0 && duplicatedRowsCount === 0) {
      setCurrentWorkflowStep(2);
    } else {
      setCurrentWorkflowStep(1);
    }
  }, [splitCompleted, emptyRowsCount, duplicatedRowsCount]);

  

  useEffect(() => {
    if (bdName) {
      fetchDatasetInfo();
    }
  }, [bdName]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const dataGrid = document.querySelector('.data-grid-container');
      if (cellEditInProgress && dataGrid && !dataGrid.contains(event.target)) {
        setCellEditInProgress(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [cellEditInProgress]);

  useEffect(() => {
    if (saveDialogOpen) {
      checkDatasetLimit();
      if (bdName) {
        const defaultName = `${bdName}_data_cleaning`;
        setCopyName(defaultName);
      }
    }
  }, [saveDialogOpen, bdName]);

  // ==================== FONCTIONS DE FILTRE ====================

  const handleFilterClick = useCallback((filterType) => {
    console.log("🔍 Filter clicked:", filterType);
    setSelectedFilter(current => {
      const newFilter = current === filterType ? null : filterType;
      console.log("🔄 New filter:", newFilter);
      return newFilter;
    });
  }, []);

  // ==================== FONCTIONS DE MODIFICATION ====================

  const handleProcessRowUpdate = useCallback((newRow, oldRow) => {
    if (!newRow || !newRow.id) {
      console.error("❌ Invalid row in handleProcessRowUpdate:", newRow);
      return oldRow;
    }
    
    console.log("✏️ Row updated:", newRow.id);
    
    setModifications((prev) => {
      const updatedModifications = new Map(prev);
      updatedModifications.set(newRow.id, { newRow, oldRow });
      return updatedModifications;
    });

    setRows(prev => prev.map((row) => (row && row.id === newRow.id ? newRow : row)));
    setIsSaved(false);
    setHasUnsavedChanges(true);

    return newRow;
  }, []);

  const handleSaveChanges = useCallback(async () => {
    try {
      console.log("💾 Starting save process...");
      setLoading(true);
      
      const modifiedRowsArray = Array.from(modifications.values()).map(m => m.newRow).filter(row => row && row.id);
      
      if (modifiedRowsArray.length === 0) {
        showSnackbar("No changes to save", "info");
        setLoading(false);
        return;
      }
      
      const rowsToSave = modifiedRowsArray.map(row => {
        const realId = row.originalId !== undefined && row.originalId !== null ? row.originalId : row.id;
        const cleanRow = { id: realId };
        
        if (data && data.columns) {
          data.columns.forEach((colName, colIndex) => {
            const colKey = `col${colIndex}`;
            let value = row[colKey];
            
            if (value === null || value === undefined || value === "") {
              cleanRow[colName] = null;
            } else {
              cleanRow[colName] = value;
            }
          });
        }
        
        return cleanRow;
      });

      console.log("📤 Sending to backend:", rowsToSave.length, "rows");
      
      const response = await axios.post(
        `${backendUrl}/api/update-rows-batch`,
        {
          bdName: bdName,
          rows: rowsToSave
        },
        { withCredentials: true }
      );

      console.log("✅ Save response:", response.data);

      if (response.status === 200) {
        setModifications(new Map());
        setIsSaved(true);
        setHasUnsavedChanges(false);
        showSnackbar('Changes saved successfully!', 'success');
        
        await fetchPaginatedData(page, selectedFilter);
        await fetchStats();
        onSplitChange?.();
      }
    } catch (error) {
      console.error('❌ Error saving:', error);
      showSnackbar(`Error saving: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [bdName, data, modifications, page, selectedFilter, fetchPaginatedData, fetchStats, onSplitChange]);

  const handleDeleteSelectedRows = useCallback(async () => {
    if (selectedRows.length === 0) return;
    
    try {
      setLoading(true);
      
      const response = await axios.post(
        `${backendUrl}/api/delete-rows-paginated`,
        {
          bdName,
          row_ids: selectedRows
        },
        { withCredentials: true }
      );

      if (response.status === 200) {
        setSelectedRows([]);
        showSnackbar(`${selectedRows.length} rows deleted successfully!`, 'success');
        
        await fetchPaginatedData(1, selectedFilter);
        await fetchStats();
        onSplitChange?.();
      }
    } catch (error) {
      console.error('Error deleting rows:', error);
      showSnackbar(`Error: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedRows, bdName, selectedFilter, fetchPaginatedData, fetchStats, onSplitChange]);

  // ==================== FONCTIONS DE SUPPRESSION PAR FILTRE ====================

const prepareConfirmation = useCallback(async (actionType) => {
  // Ne pas utiliser les données frontend, mais faire une requête API
  let title = "";
  let message = "";
  let affectedRows = 0;
  let action = null;
  let previewRows = [];

  console.log(`🔍 Preparing confirmation for action: ${actionType}`);
  
  try {
    setLoading(true);
    
    // Requête API pour obtenir les lignes concernées
    const response = await axios.get(
      `${backendUrl}/api/get-filtered-rows-preview`,
      {
        params: {
          bdName,
          filter_type: actionType === 'empty' ? 'empty' : 
                       actionType === 'duplicated' ? 'duplicates' : 
                       actionType === 'auto' ? 'auto' : null,
          limit: 100 // Limiter à 100 lignes pour la prévisualisation
        },
        withCredentials: true
      }
    );

    if (response.data) {
      const { rows: filteredRows, total_count, empty_count, duplicate_count } = response.data;
      
      console.log("📦 Filtered rows from backend:", filteredRows);
      
      // Convertir les données au format DataGrid
      const backendData = {
        columns: response.data.columns || columns.map(c => c.headerName),
        rows: filteredRows
      };
      
      const { rows: gridRows } = convertToGridFormat(backendData);
      
      // IMPORTANT: Ajouter le rowType à chaque ligne convertie
      previewRows = gridRows.map((row, index) => {
        // Trouver la ligne correspondante dans filteredRows pour récupérer rowType
        const originalRow = filteredRows.find(r => r.id === row.originalId) || filteredRows[index];
        return {
          ...row,
          rowType: originalRow?.rowType || (actionType === 'empty' ? 'empty' : 
                   actionType === 'duplicated' ? 'duplicated' : 
                   actionType === 'auto' ? (index < empty_count ? 'empty' : 'duplicated') : '')
        };
      });
      
      affectedRows = total_count;
      
      switch (actionType) {
        case "empty":
          title = "Confirm deletion of empty rows";
          message = `This will delete ${affectedRows} rows with empty values. This action cannot be undone.`;
          action = handleDeleteEmptyRows;
          break;
          
        case "duplicated":
          title = "Confirm deletion of duplicated rows";
          message = `This will delete ${affectedRows} duplicated rows (keeping the first occurrence of each). This action cannot be undone.`;
          action = handleDeleteDuplicatedRows;
          break;
          
        
          
        default:
          return;
      }

      setPreviewData(previewRows.slice(0, 100));
      setDialogConfig({
        title,
        message,
        action,
        affectedRows
      });
      
      if (affectedRows > 0) {
        setOpenConfirmDialog(true);
      } else {
        showSnackbar(`No ${actionType} rows found to delete`, "info");
      }
      
      console.log(`✅ Confirmation dialog prepared with ${previewRows.length} preview rows`);
      console.log("🎨 Preview rows with rowType:", previewRows.map(r => ({ id: r.id, rowType: r.rowType })));
    }
  } catch (error) {
    console.error("❌ Error fetching filtered rows preview:", error);
    showSnackbar(`Error: ${error.response?.data?.detail || error.message}`, "error");
  } finally {
    setLoading(false);
  }
}, [bdName, columns, convertToGridFormat, showSnackbar]);

  const [dialogConfig, setDialogConfig] = useState({
    title: "",
    message: "",
    action: null,
    affectedRows: 0
  });

  const handleConfirmAction = useCallback(async () => {
    setOpenConfirmDialog(false);
    if (dialogConfig.action) {
      await dialogConfig.action();
    }
  }, [dialogConfig]);

const deletableColumns = useMemo(() => {
  const cols = data?.columns || [];
  const target = (datasetInfo?.target_column || "").toLowerCase();
  return cols.filter((col) => {
    const name = String(col || "").toLowerCase();
    if (!name || name === "id" || name === "split_type") return false;
    if (target && name === target) return false;
    return true;
  });
}, [data?.columns, datasetInfo?.target_column]);

const handleDeleteColumn = useCallback(async () => {
  if (!columnToDelete || !bdName) return;
  setIsDeletingColumn(true);
  try {
    const response = await axios.post(
      `${backendUrl}/api/delete-column`,
      {
        originalBdName: bdName,
        currentBdName: bdName,
        columnName: columnToDelete,
      },
      { withCredentials: true }
    );
    showSnackbar(response.data?.message || `Column "${columnToDelete}" deleted`, "success");
    setDeleteColumnDialogOpen(false);
    setColumnToDelete(null);
    await fetchPaginatedData(1, selectedFilter);
    await fetchStats();
    onSplitChange?.();
  } catch (error) {
    console.error("Error deleting column:", error);
    showSnackbar(
      `Error: ${error.response?.data?.detail || error.message}`,
      "error"
    );
  } finally {
    setIsDeletingColumn(false);
  }
}, [columnToDelete, bdName, selectedFilter, fetchPaginatedData, fetchStats, onSplitChange, showSnackbar]);

const handleDeleteEmptyRows = useCallback(async () => {
  try {
    setLoading(true);
    
    const response = await axios.post(
      `${backendUrl}/api/delete-filtered-rows`,
      {
        bdName,
        filter_type: "empty"
      },
      { withCredentials: true }
    );

    if (response.status === 200) {
      showSnackbar(response.data.message, "success");
      
      // Recharger la première page après suppression
      await fetchPaginatedData(1, selectedFilter);
      const statsData = await fetchStats();
      onSplitChange?.({
        emptyRowsCount:
          typeof statsData?.empty_count === "number" ? statsData.empty_count : 0,
      });
    }
  } catch (error) {
    console.error("❌ Deletion error:", error);
    showSnackbar(`Error: ${error.response?.data?.detail || error.message}`, "error");
  } finally {
    setLoading(false);
  }
}, [bdName, selectedFilter, fetchPaginatedData, fetchStats, onSplitChange]);

const handleDeleteDuplicatedRows = useCallback(async () => {
  try {
    setLoading(true);
    
    const response = await axios.post(
      `${backendUrl}/api/delete-filtered-rows`,
      {
        bdName,
        filter_type: "duplicates"
      },
      { withCredentials: true }
    );

    if (response.status === 200) {
      showSnackbar(response.data.message, "success");
      
      await fetchPaginatedData(1, selectedFilter);
      await fetchStats();
      onSplitChange?.();
    }
  } catch (error) {
    console.error("❌ Deletion error:", error);
    showSnackbar(`Error: ${error.response?.data?.detail || error.message}`, "error");
  } finally {
    setLoading(false);
  }
}, [bdName, selectedFilter, fetchPaginatedData, fetchStats, onSplitChange]);


  // ==================== FONCTIONS DE SPLIT ====================

  const checkSplitColumnStatus = useCallback(() => {
    if (!rows.length) {
      console.log("❌ No rows available to check split column");
      return;
    }

    try {
      console.log("🔍 Checking split column status from local data...");
      
      const splitColumn = columns.find(col => 
        col.field.includes('split_type') || 
        (col.headerName && col.headerName.toLowerCase().includes('split_type'))
      );

      console.log("🔎 Split column search result:", splitColumn);
      
      if (!splitColumn) {
        setSplitColumnStatus({
          exists: false,
          hasValues: false,
          trainCount: 0,
          testCount: 0,
          message: "No split_type column found"
        });
        setHasValidSplit(false);
        setSplitCompleted(false);
        return;
      }

      const splitValues = rows.map(row => row[splitColumn.field]).filter(val => val !== null && val !== undefined);

      const valueAnalysis = splitValues.reduce((acc, value) => {
        if (value === null || value === undefined) {
          acc.null++;
        } else if (value === '') {
          acc.empty++;
        } else if (value === 'N/A' || value === 'n/a') {
          acc.na++;
        } else if (value && value.toString().toLowerCase() === 'train') {
          acc.train++;
        } else if (value && value.toString().toLowerCase() === 'test') {
          acc.test++;
        } else if (value && value.toString().toLowerCase() === 'validation') {
          acc.validation++;
        } else {
          acc.other++;
        }
        return acc;
      }, { null: 0, empty: 0, na: 0, train: 0, test: 0, validation: 0, other: 0 });

      const trainCount = valueAnalysis.train;
      const testCount = valueAnalysis.test;
      const validationCount = valueAnalysis.validation;
      
      const hasValues = trainCount > 0 || testCount > 0 || validationCount > 0;
      const hasValidValues = trainCount > 0;
      
      setSplitColumnStatus({
        exists: true,
        hasValues: hasValues,
        trainCount: trainCount,
        testCount: testCount,
        validationCount: validationCount,
        totalRows: rows.length,
        nullCount: valueAnalysis.null,
        emptyCount: valueAnalysis.empty,
        naCount: valueAnalysis.na,
        otherCount: valueAnalysis.other,
        message: `Found ${trainCount} train, ${testCount} test, ${validationCount} validation rows`
      });

      setHasValidSplit(hasValidValues);
      setSplitCompleted(hasValidValues);

    } catch (error) {
      console.error("💥 Error checking local split column:", error);
      setSplitColumnStatus({
        exists: false,
        hasValues: false,
        trainCount: 0,
        testCount: 0,
        error: true,
        message: "Error analyzing local data: " + error.message
      });
      setHasValidSplit(false);
      setSplitCompleted(false);
    }
  }, [rows, columns]);

  const fetchDatasetInfo = useCallback(async () => {
    try {
      const targetResponse = await axios.get(
        `${backendUrl}/api/get-target-column2?dbName=${bdName}`,
        { withCredentials: true }
      );
      
      let targetColumnValue = null;
      let hasTargetColumn = false;
      const rawTarget = targetResponse.data?.target_column;
      const isUnsupervised =
        !!targetResponse.data?.is_unsupervised ||
        rawTarget === "no-target-column" ||
        targetResponse.data?.model_type === "unsupervised";

      // Real target only: ignore the unsupervised sentinel
      if (rawTarget && rawTarget !== "no-target-column" && !isUnsupervised) {
        targetColumnValue = rawTarget;
        hasTargetColumn = true;
      }
      
      setDatasetInfo({
        target_column: targetColumnValue,
        has_target_column: hasTargetColumn
      });
      
      setIsSupervised(hasTargetColumn);
      
      if (targetColumnValue) {
        setSplitConfig(prev => ({ 
          ...prev, 
          targetColumn: targetColumnValue 
        }));
      }
      
      if (data && data.columns) {
        setAvailableTargetColumns(data.columns);
      }
      
    } catch (error) {
      console.error("Error fetching target column:", error);
      try {
        const fallbackResponse = await axios.get(
          `${backendUrl}/api/get-target-column?dbName=${bdName}`,
          { withCredentials: true }
        );
        
        if (fallbackResponse.data && fallbackResponse.data.target_column) {
          setDatasetInfo({
            target_column: fallbackResponse.data.target_column,
            has_target_column: true
          });
          setIsSupervised(true);
          setSplitConfig(prev => ({ 
            ...prev, 
            targetColumn: fallbackResponse.data.target_column 
          }));
        } else {
          setIsSupervised(false);
        }
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        setIsSupervised(false);
      }
    }
  }, [bdName, data]);

  const handleOpenSplitDialog = () => {
    setOpenSplitDialog(true);
  };

const handleApplySplit = async () => {
  try {
    setIsSplitting(true);
    
    if (splitConfig.splitMethod === "stratified" && !splitConfig.targetColumn) {
      showSnackbar("Target column is required for stratified split", "error");
      setIsSplitting(false);
      return;
    }

    const requestPayload = {
      bdName,
      trainSize: splitConfig.trainSize / 100,
      splitMethod: splitConfig.splitMethod,
      useSeed: splitConfig.useSeed,
      seedValue: splitConfig.seedValue,
      balanceClasses: splitConfig.balanceClasses,
      balanceMethod: splitConfig.balanceMethod,
      targetColumn: splitConfig.targetColumn
    };

    const response = await axios.post(
      `${backendUrl}/api/split-data2`,
      requestPayload,
      { withCredentials: true }
    );

    // Prefer summary returned by the split API (no extra heavy query needed for UI state)
    const summary = response.data?.summary;
    const stats = response.data?.statistics;
    let trainCount = Number(summary?.train_rows || 0);
    let testCount = Number(summary?.test_rows || 0);
    if (!trainCount && !testCount) {
      if (Array.isArray(stats)) {
        for (const row of stats) {
          const n = Number(row.count || 0);
          if (row.split_type === "train") trainCount += n;
          else if (row.split_type === "test") testCount += n;
        }
      }
    }

    setSplitStats(stats);
    setSplitCompleted(true);
    setHasValidSplit(true);
    setSplitColumnStatus({
      exists: true,
      hasValues: trainCount > 0 || testCount > 0,
      trainCount,
      testCount,
      validationCount: Number(summary?.validation_rows || 0),
      totalRows: Number(summary?.total_rows || trainCount + testCount),
      message: `Train ${trainCount.toLocaleString()} · Test ${testCount.toLocaleString()}`,
    });
    onSplitChange?.({ hasValidSplit: true });

    setOpenSplitDialog(false);
    showSnackbar(
      summary?.train_ratio
        ? `Split done: Train ${(summary.train_ratio * 100).toFixed(0)}% / Test ${(summary.test_ratio * 100).toFixed(0)}%. Refreshing table…`
        : "Dataset split completed successfully! Refreshing the table…",
      "success"
    );

    // Table refresh only (counts already known from split response)
    await fetchPaginatedData(1, selectedFilter);
    onSplitChange?.({ hasValidSplit: true });
    
  } catch (error) {
    console.error("Split error:", error);
    showSnackbar(`Split failed: ${error.response?.data?.detail || error.message}`, "error");
  } finally {
    setIsSplitting(false);
  }
};

  // ==================== FONCTIONS D'IMPUTATION ====================

const handlePreviewImputation = async (method) => {
  if (!hasValidSplit) {
    showSnackbar(
      "Dataset must be properly split (with training data) before applying imputation methods", 
      "warning"
    );
    return;
  }

  if (emptyRowsCount === 0) {
    showSnackbar("No missing values to impute", "info");
    return;
  }

  try {
    setCheckingSplitStatus(true);
    
    const params = {
      bdName: bdName,
      method: method,
      columns: ''
    };
    if (method === "mean") {
      params.ignore_outliers = ignoreOutliersForMean;
      params.z_threshold = 3.0;
    }

    const response = await axios.get(
      `${backendUrl}/api/get-imputation-preview`,
      {
        params,
        withCredentials: true,
        timeout: 30000
      }
    );

    console.log("📊 Imputation preview response:", response.data);
    
    setImputationPreview(response.data);
    setImputationMethod(method);
    
    const compatibleColumns = response.data.columns_analysis
      .filter(col => col.compatible_with_method && col.missing_count > 0)
      .map(col => col.column_name);
    
    setSelectedColumnsForImputation(compatibleColumns);
    setOpenImputationDialog(true);
    
  } catch (error) {
    console.error("Preview error:", error);
    
    let errorMessage = "Preview failed";
    if (error.response?.status === 500) {
      errorMessage = "Server error - please check if your dataset is properly formatted";
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = "Request timeout - please try again";
    } else {
      errorMessage = error.response?.data?.detail || error.message;
    }
    
    showSnackbar(`Preview failed: ${errorMessage}`, "error");
  } finally {
    setCheckingSplitStatus(false);
  }
};

  const handleApplyImputation = async () => {
    try {
      setApplyingImputation(true);
      
      const payload = {
        bdName,
        method: imputationMethod,
        columns: selectedColumnsForImputation
      };
      if (imputationMethod === "mean") {
        payload.ignore_outliers = ignoreOutliersForMean;
        payload.z_threshold = 3.0;
      }

      const response = await axios.post(
        `${backendUrl}/api/impute-missing-values`,
        payload,
        { withCredentials: true }
      );

      console.log("✅ Imputation response:", response.data);
      
      setOpenImputationDialog(false);
      setSelectedColumnsForImputation([]);
      
      if (response.data.details) {
        console.log("📊 Imputation details:", response.data.details);
        
        const anyChanges = Object.values(response.data.details).some(
          detail => detail.affected_rows > 0
        );
        
        if (anyChanges) {
          showSnackbar(`Imputation with ${imputationMethod} completed successfully!`, "success");
        } else {
          showSnackbar(`Imputation completed but no changes were made. Check data compatibility.`, "warning");
        }
      }
      
      await fetchPaginatedData(page, selectedFilter);
      const statsData = await fetchStats();
      onSplitChange?.({
        hasValidSplit: true,
        emptyRowsCount:
          typeof statsData?.empty_count === "number" ? statsData.empty_count : undefined,
      });
      
    } catch (error) {
      console.error("❌ Imputation error:", error);
      showSnackbar(`Imputation failed: ${error.response?.data?.detail || error.message}`, "error");
    } finally {
      setApplyingImputation(false);
    }
  };

  const getImputationTooltip = (method) => {
    const status = splitColumnStatus;
    
    if (checkingSplitStatus) {
      return "Checking dataset split status...";
    }
    
    if (!status.exists) {
      return "Dataset must be split first - no split_type column found";
    }
    
    if (!status.hasValues) {
      return "Dataset must be split first - split_type column is empty";
    }
    
    if (status.trainCount === 0) {
      return "Dataset must be split first - no training data found";
    }
    
    if (emptyRowsCount === 0) {
      return "No missing values to impute - dataset is already complete";
    }
    
    const methodNames = {
      "mean": "Mean Imputation",
      "median": "Median Imputation",
      "mode": "Mode Imputation"
    };
    
    return `${methodNames[method]} - Fill missing values using ${method} method (${status.trainCount} train rows available)`;
  };

  // ==================== COMPOSANT IMPUTATION DIALOG ====================

  const ImputationDialog = ({ open, onClose, previewData, method, onApply }) => {
    const [localSelectedColumns, setLocalSelectedColumns] = useState([]);

    useEffect(() => {
      if (previewData) {
        if (method === 'mode') {
          const allColumns = previewData.columns_analysis.map(col => col.column_name);
          setLocalSelectedColumns(allColumns);
        } else {
          const compatibleColumns = previewData.columns_analysis
            .filter(col => col.compatible_with_method)
            .map(col => col.column_name);
          setLocalSelectedColumns(compatibleColumns);
        }
      }
    }, [previewData, method]);

    if (!previewData) return null;

    const handleColumnToggle = (columnName, isCompatible) => {
      if (method !== 'mode' && !isCompatible) return;
      
      setLocalSelectedColumns(prev => {
        if (prev.includes(columnName)) {
          return prev.filter(col => col !== columnName);
        } else {
          return [...prev, columnName];
        }
      });
    };

    const handleSelectAll = () => {
      const allCompatibleColumns = previewData.columns_analysis
        .filter(col => col.compatible_with_method)
        .map(col => col.column_name);
      setLocalSelectedColumns(allCompatibleColumns);
    };

    const handleDeselectAll = () => {
      setLocalSelectedColumns([]);
    };

    const handleApply = () => {
      setSelectedColumnsForImputation(localSelectedColumns);
      onApply();
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ backgroundColor: 'rgb(0, 80, 111)', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Visibility />
            <Typography variant="h6">
              {method.toUpperCase()} Imputation
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          <Card sx={{ p: 2, mb: 3, backgroundColor: '#f0f8ff' }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'rgb(0, 80, 111)' }}>
              Imputation Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Method:</strong> {method.toUpperCase()}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Total Missing Values:</strong> {previewData.total_missing_before}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Note:</strong> Statistics are computed on the <strong>entire training set</strong> in the database
                  (not only the rows currently displayed on the page).
                  {method === 'mean' && ignoreOutliersForMean && (
                    <> Extreme outliers (|z| &gt; 3) are ignored when computing the mean (not deleted).</>
                  )}
                </Typography>
              </Grid>
              {method === 'mean' && (
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={ignoreOutliersForMean}
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          setIgnoreOutliersForMean(checked);
                          // Recharger le preview avec le nouveau paramètre
                          try {
                            setCheckingSplitStatus(true);
                            const response = await axios.get(
                              `${backendUrl}/api/get-imputation-preview`,
                              {
                                params: {
                                  bdName,
                                  method: 'mean',
                                  columns: '',
                                  ignore_outliers: checked,
                                  z_threshold: 3.0,
                                },
                                withCredentials: true,
                                timeout: 30000,
                              }
                            );
                            setImputationPreview(response.data);
                          } catch (err) {
                            showSnackbar?.(err.response?.data?.detail || "Preview refresh failed", "error");
                          } finally {
                            setCheckingSplitStatus(false);
                          }
                        }}
                        sx={{ color: 'rgb(0, 80, 111)' }}
                      />
                    }
                    label="Ignore extreme outliers when computing the mean (Recommended)"
                  />
                </Grid>
              )}
            </Grid>
          </Card>

        

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: 'rgb(0, 80, 111)' }}>
              Column Selection
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" size="small" onClick={handleSelectAll}>
                Select All Compatible
              </Button>
              <Button variant="outlined" size="small" onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </Box>
          </Box>

          <TableContainer component={Paper} sx={{ maxHeight: 400, border: '1px solid #e0e0e0' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="50px"><strong>Apply</strong></TableCell>
                  <TableCell><strong>Column</strong></TableCell>
                  <TableCell><strong>Data Type</strong></TableCell>
                  <TableCell><strong>Missing Values</strong></TableCell>
                  <TableCell><strong>Train Missing</strong></TableCell>
                  <TableCell><strong>Test Missing</strong></TableCell>
                  <TableCell><strong>Compatible</strong></TableCell>
                  <TableCell><strong>Imputation Value</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewData.columns_analysis.map((col) => (
                  <TableRow 
                    key={col.column_name}
                    sx={{ 
                      backgroundColor: !col.compatible_with_method ? 'rgba(0, 0, 0, 0.04)' : 'inherit',
                    }}
                  >
                    <TableCell>
                      <Checkbox
                        checked={localSelectedColumns.includes(col.column_name)}
                        onChange={() => handleColumnToggle(col.column_name, col.compatible_with_method)}
                        disabled={!col.compatible_with_method}
                        sx={{ 
                          color: 'rgb(0, 80, 111)',
                          '&.Mui-checked': {
                            color: 'rgb(0, 80, 111)',
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {col.column_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={col.data_type} 
                        size="small" 
                        color={col.data_type.includes('char') ? 'primary' : 'secondary'}
                        sx={{ backgroundColor: 'rgb(0, 80, 111)' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {col.missing_count}
                        </Typography>
                        {col.missing_count > 0 && (
                          <Warning color="warning" sx={{ fontSize: 16 }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {col.split_distribution.train ? (
                        <Typography variant="body2">
                          {col.split_distribution.train.missing_count} 
                          ({col.split_distribution.train.missing_percentage}%)
                        </Typography>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {col.split_distribution.test ? (
                        <Typography variant="body2">
                          {col.split_distribution.test.missing_count} 
                          ({col.split_distribution.test.missing_percentage}%)
                        </Typography>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {col.compatible_with_method ? (
                        <CheckCircle color="success" />
                      ) : (
                        <Close color="error" />
                      )}
                    </TableCell>
                    <TableCell>
                      {col.suggested_imputation_value !== null && col.suggested_imputation_value !== undefined ? (
                        <Chip 
                          label={col.suggested_imputation_value} 
                          size="small" 
                          sx={{ 
                            backgroundColor: 'rgb(0, 80, 111)',
                            color: 'white'
                          }}
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Important:</strong> The {method.toUpperCase()} imputation will be calculated using 
              only the <strong>training data</strong> and then applied to both training and test sets 
              to prevent data leakage.
            </Typography>
          </Alert>

          {localSelectedColumns.length > 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Selected {localSelectedColumns.length} columns:</strong> {localSelectedColumns.join(', ')}
              </Typography>
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button 
            onClick={handleApply} 
            variant="contained"
            disabled={applyingImputation || localSelectedColumns.length === 0}
            startIcon={applyingImputation ? <CircularProgress size={20} /> : <PlayArrow />}
            sx={{ backgroundColor: 'rgb(0, 80, 111)' }}
          >
            {applyingImputation ? "Applying..." : "Apply Imputation"}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  // ==================== FONCTIONS DE NAVIGATION ====================

  const canProceedToNextStep = useCallback(() => {
    return hasValidSplit;
  }, [hasValidSplit]);

  const handleNextStep = useCallback(async () => {
    if (emptyRowsCount > 0) {
      setOpenEmptyValuesDialog(true);
      return;
    }

    if (!canProceedToNextStep()) {
      if (!splitCompleted) {
        showSnackbar("You must split the dataset before proceeding", "warning");
        return;
      }
    }

    if (!isSaved) {
      setOpenSaveConfirmDialog(true);
      return;
    }

    try {
      await axios.post(
        `${backendUrl}/api/update-stage`,
        { 
          bdName: bdName,
          newStage: "outlier_manager" 
        },
        { withCredentials: true }
      );

      const copyResponse = await axios.post(
        `${backendUrl}/api/dataset/save-checkpoint`,
        { source_db: bdName },
        { withCredentials: true }
      );

      if (copyResponse.data.status !== "success") {
        throw new Error("Failed to create reset copy");
      }

      navigate("/data_preparation", { 
      state: { 
        bdName,
        initialTab: 3,
        processedData: rows,
        columns: data ? data.columns : [],
        splitConfig: splitConfig,
        splitStats: splitStats,
        targetColumn: datasetInfo?.target_column,
        hasValidSplit: hasValidSplit
      } 
    });

    } catch (error) {
      console.error("Error:", error);
      showSnackbar(`Continue error: ${error.response?.data?.message || error.message}`, "error");
    }
}, [canProceedToNextStep, isSaved, bdName, navigate, rows, data, splitConfig, splitStats, emptyRowsCount, splitCompleted, datasetInfo, hasValidSplit]);
  const handleProceedWithoutSaving = useCallback(async () => {
    setOpenSaveConfirmDialog(false);
    handleNextStep();
  }, [handleNextStep]);

  const handleSaveAndProceed = useCallback(async () => {
    setOpenSaveConfirmDialog(false);
    
    try {
      await handleSaveChanges();
      handleNextStep();
    } catch (error) {
      console.error("Error saving and proceeding:", error);
      showSnackbar("Error saving changes", "error");
    }
  }, [handleSaveChanges, handleNextStep]);

  const handlePreviousStep = useCallback(() => {
    navigate("/data_preparation", { 
      state: { 
        bdName,
        initialTab: 1,
        processedData: rows,
        columns: data?.columns,
        rows: rows
      }
    });
  }, [navigate, bdName, rows, data]);

  const applyAfterResetUi = useCallback(async () => {
    setSplitCompleted(false);
    setHasValidSplit(false);
    setSplitStats(null);
    setSplitColumnStatus({
      exists: false,
      hasValues: false,
      trainCount: 0,
      testCount: 0,
      validationCount: 0,
      totalRows: 0,
      message: "Dataset reset: no split yet",
    });
    await fetchPaginatedData(1, selectedFilter);
    await fetchStats();
    const stillSplit = await fetchSplitStats();
    onSplitChange?.({ hasValidSplit: !!stillSplit });
  }, [selectedFilter, fetchPaginatedData, fetchStats, fetchSplitStats, onSplitChange]);

  // ==================== FONCTIONS DE SUPPRESSION AVEC VÉRIFICATION ====================

  const checkSplitBeforeDelete = (actionType) => {
    if (currentWorkflowStep === 1) {
      if (actionType === 'deleteSelected') {
        handleDeleteSelectedRows();
      } else {
        prepareConfirmation(actionType);
      }
      return false;
    }
    
    if ((currentWorkflowStep === 2 || currentWorkflowStep === 3) && 
        splitColumnStatus.exists && splitColumnStatus.hasValues) {
      setPendingDeleteAction(actionType);
      setOpenDeleteWarningDialog(true);
      return false;
    }
    
    if (actionType === 'deleteSelected') {
      handleDeleteSelectedRows();
    } else {
      prepareConfirmation(actionType);
    }
    return false;
  };

  const executePendingDeleteAction = useCallback(async () => {
    if (!pendingDeleteAction) return;
    
    if (pendingDeleteAction === 'deleteSelected') {
      handleDeleteSelectedRows();
    } else {
      prepareConfirmation(pendingDeleteAction);
    }
    setPendingDeleteAction(null);
  }, [pendingDeleteAction, prepareConfirmation, handleDeleteSelectedRows]);

  // ==================== FONCTIONS DE SAUVEGARDE DE COPIE ====================

  const checkDatasetLimit = async () => {
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
  };

  const handleSaveCopy = async (overwrite = false) => {
    const nameError = validateDatasetNameInput(copyName);
    if (nameError) {
      setError(nameError);
      return;
    }
    const normalizedName = normalizeDatasetName(copyName);

    try {
      setSaveCopyLoading(true);
      setError("");
      
      const response = await axios.post(
        `${backendUrl}/api/save-dataset-copy`,
        {
          source_db: bdName,
          copy_name: normalizedName,
          copy_type: "group_optimizer",
          overwrite: overwrite
        },
        { withCredentials: true }
      );

      if (response.data.status === "success") {
        setSuccess(`Dataset copy "${normalizedName}" ${response.data.action} successfully!`);
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
      } 
      else if (errorData?.detail && String(errorData.detail).includes("Dataset limit reached")) {
        setDatasetLimitReached(true);
        setError(String(errorData.detail));
      }
      else if (errorData?.detail) {
        setError(String(errorData.detail));
      }
      else {
        setError("Failed to save copy. Please try again.");
      }
      
      setTimeout(() => setError(""), 8000);
    } finally {
      setSaveCopyLoading(false);
    }
  };

  // ==================== COMPOSANTS FLOTTANTS ====================

  const FloatingSaveButton = useMemo(() => {
    if (!hasUnsavedChanges && !cellEditInProgress) return null;

    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          animation: 'bounceIn 0.6s ease-out'
        }}
      >
        <Tooltip title={
          cellEditInProgress 
            ? "Finish editing current cell first" 
            : hasUnsavedChanges 
              ? "Save your changes to the database" 
              : "All changes have been saved"
        }>
          <Button
            variant="contained"
            className={`save-button ${hasUnsavedChanges ? 'save-notification-badge' : ''}`}
            onClick={cellEditInProgress ? null : handleSaveChanges}
            disabled={!hasUnsavedChanges || cellEditInProgress}
            startIcon={
              cellEditInProgress 
                ? <Warning /> 
                : hasUnsavedChanges 
                  ? <Save /> 
                  : <CheckCircle />
            }
            size="small"
            sx={{
              backgroundColor: cellEditInProgress 
                ? '#ff9800' 
                : hasUnsavedChanges 
                  ? '#DE6B06' 
                  : '#28a745',
              '&:hover': {
                backgroundColor: cellEditInProgress 
                  ? '#f57c00' 
                  : hasUnsavedChanges 
                    ? '#c55a05' 
                    : '#218838'
              },
              position: 'relative',
              minWidth: '140px',
              cursor: cellEditInProgress ? 'not-allowed' : 'pointer'
            }}
          >
            {cellEditInProgress 
              ? "Editing..." 
              : hasUnsavedChanges 
                ? "Save Changes" 
                : "All Saved"
            }
          </Button>
        </Tooltip>
      </Box>
    );
  }, [hasUnsavedChanges, cellEditInProgress, handleSaveChanges]);

  const FloatingDeleteButton = useMemo(() => {
    if (selectedRows.length === 0) return null;

    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 180,
          zIndex: 9999,
          animation: 'bounceIn 0.6s ease-out'
        }}
      >
        <Tooltip title={`Delete ${selectedRows.length} selected rows`}>
          <Button
            variant="contained"
            className="delete-selected-button"
            onClick={() => {
              if (!checkSplitBeforeDelete('deleteSelected')) {
                return;
              }
              handleDeleteSelectedRows();
            }}
            startIcon={<Delete />}
            size="small"
            sx={{
              backgroundColor: '#DE6B06',
              '&:hover': { 
                backgroundColor: '#c55a05' 
              },
              position: 'relative',
              minWidth: '180px',
              fontWeight: 'bold'
            }}
          >
            Delete Selected ({selectedRows.length})
          </Button>
        </Tooltip>
      </Box>
    );
  }, [selectedRows, handleDeleteSelectedRows]);

  // ==================== DATA GRID AMÉLIORÉ ====================

  const EnhancedDataGrid = useMemo(() => {
    const CustomEditComponent = (props) => {
      const { id, value, field, api } = props;
      
      if (!id) {
        console.error("❌ CustomEditComponent: No id provided", props);
        return null;
      }
      
      const isBoolean = typeof value === 'boolean';
      
      const handleChange = (event) => {
        setHasUnsavedChanges(true);
        setCellEditInProgress(true);
        
        let newValue = event.target.value;
        
        if (isBoolean) {
          newValue = event.target.value === 'true';
        }
        
        api.setEditCellValue({ 
          id, 
          field, 
          value: newValue 
        });
      };

      const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
          setCellEditInProgress(false);
          api.stopCellEditMode({ id, field });
        } else if (event.key === 'Escape') {
          setCellEditInProgress(false);
          api.stopCellEditMode({ id, field, ignoreModifications: true });
        }
      };

      const handleBlur = () => {
        setCellEditInProgress(false);
        api.stopCellEditMode({ id, field });
      };

      if (isBoolean) {
        return (
          <Select
            value={value ? 'true' : 'false'}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            autoFocus
            fullWidth
            variant="standard"
          >
            <MenuItem value="true">TRUE</MenuItem>
            <MenuItem value="false">FALSE</MenuItem>
          </Select>
        );
      }

      return (
        <TextField
          value={value || ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
          fullWidth
          variant="standard"
          sx={{ 
            '& .MuiInputBase-input': {
              padding: '8px',
              backgroundColor: 'rgba(222, 107, 6, 0.1)'
            }
          }}
        />
      );
    };

    console.log("📊 EnhancedDataGrid - columns:", columns.length);
    console.log("📊 EnhancedDataGrid - rows:", rows.length);

    // S'assurer que toutes les lignes ont un ID
    const validRows = rows.filter(row => row && row.id !== null && row.id !== undefined);
    
    if (validRows.length !== rows.length) {
      console.warn(`⚠️ Filtered out ${rows.length - validRows.length} rows without valid IDs`);
    }

    const gridColumns = columns.map(col => ({
      ...col,
      renderEditCell: (params) => <CustomEditComponent {...params} />
    }));

    return (
      <Box sx={{ position: 'relative', height: 600, width: '100%' }}>
        {(hasUnsavedChanges || cellEditInProgress) && (
          <Box
            sx={{
              position: 'absolute',
              top: -60,
              left: 0,
              right: 0,
              backgroundColor: '#fff3e0',
              border: '2px solid #DE6B06',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 100,
              animation: 'slideDown 0.3s ease-out'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Warning sx={{ color: '#DE6B06' }} />
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#DE6B06' }}>
                {cellEditInProgress ? "Editing in progress..." : "You have unsaved changes"}
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              onClick={handleSaveChanges}
              startIcon={<Save />}
              disabled={cellEditInProgress}
              sx={{
                backgroundColor: '#DE6B06',
                '&:hover': { backgroundColor: '#c55a05' },
                '&:disabled': {
                  backgroundColor: '#cccccc',
                  color: '#666666'
                }
              }}
            >
              {cellEditInProgress ? "Finish Editing" : "Save Now"}
            </Button>
          </Box>
        )}
        
        <Box className="data-grid-container" sx={{ height: '100%', width: '100%' }}>
          {loading && !isLoadingMore && <LinearProgress />}
          
          {validRows.length === 0 && !loading ? (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100%',
              flexDirection: 'column',
              gap: 2
            }}>
              <Typography variant="h6" color="textSecondary">
                No data to display
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Current state: page={page}, totalRows={totalRows}, filter={selectedFilter}
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => fetchPaginatedData(1, selectedFilter)}
                sx={{ mt: 2, backgroundColor: '#DE6B06' }}
              >
                Retry Loading
              </Button>
            </Box>
          ) : (
            <DataGrid
              rows={validRows}
              columns={gridColumns}
              getRowId={(row) => row.id}
              paginationMode="server"
              rowCount={totalRows}
              paginationModel={{ page: page - 1, pageSize }}
              onPaginationModelChange={(model) => {
                const newPage = model.page + 1;
                console.log(`📄 Changing to page ${newPage}`);
                setPage(newPage);
                setPageSize(model.pageSize);
                fetchPaginatedData(newPage, selectedFilter);
              }}
              loading={loading}
              checkboxSelection
              disableRowSelectionOnClick
              onRowSelectionModelChange={(newSelection) => {
                setSelectedRows(newSelection);
              }}
              processRowUpdate={handleProcessRowUpdate}
              onProcessRowUpdateError={(error) => {
                console.error("❌ Row update error:", error);
                setCellEditInProgress(false);
              }}
              onCellEditStart={() => setCellEditInProgress(true)}
              onCellEditStop={() => setCellEditInProgress(false)}
              pageSizeOptions={[25, 50, 100]}
              sx={{
                '& .MuiDataGrid-cell:focus': {
                  outline: '2px solid #DE6B06',
                  outlineOffset: '-2px'
                },
                '& .MuiDataGrid-cell--editing': {
                  backgroundColor: 'rgba(222, 107, 6, 0.1) !important',
                },
                '& .MuiDataGrid-cell:focus-within': {
                  backgroundColor: 'rgba(222, 107, 6, 0.05)'
                }
              }}
            />
          )}
          
          {isLoadingMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={30} />
            </Box>
          )}
        </Box>
      </Box>
    );
  }, [rows, columns, loading, isLoadingMore, totalRows, page, pageSize, selectedFilter, 
      hasUnsavedChanges, cellEditInProgress, handleProcessRowUpdate, handleSaveChanges, fetchPaginatedData]);

  // ==================== HELP DIALOG ====================

  const HelpDialog = ({ open, onClose }) => {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ backgroundColor: '#384850', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
            <HelpOutline />
            Guide: Clean · Split · Impute
          </Typography>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body1" paragraph>
            Clean rows, create a train/test split, then impute missing values. Keep this order to avoid leaking test data into fill values.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ color: '#384850', fontWeight: 700, mt: 1 }}>
            Order
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>1. Clean:</strong> remove duplicates / empty rows, fix cells.<br />
            <strong>2. Split:</strong> random or stratified train/test (stratified for classification).<br />
            <strong>3. Impute:</strong> mean / median / mode fitted on train, then applied to train and test.<br />
            Auto Clean &amp; Split can run a safe default path for you.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ color: '#384850', fontWeight: 700 }}>
            Tips
          </Typography>
          <Typography variant="body2" paragraph>
            • Delete a column removes unused features (target and split_type are protected).<br />
            • Reset restores this stage checkpoint.<br />
            • Split before imputation.
          </Typography>

          <Alert severity="info" sx={{ mt: 1 }}>
            Stats and imputation use the full training data in the database, not only the rows on screen.
          </Alert>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={onClose}
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
    );
  };

  // ==================== RENDU PRINCIPAL ====================

  const pageBusy =
    loading ||
    isLoadingMore ||
    isSplitting ||
    applyingImputation ||
    isDeletingColumn;

  const pageBusyLabel = isSplitting
    ? "Split applied, refreshing table…"
    : applyingImputation
      ? "Applying imputation…"
      : isDeletingColumn
        ? "Deleting column…"
        : isLoadingMore
          ? "Loading more rows…"
          : "Loading dataset…";

  if (!data && loading) {
    return (
      <Box
        sx={{
          position: "relative",
          minHeight: "70vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 2,
          p: 3,
        }}
      >
        <CircularProgress sx={{ color: "#DE6B06" }} size={48} />
        <Typography variant="h6" sx={{ color: "rgb(0, 80, 111)", fontWeight: 600 }}>
          Loading dataset… Please wait
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Large datasets can take a moment. Do not click other actions yet.
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="data_cleaning-container" sx={{ position: "relative", minHeight: "60vh" }}>
      {pageBusy && (
        <Box
          role="progressbar"
          aria-busy="true"
          aria-label={pageBusyLabel}
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            bgcolor: "rgba(56, 72, 80, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "all",
          }}
        >
          <Paper
            elevation={6}
            sx={{
              px: 4,
              py: 3,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              gap: 2,
              maxWidth: 420,
            }}
          >
            <CircularProgress sx={{ color: "#DE6B06" }} />
            <Box>
              <Typography sx={{ fontWeight: 700, color: "rgb(0, 80, 111)" }}>
                {pageBusyLabel}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please wait: actions are disabled while data is loading.
              </Typography>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Header Section */}
      <Box className="data_cleaning-header dp-tab-toolbar">
        <Box className="header-title-section">
          <Typography variant="h6" className="data_cleaning-title dp-tab-toolbar-title" sx={{ color: '#384850', fontWeight: 700 }}>
            Clean · Split · Impute
          </Typography>
          {splitCompleted && (
            <Chip 
              label="Dataset Split" 
              color="success"
              size="small"
              variant="filled" 
            />
          )}
        </Box>
        
        <Box className="header-actions dp-tab-toolbar-actions">
          <Button
            variant="contained"
            startIcon={<AutoFixHigh />}
            onClick={() => setOpenAutoCleanSplit(true)}
            sx={{
              height: 40,
              backgroundColor: '#DE6B06',
              textTransform: 'none',
              fontWeight: 700,
              '&:hover': { backgroundColor: '#c55a05' },
            }}
          >
            Auto Clean &amp; Split
          </Button>

          <Tooltip title="Help Guide">
            <Button
              variant="outlined"
              sx={{
                height: 40,
                borderColor: '#384850',
                color: '#384850',
                textTransform: 'none',
                fontWeight: 600,
              }}
              className="help-button"
              startIcon={<HelpOutline />}
              onClick={() => {
                setAutoHelpOpened(true);
                setOpenHelpDialog(true);
              }}
            >
              Help
            </Button>
          </Tooltip>

          <DatasetCheckpointControls
            bdName={bdName}
            copyType="data_cleaning"
            showSave={false}
            onResetSuccess={async (msg) => {
              showSnackbar(msg || "Dataset restored from reset checkpoint.", "success");
              await applyAfterResetUi();
              onCheckpointReset?.();
            }}
            onError={(msg) => showSnackbar(msg, "error")}
          />

          {!embedded && (
          <Button
            variant="outlined"
            onClick={handlePreviousStep}
            startIcon={<NavigateBefore />}
            size="small"
            sx={{
              minWidth: '190px',
              height: '40px',
              backgroundColor: '#DE6B06',
              fontWeight: '600',
              fontSize: '0.9rem',
              color:'white',
              '&:hover': {
                backgroundColor: '#c55a05',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            Group Optimizer
          </Button>
          )}
        </Box>
      </Box>

      {/* Workflow Progress Indicator */}
      <Paper className="workflow-progress" sx={{ p: 2, mb: 3, backgroundColor: '#f5f5f5' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          <Typography variant="h6" sx={{ color: 'rgb(0, 80, 111)', fontWeight: 'bold', m: 0 }}>
            Workflow Steps (Follow This Order):
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Chip 
              label="1. Clean Data" 
              color={currentWorkflowStep >= 1 ? "primary" : "default"}
              variant={currentWorkflowStep === 1 ? "filled" : "outlined"}
              sx={{ 
                backgroundColor: currentWorkflowStep === 1 ? '#DE6B06' : undefined,
                color: currentWorkflowStep === 1 ? 'white' : undefined
              }}
            />
            <NavigateNext sx={{ mx: 1, color: 'text.secondary' }} />
            <Chip 
              label="2. Split Dataset" 
              color={currentWorkflowStep >= 2 ? "primary" : "default"}
              variant={currentWorkflowStep === 2 ? "filled" : "outlined"}
              sx={{ 
                backgroundColor: currentWorkflowStep === 2 ? '#DE6B06' : undefined,
                color: currentWorkflowStep === 2 ? 'white' : undefined
              }}
            />
            <NavigateNext sx={{ mx: 1, color: 'text.secondary' }} />
            <Chip 
              label="3. Impute Missing Values" 
              color={currentWorkflowStep >= 3 ? "primary" : "default"}
              variant={currentWorkflowStep === 3 ? "filled" : "outlined"}
              sx={{ 
                backgroundColor: currentWorkflowStep === 3 ? '#DE6B06' : undefined,
                color: currentWorkflowStep === 3 ? 'white' : undefined
              }}
            />
          </Box>
          {!splitCompleted && (
            <Alert severity="warning" sx={{ fontSize: '0.8rem', py: 0 }}>
              Split dataset before using imputation methods
            </Alert>
          )}
        </Box>
      </Paper>

      {/* Stats Overview Cards */}
      <Grid container spacing={2} className="stats-grid">
        <Grid item xs={12} sm={6} md={3}>
          <Card className="stat-card total-rows-card">
            <CardContent className="stat-card-content">
              <Typography className="stat-label" gutterBottom>
                Total Rows
              </Typography>
              <Typography variant="h4" component="div" className="stat-value total-stat-value">
                {stats.totalRows}
              </Typography>
              <Box className="stat-spacer" />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card className="stat-card total-columns-card">
            <CardContent className="stat-card-content">
              <Typography className="stat-label" gutterBottom>
                Total Columns
              </Typography>
              <Typography variant="h4" component="div" className="stat-value total-stat-value">
                {stats.totalColumns}
              </Typography>
              <Box className="stat-spacer" />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card className="stat-card empty-stat-card">
            <CardContent className="stat-card-content">
              <Typography className="stat-label" gutterBottom>
                Empty Values
              </Typography>
              <Typography variant="h4" component="div" className="stat-value empty-stat-value">
                {emptyRowsCount}
              </Typography>
              <Typography variant="body2" className="stat-percentage">
                {stats.totalRows > 0 ? ((emptyRowsCount / stats.totalRows * 100).toFixed(1) + '%') : '0%'} of rows
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card className="stat-card duplicated-stat-card">
            <CardContent className="stat-card-content">
              <Typography className="stat-label" gutterBottom>
                Duplicated Rows
              </Typography>
              <Typography variant="h4" component="div" className="stat-value duplicated-stat-value">
                {duplicatedRowsCount}
              </Typography>
              <Typography variant="body2" className="stat-percentage">
                {stats.totalRows > 0 ? ((duplicatedRowsCount / stats.totalRows * 100).toFixed(1) + '%') : '0%'} of rows
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {emptyLikeFindings.length > 0 && (
        <Alert severity="warning" variant="outlined" sx={{ mb: 3 }} icon={<Warning />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
            Values treated as empty / missing
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            On this page, these tokens are detected as empty:{" "}
            <strong>
              {(emptyLikeTokens.length
                ? emptyLikeTokens
                : ["none", "null", "na", "n/a", "nan", "nat", "missing", "unknown", "-", "--", "?"]
              ).join(", ")}
            </strong>
            . That is intentional for cleaning and imputation: but if a token is a real
            category in your data (for example <em>Unknown</em> as an attack source),
            rename it in the <strong>Groups</strong> step before you delete empty rows or
            run Auto Clean &amp; Split.
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.25 }}>
            {emptyLikeFindings.slice(0, 8).map((f) => (
              <li key={`${f.column}-${f.value}`}>
                <Typography variant="body2">
                  Column <strong>{f.column}</strong>: &quot;{f.value}&quot;: {f.count} rows
                  ({f.percentage}%)
                </Typography>
              </li>
            ))}
          </Box>
          {emptyLikeFindings.length > 8 && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              …and {emptyLikeFindings.length - 8} more value(s)
            </Typography>
          )}
          {typeof onGoToGroups === "function" && (
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={onGoToGroups}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Go to Groups to rename
            </Button>
          )}
        </Alert>
      )}

      {/* Dataset Split & Imputation Section */}
      <Paper className="split-imputation-section" sx={{ p: 3, mb: 3, backgroundColor: '#f8f9fa' }}>
        <Typography variant="h6" gutterBottom sx={{ color: 'rgb(0, 80, 111)', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
          <PlayArrow sx={{ mr: 1 }} /> Dataset Split & Imputation
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Tooltip title={
            <Box>
              <Typography variant="body2" gutterBottom>
                <strong>Recommended order:</strong>
              </Typography>
              <Typography variant="caption">
                1. Remove duplicates and empty rows first<br/>
                2. Then split dataset<br/>
                3. Finally apply imputation methods
              </Typography>
            </Box>
          }>
            <Button
              variant={splitCompleted ? "outlined" : "contained"}
              color={splitCompleted ? "success" : "primary"}
              onClick={handleOpenSplitDialog}
              startIcon={splitCompleted ? <CheckCircle /> : <PlayArrow />}
              size="medium"
              sx={{ 
                backgroundColor: splitCompleted ? undefined : 'rgb(0, 80, 111)',
                borderColor: splitCompleted ? undefined : 'rgb(0, 80, 111)'
              }}
            >
              {splitCompleted ? "Split Completed" : "Split Dataset"}
            </Button>
          </Tooltip>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
              {splitCompleted 
                ? "✓ Dataset split completed. You can now use imputation methods."
                : "Split dataset first to enable imputation methods"}
            </Typography>
            
{splitCompleted && splitColumnStatus && splitColumnStatus.totalRows > 0 && (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'rgb(0, 80, 111)' }}>
        Training: {splitColumnStatus.trainCount} rows (
        {Math.round((splitColumnStatus.trainCount / splitColumnStatus.totalRows) * 100)}%)
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'rgb(0, 80, 111)' }}>
        Test: {splitColumnStatus.testCount} rows (
        {Math.round((splitColumnStatus.testCount / splitColumnStatus.totalRows) * 100)}%)
      </Typography>
      {splitColumnStatus.validationCount > 0 && (
        <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'rgb(0, 80, 111)' }}>
          Validation: {splitColumnStatus.validationCount} rows (
          {Math.round((splitColumnStatus.validationCount / splitColumnStatus.totalRows) * 100)}%)
        </Typography>
      )}
    </Box>
    {/* Afficher aussi le total pour vérification */}
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      Total dataset: {splitColumnStatus.totalRows} rows
    </Typography>
  </Box>
)}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', ml: 'auto', alignItems: 'center' }}>
            <Tooltip title={getImputationTooltip("mean")}>
              <span>
                <Button
                  variant="outlined"
                  onClick={() => handlePreviewImputation("mean")}
                  disabled={!hasValidSplit || checkingSplitStatus}
                  size="small"
                  sx={{
                    opacity: (hasValidSplit && !checkingSplitStatus) ? 1 : 0.6,
                    borderColor: (hasValidSplit && !checkingSplitStatus) ? 'rgb(0, 80, 111)' : 'grey.400',
                    color: (hasValidSplit && !checkingSplitStatus) ? 'rgb(0, 80, 111)' : 'grey.400'
                  }}
                >
                  {checkingSplitStatus ? "Checking..." : "Mean Imputation"}
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={getImputationTooltip("median")}>
              <span>
                <Button
                  variant="outlined"
                  onClick={() => handlePreviewImputation("median")}
                  disabled={!hasValidSplit || checkingSplitStatus}
                  size="small"
                  sx={{
                    opacity: (hasValidSplit && !checkingSplitStatus) ? 1 : 0.6,
                    borderColor: (hasValidSplit && !checkingSplitStatus) ? 'rgb(0, 80, 111)' : 'grey.400',
                    color: (hasValidSplit && !checkingSplitStatus) ? 'rgb(0, 80, 111)' : 'grey.400'
                  }}
                >
                  Median Imputation
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={getImputationTooltip("mode")}>
              <span>
                <Button
                  variant="outlined"
                  onClick={() => handlePreviewImputation("mode")}
                  disabled={!hasValidSplit || checkingSplitStatus}
                  size="small"
                  sx={{
                    opacity: (hasValidSplit && !checkingSplitStatus) ? 1 : 0.6,
                    borderColor: (hasValidSplit && !checkingSplitStatus) ? 'rgb(0, 80, 111)' : 'grey.400',
                    color: (hasValidSplit && !checkingSplitStatus) ? 'rgb(0, 80, 111)' : 'grey.400'
                  }}
                >
                  Mode Imputation
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {emptyRowsCount > 0 && splitCompleted && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Your dataset contains {emptyRowsCount} missing values. 
              Use the imputation methods above to fill them appropriately.
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* Dialogue d'imputation */}
      <ImputationDialog
        open={openImputationDialog}
        onClose={() => setOpenImputationDialog(false)}
        previewData={imputationPreview}
        method={imputationMethod}
        onApply={handleApplyImputation}
      />

      {/* Data Quality Actions */}
      <Box className="data-quality-section">
        <Typography variant="h6" className="data-quality-title" sx={{ color: 'rgb(0, 80, 111)' }}>
          <FilterList className="quality-icon" /> Data Quality Actions
        </Typography>
        
        <Box className="quality-actions">
          <Box>
            <Button
              variant={selectedFilter === 'empty' ? 'contained' : 'outlined'}
              className={`filter-button empty ${selectedFilter === 'empty' ? 'active' : ''}`}
              onClick={() => handleFilterClick('empty')}
              disabled={emptyRowsCount === 0}
              startIcon={<Warning />}
              size="small"
              sx={{
                backgroundColor: selectedFilter === 'empty' ? '#DE6B06' : undefined,
                borderColor: '#DE6B06',
                color: selectedFilter === 'empty' ? 'white' : '#DE6B06'
              }}
            >
              {selectedFilter === 'empty' ? 'Hide Empty' : 'Show Empty'} ({emptyRowsCount})
            </Button>
          </Box>
          
          <Box>
            <Button
              variant={selectedFilter === 'duplicated' ? 'contained' : 'outlined'}
              className={`filter-button duplicated ${selectedFilter === 'duplicated' ? 'active' : ''}`}
              onClick={() => handleFilterClick('duplicated')}
              disabled={duplicatedRowsCount === 0}
              size="small"
              sx={{
                backgroundColor: selectedFilter === 'duplicated' ? '#DE6B06' : undefined,
                borderColor: '#DE6B06',
                color: selectedFilter === 'duplicated' ? 'white' : '#DE6B06'
              }}
            >
              {selectedFilter === 'duplicated' ? 'Hide Duplicates' : 'Show Duplicates'} ({duplicatedRowsCount})
            </Button>
          </Box>
          
          <Box className="clean-actions">
            <Button
              variant="contained"
              className="delete-empty-button"
              onClick={() => checkSplitBeforeDelete("empty")}
              disabled={emptyRowsCount === 0}
              startIcon={<Delete />}
              size="small"
              sx={{ backgroundColor: '#DE6B06' }}
            >
              Delete Empty
            </Button>

            <Button
              variant="contained"
              className="delete-duplicates-button"
              onClick={() => checkSplitBeforeDelete("duplicated")}
              disabled={duplicatedRowsCount === 0}
              startIcon={<Delete />}
              size="small"
              sx={{ backgroundColor: '#DE6B06' }}
            >
              Delete Duplicates
            </Button>

            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={() => {
                setColumnToDelete(null);
                setDeleteColumnDialogOpen(true);
              }}
              disabled={deletableColumns.length === 0 || isDeletingColumn}
              size="small"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Delete a column
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Data Grid */}
      {EnhancedDataGrid}

      {/* Boutons Flottants */}
      {FloatingSaveButton}
      {FloatingDeleteButton}

      {/* Help Dialog */}
      <HelpDialog open={openHelpDialog} onClose={() => setOpenHelpDialog(false)} />

      <AutoCleanSplitDialog
        open={openAutoCleanSplit}
        onClose={() => setOpenAutoCleanSplit(false)}
        bdName={bdName}
        showSnackbar={showSnackbar}
        onCompleted={async () => {
          setSplitCompleted(true);
          setHasValidSplit(true);
          onSplitChange?.({ hasValidSplit: true });
          await fetchPaginatedData(1, null);
          const statsData = await fetchStats();
          await fetchSplitStats();
          onSplitChange?.({
            hasValidSplit: true,
            emptyRowsCount:
              typeof statsData?.empty_count === "number"
                ? statsData.empty_count
                : typeof emptyRowsCount === "number"
                  ? emptyRowsCount
                  : undefined,
          });
        }}
      />

      {/* Delete Column Dialog */}
      <Dialog
        open={deleteColumnDialogOpen}
        onClose={() => !isDeletingColumn && setDeleteColumnDialogOpen(false)}
      >
        <DialogTitle>Delete a column</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            Select the column to delete. This action is irreversible.
            The target column and system columns (id, split_type) cannot be deleted.
          </Typography>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Column to delete</InputLabel>
            <Select
              value={columnToDelete || ""}
              onChange={(e) => setColumnToDelete(e.target.value)}
              label="Column to delete"
              disabled={isDeletingColumn}
            >
              {deletableColumns.map((col) => (
                <MenuItem key={col} value={col}>
                  {col}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteColumnDialogOpen(false)}
            disabled={isDeletingColumn}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteColumn}
            color="error"
            variant="contained"
            disabled={!columnToDelete || isDeletingColumn}
          >
            {isDeletingColumn ? <CircularProgress size={24} color="inherit" /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Split Configuration Dialog */}
      <Dialog
        open={openSplitDialog}
        onClose={() => setOpenSplitDialog(false)}
        maxWidth="lg"
        fullWidth
        className="split-config-dialog"
      >
        <DialogTitle sx={{ 
          backgroundColor: 'rgb(0, 80, 111)', 
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlayArrow />
            <Typography variant="h6">Dataset Split Configuration</Typography>
          </Box>
          {splitCompleted && (
            <Chip 
              label="Split Applied" 
              color="success" 
              size="small" 
            />
          )}
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ color: 'rgb(0, 80, 111)', fontWeight: 'bold' }}>
                Split configuration
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom sx={{ fontWeight: '600' }}>
                  Train/Test Ratio
                </Typography>
                <Slider
                  value={splitConfig.trainSize}
                  onChange={(_, newValue) => setSplitConfig(prev => ({ ...prev, trainSize: newValue }))}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}%`}
                  min={10}
                  max={90}
                  step={5}
                  sx={{ 
                    width: '90%', 
                    mt: 2,
                    color: 'rgb(0, 80, 111)'
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgb(0, 80, 111)' }}>
                    Training: {splitConfig.trainSize}%
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'rgb(0, 80, 111)' }}>
                    Test: {100 - splitConfig.trainSize}%
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom sx={{ fontWeight: '600' }}>
                  Split Method
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={splitConfig.splitMethod}
                    onChange={(e) => setSplitConfig(prev => ({ 
                      ...prev, 
                      splitMethod: e.target.value
                    }))}
                  >
                    <MenuItem value="random">Random Split</MenuItem>
                    <MenuItem 
                      value="stratified" 
                      disabled={!isSupervised || !datasetInfo?.target_column}
                    >
                      Stratified Split 
                      {(!isSupervised || !datasetInfo?.target_column) && " (Requires Target Column)"}
                    </MenuItem>
                  </Select>
                </FormControl>
                
                {splitConfig.splitMethod === "stratified" && (!isSupervised || !datasetInfo?.target_column) && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {!isSupervised 
                      ? "This dataset doesn't have a target column. Stratified split is not available." 
                      : "Target column not found. Please check your dataset configuration."}
                  </Alert>
                )}
              </Box>

              {isSupervised && datasetInfo?.target_column && (
                <Box sx={{ mb: 3, p: 2, backgroundColor: 'success.light', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'success.dark', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle fontSize="small" />
                    Target Column Detected
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <strong>Target:</strong> {datasetInfo.target_column}
                  </Typography>
                  {splitConfig.splitMethod === "stratified" && (
                    <Typography variant="caption" sx={{ color: 'success.dark', fontStyle: 'italic' }}>
                      Stratified split will maintain class distribution based on this column
                    </Typography>
                  )}
                </Box>
              )}

              {!isSupervised && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  This dataset doesn't have a target column. Only random split is available.
                </Alert>
              )}

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={splitConfig.useSeed}
                      onChange={(e) => setSplitConfig(prev => ({ ...prev, useSeed: e.target.checked }))}
                      sx={{ color: 'rgb(0, 80, 111)' }}
                    />
                  }
                  label={
                    <Typography sx={{ fontWeight: '600' }}>
                      Use random seed for reproducibility
                    </Typography>
                  }
                />
                {splitConfig.useSeed && (
                  <TextField
                    type="number"
                    value={splitConfig.seedValue}
                    onChange={(e) => setSplitConfig(prev => ({ ...prev, seedValue: parseInt(e.target.value) || 0 }))}
                    label="Seed value"
                    fullWidth
                    sx={{ mt: 1, maxWidth: 150 }}
                  />
                )}
              </Box>

              {isSupervised && datasetInfo?.target_column && (
                <Box sx={{ mb: 3 }}>
                  <Typography gutterBottom sx={{ fontWeight: '600' }}>
                    Class Balancing
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={splitConfig.balanceClasses}
                        onChange={(e) => setSplitConfig(prev => ({ ...prev, balanceClasses: e.target.checked }))}
                        sx={{ color: 'rgb(0, 80, 111)' }}
                      />
                    }
                    label="Balance classes in training set only"
                  />
                  {splitConfig.balanceClasses && (
                    <>
                      <FormControl fullWidth sx={{ mt: 1 }}>
                        <Select
                          value={splitConfig.balanceMethod}
                          onChange={(e) => setSplitConfig(prev => ({ ...prev, balanceMethod: e.target.value }))}
                        >
                          <MenuItem value="oversampling">Oversampling (Minority Class)</MenuItem>
                          <MenuItem value="undersampling">Undersampling (Majority Class)</MenuItem>
                        </Select>
                      </FormControl>
                      <Alert severity="info" sx={{ mt: 1 }}>
                        Balancing is applied <strong>after</strong> the split, on the <strong>training set only</strong>.
                        The test set stays untouched to avoid data leakage.
                      </Alert>
                    </>
                  )}
                </Box>
              )}

              {splitConfig.splitMethod === "stratified" && isSupervised && datasetInfo?.target_column && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Stratified Split:</strong> Automatically maintains class distribution <br />
                    in both train and test sets based on the target column "{datasetInfo.target_column}".
                    You can still enable class balancing on the training set above.
                  </Typography>
                </Alert>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ color: 'rgb(0, 80, 111)', fontWeight: 'bold' }}>
                Dataset overview
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Card sx={{ 
                    textAlign: 'center', 
                    p: 1.5, 
                    border: '2px solid', 
                    borderColor: 'rgb(0, 80, 111)',
                    backgroundColor: 'rgba(0, 80, 111, 0.05)'
                  }}>
                    <Typography variant="h4" color="rgb(0, 80, 111)" fontWeight="bold">
                      {stats.totalRows}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="500">
                      Total Rows
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card sx={{ 
                    textAlign: 'center', 
                    p: 1.5, 
                    border: '2px solid', 
                    borderColor: 'rgb(0, 80, 111)',
                    backgroundColor: 'rgba(0, 80, 111, 0.05)'
                  }}>
                    <Typography variant="h4" color="rgb(0, 80, 111)" fontWeight="bold">
                      {stats.totalColumns}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="500">
                      Total Columns
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: '600' }}>
                  Split Distribution
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Card sx={{ 
                      p: 2, 
                      textAlign: 'center', 
                      bgcolor: 'rgb(0, 80, 111)',
                      color: 'white',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', bgcolor: 'rgb(0, 60, 90)' }} />
                      <Typography variant="h5" fontWeight="bold">
                        {splitConfig.trainSize}%
                      </Typography>
                      <Typography variant="body2">
                        Training Set
                      </Typography>
                      <Typography variant="caption">
                        ~{Math.round(stats.totalRows * splitConfig.trainSize / 100)} rows
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card sx={{ 
                      p: 2, 
                      textAlign: 'center', 
                      bgcolor: 'rgb(0, 80, 111)',
                      color: 'white',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', bgcolor: 'rgb(0, 60, 90)' }} />
                      <Typography variant="h5" fontWeight="bold">
                        {100 - splitConfig.trainSize}%
                      </Typography>
                      <Typography variant="body2">
                        Test Set
                      </Typography>
                      <Typography variant="caption">
                        ~{Math.round(stats.totalRows * (100 - splitConfig.trainSize) / 100)} rows
                      </Typography>
                    </Card>
                  </Grid>
                </Grid>
              </Box>

              <Card sx={{ 
                p: 2, 
                bgcolor: 'rgba(0, 80, 111, 0.05)',
                border: '1px solid',
                borderColor: 'rgb(0, 80, 111)',
                mb: 2
              }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: 'rgb(0, 80, 111)' }}>
                  📋 Split Summary
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2">
                    • <strong>Method:</strong> {splitConfig.splitMethod === 'stratified' ? 'Stratified' : 'Random'}
                  </Typography>
                  
                  {isSupervised && datasetInfo?.target_column && (
                    <Typography variant="body2">
                      • <strong>Target:</strong> {datasetInfo.target_column}
                    </Typography>
                  )}
                  
                  <Typography variant="body2">
                    • <strong>Training:</strong> {splitConfig.trainSize}% ({Math.round(stats.totalRows * splitConfig.trainSize / 100)} rows)
                  </Typography>
                  
                  <Typography variant="body2">
                    • <strong>Test:</strong> {100 - splitConfig.trainSize}% ({Math.round(stats.totalRows * (100 - splitConfig.trainSize) / 100)} rows)
                  </Typography>

                  {splitConfig.useSeed && (
                    <Typography variant="body2">
                      • <strong>Seed:</strong> {splitConfig.seedValue}
                    </Typography>
                  )}

                  {splitConfig.balanceClasses && (
                    <Typography variant="body2">
                      • <strong>Balancing:</strong> {splitConfig.balanceMethod === 'oversampling' ? 'Oversampling' : 'Undersampling'}
                    </Typography>
                  )}
                </Box>
              </Card>

              {emptyRowsCount > 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Note:</strong> Your dataset contains {emptyRowsCount} empty values. 
                    Consider cleaning data before splitting for optimal model performance.
                  </Typography>
                </Alert>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions sx={{ p: 2, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => setOpenSplitDialog(false)}
            variant="outlined"
            startIcon={<Close />}
          >
            Cancel
          </Button>
          
          <Box sx={{ flex: 1 }} />
          
          {!isSupervised && (
            <Chip 
              label="Unsupervised Dataset" 
              color="default" 
              size="small" 
              variant="outlined"
            />
          )}
          
          {isSupervised && datasetInfo?.target_column && (
            <Chip 
              label={`Target: ${datasetInfo.target_column}`} 
              color="success" 
              size="small" 
              variant="outlined"
            />
          )}
          
          <Button 
            onClick={handleApplySplit} 
            variant="contained" 
            disabled={isSplitting || (splitConfig.splitMethod === "stratified" && (!isSupervised || !datasetInfo?.target_column))}
            startIcon={isSplitting ? <CircularProgress size={20} /> : <PlayArrow />}
            sx={{ 
              minWidth: 140,
              backgroundColor: 'rgb(0, 80, 111)'
            }}
          >
            {isSplitting ? "Applying Split..." : "Apply Split"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Warning Dialog */}
      <Dialog
        open={openDeleteWarningDialog}
        onClose={() => setOpenDeleteWarningDialog(false)}
        aria-labelledby="delete-warning-dialog-title"
      >
        <DialogTitle id="delete-warning-dialog-title" sx={{ backgroundColor: 'rgb(0, 80, 111)', color: 'white' }}>
          <Warning sx={{ mr: 1 }} />
          Dataset Already Split
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body1" gutterBottom>
            Your dataset has already been split into training and test sets.
          </Typography>
          <Typography variant="body2" paragraph>
            Deleting rows at this stage may cause imbalance between your training and test datasets, which could affect model performance.
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Current workflow step:</strong> {currentWorkflowStep === 2 ? "Split Dataset" : "Impute Missing Values"}<br/>
              <strong>Recommended approach:</strong><br/>
              • Use imputation methods instead of deletion to preserve dataset structure<br/>
              • Or reset the dataset and apply cleaning before splitting
            </Typography>
          </Alert>
          <Typography variant="body2" color="text.secondary">
            {pendingDeleteAction === 'deleteSelected' 
              ? `Do you want to delete ${selectedRows.length} selected rows anyway?`
              : 'Do you want to see the affected rows and confirm deletion?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpenDeleteWarningDialog(false)}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              setOpenDeleteWarningDialog(false);
              executePendingDeleteAction();
            }}
            variant="contained"
            sx={{ backgroundColor: '#DE6B06' }}
          >
            {pendingDeleteAction === 'deleteSelected' ? 'Delete Anyway' : 'Show Affected Rows'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
  open={openConfirmDialog}
  onClose={() => setOpenConfirmDialog(false)}
  aria-labelledby="alert-dialog-title"
  aria-describedby="alert-dialog-description"
  maxWidth="lg"
  fullWidth
  className="confirm-dialog"
>
  <DialogTitle id="alert-dialog-title" className="dialog-title" sx={{ backgroundColor: 'rgb(0, 80, 111)', color: 'white' }}>
    {dialogConfig.title}
  </DialogTitle>
  <DialogContent className="dialog-content" sx={{ p: 3 }}>
    <Box sx={{ mb: 2 }}>
      <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
        Action summary:
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
        {dialogConfig.message}
      </Typography>
    </Box>

    {dialogConfig.title.includes("automatic") && (
      <Box className="preview-section" sx={{ mb: 2 }}>
        <Box className="preview-legend" sx={{ display: 'flex', gap: 2, mb: 1 }}>
          <Box className="preview-legend-item" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#ffebee', border: '1px solid #f44336' }} />
            <Typography variant="caption">Empty rows</Typography>
          </Box>
          <Box className="preview-legend-item" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#fff3e0', border: '1px solid #ff9800' }} />
            <Typography variant="caption">Duplicated rows</Typography>
          </Box>
        </Box>
      </Box>
    )}

    <Typography variant="subtitle2" className="preview-subtitle" sx={{ mb: 1 }}>
      Preview (showing {Math.min(previewData.length, 100)} of {dialogConfig.affectedRows} affected rows):
    </Typography>

    <Box className="preview-grid-container" sx={{ height: 400, width: '100%' }}>
      <DataGrid
        rows={previewData}
        columns={columns.map(col => ({
          ...col,
          // Ajouter une classe CSS basée sur le rowType
          cellClassName: (params) => {
            if (params.row.rowType === 'empty') return 'row-type-empty';
            if (params.row.rowType === 'duplicated') return 'row-type-duplicated';
            return '';
          }
        }))}
        getRowId={(row) => row.id}
        pageSizeOptions={[5, 10, 25, 50, 100]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10 } },
        }}
        disableRowSelectionOnClick
        sx={{
          '& .row-type-empty': {
            backgroundColor: '#ffebee !important',
            '&:hover': {
              backgroundColor: '#ffcdd2 !important'
            }
          },
          '& .row-type-duplicated': {
            backgroundColor: '#fff3e0 !important',
            '&:hover': {
              backgroundColor: '#ffe0b2 !important'
            }
          }
        }}
      />
    </Box>
  </DialogContent>
  <DialogActions className="dialog-actions" sx={{ p: 2, gap: 1 }}>
    <Button 
      onClick={() => setOpenConfirmDialog(false)} 
      variant="outlined"
    >
      Cancel
    </Button>
    <Button 
      onClick={handleConfirmAction} 
      variant="contained"
      autoFocus
      sx={{ backgroundColor: 'rgb(0, 80, 111)' }}
    >
      Confirm ({dialogConfig.affectedRows} rows)
    </Button>
  </DialogActions>
</Dialog>

      {/* Save Confirmation Dialog */}
      <Dialog
        open={openSaveConfirmDialog}
        onClose={() => setOpenSaveConfirmDialog(false)}
        aria-labelledby="save-confirm-dialog-title"
        className="save-confirm-dialog"
      >
        <DialogTitle id="save-confirm-dialog-title" className="dialog-title" sx={{ backgroundColor: '#DE6B06', color: 'white' }}>
          Unsaved Changes
        </DialogTitle>
        <DialogContent className="dialog-content">
          <Typography>
            You have unsaved changes. Would you like to save before proceeding?
          </Typography>
        </DialogContent>
        <DialogActions className="dialog-actions">
          <Button onClick={() => setOpenSaveConfirmDialog(false)} className="dialog-button">
            Cancel
          </Button>
          <Button onClick={handleProceedWithoutSaving} className="dialog-button">
            Proceed Without Saving
          </Button>
          <Button onClick={handleSaveAndProceed} className="confirm-button" sx={{ backgroundColor: '#DE6B06' }}>
            Save and Continue
          </Button>
        </DialogActions>
      </Dialog>

      {/* Empty Values Dialog */}
      <Dialog
        open={openEmptyValuesDialog}
        onClose={() => setOpenEmptyValuesDialog(false)}
        aria-labelledby="empty-values-dialog-title"
        className="empty-values-dialog"
      >
        <DialogTitle id="empty-values-dialog-title" className="dialog-title" sx={{ backgroundColor: 'rgb(0, 80, 111)', color: 'white' }}>
          Empty Values Detected
        </DialogTitle>
        <DialogContent className="dialog-content">
          <Typography>
            There are {emptyRowsCount} rows with empty values in your dataset.
            You must clean these before continuing. The process cannot continue with empty values.
          </Typography>
        </DialogContent>
        <DialogActions className="dialog-actions">
          <Button onClick={() => setOpenEmptyValuesDialog(false)} className="confirm-button" sx={{ backgroundColor: 'rgb(0, 80, 111)' }}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity} 
          className="snackbar-alert"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

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
        className="save-copy-dialog"
      >
        <DialogTitle className="dialog-title">
          <SaveIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Save Dataset Copy
        </DialogTitle>
        <DialogContent dividers className="dialog-content">
          
          <Typography variant="body2" sx={{ mb: 2, color: 'var(--dark)' }}>
            Save the current state of your dataset with all transformations applied.
          </Typography>
          
          <TextField
            autoFocus
            fullWidth
            label="Dataset Name"
            value={copyName}
            onChange={(e) => {
              setCopyName(e.target.value);
              setNameConflict(false);
              setDatasetLimitReached(false);
              setError("");
            }}
            variant="outlined"
            className="copy-name-input"
            sx={{ mt: 1 }}
            helperText={nameConflict ? "This name is already used" : "Enter a name for your dataset"}
            error={nameConflict}
          />
          
          {nameConflict && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                Dataset Name Already Exists
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                The name "<strong>{copyName}</strong>" is already used. You can:
              </Typography>
              
              {existingTables.length > 0 && (
                <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight="600" sx={{ mb: 1 }}>
                    Existing datasets:
                  </Typography>
                  {existingTables.map((table, index) => (
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
                    const newName = `${copyName}_${timestamp}`;
                    setCopyName(newName);
                    setNameConflict(false);
                    setError("");
                  }}
                  sx={{ flex: 1 }}
                >
                  Generate New Name
                </Button>
                <Button 
                  variant="contained" 
                  size="small"
                  color="warning"
                  onClick={() => handleSaveCopy(true)}
                  disabled={saveCopyLoading}
                  sx={{ flex: 1 }}
                >
                  {saveCopyLoading ? "Overwriting..." : `Overwrite Existing`}
                </Button>
              </Box>
            </Alert>
          )}
          
          {datasetLimitReached && (
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
                    setError("Please delete some datasets in the dashboard, then refresh this page and try again.");
                  }}
                >
                  Open Dashboard to Delete Datasets
                </Button>
                <Button 
                  variant="contained" 
                  size="small"
                  color="warning"
                  onClick={() => {
                    if (nameConflict) {
                      handleSaveCopy(true);
                    } else {
                      setError("To overwrite, please use an existing dataset name.");
                      setNameConflict(true);
                    }
                  }}
                  disabled={saveCopyLoading}
                >
                  {saveCopyLoading ? "Overwriting..." : "Overwrite Existing Dataset"}
                </Button>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => window.location.reload()}
                  sx={{ mt: 1 }}
                >
                  Refresh Page After Deletion
                </Button>
              </Box>
            </Alert>
          )}
      
          {error && !nameConflict && !datasetLimitReached && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
      
        </DialogContent>
        <DialogActions className="dialog-actions">
          <Button 
            onClick={() => {
              setSaveDialogOpen(false);
              setError("");
              setNameConflict(false);
              setDatasetLimitReached(false);
            }} 
            className="close-dialog-button"
            startIcon={<ClearIcon />}
          >
            Cancel
          </Button>
          
          {!nameConflict && !datasetLimitReached && (
            <Button 
              onClick={() => handleSaveCopy(false)}
              variant="contained"
              className="confirm-save-button"
              startIcon={<SaveIcon />}
              disabled={saveCopyLoading || !copyName.trim()}
            >
              {saveCopyLoading ? "Saving..." : "Save Copy"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Data_cleaning;