import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import moment from "moment";
import RefreshIcon from '@mui/icons-material/Refresh';
import { ArrowBackIos, ArrowForwardIos } from '@mui/icons-material';
import { LinearProgress, Backdrop, Fade } from "@mui/material";
import Chip from '@mui/material/Chip';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';

import {FormControlLabel, Checkbox,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  TextField,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,Divider,
  IconButton,
  ListSubheader,
} from "@mui/material";
import { backendUrl } from "../config";
import { normalizeDatasetName, validateDatasetNameInput } from "../utils/datasetName";
import DatasetCheckpointControls from "../components/DatasetCheckpointControls";

import { DataGrid } from "@mui/x-data-grid";
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import OutlierManagerDialog from '../components/OutlierManagerDialog';
import AutoTransformDialog from '../components/AutoTransformDialog';
import ClearIcon from '@mui/icons-material/Clear';
import SchoolIcon from '@mui/icons-material/School';

const colorPalette = {
  primary: '#384850',
  secondary: '#DE6B06',
  neutral: '#DDDEDF'
};

const transformationMethods = {
    // Dates use the same manual methods as text; leaving a date as-is is OK
    // for optional Time Series validation in Create Model.
    date: [
    {
      value: "frequency",
      label: "Frequency Encoding",
      description: "Replaces each value with its relative frequency (count / n) in the full dataset",
      example: "['A','A','B'] on 3 rows → A:0.67, B:0.33"
    },
  ],
  boolean: [
    {
      value: "binary",
      label: "Binary Encoding",
      description: "Converts boolean values to 0 and 1",
      example: "true → 1, false → 0"
    },
    {
      value: "invert",
      label: "Boolean Inversion",
      description: "Inverts boolean values (true→0, false→1)",
      example: "true → 0, false → 1"
    }
  ],
  categorical: [
    {
      value: "onehot",
      label: "One-Hot Encoding",
      description: "Creates binary columns for each unique category",
      example: "['Red', 'Blue'] → Red:1, Blue:0"
    },
    {
      value: "label",
      label: "Label Encoding",
      description: "Assigns a unique number to each category",
      example: "['Red', 'Blue'] → 0, 1"
    },
  ],
  numerical: [
    {
      value: "standard",
      label: "Standardization",
      description: "Normalizes with mean=0 and standard deviation=1",
      formula: "(x - μ) / σ"
    },
    {
      value: "minmax",
      label: "MinMax Normalization",
      description: "Scales between 0 and 1",
      formula: "(x - min) / (max - min)"
    },
    {
      value: "log",
      label: "Logarithmic Transformation",
      description: "Applies log(1+x) to reduce skewness",
      example: "For skewed data"
    }
  ],
  text: [
    {
      value: "frequency",
      label: "Frequency Encoding",
      description: "Replaces each category with its relative frequency (count / n) in the full dataset",
      example: "['A','A','B'] on 3 rows → A:0.67, B:0.33"
    },
  ],
};

const Data_transformation = ({
  embedded = false,
  bdName: bdNameProp = null,
  onClose = null,
  onDataChanged = null,
  onOm2ReadyChange = null,
} = {}) => {
  const { state: locationState } = useLocation();
  const navigate = useNavigate();
  const { bdName: bdNameFromState } = locationState || {};
  const bdName = bdNameProp ?? bdNameFromState;
  
const [rowCount, setRowCount] = useState(0);
const [totalRows, setTotalRows] = useState(0);
const [loadingData, setLoadingData] = useState(false);
const [paginationModel, setPaginationModel] = useState({
  page: 0,
  pageSize: 50, 
});
const [helpDialogOpen, setHelpDialogOpen] = useState(false);
const [methodHelpDialogOpen, setMethodHelpDialogOpen] = useState(false);
const [currentMethodHelp, setCurrentMethodHelp] = useState(null);

const [regexLoading, setRegexLoading] = useState(false);
const [regexProgress, setRegexProgress] = useState(0);
const [regexStatus, setRegexStatus] = useState("");
const [patternError, setPatternError] = useState("");
  // Main states
  const [state, setState] = useState({
    isLoading: true,
    error: null,
    originalData: null,
    columns: [],
    columnStats: {},
    columnTypes: {},
  });
const [regexTutorialOpen, setRegexTutorialOpen] = useState(false);
  const [configurations, setConfigurations] = useState([]);
  // Nouveau modèle d'UI : une méthode (+ paramètres) sélectionnée par colonne, appliquée à la demande
  const [columnMethods, setColumnMethods] = useState({});
  const [columnSearch, setColumnSearch] = useState("");
  // Popups Outlier Manager (univarié / multivarié)
  const [outlierDialog, setOutlierDialog] = useState(null); // null | 'v1' | 'v2'
  const [openAutoTransform, setOpenAutoTransform] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transformLoading, setTransformLoading] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [currentBdName, setCurrentBdName] = useState(bdName);
  const [checkingNumerized, setCheckingNumerized] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
const [selectedPattern, setSelectedPattern] = useState('');
  const [loadingTargetColumn, setLoadingTargetColumn] = useState(true);
  const [extractAllGroups, setExtractAllGroups] = useState(false);
  const [groupCount, setGroupCount] = useState(0);
  const [groupColumnNames, setGroupColumnNames] = useState([]);
  const [keepOption, setKeepOption] = useState('full');
  const [outputColumn, setOutputColumn] = useState('');
  const [helpDialogInitialized, setHelpDialogInitialized] = useState(false);

const [success, setSuccess] = useState("");
const [error, setError] = useState("");
const [saveDialogOpen, setSaveDialogOpen] = useState(false);
const [copyName, setCopyName] = useState("");
const [nameConflict, setNameConflict] = useState(false);
const [existingTables, setExistingTables] = useState([]);
const [overwriteMode, setOverwriteMode] = useState(false);
const [datasetLimitReached, setDatasetLimitReached] = useState(false);
const [datasetCount, setDatasetCount] = useState(0);
const [saveCopyLoading, setSaveCopyLoading] = useState(false); 

// Open help dialog (unified)
const handleOpenHelp = () => {
  setHelpDialogOpen(true);
};

// Open method help dialog
const handleOpenMethodHelp = (method) => {
  setCurrentMethodHelp(method);
  setMethodHelpDialogOpen(true);
};

// Close method help dialog
const handleCloseMethodHelp = () => {
  setMethodHelpDialogOpen(false);
  setCurrentMethodHelp(null);
};

// Show help dialog automatically when page loads (including embedded tabs)
useEffect(() => {
  if (!state.isLoading && state.originalData && !helpDialogInitialized) {
    setTimeout(() => {
      setHelpDialogOpen(true);
      setHelpDialogInitialized(true);
    }, 400);
  }
}, [state.isLoading, state.originalData, helpDialogInitialized]);

// Method Help Dialog Component
const MethodHelpDialog = () => (
  <Dialog open={methodHelpDialogOpen} onClose={handleCloseMethodHelp}>
    <DialogTitle sx={{ bgcolor: colorPalette.primary, color: 'white' }}>
      <Typography variant="h6">{currentMethodHelp?.label || "Method Help"}</Typography>
    </DialogTitle>
    <DialogContent dividers>
      {currentMethodHelp ? (
        <Box>
          <Typography paragraph>{currentMethodHelp.description}</Typography>
          {currentMethodHelp.example && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>Example:</strong> {currentMethodHelp.example}
            </Typography>
          )}
          {currentMethodHelp.formula && (
            <Typography variant="body2" fontFamily="monospace" sx={{ mt: 1 }}>
              <strong>Formula:</strong> {currentMethodHelp.formula}
            </Typography>
          )}
        </Box>
      ) : (
        <Typography>Select a method to see its help</Typography>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={handleCloseMethodHelp} sx={{ color: colorPalette.primary }}>
        Close
      </Button>
    </DialogActions>
  </Dialog>
);

// Unified Help Dialog Component
const HelpDialog = ({ open, onClose }) => {
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);

  if (showWelcomeTour) {
    return (
      <Dialog
        open={open}
        onClose={() => {
          setShowWelcomeTour(false);
          onClose();
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, overflow: 'hidden' }
        }}
      >
        <Box sx={{ bgcolor: colorPalette.primary, p: 3, textAlign: 'center', color: 'white' }}>
          <SchoolIcon sx={{ fontSize: 48, mb: 1 }} />
          <Typography variant="h5" fontWeight="bold">Welcome to Data Transformation</Typography>
          <Typography variant="body1" sx={{ opacity: 0.9, mt: 1 }}>Prepare your data for machine learning</Typography>
        </Box>

        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ p: 3, borderBottom: `1px solid ${colorPalette.neutral}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: colorPalette.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</Box>
              <Typography variant="h6" fontWeight="bold">Pick a column</Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ ml: 7 }}>Choose a method for that column, then Apply. Or use Apply All / Auto Transform.</Typography>
          </Box>

          <Box sx={{ p: 3, borderBottom: `1px solid ${colorPalette.neutral}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: colorPalette.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</Box>
              <Typography variant="h6" fontWeight="bold">Match method to type</Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ ml: 7 }}>Numerical, categorical, boolean, text, and date each have their own methods. At most one date column may remain for Time Series validation.</Typography>
          </Box>

          <Box sx={{ p: 3, borderBottom: `1px solid ${colorPalette.neutral}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: colorPalette.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>3</Box>
              <Typography variant="h6" fontWeight="bold">Optional tools</Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ ml: 7 }}>Extract from text, delete a column, clean empty rows, then open Outliers if needed before Train Model.</Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, bgcolor: colorPalette.neutral, justifyContent: 'center' }}>
          <Button variant="contained" onClick={() => setShowWelcomeTour(false)} sx={{ bgcolor: colorPalette.primary, px: 4, '&:hover': { bgcolor: '#003c56' } }}>Got it</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ bgcolor: '#384850', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
          Guide: Data Transformation
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Alert severity="info" sx={{ m: 3, mb: 0 }}>
          <Typography variant="body2">
            <strong>How to use:</strong> pick a column, choose a method, click Apply. Use Auto Transform for a bulk pass, or Extract from text for patterns.
          </Typography>
        </Alert>

        <Box sx={{ p: 3, borderBottom: `1px solid ${colorPalette.neutral}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: colorPalette.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</Box>
            <Typography variant="h6" fontWeight="bold">Per column</Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ ml: 7 }}>
            Methods depend on column type. Apply one column at a time, or Apply All for pending methods.
          </Typography>
        </Box>

        <Box sx={{ p: 3, borderBottom: `1px solid ${colorPalette.neutral}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: colorPalette.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</Box>
            <Typography variant="h6" fontWeight="bold">Auto Transform</Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ ml: 7 }}>
            Profiles columns and applies safe encodings. For dates: keep one for Time Series validation, or delete them.
          </Typography>
        </Box>

        <Box sx={{ p: 3, borderBottom: `1px solid ${colorPalette.neutral}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: colorPalette.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>3</Box>
            <Typography variant="h6" fontWeight="bold">Next</Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ ml: 7 }}>
            Remove empty rows if needed, optionally open Outliers, then go to Train Model when columns are ready.
          </Typography>
        </Box>

        <Divider />

        <Box sx={{ p: 3, bgcolor: '#f8f9fa' }}>
          <Typography variant="h6" gutterBottom sx={{ color: colorPalette.primary, fontWeight: 'bold' }}>
            Available Transformations by Column Type
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'white' }}>
                <Typography variant="subtitle2" fontWeight="bold" color={colorPalette.primary}>
                   Numerical Columns
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  • <strong>Standardization</strong>: mean 0, std 1<br />
                  • <strong>MinMax</strong>: scale to [0, 1]<br />
                  • <strong>Log</strong>: log(1+x) for skew
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'white' }}>
                <Typography variant="subtitle2" fontWeight="bold" color={colorPalette.primary}>
                   Categorical Columns
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  • <strong>One-Hot</strong>: binary columns per category<br />
                  • <strong>Label</strong>: numeric codes per category
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'white' }}>
                <Typography variant="subtitle2" fontWeight="bold" color={colorPalette.primary}>
                   Boolean Columns
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  • <strong>Binary</strong>: true/false to 1/0<br />
                  • <strong>Invert</strong>: true→0, false→1
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'white' }}>
                <Typography variant="subtitle2" fontWeight="bold" color={colorPalette.primary}>
                   Text Columns
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  • <strong>Frequency</strong>: value replaced by count / n
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'white' }}>
                <Typography variant="subtitle2" fontWeight="bold" color={colorPalette.primary}>
                   Date Columns
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  • Leave as-is for optional Time Series validation in Train Model (at most one date).<br />
                  • Or Frequency encoding, same as text.
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        <Divider />

        <Box sx={{ p: 3, bgcolor: '#f8f9fa' }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ color: colorPalette.primary, mb: 1 }}>
             Additional Tools
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 1.5, bgcolor: 'white', textAlign: 'center' }}>
                <DeleteSweepIcon sx={{ color: colorPalette.secondary }} />
                <Typography variant="body2" fontWeight="bold">Delete Column</Typography>
                <Typography variant="caption" color="text.secondary">Remove unwanted columns</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 1.5, bgcolor: 'white', textAlign: 'center' }}>
                <Typography variant="body2" fontWeight="bold">Extract from text</Typography>
                <Typography variant="caption" color="text.secondary">
                  Create columns from patterns in text. Test first, then apply.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 1.5, bgcolor: 'white', textAlign: 'center' }}>
                <DeleteSweepIcon sx={{ color: colorPalette.secondary }} />
                <Typography variant="body2" fontWeight="bold">Clean Empty Rows</Typography>
                <Typography variant="caption" color="text.secondary">Remove rows with empty values</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
        
       
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={onClose} 
          variant="contained"
          fullWidth
          size="large"
          sx={{ bgcolor: colorPalette.primary, '&:hover': { bgcolor: '#003c56' }, textTransform: 'none', fontWeight: 700 }}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Loading overlay component
const LoadingOverlay = () => (
  <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.modal + 1 }} open={transformLoading}>
    <Fade in={transformLoading}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, bgcolor: 'rgba(0,0,0,0.8)', borderRadius: 4, minWidth: 300 }}>
        <CircularProgress size={60} sx={{ color: colorPalette.secondary, mb: 3 }} />
        <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>Applying Transformations...</Typography>
        <Typography variant="body2" sx={{ color: '#ddd', textAlign: 'center' }}>This may take a few moments.<br />Please do not close the page.</Typography>
      </Box>
    </Fade>
  </Backdrop>
);

// ==================== REGEX NORMALIZATION ====================
// Strip ^/$ so patterns search anywhere in the cell (extraction, not full-string validation).
// Translate legacy PostgreSQL forms (\\y, [[:space:]]) to Python re (same engine as predict).
const normalizeRegexPattern = (pattern) => {
  if (!pattern) return { original: pattern, normalized: pattern, wasModified: false };

  const original = pattern;
  let normalized = pattern.trim();
  let wasModified = false;

  if (normalized.startsWith('^')) {
    normalized = normalized.substring(1);
    wasModified = true;
  }
  if (normalized.endsWith('$')) {
    normalized = normalized.slice(0, -1);
    wasModified = true;
  }

  // Legacy PG → Python (keeps old saved patterns / pasted PG patterns working)
  const beforeLegacy = normalized;
  normalized = normalized
    .replace(/\\y/g, '\\b')
    .replace(/\[\[:space:\]\]/g, '\\s')
    .replace(/\[\[:digit:\]\]/g, '\\d')
    .replace(/\[\[:alpha:\]\]/g, '[A-Za-z]')
    .replace(/\[\[:alnum:\]\]/g, '[A-Za-z0-9]')
    .replace(/\[\^\[:space:\]\]/g, '[^\\s]');
  if (normalized !== beforeLegacy) wasModified = true;

  return { original, normalized, wasModified: wasModified && original !== normalized };
};

/** Count capturing groups for column preview (structure only). */
const countCapturingGroups = (pattern) => {
  if (!pattern) return 0;
  let count = 0;
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === '\\') {
      i += 2;
      continue;
    }
    if (pattern[i] === '(' && pattern[i + 1] !== '?') count += 1;
    i += 1;
  }
  return count;
};

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

useEffect(() => {
  if (saveDialogOpen) {
    checkDatasetLimit();
    if (bdName) {
      const defaultName = `${bdName}_data_transformation`;
      setCopyName(defaultName);
    }
  }
}, [saveDialogOpen, bdName]);

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

const validateAllConfigurations = () => {
  const configErrors = [];
  
  configurations.forEach(config => {
    if (config.method === "log" && config.column) {
      const { hasNegative, minValue } = checkNegativeValues(config.column);
      const offset = config.parameters.offset || 1;
      
      if (hasNegative && offset <= Math.abs(minValue)) {
        const requiredOffset = Math.abs(minValue) + 1;
        configErrors.push({
          column: config.column,
          message: `Insufficient offset for "${config.column}". Minimum required: ${requiredOffset} (min value: ${minValue})`
        });
      }
    }
  });
  
  return configErrors;
};

const [emptyRowsCount, setEmptyRowsCount] = useState(0);

useEffect(() => {
  if (currentBdName) {
    countRowsWithEmptyValues().then(count => {
      setEmptyRowsCount(count);
    });
  }
}, [currentBdName]);

const countRowsWithEmptyValues = async () => {
  try {
    const response = await axios.get(
      `${backendUrl}/api/count-empty-rows`,
      {
        params: { bdName: currentBdName },
        withCredentials: true
      }
    );
    return response.data.count;
  } catch (error) {
    console.error("Error counting empty rows:", error);
    return 0;
  }
};

const reloadAfterCheckpointReset = async () => {
  setProcessing(true);
  setLoadingData(true);
  try {
      const dataResponse = await axios.get(
        `${backendUrl}/api/get-data-paginatedd`,
        {
          params: {
            bdName: bdName,
            page: paginationModel.page,
            pageSize: paginationModel.pageSize
          },
          withCredentials: true
        }
      );

      const formatData = (apiResponse) => {
        const columnNames = apiResponse.columns;
        const page = paginationModel.page;
        
        return apiResponse.rows.map((row, index) => {
          const formatted = { id: index + (page * paginationModel.pageSize) };
          columnNames.forEach((colName, i) => {
            formatted[colName] = row[`col${i}`] ?? row[colName] ?? null;
          });
          return formatted;
        });
      };

      const pageData = formatData(dataResponse.data);
      const columns = dataResponse.data.columns;
      const totalCount = dataResponse.data.total_count;

      setTotalRows(totalCount);
      setRowCount(totalCount);

      try {
        const typesResponse = await axios.get(
          `${backendUrl}/api/analyze-column-types`,
          {
            params: {
              bdName: bdName
            },
            withCredentials: true
          }
        );

        const columnTypes = {};
        const columnStats = {};
        
        typesResponse.data.column_types.forEach(item => {
          columnTypes[item.column_name] = item.column_type;
          
          if (item.stats && (item.column_type === "numerical" || item.column_type === "categorical" || item.column_type === "boolean")) {
            columnStats[item.column_name] = {
              min: item.stats.min,
              max: item.stats.max,
              mean: item.stats.mean,
              median: item.stats.median,
              missing: (item.stats.total ?? 0) - (item.stats.non_null ?? 0),
              distinct: item.stats.distinct,
              is_numeric_content: !!item.stats.is_numeric_content || item.column_type === "numerical",
            };
          } else if (item.stats) {
            columnStats[item.column_name] = {
              ...(columnStats[item.column_name] || {}),
              is_numeric_content: !!item.stats.is_numeric_content,
              distinct: item.stats.distinct,
              missing: (item.stats.total ?? 0) - (item.stats.non_null ?? 0),
            };
          }
        });

        setState({
          isLoading: false,
          error: null,
          originalData: pageData,
          columns,
          columnStats,
          columnTypes,
        });

      } catch (typesError) {
        console.warn("Could not fetch column types from backend, falling back to frontend detection:", typesError);
        
        // FALLBACK: Utiliser la détection frontend si l'API échoue
        const columnStats = {};
        const columnTypes = {};

        columns.forEach((col) => {
          const values = pageData
            .map((row) => row[col])
            .filter((val) => val !== null && val !== "");

          columnTypes[col] = detectColumnTypeFallback(values);

          if (columnTypes[col] === "numerical") {
            const numericValues = values
              .map(parseFloat)
              .filter((v) => !isNaN(v));

            if (numericValues.length > 0) {
              const sorted = [...numericValues].sort((a, b) => a - b);
              columnStats[col] = {
                min: sorted[0],
                max: sorted[sorted.length - 1],
                mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
                median: sorted[Math.floor(sorted.length / 2)],
                missing: pageData.length - numericValues.length
              };
            }
          }
        });

        setState({
          isLoading: false,
          error: null,
          originalData: pageData,
          columns,
          columnStats,
          columnTypes,
        });
      }

      setCurrentBdName(bdName);
      setConfigurations([]);
      setColumnMethods({});
      onDataChanged?.();
  } catch (error) {
    console.error("Error reloading after reset:", error);
    alert(`Error during reset reload: ${error.response?.data?.detail || error.message}`);
  } finally {
    setProcessing(false);
    setLoadingData(false);
  }
};

const handleBackToOutlierManager = async () => {
  setProcessing(true);
  
  try {
    const checkResponse = await axios.get(
      `${backendUrl}/api/check-numerized?bdName=${bdName}`,
      { withCredentials: true }
    );
    
    if (checkResponse.data.numerizedExists) {
      const syncResult = await axios.post(
        `${backendUrl}/api/synchronize-numerized-to-original-complete`,
        {
          originalBdName: bdName,
          numerizedBdName: currentBdName
        },
        { withCredentials: true }
      );
      
      if (syncResult.data.success) {
        await axios.post(
          `${backendUrl}/api/dataset/save-checkpoint`,
          { source_db: bdName },
          { withCredentials: true }
        );
      }
    }
    
    navigate("/data_preparation", { 
      state: { 
        bdName,
        initialTab: 2,
        numerizedBdName: currentBdName 
      } 
    });
    
  } catch (error) {
    console.error("Error during synchronization:", error);
    alert(`Error: ${error.response?.data?.detail || error.message}`);
  } finally {
    setProcessing(false);
  }
};

const handleDeleteEmptyRows = async () => {
  const emptyRowsCount = await countRowsWithEmptyValues();
  if (!window.confirm(`Are you sure you want to delete the ${emptyRowsCount} rows containing at least one empty value?`)) {
    return;
  }

  setProcessing(true);
  
  try {
    const response = await axios.post(
      `${backendUrl}/api/delete-rows-with-empty-values`,
      { bdName: currentBdName },
      { withCredentials: true }
    );

    const loadUpdatedData = async () => {
      try {
        const dataResponse = await axios.get(
          `${backendUrl}/api/get-data-paginatedd`,
          {
            params: {
              bdName: currentBdName,
              page: paginationModel.page,
              pageSize: paginationModel.pageSize
            },
            withCredentials: true
          }
        );

        const formatData = (apiResponse) => {
          const columnNames = apiResponse.columns;
          return apiResponse.rows.map((row, index) => {
            const formatted = { id: index + (paginationModel.page * paginationModel.pageSize) };
            columnNames.forEach((colName, i) => {
              formatted[colName] = row[`col${i}`] ?? row[colName] ?? "";
            });
            return formatted;
          });
        };

        const pageData = formatData(dataResponse.data);
        const columns = dataResponse.data.columns;
        setTotalRows(totalRows - response.data.deleted_count);

        const newEmptyCount = await countRowsWithEmptyValues();
        setEmptyRowsCount(newEmptyCount);

        setState(prev => ({
          ...prev,
          originalData: pageData,
          columns
        }));

        alert(`Empty rows successfully deleted. ${response.data.deleted_count} rows removed.`);
      } catch (error) {
        console.error("Error loading updated data:", error);
        alert("Error reloading data after deletion");
      } finally {
        setProcessing(false);
      }
    };

    await loadUpdatedData();
  } catch (error) {
    console.error("Error deleting empty rows:", error);
    alert(`Error deleting empty rows: ${error.response?.data?.detail || error.message}`);
    setProcessing(false);
  }
};

/**
 * Predefined patterns oriented for ML AutoML.
 * Order in the UI: Cybersecurity first, then general numeric / categorical patterns.
 */
const predefinedExtractionCategories = [
  {
    category: "Cybersecurity",
    items: [
      {
        id: "port",
        name: "Port number after :",
        pattern: ":([0-9]{1,5})\\b",
        description: "TCP/UDP port",
        example: "10.0.0.1:443 → 443",
        castNumeric: true,
        mlRole: "numeric",
        utility: "Numeric service port from host:port logs: strong feature for network / security models.",
        nextSteps: "Cast to numeric → train. Or map well-known ports to categories later (http/ssh/other).",
      },
      {
        id: "ipv4_first_octet",
        name: "IPv4 first octet",
        pattern: "\\b(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)(?:\\.(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)){3}\\b",
        description: "First number of an IPv4",
        example: "src=192.168.1.5 → 192",
        castNumeric: true,
        mlRole: "numeric",
        utility:
          "Compact numeric network signal (10 / 172 / 192…). Better for ML than a full IP (too many unique values on thousands of rows).",
        nextSteps: "Cast to numeric → train. Prefer this over extracting the full address.",
      },
      {
        id: "ipv4_for_count",
        name: "IPv4 (use with Count mode)",
        pattern: "\\b((?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?))\\b",
        description: "IPv4 match for counting",
        example: "from 10.0.0.1 to 10.0.0.2 → count 2",
        castNumeric: true,
        validateKind: "ipv4",
        mlRole: "numeric",
        preferredMode: "all_count",
        utility:
          "Do not keep full IPs as categories (too many values). Use Extraction mode “All matches: count” to get how many IPs appear in the cell: a strong numeric feature.",
        nextSteps: "Set mode to All: count → Test → Apply. Result column is numeric (0, 1, 2…). Ready to train.",
      },
      {
        id: "http_status",
        name: "HTTP status code",
        pattern: "HTTP/[0-9]\\.[0-9][\\s\"]+([0-9]{3})",
        description: "3-digit status",
        example: 'HTTP/1.1" 404 → 404',
        castNumeric: true,
        mlRole: "numeric",
        utility: "Numeric status (200, 404, 500…). Also easy to turn into class buckets.",
        nextSteps:
          "Cast to numeric, or after extract use Groups / Label encoding on 2xx|4xx|5xx if you bin them in cleaning.",
      },
      {
        id: "http_method",
        name: "HTTP method",
        pattern: "\\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\\b",
        description: "Request verb",
        example: "POST /api/login → POST",
        castNumeric: false,
        mlRole: "categorical",
        utility: "Small closed set of categories: excellent ML feature for API / access logs.",
        nextSteps: "One-Hot or Label encoding → train. Few unique values → One-Hot is fine.",
      },
      {
        id: "url_host",
        name: "URL host / domain",
        pattern: "(?:https?|ftp)://([^/:\\s\"'<>]+)",
        description: "Hostname from URL",
        example: "https://api.example.com/v1 → api.example.com",
        castNumeric: false,
        validateKind: "domain",
        mlRole: "categorical",
        utility:
          "Categorical host feature from web / proxy / C2-style logs. Full URLs are dropped on purpose (high cardinality).",
        nextSteps: "Label / Frequency encoding. If too many hosts, Frequency encoding is safer than One-Hot.",
      },
      {
        id: "url_for_count",
        name: "URL (use with Count mode)",
        pattern: "((?:https?|ftp)://[^\\s\"'<>]+)",
        description: "URL match for counting",
        example: "see https://a.com and https://b.com → count 2",
        castNumeric: true,
        validateKind: "url",
        mlRole: "numeric",
        preferredMode: "all_count",
        utility: "Number of links in a message / log line: numeric feature without storing unique URLs.",
        nextSteps: "Mode All: count → Apply. For which site, use “URL host / domain”.",
      },
      {
        id: "file_extension",
        name: "File extension",
        pattern: "\\.([A-Za-z0-9]{1,5})(?:\\b|$)",
        description: "Extension after last dot",
        example: "payload.exe → exe",
        castNumeric: false,
        mlRole: "categorical",
        utility:
          "File type category (exe, dll, pdf, jpg…). Useful in malware / EDR / document pipelines without keeping the full path.",
        nextSteps: "Optional: Ignore letter case. Then Label / One-Hot encoding → train.",
      },
      {
        id: "hash_for_count",
        name: "Hex hash (use with Count mode)",
        pattern: "\\b([0-9a-fA-F]{32}|[0-9a-fA-F]{40}|[0-9a-fA-F]{64})\\b",
        description: "MD5/SHA-like token count",
        example: "two hashes in line → count 2",
        castNumeric: true,
        mlRole: "numeric",
        preferredMode: "all_count",
        utility:
          "Raw hashes are unique IDs: useless (and risky) as categories. Counting how many hashes appear is the ML-useful signal.",
        nextSteps: "Mode All: count → Apply → numeric feature for security models.",
      },
      {
        id: "cve_id",
        name: "CVE identifier",
        pattern: "(CVE-[0-9]{4}-[0-9]{4,7})",
        description: "Vulnerability ID",
        example: "CVE-2021-44228",
        castNumeric: false,
        mlRole: "categorical",
        utility:
          "Security category. Useful if the same CVEs repeat. If almost unique per row, use “CVE year” instead or mode All: count.",
        nextSteps:
          "If few distinct CVEs: Label / Frequency encoding. If too many uniques: extract CVE year (numeric) or use count mode.",
      },
      {
        id: "cve_year",
        name: "CVE year",
        pattern: "CVE-([0-9]{4})-[0-9]{4,7}",
        description: "Year inside CVE-…",
        example: "CVE-2021-44228 → 2021",
        castNumeric: true,
        mlRole: "numeric",
        utility: "Numeric time proxy from CVE text when the full CVE ID is too unique for encoding.",
        nextSteps: "Cast to numeric → train.",
      },
      {
        id: "email_for_count",
        name: "Email (use with Count mode)",
        pattern: "([a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,})",
        description: "Email match for counting",
        example: "a@x.com; b@y.com → count 2",
        castNumeric: true,
        validateKind: "email",
        mlRole: "numeric",
        preferredMode: "all_count",
        utility:
          "Full emails are near-IDs (bad for One-Hot). Counting emails per cell is useful for phishing / spam / multi-contact signals.",
        nextSteps: "Mode All: count → Apply. For provider identity, use “Email domain” (General).",
      },
    ],
  },
  {
    category: "Numbers (ready for training)",
    items: [
      {
        id: "digits",
        name: "First number in the cell",
        pattern: "([0-9]+(?:[.,][0-9]+)?)",
        description: "First numeric token",
        example: "Size: 25m² → 25",
        castNumeric: true,
        mlRole: "numeric",
        utility:
          "Creates a numeric feature immediately (with Cast to numeric). Ideal for mixed text like “age: 42”, “score 87/100”.",
        nextSteps: "Apply → column is numerical → ready for Standardize / MinMax / model training.",
      },
      {
        id: "percent",
        name: "Percentage",
        pattern: "([0-9]+(?:[.,][0-9]+)?)\\s*%",
        description: "Value before %",
        example: "12,5% → 12.5",
        castNumeric: true,
        mlRole: "numeric",
        utility: "Direct numeric feature for rates, completion %, CPU usage, discounts.",
        nextSteps: "Cast to numeric → train. Optional: scale with MinMax if values span 0–100.",
      },
      {
        id: "amount",
        name: "Currency amount",
        pattern: "[€$£¥]?\\s?([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]+)?|[0-9]+(?:[.,][0-9]+)?)\\s?[€$£¥]?",
        description: "Money amount (. or , decimals)",
        example: "1.234,56 € → 1234.56",
        castNumeric: true,
        mlRole: "numeric",
        utility: "Turns price / cost / salary text into a numeric column for regression or risk models.",
        nextSteps: "Cast to numeric → Standardize or Log if skewed → train.",
      },
      {
        id: "weight_kg",
        name: "Weight (kg)",
        pattern: "([0-9]+(?:[.,][0-9]+)?)\\s*kg",
        description: "Numeric weight",
        example: "72,5 kg → 72.5",
        castNumeric: true,
        mlRole: "numeric",
        utility: "Numeric measurement feature from free-text product / logistics fields.",
        nextSteps: "Cast to numeric → ready for training.",
      },
      {
        id: "speed_kmh",
        name: "Speed (km/h)",
        pattern: "([0-9]+(?:[.,][0-9]+)?)\\s*km/h",
        description: "Numeric speed",
        example: "120 km/h → 120",
        castNumeric: true,
        mlRole: "numeric",
        utility: "Numeric feature from telemetry / fleet / sensor text.",
        nextSteps: "Cast to numeric → train.",
      },
      {
        id: "temp_c",
        name: "Temperature (°C)",
        pattern: "([0-9]+(?:[.,][0-9]+)?)\\s*°?C",
        description: "Numeric temperature",
        example: "23.5°C → 23.5",
        castNumeric: true,
        mlRole: "numeric",
        utility: "Numeric climate / IoT feature from mixed descriptions.",
        nextSteps: "Cast to numeric → train.",
      },
      {
        id: "year_4digit",
        name: "Year (19xx / 20xx)",
        pattern: "\\b((?:19|20)\\d{2})\\b",
        description: "Four-digit year",
        example: "Report 2021-Q3 → 2021",
        castNumeric: true,
        mlRole: "numeric",
        utility: "Numeric time feature (year) from dates or titles: useful for trends.",
        nextSteps: "Cast to numeric. Can also treat as ordered categorical if few distinct years.",
      },
      {
        id: "hour_of_day",
        name: "Hour of day (0–23)",
        pattern: "\\b([01]?\\d|2[0-3])(?::[0-5]\\d)",
        description: "Hour before :mm",
        example: "Event at 09:45 → 09",
        castNumeric: true,
        mlRole: "numeric",
        utility: "Numeric cyclical feature (hour) from timestamps in text logs.",
        nextSteps: "Cast to numeric. Optional later: encode as sin/cos outside this tool, or bin morning/night via groups.",
      },
    ],
  },
  {
    category: "Categories (then encode)",
    items: [
      {
        id: "email_domain",
        name: "Email domain",
        pattern: "[a-zA-Z0-9._%+\\-]+@([a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,})",
        description: "Provider / domain only",
        example: "user@gmail.com → gmail.com",
        castNumeric: false,
        validateKind: "domain",
        mlRole: "categorical",
        utility:
          "Low/medium cardinality category (gmail.com, company.fr…). Strong for churn, fraud, support models. Full email is avoided (almost unique).",
        nextSteps: "Apply → Label encoding or Frequency encoding (or One-Hot if few domains) → train.",
      },
      {
        id: "currency_code",
        name: "Currency code (EUR/USD…)",
        pattern: "\\b(EUR|USD|GBP|CHF|JPY|CAD|AUD|CNY|MAD|TND|DZD)\\b",
        description: "ISO-like currency token",
        example: "Paid 120 EUR → EUR",
        castNumeric: false,
        mlRole: "categorical",
        utility: "Currency as category next to a numeric amount (extract amount separately).",
        nextSteps: "One-Hot or Label encoding. Pair with “Currency amount” for a complete price feature set.",
      },
      {
        id: "boolean_token",
        name: "Yes / No / True / False",
        pattern: "\\b(yes|no|true|false|y|n|oui|non)\\b",
        description: "Boolean word in text",
        example: "active: true → true",
        castNumeric: false,
        mlRole: "categorical",
        utility: "Turns free-text flags into a boolean-like category (2–8 values).",
        nextSteps: "Ignore letter case → Label encoding (or map to 0/1 in cleaning) → train.",
      },
    ],
  },
];

const findPredefinedById = (id) => {
  for (const cat of predefinedExtractionCategories) {
    const found = cat.items.find((item) => item.id === id);
    if (found) return found;
  }
  return null;
};

const isBooleanColumn = (values) => {
  const boolValues = values.map((val) => String(val).toLowerCase());
  return boolValues.every((val) =>
    ["true", "false", "1", "0", "t", "f", "yes", "no"].includes(val.toLowerCase())
  );
};

// Dans le fichier React (Data_transformation.jsx)
// Modifiez la fonction detectColumnType

const detectColumnTypeFallback = (sample) => {
  // Aligné sur le backend /analyze-column-types (échantillon page = fallback seulement)
  const nonEmpty = sample.filter((val) => val !== null && val !== undefined && String(val).trim() !== "");
  if (nonEmpty.length === 0) return "text";

  const uniqueValues = [...new Set(nonEmpty.map((v) => String(v).trim()))];
  const uniqueCount = uniqueValues.size;
  const totalCount = nonEmpty.length;
  const ratio = uniqueCount / totalCount;
  const isLowCard = uniqueCount <= 200 && ratio <= 0.05;

  if (uniqueCount === 2) return "boolean";

  const allNumeric = nonEmpty.every((val) => {
    const s = String(val).trim();
    if (s === "") return true;
    const lower = s.toLowerCase();
    if (lower === "true" || lower === "false") return false;
    return !Number.isNaN(Number(s));
  });

  if (allNumeric) {
    return isLowCard ? "categorical" : "numerical";
  }

  const dateFormats = [
    "YYYY-MM-DD", "DD-MM-YYYY", "YYYY/MM/DD", "DD/MM/YYYY",
    "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DDTHH:mm:ss",
  ];
  const dateCount = nonEmpty.filter((v) => {
    const strVal = String(v).trim();
    return dateFormats.some((fmt) => moment(strVal, fmt, true).isValid());
  }).length;
  if (!isLowCard && dateCount / nonEmpty.length > 0.5) return "date";

  return isLowCard ? "categorical" : "text";
};

const updateAppliedActions = async (bdName, actionDescription, params = {}) => {
  try {
    const response = await axios.post(
      `${backendUrl}/api/update-applied-actions`,
      {
        bdName: bdName,
        action: actionDescription,
        parameters: params
      },
      { 
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;

  } catch (error) {
    console.error("Detailed error:", error);
    throw new Error(error.response?.data?.detail || "Failed to update");
  }
};

const [extractDialogOpen, setExtractDialogOpen] = useState(false);
const [selectedExtractColumn, setSelectedExtractColumn] = useState("");
const [regexPattern, setRegexPattern] = useState("");
const [testText, setTestText] = useState("Paste your text here to test the regular expression");
const [regexMatches, setRegexMatches] = useState([]);
const [regexCaseInsensitive, setRegexCaseInsensitive] = useState(false);
const [regexDeleteSource, setRegexDeleteSource] = useState(false);
const [regexCastNumeric, setRegexCastNumeric] = useState(false);
const [regexExtractMode, setRegexExtractMode] = useState("first"); // first | all_concat | all_count
const [regexCoverage, setRegexCoverage] = useState(null);
const [regexTesting, setRegexTesting] = useState(false);
const [regexUnmatchedSamples, setRegexUnmatchedSamples] = useState([]);
const MAX_REGEX_PATTERN_LENGTH = 500;

const handleOpenExtractDialog = () => {
  setExtractDialogOpen(true);
  setSelectedExtractColumn("");
  setRegexPattern("");
  setTestText("");
  setRegexMatches([]);
  setRegexCoverage(null);
  setRegexUnmatchedSamples([]);
  setPatternError("");
  setSelectedPattern("");
  setRegexCaseInsensitive(false);
  setRegexDeleteSource(false);
  setRegexCastNumeric(false);
  setRegexExtractMode("first");
};

const handleTestRegex = async () => {
  setPatternError("");
  setRegexMatches([]);
  setRegexUnmatchedSamples([]);
  setRegexCoverage(null);

  if (!regexPattern) {
    setPatternError("Please enter a regex pattern");
    return;
  }
  if (!selectedExtractColumn) {
    setPatternError("Please select a column first");
    return;
  }
  if (regexPattern.length > MAX_REGEX_PATTERN_LENGTH) {
    setPatternError(
      `Pattern is too long (${regexPattern.length} chars). Maximum is ${MAX_REGEX_PATTERN_LENGTH}.`
    );
    return;
  }

  const { normalized } = normalizeRegexPattern(regexPattern);
  const sourceBdName = (currentBdName || bdName || "").replace(/_numerized$/, "");
  const preset = selectedPattern ? findPredefinedById(selectedPattern) : null;

  try {
    setRegexTesting(true);
    const response = await axios.post(
      `${backendUrl}/api/test-regex-pattern`,
      {
        bdName: sourceBdName,
        columnName: selectedExtractColumn,
        pattern: normalized,
        caseInsensitive: regexCaseInsensitive,
        extractMode: regexExtractMode,
        castNumeric: regexCastNumeric || regexExtractMode === "all_count",
        sampleLimit: 8,
        presetId: selectedPattern || undefined,
        validateKind: preset?.validateKind || undefined,
      },
      { withCredentials: true, headers: { "Content-Type": "application/json" } }
    );

    const data = response.data;
    setRegexCoverage({
      total_rows: data.total_rows,
      matched_rows: data.matched_rows,
      unmatched_rows: data.unmatched_rows,
      match_pct: data.match_pct,
      group_count: data.group_count,
      capturing_groups: data.capturing_groups,
      engine: data.engine,
      pattern: data.pattern,
      invalid_count: data.invalid_count || 0,
      invalid_rate: data.invalid_rate || 0,
    });

    const samples = (data.samples || []).map((s) => ({
      original: s.original || "",
      groups: s.groups || [],
      displayGroups: (s.groups || [])
        .map((g, idx) => `Group ${idx + 1}: "${g ?? "null"}"`)
        .join(" | "),
    }));

    setRegexUnmatchedSamples(
      (data.unmatched_samples || []).map((s) => ({
        original: s.original || "",
      }))
    );

    if (data.matched_rows === 0) {
      setPatternError(
        `No matches on the full dataset (${data.total_rows} rows). Try adjusting your pattern: see unmatched examples below.`
      );
      setRegexMatches([]);
    } else {
      setRegexMatches(samples);
    }
  } catch (error) {
    const detail =
      error.response?.data?.detail ||
      error.message ||
      "Regex test failed";
    setPatternError(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join("; ")
          : "Regex test failed"
    );
    setRegexMatches([]);
    setRegexUnmatchedSamples([]);
    setRegexCoverage(null);
  } finally {
    setRegexTesting(false);
  }
};

// Intro popup removed: Help is inside the extract dialog
const renderRegexIntroDialog = () => null;

const applyRegexExtraction = async () => {
  if (!regexPattern || !selectedExtractColumn) {
    alert("Please select a column and define an extraction pattern");
    return;
  }

  const { original, normalized, wasModified } = normalizeRegexPattern(regexPattern);

  if (normalized.length > MAX_REGEX_PATTERN_LENGTH) {
    alert(`Pattern is too long (${normalized.length} chars). Maximum is ${MAX_REGEX_PATTERN_LENGTH}.`);
    return;
  }

  if (!regexCoverage || regexCoverage.matched_rows === 0) {
    alert("Please run Test pattern first and ensure there are matches.");
    return;
  }

  if (regexCoverage.match_pct < 50) {
    const ok = window.confirm(
      `Warning: pattern matches only ${regexCoverage.match_pct}% of rows ` +
      `(${regexCoverage.matched_rows}/${regexCoverage.total_rows}).\n\n` +
      `${regexCoverage.unmatched_rows} rows will stay empty for extracted columns.\n\nContinue?`
    );
    if (!ok) return;
  }

  try {
    setRegexLoading(true);
    setRegexProgress(0);
    setRegexStatus("Preparing extraction...");
    setProcessing(true);

    const groupCount =
      regexExtractMode === "all_count"
        ? 1
        : Math.max(regexCoverage.capturing_groups || countCapturingGroups(normalized), 1);

    const outputColumns =
      groupColumnNames.length > 0
        ? groupColumnNames
        : regexExtractMode === "all_count"
          ? [`${selectedExtractColumn}_match_count`]
          : Array.from({ length: groupCount }, (_, i) => `${selectedExtractColumn}_group_${i + 1}`);

    setOutputColumn(outputColumns.join(", "));

    const sourceBdName = (currentBdName || bdName || "").replace(/_numerized$/, "");
    const preset = selectedPattern ? findPredefinedById(selectedPattern) : null;

    const payload = {
      bdName: sourceBdName,
      columnName: selectedExtractColumn,
      pattern: normalized,
      outputColumns,
      caseInsensitive: regexCaseInsensitive,
      deleteSource: regexDeleteSource,
      castNumeric: regexCastNumeric || regexExtractMode === "all_count",
      extractMode: regexExtractMode,
      presetId: selectedPattern || undefined,
      validateKind: preset?.validateKind || undefined,
    };

    setRegexStatus("Extracting data...");
    setRegexProgress(30);

    const response = await axios.post(`${backendUrl}/api/regex-extract`, payload, {
      withCredentials: true,
      headers: { "Content-Type": "application/json" },
    });

    setRegexProgress(70);
    setRegexStatus("Updating interface...");

    const createdColumns = response.data.columns_created || [];
    const newBdName = response.data.target_table;
    setCurrentBdName(newBdName);

    setRegexProgress(85);
    setRegexStatus("Recording actions...");

    await updateAppliedActions(newBdName, `regex_extract:${selectedExtractColumn}`, {
      pattern: normalized,
      original_pattern: wasModified ? original : undefined,
      output_column: createdColumns,
      case_insensitive: regexCaseInsensitive,
      extract_mode: regexExtractMode,
      delete_source: regexDeleteSource,
      cast_numeric: regexCastNumeric,
      validate_kind: preset?.validateKind || undefined,
      action_type: response.data.action,
    });

    setRegexProgress(95);
    setRegexStatus("Reloading data...");
    await loadDataAfterExtraction(newBdName);
    setRegexProgress(100);

    setConfigurations((prev) => [
      ...prev,
      {
        id: Date.now(),
        column: selectedExtractColumn,
        method: "regex_extract",
        parameters: {
          pattern: normalized,
          original_pattern: wasModified ? original : undefined,
          output_columns: createdColumns,
          extract_mode: regexExtractMode,
          case_insensitive: regexCaseInsensitive,
          keep: keepOption,
        },
        outputColumns: createdColumns,
        timestamp: new Date().toISOString(),
      },
    ]);

    const castNote =
      response.data.casted_numeric?.length
        ? `\nCast to numeric: ${response.data.casted_numeric.join(", ")}`
        : "";
    const delNote = response.data.deleted_source ? `\nSource column deleted.` : "";
    const normNote = wasModified
      ? `\nPattern normalized: "${original}" → "${normalized}"`
      : "";
    const m = response.data.metrics || {};
    const metricsNote = m.matched_rows != null
      ? `\nMatch rate: ${m.match_pct}% (${m.matched_rows}/${m.total_rows})` +
        (m.invalid_count ? `\nInvalid filtered: ${m.invalid_count} (${m.invalid_rate}%)` : "")
      : "";

    alert(
      `Extraction successful. ${createdColumns.length} column(s): ${createdColumns.join(", ")}` +
        castNote +
        delNote +
        normNote +
        metricsNote
    );
    setExtractDialogOpen(false);

    setTimeout(() => {
      setRegexLoading(false);
      setProcessing(false);
    }, 500);
  } catch (error) {
    console.error("Error during extraction:", error);
    let errorMessage = "Error during extraction";
    if (error.response) {
      errorMessage += `: ${error.response.data?.detail || error.response.statusText}`;
    } else if (error.request) {
      errorMessage += ": No response received from server";
    } else {
      errorMessage += `: ${error.message}`;
    }
    alert(errorMessage);
    setRegexLoading(false);
    setProcessing(false);
    setRegexProgress(0);
  }
};

const loadDataAfterExtraction = async (bdNameToLoad) => {
  try {
    const page = paginationModel.page;
    const pageSize = paginationModel.pageSize;
    
    // Récupérer les données
    const dataResponse = await axios.get(
      `${backendUrl}/api/get-data-paginatedd`,
      {
        params: {
          bdName: bdNameToLoad,
          page: page,
          pageSize: pageSize
        },
        withCredentials: true
      }
    );

    // Récupérer les types depuis le backend (NOUVEL ENDPOINT)
    const typesResponse = await axios.get(
      `${backendUrl}/api/analyze-column-types`,  // ← NOUVEAU NOM
      {
        params: {
          bdName: bdNameToLoad
        },
        withCredentials: true
      }
    );

    const formatData = (apiResponse) => {
      const columnNames = apiResponse.columns;
      return apiResponse.rows.map((row, index) => {
        const formatted = { id: index + (page * pageSize) };
        columnNames.forEach((colName, i) => {
          formatted[colName] = row[`col${i}`] ?? row[colName] ?? "";
        });
        return formatted;
      });
    };

    const pageData = formatData(dataResponse.data);
    const columns = dataResponse.data.columns;
    const totalCount = dataResponse.data.total_count;

    setTotalRows(totalCount);
    setRowCount(totalCount);

    // Construire les types
    const columnTypes = {};
    const columnStats = {};
    
    typesResponse.data.column_types.forEach(item => {
      columnTypes[item.column_name] = item.column_type;
      
      if (item.stats && (item.column_type === "numerical" || item.column_type === "categorical" || item.column_type === "boolean")) {
            columnStats[item.column_name] = {
              min: item.stats.min,
              max: item.stats.max,
              mean: item.stats.mean,
              median: item.stats.median,
              missing: (item.stats.total ?? 0) - (item.stats.non_null ?? 0),
              distinct: item.stats.distinct,
              is_numeric_content: !!item.stats.is_numeric_content || item.column_type === "numerical",
            };
      }
    });

    setState({
      isLoading: false,
      error: null,
      originalData: pageData,
      columns,
      columnStats,
      columnTypes,
    });

    return true;
  } catch (error) {
    console.error("Error reloading data:", error);
    
    // FALLBACK: Utiliser la détection frontend
    try {
      const page = paginationModel.page;
      const pageSize = paginationModel.pageSize;
      
      const dataResponse = await axios.get(
        `${backendUrl}/api/get-data-paginatedd`,
        {
          params: {
            bdName: bdNameToLoad,
            page: page,
            pageSize: pageSize
          },
          withCredentials: true
        }
      );

      const formatData = (apiResponse) => {
        const columnNames = apiResponse.columns;
        return apiResponse.rows.map((row, index) => {
          const formatted = { id: index + (page * pageSize) };
          columnNames.forEach((colName, i) => {
            formatted[colName] = row[`col${i}`] ?? row[colName] ?? "";
          });
          return formatted;
        });
      };

      const pageData = formatData(dataResponse.data);
      const columns = dataResponse.data.columns;
      const totalCount = dataResponse.data.total_count;

      setTotalRows(totalCount);
      setRowCount(totalCount);

      const columnTypes = {};
      columns.forEach((col) => {
        const sampleValues = pageData
          .map(row => row[col])
          .filter(val => val !== null && val !== "")
          .slice(0, 50);
        columnTypes[col] = detectColumnTypeFallback(sampleValues);
      });

      setState({
        isLoading: false,
        error: null,
        originalData: pageData,
        columns,
        columnStats: {},
        columnTypes,
      });
      return true;
    } catch (fallbackError) {
      alert("Data reloaded but interface may need refresh");
      return false;
    }
  }
};
const validateRegexPattern = () => {
  // Apply requires a successful full-dataset test first.
  if (!regexCoverage || regexCoverage.matched_rows <= 0) {
    setPatternError("Run Test pattern first: it checks your pattern on the full dataset.");
    return false;
  }
  return true;
};

// ==================== EXTRACT DIALOG ====================
const renderExtractDialog = () => {
  const { normalized: patternNormalized, wasModified: patternNormalizedFlag } =
    normalizeRegexPattern(regexPattern);
  const previewGroupCount =
    regexExtractMode === "all_count"
      ? 1
      : Math.max(
          regexCoverage?.capturing_groups ?? countCapturingGroups(patternNormalized),
          1
        );
  const previewColumns =
    regexExtractMode === "all_count"
      ? [`${selectedExtractColumn || "col"}_match_count`]
      : Array.from({ length: previewGroupCount }, (_, i) =>
          `${selectedExtractColumn || "col"}_group_${i + 1}`
        );

  const sourcePreviewRows = selectedExtractColumn
    ? (state.originalData || [])
        .map((row, idx) => ({
          id: row.id ?? idx,
          value: row[selectedExtractColumn],
        }))
        .filter((r) => r.value !== null && r.value !== undefined && String(r.value).trim() !== "")
        .slice(0, 8)
    : [];

  const truncate = (v, n = 80) => {
    const s = v == null ? "" : String(v);
    return s.length > n ? `${s.slice(0, n)}…` : s;
  };

  return (
  <Dialog
    open={extractDialogOpen}
    onClose={() => setExtractDialogOpen(false)}
    maxWidth="md"
    fullWidth
  >
    <DialogTitle
      sx={{
        bgcolor: '#384850',
        color: 'white',
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
      }}
    >
      <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>
        Extract from text
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setRegexTutorialOpen(true)}
          sx={{
            color: 'white',
            borderColor: 'rgba(255,255,255,0.5)',
            textTransform: 'none',
            fontWeight: 600,
            '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.08)' },
          }}
        >
          Help
        </Button>
        <IconButton size="small" onClick={() => setExtractDialogOpen(false)} sx={{ color: 'white' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </DialogTitle>

    <DialogContent dividers sx={{ p: 2.5, bgcolor: '#fff' }}>
      <Typography variant="subtitle2" sx={{ color: '#384850', fontWeight: 700, mb: 1.5 }}>
        1. Column and pattern
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="extract-source-col-label" shrink>
          Source column
        </InputLabel>
        <Select
          labelId="extract-source-col-label"
          value={selectedExtractColumn}
          displayEmpty
          notched
          renderValue={(selected) => {
            if (!selected) {
              return <em style={{ color: '#757575' }}>Select a column…</em>;
            }
            const t = state.columnTypes?.[selected];
            return t ? `${selected} (${t})` : selected;
          }}
          onChange={(e) => {
            setSelectedExtractColumn(e.target.value);
            setRegexMatches([]);
            setRegexUnmatchedSamples([]);
            setRegexCoverage(null);
            setPatternError("");
          }}
          label="Source column"
          sx={{
            minHeight: 56,
            fontSize: '1rem',
            '& .MuiSelect-select': { py: 1.75, whiteSpace: 'normal' },
          }}
          MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
        >
          <MenuItem value="" disabled>
            <em>Select a column…</em>
          </MenuItem>
          {state.columns
            .filter((col) => col !== 'split_type')
            .map((col) => (
              <MenuItem key={col} value={col} sx={{ fontSize: '0.95rem', whiteSpace: 'normal' }}>
                {col} ({state.columnTypes[col]})
              </MenuItem>
            ))}
        </Select>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 1 }}>
        <InputLabel id="extract-preset-label" shrink>
          Ready-made pattern
        </InputLabel>
        <Select
          labelId="extract-preset-label"
          value={selectedPattern || ''}
          displayEmpty
          notched
          renderValue={(selected) => {
            if (!selected) {
              return (
                <em style={{ color: '#757575' }}>
                  Select a ready-made pattern (or write your own below)…
                </em>
              );
            }
            const item = findPredefinedById(selected);
            return item ? item.name : selected;
          }}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedPattern(id);
            const selected = findPredefinedById(id);
            if (selected) {
              setRegexPattern(selected.pattern);
              setRegexCastNumeric(!!selected.castNumeric);
              if (selected.preferredMode) {
                setRegexExtractMode(selected.preferredMode);
              }
              setRegexMatches([]);
              setRegexUnmatchedSamples([]);
              setRegexCoverage(null);
              setPatternError("");
            } else {
              setSelectedPattern('');
            }
          }}
          label="Ready-made pattern"
          sx={{
            minHeight: 56,
            fontSize: '1rem',
            '& .MuiSelect-select': { py: 1.75, whiteSpace: 'normal' },
          }}
          MenuProps={{ PaperProps: { sx: { maxHeight: 420 } } }}
        >
          <MenuItem value="">
            <em>Custom / none</em>
          </MenuItem>
          {predefinedExtractionCategories.map((cat) => [
            <ListSubheader key={`h-${cat.category}`} sx={{ bgcolor: '#f5f5f5', lineHeight: '32px', fontWeight: 700 }}>
              {cat.category}
            </ListSubheader>,
            ...cat.items.map((item) => (
              <MenuItem key={item.id} value={item.id} sx={{ whiteSpace: 'normal', py: 1.25 }}>
                <Box>
                  <Typography fontWeight={600} fontSize="0.95rem">
                    {item.name}
                    {item.mlRole === 'numeric' ? ' · numeric' : item.mlRole === 'categorical' ? ' · categorical' : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                </Box>
              </MenuItem>
            )),
          ])}
        </Select>
      </FormControl>

      {selectedPattern && findPredefinedById(selectedPattern) && (() => {
        const p = findPredefinedById(selectedPattern);
        return (
          <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: '#f7f8f9' }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Example:</strong> {p.example}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>For ML:</strong>{' '}
              {p.mlRole === 'numeric'
                ? 'Numeric feature (usable for training after cast)'
                : p.mlRole === 'categorical'
                ? 'Categorical feature (encode before training)'
                : 'Feature for modeling'}
            </Typography>
            {p.utility && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Why extract this:</strong> {p.utility}
              </Typography>
            )}
            {p.nextSteps && (
              <Typography variant="body2">
                <strong>Next steps:</strong> {p.nextSteps}
              </Typography>
            )}
            {p.preferredMode === 'all_count' && (
              <Typography variant="body2" sx={{ mt: 0.5, color: '#DE6B06', fontWeight: 600 }}>
                Extraction mode set to “All matches: count”: do not keep the raw unique values.
              </Typography>
            )}
          </Paper>
        );
      })()}

      <TextField
        label="Pattern"
        value={regexPattern}
        onChange={(e) => {
          setRegexPattern(e.target.value);
          setSelectedPattern('');
          setRegexMatches([]);
          setRegexUnmatchedSamples([]);
          setRegexCoverage(null);
        }}
        fullWidth
        multiline
        minRows={3}
        placeholder="Or type your own: put () around what to extract"
        helperText="Prefer a ready-made pattern (numeric / categorical for training). Custom: use () for capture groups. Max 500 characters."
        sx={{ mt: 1, '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: '0.95rem' } }}
      />

      {patternNormalizedFlag && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontFamily: 'monospace' }}>
          Normalized: {patternNormalized}
        </Typography>
      )}

      <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f7f8f9', border: '1px solid #e0e0e0' }}>
        <Typography variant="caption" fontWeight={700} sx={{ color: '#384850', display: 'block', mb: 1 }}>
          Options
        </Typography>
        <FormControl size="small" fullWidth sx={{ mb: 1 }}>
          <InputLabel>Extraction mode</InputLabel>
          <Select
            value={regexExtractMode}
            label="Extraction mode"
            onChange={(e) => {
              setRegexExtractMode(e.target.value);
              setRegexMatches([]);
              setRegexUnmatchedSamples([]);
              setRegexCoverage(null);
            }}
          >
            <MenuItem value="first">First match per row (default)</MenuItem>
            <MenuItem value="all_concat">All matches: concatenate with |</MenuItem>
            <MenuItem value="all_count">All matches: count (numeric)</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Checkbox
              checked={regexCaseInsensitive}
              onChange={(e) => {
                setRegexCaseInsensitive(e.target.checked);
                setRegexMatches([]);
                setRegexCoverage(null);
              }}
              size="small"
            />
          }
          label={<Typography variant="body2">Ignore letter case</Typography>}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={regexCastNumeric}
              onChange={(e) => setRegexCastNumeric(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Cast result to numeric when possible</Typography>}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={regexDeleteSource}
              onChange={(e) => setRegexDeleteSource(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Delete source column after apply (off by default)</Typography>}
        />
        {selectedExtractColumn && regexPattern && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            New column(s): {previewColumns.join(', ')}
          </Typography>
        )}
      </Box>

      <Typography variant="subtitle2" sx={{ color: '#384850', fontWeight: 700, mt: 3, mb: 1 }}>
        2. Preview and test
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Below: a few rows from the selected column. Click <strong>Test on all rows</strong> to see
        what the new columns would contain (full dataset). Then click <strong>Apply</strong>.
      </Typography>

      {!selectedExtractColumn ? (
        <Alert severity="info" sx={{ mb: 1.5 }}>Select a source column to preview its values.</Alert>
      ) : sourcePreviewRows.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>No non-empty values found in this column (on the current page).</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 1.5, maxHeight: 220 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f5f5f5', width: 56 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f5f5f5' }}>{selectedExtractColumn}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sourcePreviewRows.map((row, i) => (
                <TableRow key={row.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {truncate(row.value, 120)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Button
        variant="contained"
        onClick={handleTestRegex}
        disabled={!selectedExtractColumn || !regexPattern || regexTesting}
        sx={{ bgcolor: '#DE6B06', '&:hover': { bgcolor: '#c45f05' }, textTransform: 'none', fontWeight: 700, mb: 2 }}
      >
        {regexTesting ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} color="inherit" /> Testing…
          </Box>
        ) : (
          'Test on all rows'
        )}
      </Button>

      {patternError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2">{patternError}</Typography>
        </Alert>
      )}

      {regexCoverage && !patternError && (
        <Alert
          severity={regexCoverage.match_pct >= 80 ? 'success' : regexCoverage.match_pct >= 40 ? 'warning' : 'error'}
          sx={{ mb: 2 }}
        >
          <Typography variant="body2">
            <strong>{regexCoverage.match_pct}%</strong> match
            {' '}({regexCoverage.matched_rows.toLocaleString()} / {regexCoverage.total_rows.toLocaleString()} rows)
            {regexCoverage.unmatched_rows > 0
              ? `: ${regexCoverage.unmatched_rows.toLocaleString()} rows stay empty`
              : ''}
            {regexCoverage.invalid_count > 0
              ? `: ${regexCoverage.invalid_count} invalid value(s) filtered`
              : ''}
          </Typography>
        </Alert>
      )}

      {regexMatches.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Result preview (sample matches)
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 260 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#f5f5f5' }}>{selectedExtractColumn}</TableCell>
                  {previewColumns.map((col) => (
                    <TableCell key={col} sx={{ fontWeight: 700, bgcolor: '#f5f5f5' }}>{col}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {regexMatches.slice(0, 8).map((match, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: 220 }}>
                      {truncate(match.original, 100)}
                    </TableCell>
                    {(match.groups || []).length > 0
                      ? (match.groups || []).map((g, idx) => (
                          <TableCell key={idx} sx={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}>
                            {g == null || g === '' ? 'N/A' : truncate(g, 60)}
                          </TableCell>
                        ))
                      : previewColumns.map((col) => (
                          <TableCell key={col}>-</TableCell>
                        ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {regexUnmatchedSamples.length > 0 && (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Unmatched examples (adjust the pattern if needed)
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 160 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, bgcolor: '#f5f5f5' }}>{selectedExtractColumn}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {regexUnmatchedSamples.slice(0, 6).map((sample, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {truncate(sample.original, 120)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </DialogContent>

    <DialogActions sx={{ px: 2.5, py: 1.5, bgcolor: '#f7f8f9', gap: 1 }}>
      <Button onClick={() => setExtractDialogOpen(false)} sx={{ textTransform: 'none' }}>
        Cancel
      </Button>
      <Button
        onClick={applyRegexExtraction}
        variant="contained"
        disabled={
          !selectedExtractColumn ||
          !regexPattern ||
          !regexCoverage ||
          regexCoverage.matched_rows === 0 ||
          regexTesting ||
          regexLoading
        }
        sx={{ px: 3, bgcolor: '#384850', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#2c383f' } }}
      >
        {!selectedExtractColumn
          ? 'Select a column'
          : !regexPattern
          ? 'Choose a pattern'
          : !regexCoverage
          ? 'Test first'
          : regexCoverage.matched_rows === 0
          ? 'No matches'
          : 'Apply'}
      </Button>
    </DialogActions>

    {regexLoading && (
      <Box sx={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
        bgcolor: 'white', border: '1px solid #ddd', p: 2, minWidth: 280
      }}>
        <Typography variant="body2" gutterBottom>{regexStatus}</Typography>
        <LinearProgress variant="determinate" value={regexProgress} sx={{ height: 6 }} />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {regexProgress}%
        </Typography>
      </Box>
    )}
  </Dialog>
  );
};

// ==================== REGEX HELP / GUIDE ====================
const renderRegexTutorialDialog = () => (
  <Dialog
    open={regexTutorialOpen}
    onClose={() => setRegexTutorialOpen(false)}
    maxWidth="lg"
    fullWidth
  >
    <DialogTitle sx={{ bgcolor: '#384850', color: 'white', fontWeight: 700, py: 1.5 }}>
      How to extract values from a column
    </DialogTitle>

    <DialogContent dividers sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ color: '#384850', fontWeight: 700, mb: 1 }}>
        What this tool does
      </Typography>
      <Typography paragraph>
        Some columns contain free text mixed with useful values (prices, IP addresses, emails, hashes…).
        Extraction finds those values and writes them into <strong>new columns</strong> that you can use
        for training. The same rules are reused later when you run the model on new data.
      </Typography>

      <Typography variant="h6" sx={{ color: '#384850', fontWeight: 700, mb: 1, mt: 2 }}>
        Real example (step by step)
      </Typography>
      <Typography variant="body2" paragraph>
        Imagine a column named <code>message</code> with rows like:
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell><strong>message</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow><TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>Order paid: 72,5 kg delivered</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>Weight: 10 kg: warehouse A</TableCell></TableRow>
            <TableRow><TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>No weight listed</TableCell></TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="body2" component="div" sx={{ mb: 2 }}>
        <strong>1.</strong> Open Extract from text → choose column <code>message</code>.<br />
        <strong>2.</strong> Ready-made pattern → <em>Weight (kg)</em>. Tick <em>Cast to numeric</em>.<br />
        <strong>3.</strong> Click <em>Test on all rows</em>. You see a result table, for example:
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell><strong>message</strong></TableCell>
              <TableCell><strong>message_group_1</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>Order paid: 72,5 kg delivered</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>72.5</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>Weight: 10 kg: warehouse A</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>10</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="body2" paragraph>
        The third row (&quot;No weight listed&quot;) appears under unmatched examples and stays empty after Apply.
        If the match % looks good, click <strong>Apply</strong>: the new column is written into the dataset.
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" sx={{ color: '#384850', fontWeight: 700, mb: 1 }}>
        Extraction modes: before / after
      </Typography>
      <Typography variant="body2" paragraph>
        Cell: <code>from 10.0.0.1 to 10.0.0.2</code> with pattern IPv4
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell><strong>Mode</strong></TableCell>
              <TableCell><strong>Result column</strong></TableCell>
              <TableCell><strong>When to use</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>First match</TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>10.0.0.1</TableCell>
              <TableCell>One value per cell is enough</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>All: concatenate</TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>10.0.0.1 | 10.0.0.2</TableCell>
              <TableCell>Keep every match (multi-IP logs…)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>All: count</TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>2</TableCell>
              <TableCell>Need a numeric feature (how many)</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" sx={{ color: '#384850', fontWeight: 700, mb: 1 }}>
        Other options: before / after
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell><strong>Option</strong></TableCell>
              <TableCell><strong>Before</strong></TableCell>
              <TableCell><strong>After</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Ignore letter case</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>HTTP/1.1 and http/1.1</TableCell>
              <TableCell>Both match the same pattern</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Cast to numeric</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>72,5 or 1.234,56</TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>72.5 / 1234.56 (number)</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Delete source column</TableCell>
              <TableCell>Keep <code>message</code> + new column</TableCell>
              <TableCell>Only the new column remains (irreversible)</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" sx={{ color: '#384850', fontWeight: 700, mb: 1 }}>
        Recommended workflow
      </Typography>
      <Typography variant="body2" component="div" sx={{ mb: 2 }}>
        1. Select the text column.<br />
        2. Prefer a ready-made pattern (Amount, Email domain, HTTP status, Count IPs…).<br />
        3. Choose the mode and options.<br />
        4. <strong>Test on all rows</strong>: check match %, result table, and unmatched rows.<br />
        5. If the preview looks correct, click <strong>Apply</strong>.
      </Typography>

      <Typography variant="h6" sx={{ color: '#384850', fontWeight: 700, mb: 1 }}>
        Writing your own pattern (complete guide)
      </Typography>
      <Typography variant="body2" paragraph>
        A pattern is a rule that searches inside each cell. Put parentheses <code>()</code> around
        the part you want to keep as a new column. Prefer ready-made patterns when possible;
        write your own only when no preset fits.
      </Typography>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Building blocks
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell><strong>Symbol</strong></TableCell>
              <TableCell><strong>Meaning</strong></TableCell>
              <TableCell><strong>Example</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow><TableCell><code>()</code></TableCell><TableCell>Keep this part (capture group)</TableCell><TableCell><code>([0-9]+)</code> → digits only</TableCell></TableRow>
            <TableRow><TableCell><code>\d</code></TableCell><TableCell>One digit (0–9)</TableCell><TableCell><code>\d+</code> → 123</TableCell></TableRow>
            <TableRow><TableCell><code>\w</code></TableCell><TableCell>Letter, digit or _</TableCell><TableCell><code>\w+</code> → user_01</TableCell></TableRow>
            <TableRow><TableCell><code>\s</code></TableCell><TableCell>Space / tab</TableCell><TableCell><code>kg\s*</code> → kg with optional spaces</TableCell></TableRow>
            <TableRow><TableCell><code>\b</code></TableCell><TableCell>Word edge (start/end of word)</TableCell><TableCell><code>\bIP\b</code> → whole word IP</TableCell></TableRow>
            <TableRow><TableCell><code>.</code></TableCell><TableCell>Any single character</TableCell><TableCell><code>a.c</code> → abc, a5c</TableCell></TableRow>
            <TableRow><TableCell><code>+</code> <code>*</code> <code>?</code></TableCell><TableCell>1 or more / 0 or more / optional</TableCell><TableCell><code>colou?r</code> → color or colour</TableCell></TableRow>
            <TableRow><TableCell><code>[abc]</code></TableCell><TableCell>One character from the set</TableCell><TableCell><code>[0-9.,]</code> → digit, dot or comma</TableCell></TableRow>
            <TableRow><TableCell><code>|</code></TableCell><TableCell>OR</TableCell><TableCell><code>(GET|POST)</code></TableCell></TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Method: build a complex pattern step by step
      </Typography>
      <Typography variant="body2" paragraph>
        Always start from a real cell, then add one rule at a time. Test after each step.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Example A: extract amount and currency from a invoice line
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
          Cell: Invoice #A-2041 total due: 1.234,56 EUR on 2024-03-12
        </Typography>
        <Typography variant="body2" component="div">
          <strong>Goal:</strong> keep the number <code>1.234,56</code> and the currency <code>EUR</code> (2 columns).<br /><br />
          <strong>Step 1: find the number</strong><br />
          Digits with optional thousands and decimal: <code>[0-9]+(?:[.,][0-9]+)*</code><br />
          Wrap it: <code>([0-9]+(?:[.,][0-9]+)*)</code><br /><br />
          <strong>Step 2: require a currency code after it</strong><br />
          Space then 3 letters: <code>\s+([A-Z]{'{3}'})</code><br /><br />
          <strong>Step 3: combine</strong><br />
          Final pattern:<br />
          <code>([0-9]+(?:[.,][0-9]+)*)\s+([A-Z]{'{3}'})</code><br /><br />
          <strong>Result:</strong> group 1 = <code>1.234,56</code> · group 2 = <code>EUR</code><br />
          Tip: enable <em>Cast to numeric</em> only on the amount column if you extract amount alone; with 2 groups keep text for currency.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Example B: extract IP and port from a firewall log
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
          Cell: DENY tcp src=192.168.10.44:443 dst=10.0.0.5:8080 action=drop
        </Typography>
        <Typography variant="body2" component="div">
          <strong>Goal:</strong> source IP and source port.<br /><br />
          <strong>Step 1: locate the source marker</strong><br />
          Literal text: <code>src=</code><br /><br />
          <strong>Step 2: IPv4 (4 numbers 0–255 separated by dots)</strong><br />
          <code>((?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){'{3}'}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))</code><br /><br />
          <strong>Step 3: port after a colon</strong><br />
          <code>:([0-9]{'{1,5}'})</code><br /><br />
          <strong>Step 4: combine</strong><br />
          Final pattern:<br />
          <code>src=((?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){'{3}'}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)):([0-9]{'{1,5}'})</code><br /><br />
          <strong>Result:</strong> group 1 = <code>192.168.10.44</code> · group 2 = <code>443</code><br />
          Tip: if several IPs appear in one cell, use mode <em>All: concatenate</em> or <em>All: count</em>.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Example C: extract email local-part and domain separately
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
          Cell: Contact: marie.dupont+billing@corp-mail.fr please reply
        </Typography>
        <Typography variant="body2" component="div">
          <strong>Goal:</strong> two columns: local part and domain.<br /><br />
          <strong>Step 1: local part</strong> (letters, digits, . _ % + -)<br />
          <code>([a-zA-Z0-9._%+\-]+)</code><br /><br />
          <strong>Step 2: @ then domain</strong><br />
          <code>@([a-zA-Z0-9.\-]+\.[a-zA-Z]{'{2,}'})</code><br /><br />
          <strong>Step 3: combine</strong><br />
          Final pattern:<br />
          <code>([a-zA-Z0-9._%+\-]+)@([a-zA-Z0-9.\-]+\.[a-zA-Z]{'{2,}'})</code><br /><br />
          <strong>Result:</strong> group 1 = <code>marie.dupont+billing</code> · group 2 = <code>corp-mail.fr</code>
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Example D: extract a Windows path from mixed text
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
          Cell: Process started C:\Program Files\App\bin\tool.exe pid=4421
        </Typography>
        <Typography variant="body2" component="div">
          <strong>Goal:</strong> full path ending with a file name.<br /><br />
          <strong>Step 1: drive letter</strong><br />
          <code>[A-Za-z]:\\</code><br /><br />
          <strong>Step 2: folders and file</strong> (anything except forbidden path characters)<br />
          <code>(?:[^\\/:*?&quot;&lt;&gt;|\r\n]+\\)*[^\\/:*?&quot;&lt;&gt;|\r\n]+</code><br /><br />
          <strong>Step 3: wrap as one capture</strong><br />
          Final pattern:<br />
          <code>([A-Za-z]:\\(?:[^\\/:*?&quot;&lt;&gt;|\r\n]+\\)*[^\\/:*?&quot;&lt;&gt;|\r\n]+)</code><br /><br />
          <strong>Result:</strong> <code>C:\Program Files\App\bin\tool.exe</code>
        </Typography>
      </Paper>

      <Alert severity="info" sx={{ mb: 1 }}>
        <Typography variant="body2">
          After writing a pattern: always click <strong>Test on all rows</strong>. Check the result table
          and the unmatched examples. Fix the pattern if match % is low, then Apply.
        </Typography>
      </Alert>
    </DialogContent>

    <DialogActions sx={{ p: 2, bgcolor: '#f7f8f9' }}>
      <Button
        onClick={() => setRegexTutorialOpen(false)}
        variant="contained"
        sx={{ bgcolor: '#384850', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#2c383f' } }}
      >
        Close
      </Button>
    </DialogActions>
  </Dialog>
);

const handleDeleteColumn = async () => {
  if (!columnToDelete) return;
  
  setIsDeleting(true);
  
  try {
    const response = await axios.post(
      `${backendUrl}/api/delete-column`,
      {
        originalBdName: bdName,
        currentBdName: currentBdName,
        columnName: columnToDelete
      },
      { withCredentials: true }
    );
    
    await updateAppliedActions(
      response.data.new_bd_name || currentBdName,
      `delete:${columnToDelete}`
    );

    const newBdName = response.data.new_bd_name || currentBdName;
    setCurrentBdName(newBdName);
    await loadDataAfterExtraction(newBdName);

    setConfigurations(prev => 
      prev.filter(config => config.column !== columnToDelete)
    );

    alert(`Column "${columnToDelete}" deleted successfully!`);
    setDeleteDialogOpen(false);
    setColumnToDelete(null);
    
  } catch (error) {
    console.error("Error deleting column:", error);
    alert(`Error: ${error.response?.data?.detail || error.message}`);
  } finally {
    setIsDeleting(false);
  }
};

const getAvailableMethods = (column) => {
  const columnType = state.columnTypes[column] || "text";
  let methods = [...(transformationMethods[columnType] || [])];

  // Boolean: uniquement Binary Encoding + Boolean Inversion (jamais numeric / frequency)
  // Categorical avec contenu numérique (ex. 1,2,3,4,5) : + méthodes numériques
  // Frequency Encoding : uniquement pour type "text"
  if (columnType === "categorical") {
    const isNumericContent = !!state.columnStats?.[column]?.is_numeric_content;
    if (isNumericContent) {
      const existing = new Set(methods.map((m) => m.value));
      for (const m of transformationMethods.numerical) {
        if (!existing.has(m.value)) methods.push(m);
      }
    }
  }

  // Sécurité : retirer frequency partout sauf text
  if (columnType !== "text") {
    methods = methods.filter((m) => m.value !== "frequency");
  }
  
  if (loadingTargetColumn) {
    return methods;
  }
  
  if (targetColumn && column === targetColumn) {
    return methods.filter(method => 
      method.value !== "onehot"
    );
  }
  
  return methods;
};

const [targetColumn, setTargetColumn] = useState(null);

const addConfiguration = () => {
  setConfigurations([
    ...configurations,
    {
      id: Date.now(),
      column: "",
      method: "",
      parameters: {},
      outputColumns: [],
    },
  ]);
};

const updateConfiguration = (id, field, value) => {
  setConfigurations((prev) =>
    prev.map((config) => {
      if (config.id === id) {
        const updated = { ...config, [field]: value };

        if (field === "column") {
          updated.method = "";
          updated.parameters = {};
        }

        if (field === "method" && value) {
          updated.parameters = getDefaultParameters(value, config.column);
        }

        return updated;
      }
      return config;
    })
  );
};

const getDefaultParameters = (method, column) => {
  if (method === "minmax") {
    return {
      min: 0,
      max: 1,
      clip: false,
    };
  }
 
  if (method === "log") {
    return {
      base: "natural",
      offset: 1,
    };
  }

  return {};
};

const removeConfiguration = (id) => {
  setConfigurations((prev) => prev.filter((config) => config.id !== id));
};

// ==================== NOUVEAU MODÈLE : méthode + Apply par colonne ====================

// Colonnes transformables (on masque les colonnes système)
const transformableColumns = (state.columns || []).filter(
  (col) => col !== "split_type" && col !== "id"
);

// Colonne utilisable en multivarié : numerical, boolean, ou categorical à contenu numérique (0/1/2…)
const isColumnNumericCompatible = (col) => {
  const t = state.columnTypes[col];
  if (t === "numerical") return true;
  if (t === "boolean") return true;
  if (t === "categorical") {
    const stats = state.columnStats?.[col];
    // Contenu numérique (is_numeric_content) ou stats min/max déjà présentes
    return !!(
      stats?.is_numeric_content ||
      stats?.min != null ||
      stats?.max != null ||
      stats?.mean != null
    );
  }
  return false;
};

// Ready for OM2 / Train Model: numeric features OK, at most ONE date allowed
const dateColumns = transformableColumns.filter(
  (col) => state.columnTypes[col] === "date"
);
const isColumnModelingCompatible = (col) => {
  if (isColumnNumericCompatible(col)) return true;
  // At most one date column may remain
  if (state.columnTypes[col] === "date") return dateColumns.length <= 1;
  return false;
};

// Active OM2 Multivariate + unlocks Train Model in Data Preparation
const allColumnsNumeric =
  transformableColumns.length > 0 &&
  transformableColumns.every((col) => isColumnModelingCompatible(col)) &&
  dateColumns.length <= 1;

const nonNumericColumns = transformableColumns.filter(
  (col) => !isColumnModelingCompatible(col)
);

// Signal to parent: same condition as OM2 Multivariate button (columns numeric-compatible)
useEffect(() => {
  if (typeof onOm2ReadyChange !== "function") return;
  onOm2ReadyChange(allColumnsNumeric && transformableColumns.length > 0);
}, [allColumnsNumeric, transformableColumns.length, onOm2ReadyChange]);

const setColumnMethod = (col, method) => {
  setColumnMethods((prev) => ({
    ...prev,
    [col]: {
      method,
      parameters: method ? getDefaultParameters(method, col) : {},
    },
  }));
};

const setColumnParam = (col, key, value) => {
  setColumnMethods((prev) => ({
    ...prev,
    [col]: {
      ...(prev[col] || {}),
      parameters: { ...((prev[col] || {}).parameters || {}), [key]: value },
    },
  }));
};

const clearColumnMethod = (col) => {
  setColumnMethods((prev) => {
    const next = { ...prev };
    delete next[col];
    return next;
  });
};

const pendingMethodsCount = Object.values(columnMethods).filter(
  (cm) => cm && cm.method
).length;

const applyColumnTransform = async (col) => {
  const cm = columnMethods[col];
  if (!cm || !cm.method) return;
  await handleTransform([
    { column: col, method: cm.method, parameters: cm.parameters || {} },
  ]);
  clearColumnMethod(col);
};

const applyAllTransforms = async () => {
  const configs = Object.entries(columnMethods)
    .filter(([, cm]) => cm && cm.method)
    .map(([col, cm]) => ({
      column: col,
      method: cm.method,
      parameters: cm.parameters || {},
    }));
  if (configs.length === 0) return;
  await handleTransform(configs);
  setColumnMethods({});
};

const validateConfigurations = () => {
  return configurations.every(config => 
    config.column && config.method && 
    (config.method !== "target" || config.parameters.target_column)
  );
};

const checkNegativeValues = (column) => {
  const values = state.originalData
    .map(row => row[column])
    .filter(val => val !== null && val !== "")
    .map(val => parseFloat(val))
    .filter(val => !isNaN(val));
  
  const minValue = Math.min(...values);
  const hasNegative = minValue <= 0;
  
  return { hasNegative, minValue };
};

const handleTransform = async (configsToApply = null) => {
  const configsUsed = (configsToApply && configsToApply.length)
    ? configsToApply
    : configurations;

  if (!configsUsed || configsUsed.length === 0) {
    return;
  }

  setTransformLoading(true);
  setProcessing(true);

  try {
    const statsResponse = await axios.get(
      `${backendUrl}/api/get-global-statistics?bdName=${currentBdName}`,
      { withCredentials: true }
    );
    
    const globalStats = statsResponse.data.statistics;

    const payload = configsUsed.map(config => ({
      column: config.column,
      method: config.method,
      parameters: {
        ...config.parameters,
        global_stats: globalStats[config.column]
      }
    }));

    const response = await axios.post(
      `${backendUrl}/api/process-numerisation`,
      {
        bdName: currentBdName,
        configurations: payload,
      },
      { withCredentials: true }
    );

    setConfigurations([]);
    
    setCurrentBdName(response.data.new_bd_name);

    // Récupérer les données après transformation
    const responseAfter = await axios.get(
      `${backendUrl}/api/get-data-paginatedd?bdName=${response.data.new_bd_name}`,
      { withCredentials: true }
    );

    // 🔥 CORRECTION: Utiliser l'API backend pour les types
    const typesResponse = await axios.get(
      `${backendUrl}/api/analyze-column-types`,
      {
        params: {
          bdName: response.data.new_bd_name
        },
        withCredentials: true
      }
    );

    const formatData = (apiResponse) => {
      const columnNames = apiResponse.data.columns;
      return apiResponse.data.rows.map((row, index) => {
        const formatted = { id: index };
        columnNames.forEach((colName, i) => {
          formatted[colName] = row[`col${i}`] ?? row[colName] ?? "";
        });
        return formatted;
      });
    };

    const fullData = formatData(responseAfter);
    const columns = responseAfter.data.columns;

    // 🔥 CORRECTION: Construire les types à partir de la réponse du backend
    const columnTypes = {};
    const columnStats = {};
    
    typesResponse.data.column_types.forEach(item => {
      columnTypes[item.column_name] = item.column_type;
      
      if (item.stats && (item.column_type === "numerical" || item.column_type === "categorical" || item.column_type === "boolean")) {
            columnStats[item.column_name] = {
              min: item.stats.min,
              max: item.stats.max,
              mean: item.stats.mean,
              median: item.stats.median,
              missing: (item.stats.total ?? 0) - (item.stats.non_null ?? 0),
              distinct: item.stats.distinct,
              is_numeric_content: !!item.stats.is_numeric_content || item.column_type === "numerical",
            };
      }
    });

    setState({
      isLoading: false,
      error: null,
      originalData: fullData,
      columns,
      columnStats,
      columnTypes,
    });

    // Sauvegarder les actions spéciales
    for (const config of configsUsed) {
      if (config.method === "log") {
        await updateAppliedActions(
          response.data.new_bd_name,
          `log_transform:${config.column}`,
          {
            base: config.parameters?.base,
            offset: config.parameters?.offset
          }
        );
      }
    }

    setSuccess("Transformation applied successfully!");
    setTimeout(() => setSuccess(""), 4000);
    onDataChanged?.();
  } catch (error) {
    setState((prev) => ({
      ...prev,
      error: error.response?.data?.detail || error.message,
    }));
  } finally {
    setTransformLoading(false);
    setProcessing(false);
  }
};

const extractLabelMapping = (originalData, transformedData, columnName) => {
  const mapping = {};
  
  const originalMap = {};
  originalData.forEach(row => {
    originalMap[row.id] = row[columnName];
  });
  
  transformedData.forEach(transformedRow => {
    const originalCategory = originalMap[transformedRow.id];
    if (originalCategory !== undefined && transformedRow[columnName] !== undefined) {
      mapping[originalCategory] = transformedRow[columnName];
    }
  });
  
  return mapping;
};

const loadColumnStats = async (column) => {
  try {
    const response = await axios.get(
      `${backendUrl}/api/get-column-statss`,
      {
        params: {
          bdName: currentBdName,
          column: column
        },
        withCredentials: true
      }
    );
    
    setState(prev => ({
      ...prev,
      columnStats: {
        ...prev.columnStats,
        [column]: response.data.stats
      }
    }));
  } catch (error) {
    console.error("Error loading column stats:", error);
  }
};

const validateColumnsForModeling = () => {
  const invalidTypes = ['categorical'];
  let hasTextColumns = false;
  let hasInvalidColumns = false;
  
  let dateColumnsCount = 0;
  let dateColumnsList = [];

  state.columns.forEach(col => {
    if (col === 'split_type') return;

    const type = state.columnTypes[col];

    if (type === 'date') {
      dateColumnsCount++;
      dateColumnsList.push(col);
      // Single date is allowed; multiple dates blocked below
      return;
    }

    if (type === 'boolean') {
      const sampleValues = state.originalData.slice(0, 10).map(row => row[col]);
      const isBinary = sampleValues.every(val =>
        val === 0 || val === 1 || val === '0' || val === '1'
      );
      if (!isBinary) hasInvalidColumns = true;
    }
    else if (invalidTypes.includes(type)) {
      hasInvalidColumns = true;
    }
    else if (type === 'text') {
      hasTextColumns = true;
      hasInvalidColumns = true;
    }
  });

  if (dateColumnsCount > 1) {
    return {
      hasTextColumns,
      hasInvalidColumns: true,
      dateError: true,
      dateColumnsCount,
      dateColumnsList,
    };
  }

  return {
    hasTextColumns,
    hasInvalidColumns,
    dateError: false,
    dateColumnsCount,
    dateColumnsList,
  };
};

const handleNavigateToModelSelection = async () => {
  const emptyRowsCount = countRowsWithEmptyValues(state.originalData);
  if (emptyRowsCount > 0) {
    alert(
      `You cannot proceed to Outlier Manager 2 while there are ${emptyRowsCount} rows with empty values.\n\nPlease remove empty rows using the "Clean" button or manually fix missing values before continuing.`
    );
    return;
  }

  const { hasTextColumns, hasInvalidColumns, dateError, dateColumnsCount, dateColumnsList } = validateColumnsForModeling();

  if (dateError) {
    alert(
      `Multiple date columns detected (${dateColumnsCount}): ${dateColumnsList.join(', ')}\n\n` +
      `Only ONE date column is allowed (for optional Time Series validation).\n\n` +
      `Use Auto Transform to keep one date and delete the rest, or delete the extra date columns manually.`
    );
    return;
  }

  if (hasTextColumns && hasInvalidColumns) {
    const textColumnsList = state.columns.filter(col => 
      col !== 'split_type' && state.columnTypes[col] === 'text'
    );
    
    alert(
      `Text Columns Detected (${textColumnsList.length})\n\n` +
      `Text columns found: ${textColumnsList.join(', ')}\n\n` +
      `You cannot proceed while text columns remain unencoded.\n\n` +
      `Use Frequency Encoding on text columns, or "Extract with Regex" to pull numerical features.`
    );
    return;
  }

  if (hasInvalidColumns) {
    alert(
      `Some columns are not in a compatible format:\n\n` +
      `- Unencoded categorical columns\n` +
      `- Booleans not converted (true/false instead of 0/1)\n` +
      `- More than one date column\n\n` +
      `Note: At most ONE date column is allowed (optional Time Series validation).\n` +
      `The split_type column is ignored in these checks.\n\n` +
      `Please apply the necessary transformations before continuing.`
    );
    return;
  }

  setProcessing(true);
  
  try {
    const checkResponse = await axios.get(
      `${backendUrl}/api/check-numerized?bdName=${bdName}`,
      { withCredentials: true }
    );
    
    let finalBdName = currentBdName;
    
    if (!checkResponse.data.numerizedExists) {
      const response = await axios.post(
        `${backendUrl}/api/create-reset-copy2`,
        {
          source_db: currentBdName,
          target_db: `${bdName}_numerized`,
          reset: false
        },
        { withCredentials: true }
      );
      
      finalBdName = response.data.new_bd_name || `${bdName}_numerized`;
      setCurrentBdName(finalBdName);
    } else {
      finalBdName = `${bdName}_numerized`;
      
      if (currentBdName !== finalBdName) {
        setCurrentBdName(finalBdName);
      }
    }
    
    await axios.post(
      `${backendUrl}/api/update-stage`,
      { 
        bdName: finalBdName,
        newStage: "outlier_manager2" 
      },
      { withCredentials: true }
    );

    // Checkpoint the working original table (never overwrite _reset from _numerized)
    await axios.post(
      `${backendUrl}/api/dataset/save-checkpoint`,
      { source_db: bdName },
      { withCredentials: true }
    );
    const resetBdName = `${bdName}_reset`;

    try {
      navigate("/data_preparation", {
        state: {
          bdName: bdName,
          initialTab: 3,
          numerizedBdName: finalBdName,
          originalBdName: bdName,
          resetBdName: resetBdName
        }
      });
      
    } catch (resetError) {
      console.warn("Navigation after checkpoint failed", resetError);
      
      navigate("/data_preparation", {
        state: {
          bdName: bdName,
          initialTab: 3,
          numerizedBdName: finalBdName,
          originalBdName: bdName,
          resetBdName: resetBdName
        }
      });
    }
    
  } catch (error) {
    console.error("Error during navigation preparation:", error);
    alert(`Error: ${error.response?.data?.detail || error.message}`);
  } finally {
    setProcessing(false);
  }
};

const renderColumnStats = (column) => {
  if (column && !state.columnStats[column]) {
    loadColumnStats(column);
  }

  if (!state.columnStats[column]) {
    return (
      <Box sx={{ mt: 1, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  const stats = state.columnStats[column];
  return (
    <Box sx={{ mt: 1, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
      <Typography variant="subtitle2">Statistics:</Typography>
      <Grid container spacing={1}>
        <Grid item xs={6}>
          Min: {stats.min?.toFixed(2) || 'N/A'}
        </Grid>
        <Grid item xs={6}>
          Max: {stats.max?.toFixed(2) || 'N/A'}
        </Grid>
        <Grid item xs={6}>
          Mean: {stats.mean?.toFixed(2) || 'N/A'}
        </Grid>
        <Grid item xs={6}>
          Median: {stats.median?.toFixed(2) || 'N/A'}
        </Grid>
        <Grid item xs={12}>
          Missing values: {stats.missing || 0}
        </Grid>
      </Grid>
    </Box>
  );
};

// Petit indicateur de statistique
const StatChip = ({ label, value }) => (
  <Chip
    size="small"
    variant="outlined"
    label={`${label}: ${value !== undefined && value !== null && !isNaN(value) ? Number(value).toFixed(2) : 'N/A'}`}
    sx={{ fontSize: '0.7rem', height: 22 }}
  />
);

// Nouveau panneau de transformation : une méthode + Apply par colonne, + Apply All
const renderTransformationPanel = () => {
  if (!state.originalData) return null;

  const search = (columnSearch || "").toLowerCase();
  const cols = transformableColumns.filter((c) =>
    c.toLowerCase().includes(search)
  );

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3, borderRadius: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          mb: 1,
        }}
      >
        <Typography variant="h6" fontWeight="bold" sx={{ color: colorPalette.primary, flexGrow: 1 }}>
          Transform Columns
        </Typography>
        {targetColumn && (
          <Chip label={`Target: ${targetColumn}`} color="primary" variant="outlined" size="small" />
        )}
        <TextField
          size="small"
          placeholder="Search column…"
          value={columnSearch}
          onChange={(e) => setColumnSearch(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.disabled' }} /> }}
          sx={{ minWidth: 200 }}
        />
        <Tooltip title={pendingMethodsCount === 0 ? "Select at least one method to apply" : "Apply every selected method at once"}>
          <span>
            <Button
              variant="contained"
              onClick={applyAllTransforms}
              disabled={processing || pendingMethodsCount === 0}
              startIcon={<AutoFixHighIcon />}
              sx={{
                backgroundColor: colorPalette.secondary,
                '&:hover': { backgroundColor: '#c55a05' },
              }}
            >
              Apply All ({pendingMethodsCount})
            </Button>
          </span>
        </Tooltip>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pick a transformation method for a column, then click <strong>Apply</strong>.
        Selected several? Use <strong>Apply All</strong> to run them together.
      </Typography>

      {cols.length === 0 && (
        <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
          No columns match your search.
        </Typography>
      )}

      <Grid container spacing={2}>
        {cols.map((col) => {
          const type = state.columnTypes[col] || 'text';
          const isTarget = targetColumn && col === targetColumn;
          const methods = getAvailableMethods(col);
          const cm = columnMethods[col] || { method: '', parameters: {} };
          const stats = state.columnStats[col];
          const disabledType = false;
          const isDateType = type === 'date';

          return (
            <Grid item xs={12} md={6} lg={4} key={col}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  borderColor: isTarget ? '#ff5722' : 'divider',
                  borderWidth: isTarget ? 2 : 1,
                  backgroundColor: cm.method ? 'rgba(222,107,6,0.04)' : '#fff',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography fontWeight={700} noWrap title={col} sx={{ flexGrow: 1 }}>
                    {col}
                  </Typography>
                  {isTarget && <Chip label="target" size="small" color="warning" />}
                  <Chip
                    label={type}
                    size="small"
                    sx={{
                      bgcolor:
                        type === 'numerical' ? '#e3f2fd'
                        : type === 'categorical' ? '#e8f5e9'
                        : type === 'boolean' ? '#fff3e0'
                        : type === 'date' ? '#fff4e5'
                        : '#f0f0f0',
                      fontWeight: 600,
                    }}
                  />
                  {!isTarget && col !== 'split_type' && (
                    <Tooltip title="Delete this column">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setColumnToDelete(col);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={processing || isDeleting}
                        sx={{ ml: 0.25 }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                {type === 'numerical' && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    <StatChip label="mean" value={stats?.mean} />
                    <StatChip label="median" value={stats?.median} />
                    <StatChip label="min" value={stats?.min} />
                    <StatChip label="max" value={stats?.max} />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`missing: ${stats?.missing ?? 0}`}
                      sx={{ fontSize: '0.7rem', height: 22 }}
                    />
                  </Box>
                )}
                {(type === 'categorical' || type === 'boolean') && stats?.distinct != null && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${stats.distinct} unique`}
                    sx={{ fontSize: '0.7rem', height: 22, alignSelf: 'flex-start' }}
                  />
                )}

                {isDateType && (
                  <Alert severity="info" sx={{ py: 0, fontSize: '0.78rem' }}>
                    Date columns use the same methods as text. You can also leave them as-is
                    for optional <strong>Time Series</strong> validation in Create Model
                    (they are not used as normal features). Or use <strong>Extract from text</strong> above.
                  </Alert>
                )}
                {type === 'text' && (
                  <Alert severity="info" sx={{ py: 0, fontSize: '0.78rem' }}>
                    You can also use <strong>Extract with Regex</strong> above to pull patterns from this text column.
                  </Alert>
                )}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Method</InputLabel>
                        <Select
                          value={cm.method || ''}
                          label="Method"
                          onChange={(e) => setColumnMethod(col, e.target.value)}
                          disabled={loadingTargetColumn}
                        >
                          <MenuItem value=""><em>None</em></MenuItem>
                          {methods.map((m) => (
                            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        variant="contained"
                        onClick={() => applyColumnTransform(col)}
                        disabled={processing || !cm.method}
                        sx={{
                          backgroundColor: colorPalette.primary,
                          whiteSpace: 'nowrap',
                          '&:hover': { backgroundColor: '#003d54' },
                        }}
                      >
                        Apply
                      </Button>
                    </Box>

                    {cm.method === 'minmax' && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          size="small"
                          type="number"
                          label="Min"
                          value={cm.parameters?.min ?? 0}
                          onChange={(e) => setColumnParam(col, 'min', parseFloat(e.target.value))}
                          fullWidth
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Max"
                          value={cm.parameters?.max ?? 1}
                          onChange={(e) => setColumnParam(col, 'max', parseFloat(e.target.value))}
                          fullWidth
                        />
                      </Box>
                    )}

                    {cm.method && (
                      <Typography variant="caption" color="text.secondary">
                        {methods.find((m) => m.value === cm.method)?.description}
                      </Typography>
                    )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
};

const renderDataTable = () => {
  if (!state.originalData) return null;

  const columns = state.columns.map((col) => ({
    field: col,
    headerName: col,
    width: 150,
    headerClassName:
      state.columnTypes[col] === "numerical"
        ? "numerical-header"
        : "categorical-header",
    cellClassName:
      state.columnTypes[col] === "numerical"
        ? "numerical-cell"
        : "categorical-cell",
  }));

  return (
    <Box sx={{ height: 400, width: "100%", mt: 2 }}>
      <DataGrid
        rows={state.originalData}
        columns={columns}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[25, 50, 100]}
        rowCount={totalRows}
        paginationMode="server"
        loading={loadingData}
        disableRowSelectionOnClick
        onCellClick={(params) => setSelectedColumn(params.field)}
      />
    </Box>
  );
};

// L'ancien panneau "Transformation Configurations" (ajouter config → choisir colonne)
// a été remplacé par renderTransformationPanel() : une méthode + Apply par colonne, + Apply All.

const renderDeleteDialog = () => (
  <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
    <DialogTitle>Delete a column</DialogTitle>
    <DialogContent>
      <Typography paragraph>
        Select the column to delete. This action is irreversible.
      </Typography>
      
      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel>Column to delete</InputLabel>
        <Select
          value={columnToDelete || ''}
          onChange={(e) => setColumnToDelete(e.target.value)}
          label="Column to delete"
        >
          {state.columns
            .filter(col => col !== 'split_type')
            .map((col) => (
              <MenuItem key={col} value={col}>
                {col} ({state.columnTypes[col] || 'unknown'})
              </MenuItem>
            ))}
        </Select>
      </FormControl>
    </DialogContent>
    <DialogActions>
      <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
      <Button 
        onClick={handleDeleteColumn}
        color="error"
        disabled={!columnToDelete || isDeleting}
      >
        {isDeleting ? <CircularProgress size={24} /> : "Delete"}
      </Button>
    </DialogActions>
  </Dialog>
);

const loadData = async (page = 0, pageSize = 50) => {
  try {
    setLoadingData(true);
    setState((prev) => ({ ...prev, error: null }));

    // Nouveau workflow : on travaille TOUJOURS sur la table originale
    // (plus de version "_numerized" ; les transformations sont appliquées en place).
    const finalBdName = bdName;

    setCurrentBdName(finalBdName);

    // 1. Récupérer les données (comme avant)
    const dataResponse = await axios.get(
      `${backendUrl}/api/get-data-paginatedd`,
      {
        params: {
          bdName: finalBdName,
          page: page,
          pageSize: pageSize
        },
        withCredentials: true
      }
    );

    // 2. Récupérer les types de colonnes depuis le backend (NOUVEL ENDPOINT)
    const typesResponse = await axios.get(
      `${backendUrl}/api/analyze-column-types`,
      {
        params: {
          bdName: finalBdName
        },
        withCredentials: true
      }
    );

    let targetColumnFromBackend = null;
    try {
      const targetResponse = await axios.get(
        `${backendUrl}/api/get-target-column?dbName=${bdName}`,
        { withCredentials: true }
      );
      
      if (targetResponse.data && targetResponse.data.target_column) {
        targetColumnFromBackend = targetResponse.data.target_column;
      }
    } catch (error) {
      console.warn("Could not fetch target column:", error);
    }

    // 3. Formater les données
    const formatData = (apiResponse) => {
      const columnNames = apiResponse.columns;
      return apiResponse.rows.map((row, index) => {
        const formatted = { id: index + (page * pageSize) };
        columnNames.forEach((colName, i) => {
          formatted[colName] = row[`col${i}`] ?? row[colName] ?? "";
        });
        return formatted;
      });
    };

    const pageData = formatData(dataResponse.data);
    const columns = dataResponse.data.columns;
    const totalCount = dataResponse.data.total_count;

    setTotalRows(totalCount);
    setRowCount(totalCount);

    // 4. Construire les types à partir de la réponse du backend
    const columnTypes = {};
    const columnStats = {};
    
    typesResponse.data.column_types.forEach(item => {
      columnTypes[item.column_name] = item.column_type;
      
      if (item.stats && (item.column_type === "numerical" || item.column_type === "categorical" || item.column_type === "boolean")) {
            columnStats[item.column_name] = {
              min: item.stats.min,
              max: item.stats.max,
              mean: item.stats.mean,
              median: item.stats.median,
              missing: (item.stats.total ?? 0) - (item.stats.non_null ?? 0),
              distinct: item.stats.distinct,
              is_numeric_content: !!item.stats.is_numeric_content || item.column_type === "numerical",
            };
      }
    });

    // 5. Détecter la colonne target
    let detectedTargetColumn = null;
    if (targetColumnFromBackend && columns.includes(targetColumnFromBackend)) {
      detectedTargetColumn = targetColumnFromBackend;
    }

    setTargetColumn(detectedTargetColumn);
    setLoadingTargetColumn(false);

    setState({
      isLoading: false,
      error: null,
      originalData: pageData,
      columns,
      columnStats,
      columnTypes,
    });

  } catch (error) {
    console.error("Error loading data:", error);
    
    // FALLBACK: Utiliser la détection frontend si l'API backend échoue
    console.warn("Falling back to frontend detection...");
    try {
      // Nouveau workflow : toujours la table originale
      const fallbackBdName = bdName;

      const fallbackData = await axios.get(
        `${backendUrl}/api/get-data-paginatedd`,
        {
          params: {
            bdName: fallbackBdName,
            page: page,
            pageSize: pageSize
          },
          withCredentials: true
        }
      );
      
      const formatData = (apiResponse) => {
        const columnNames = apiResponse.columns;
        return apiResponse.rows.map((row, index) => {
          const formatted = { id: index + (page * pageSize) };
          columnNames.forEach((colName, i) => {
            formatted[colName] = row[`col${i}`] ?? row[colName] ?? "";
          });
          return formatted;
        });
      };

      const pageData = formatData(fallbackData.data);
      const columns = fallbackData.data.columns;
      const totalCount = fallbackData.data.total_count;

      setTotalRows(totalCount);
      setRowCount(totalCount);

      // Utiliser la détection frontend comme fallback
      const columnTypes = {};
      columns.forEach((col) => {
        const sampleValues = pageData
          .map(row => row[col])
          .filter(val => val !== null && val !== "")
          .slice(0, 50);
        columnTypes[col] = detectColumnTypeFallback(sampleValues);
      });

      setState({
        isLoading: false,
        error: null,
        originalData: pageData,
        columns,
        columnStats: {},
        columnTypes,
      });
      setLoadingTargetColumn(false);
    } catch (fallbackError) {
      console.error("Fallback also failed:", fallbackError);
      setState({
        isLoading: false,
        error: error.response?.data?.detail || error.message,
        originalData: null,
        columns: [],
        columnStats: {},
        columnTypes: {}
      });
      setLoadingTargetColumn(false);
    }
  } finally {
    setLoadingData(false);
    setCheckingNumerized(false);
  }
};

useEffect(() => {
  if (!bdName) {
    navigate("/upload");
    return;
  }
  
  setLoadingTargetColumn(true);
  loadData(paginationModel.page, paginationModel.pageSize);
}, [bdName, navigate]);

useEffect(() => {
  if (bdName) {
    loadData(paginationModel.page, paginationModel.pageSize);
  }
}, [bdName, paginationModel.page, paginationModel.pageSize]);

if (state.isLoading) {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="300px"
    >
      <CircularProgress />
    </Box>
  );
}

if (state.error) {
  return (
    <Box sx={{ p: 3 }}>
      <Alert severity="error" sx={{ mb: 2 }}>
        Error loading data: {state.error}
      </Alert>
      <Button onClick={() => navigate(-1)} variant="contained">
        Back
      </Button>
    </Box>
  );
}

return (
  <Box sx={{ p: embedded ? 0 : 3, maxWidth: '100%', width: '100%' }}>
    <LoadingOverlay />
    <HelpDialog open={helpDialogOpen} onClose={() => setHelpDialogOpen(false)} />
    <MethodHelpDialog />

    <Box className="dp-tab-toolbar">
      <Typography variant="h6" className="dp-tab-toolbar-title" sx={{ color: '#384850', fontWeight: 700 }}>
        Transform: Feature Engineering
      </Typography>

      <Box className="dp-tab-toolbar-actions">
        <Button
          variant="contained"
          startIcon={<AutoFixHighIcon />}
          onClick={() => setOpenAutoTransform(true)}
          disabled={processing}
          sx={{
            height: 40,
            textTransform: 'none',
            fontWeight: 700,
            backgroundColor: '#DE6B06',
            '&:hover': { backgroundColor: '#c55a05' },
          }}
        >
          Auto Transform
        </Button>

        <Tooltip title="View user guide">
          <Button
            variant="outlined"
            startIcon={<HelpOutlineIcon />}
            onClick={handleOpenHelp}
            sx={{
              height: 40,
              textTransform: 'none',
              borderColor: '#384850',
              color: '#384850',
              fontWeight: 600,
            }}
          >
            Help
          </Button>
        </Tooltip>

        <DatasetCheckpointControls
          bdName={bdName}
          copyType="data_transformation"
          disabled={processing}
          showSave={false}
          onResetSuccess={async (msg) => {
            alert(msg || "Dataset restored from reset checkpoint.");
            await reloadAfterCheckpointReset();
          }}
          onError={(msg) => alert(msg)}
        />
      </Box>
    </Box>

    {!embedded && (
    <Box sx={{ mb: 2 }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Working dataset:</strong> {bdName}
        </Typography>
      </Alert>
    </Box>
    )}

    {!embedded && (
    <Box mt={4} display="flex" justifyContent="space-between">
      <Tooltip title="Return to outlier management step">
        <Button
          variant="contained"
          color="primary"
          startIcon={<ArrowBackIos sx={{ fontSize: '16px' }} />}
          onClick={handleBackToOutlierManager}
          disabled={processing}
          sx={{
            minWidth: '220px',
            height: '40px',
            backgroundColor: '#DE6B06',
            fontWeight: '600',
            fontSize: '0.9rem',
            '&:hover': {
              backgroundColor: '#c55a05',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
            },
            transition: 'all 0.2s ease-in-out'
          }}
        >
          {processing ? <CircularProgress size={20} /> : "Back to Outlier Manager"}
        </Button>
      </Tooltip>
      
      <Button
        variant="contained"
        onClick={async () => {
          await handleNavigateToModelSelection();
        }}
        disabled={processing}
        endIcon={<ArrowForwardIos/>}
        sx={{
          backgroundColor: '#338938ff',
          '&:hover': {
            backgroundColor: '#2e7d32'
          }
        }}
      >
        {processing ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          "Proceed to Outlier Manager 2"
        )}
      </Button>
    </Box>
    )}
    
    <Box mb={3} mt={embedded ? 0 : 3}>
      <Typography paragraph>
        Apply numerical transformations to your data, detect outliers, or extract new fields.
        Choose a method per column and click Apply: or run several at once with Apply All.
      </Typography>
    </Box>

    {/* Barre d'actions */}
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
    <Button
      variant="outlined"
      color="error"
      onClick={() => setDeleteDialogOpen(true)}
    >
      Delete a column
    </Button>

    <Button
      variant="outlined"
      color="primary"
      onClick={handleOpenExtractDialog}
      sx={{ 
        backgroundColor: '#f0f4f8',
        borderColor: colorPalette.primary,
        color: colorPalette.primary,
        textTransform: 'none',
        fontWeight: 600,
        '&:hover': {
          backgroundColor: '#e0e9f2',
          borderColor: colorPalette.primary
        }
      }}
    >
      Extract from text
    </Button>

    <Button
      variant="outlined"
      onClick={() => setOutlierDialog('v1')}
      startIcon={<ScatterPlotIcon />}
      sx={{
        borderColor: colorPalette.secondary,
        color: colorPalette.secondary,
        '&:hover': { borderColor: colorPalette.secondary, backgroundColor: 'rgba(222,107,6,0.06)' }
      }}
    >
      Outlier Manager
    </Button>

    <Tooltip
      title={
        allColumnsNumeric
          ? ""
          : dateColumns.length > 1
            ? `Only one date column is allowed. Extra dates: ${dateColumns.join(', ')}: keep one (Auto Transform) or delete the rest.`
            : `Available once every column is numeric-compatible (at most one date allowed). Remaining: ${nonNumericColumns.join(', ') || 'N/A'}`
      }
    >
      <span>
        <Button
          variant="outlined"
          onClick={() => setOutlierDialog('v2')}
          disabled={!allColumnsNumeric}
          startIcon={<BubbleChartIcon />}
          sx={{
            borderColor: colorPalette.primary,
            color: colorPalette.primary,
            '&:hover': { borderColor: colorPalette.primary, backgroundColor: 'rgba(56,72,80,0.06)' }
          }}
        >
          Outlier Manager (Multivariate)
        </Button>
      </span>
    </Tooltip>
    </Box>

    <Tooltip title="Rows containing at least one empty value (NULL, '', 'null', [], {})">
      <Box display="flex" alignItems="center" sx={{ 
        p: 1.5, 
        border: '1px solid', 
        borderColor: emptyRowsCount > 0 ? 'warning.main' : 'divider',
        borderRadius: 1,
        backgroundColor: emptyRowsCount > 0 ? '#fff3e0' : 'background.paper'
      }}>
        <Typography variant="body2" sx={{ mr: 2, fontWeight: 500 }}>
          Rows with empty values: {emptyRowsCount} / {totalRows || 0}
        </Typography>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={handleDeleteEmptyRows}
          disabled={emptyRowsCount === 0 || processing}
          color="warning"
          startIcon={processing ? <CircularProgress size={16} /> : <DeleteSweepIcon fontSize="small" />}
          sx={{
            borderColor: colorPalette.secondary,
            color: colorPalette.secondary,
            '&:hover': {
              borderColor: colorPalette.secondary,
              backgroundColor: 'rgba(222, 107, 6, 0.04)'
            }
          }}
        >
          Clean
        </Button>
      </Box>
    </Tooltip>
    
    {renderRegexIntroDialog()}
    {renderExtractDialog()}
    {renderRegexTutorialDialog()}

    <AutoTransformDialog
      open={openAutoTransform}
      onClose={() => setOpenAutoTransform(false)}
      bdName={currentBdName || bdName}
      showSnackbar={(msg, severity) => {
        if (severity === "error") {
          setState((prev) => ({ ...prev, error: msg }));
        } else {
          setSuccess(msg);
          setTimeout(() => setSuccess(""), 5000);
        }
      }}
      onCompleted={async () => {
        await loadData(paginationModel.page, paginationModel.pageSize);
        onDataChanged?.();
      }}
    />

    {success && (
      <Alert severity="success" sx={{ my: 2 }} onClose={() => setSuccess("")}>
        {success}
      </Alert>
    )}
    {state.error && (
      <Alert severity="error" sx={{ my: 2 }} onClose={() => setState((prev) => ({ ...prev, error: null }))}>
        {state.error}
      </Alert>
    )}

    {renderDataTable()}
    {renderTransformationPanel()}
    {renderDeleteDialog()}

    <OutlierManagerDialog
      open={outlierDialog === 'v1'}
      onClose={() => { setOutlierDialog(null); loadData(paginationModel.page, paginationModel.pageSize); onDataChanged?.(); }}
      variant="v1"
      bdName={currentBdName || bdName}
    />
    <OutlierManagerDialog
      open={outlierDialog === 'v2'}
      onClose={() => { setOutlierDialog(null); loadData(paginationModel.page, paginationModel.pageSize); onDataChanged?.(); }}
      variant="v2"
      bdName={currentBdName || bdName}
      originalBdName={bdName}
    />
    
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
    >
      <DialogTitle>
        <SaveIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Save Dataset Copy
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
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
                {saveCopyLoading ? "Overwriting..." : "Overwrite Existing"}
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
      <DialogActions>
        <Button 
          onClick={() => {
            setSaveDialogOpen(false);
            setError("");
            setNameConflict(false);
            setDatasetLimitReached(false);
          }} 
          startIcon={<ClearIcon />}
        >
          Cancel
        </Button>
        
        {!nameConflict && !datasetLimitReached && (
          <Button 
            onClick={() => handleSaveCopy(false)}
            variant="contained"
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
};

export default Data_transformation;