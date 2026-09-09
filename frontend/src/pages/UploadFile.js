import axios from "axios";
import { useEffect,useState, useCallback } from "react";
import { useNavigate } from "react-router-dom"; 
import * as XLSX from "xlsx";
import { DataGrid } from "@mui/x-data-grid";
import { 
  Box, Button, Input, Modal, Checkbox, List, ListItem, ListItemText, 
  TextField, Typography, FormControl, FormControlLabel, Radio, RadioGroup,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Card, CardContent, Stepper, Step, StepLabel, Chip,
  Alert, IconButton, LinearProgress, styled, CircularProgress
} from "@mui/material";
import { Delete as DeleteIcon } from "@mui/icons-material";
import './UploadFile.css';
import {
  Upload as UploadIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Edit as EditIcon
} from "@mui/icons-material";
import { backendUrl } from "../config";
import { normalizeDatasetName, validateDatasetNameInput } from "../utils/datasetName";

// Must match backend validate_column_name (safe SQL identifiers)
const COLUMN_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
const RESERVED_COLUMN_NAMES = new Set(["id"]);

function getColumnNameIssue(name, allNames, index) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Name cannot be empty";
  if (RESERVED_COLUMN_NAMES.has(trimmed.toLowerCase())) {
    return "Name 'id' is reserved: please rename this column";
  }
  if (!COLUMN_NAME_RE.test(trimmed)) {
    return "Use only letters, numbers, _; must start with a letter or _";
  }
  const dup = allNames.some(
    (n, i) => i !== index && (n ?? "").trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (dup) return "Duplicate name";
  return null;
}

function collectColumnNameErrors(names) {
  const errors = {};
  names.forEach((name, index) => {
    const issue = getColumnNameIssue(name, names, index);
    if (issue) errors[index] = issue;
  });
  return errors;
}

// Styled components for better UI
const StyledUploadArea = styled(Box)(({ theme }) => ({
  border: `2px dashed #384850`,
  borderRadius: 2,
  padding: theme.spacing(4),
  textAlign: 'center',
  backgroundColor: '#ffffff',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease, background-color 0.15s ease',
  '&:hover': {
    backgroundColor: '#f3f4f5',
    borderColor: '#384850'
  }
}));

const FileInfoCard = styled(Card)(({ theme }) => ({
  marginTop: theme.spacing(3),
  border: '1px solid #c8c9ca',
  boxShadow: 'none',
  borderRadius: 2
}));

const DataGridContainer = styled(Box)(({ theme }) => ({
  height: 500,
  width: '100%',
  marginTop: theme.spacing(3),
  '& .MuiDataGrid-cell': {
    borderRight: '1px solid #DDDEDF',
  },
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: '#e8e9ea',
    borderBottom: '1px solid #c8c9ca',
  }
}));

function UploadFile() {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [columnColors, setColumnColors] = useState({});
  const [openPopup, setOpenPopup] = useState(false);
  const [bdName, setBdName] = useState("");
  const [bdNameError, setBdNameError] = useState("");
  const [bdNameTouched, setBdNameTouched] = useState(false);
  const [fileInfo, setFileInfo] = useState({
    name: "",
    size: "",
    rows: 0,
    cols: 0,
    dataTypes: {},
  });
  const [selectedColumns, setSelectedColumns] = useState(
    columns.map(col => col.field) 
  );
  const [tableLimitExceeded, setTableLimitExceeded] = useState(false);
  const [userTableCount, setUserTableCount] = useState(0);
  const [nameErrors, setNameErrors] = useState({});

  const [openNameColumnsDialog, setOpenNameColumnsDialog] = useState(false);
  const [openDelimiterDialog, setOpenDelimiterDialog] = useState(false);
  const [rawData, setRawData] = useState(null);
  const [rawDataType, setRawDataType] = useState(""); // "array" or "text"
  const [columnNames, setColumnNames] = useState([]);
  const [detectedDelimiter, setDetectedDelimiter] = useState(",");
  const [selectedDelimiter, setSelectedDelimiter] = useState(",");
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);

  const navigate = useNavigate();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false); 
  // Steps for upload process
  const steps = ['Upload File', 'Configure Data', 'Review & Save'];
  const [activeStep, setActiveStep] = useState(0);









const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const validateFile = (file) => {
  // Vérification de l'extension réelle
  const fileExtension = file.name.toLowerCase().split('.').pop();
  const allowedExtensions = ['xlsx', 'csv', 'txt'];
  
  if (!allowedExtensions.includes(fileExtension)) {
    return false;
  }
  
  // Vérification du type MIME et de la signature magique
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arr = new Uint8Array(e.target.result);
      let header = '';
      for (let i = 0; i < 4; i++) {
        header += arr[i].toString(16);
      }
      
      // Vérifier les signatures magiques
      const validSignatures = {
        'xlsx': '504b34', // PK\x03\x04
        'csv': '', // CSV n'a pas de signature unique
        'txt': ''  // TXT non plus
      };
      
      if (fileExtension === 'xlsx' && header !== '504b34') {
        resolve(false);
        return;
      }
      
      resolve(true);
    };
    reader.readAsArrayBuffer(file.slice(0, 4));
  });
};





const validateBdName = (tableName) => validateDatasetNameInput(tableName);

  // Handler pour le changement de nom
  const handleBdNameChange = (e) => {
    const name = e.target.value;
    setBdName(name);
    setBdNameTouched(true);
    setBdNameError(validateBdName(name));
  };

  useEffect(() => {
    checkTableLimit();
  }, []);

  // Add this function to check the table limit
  const checkTableLimit = async () => {
  try {
    const response = await axios.get(`${backendUrl}/api/get-user-table-count`, {
      withCredentials: true
    });
    
    setUserTableCount(response.data.count);
    
    if (response.data.count >= 10) {
      setTableLimitExceeded(true);
    }
  } catch (error) {
    console.error("Error checking table limit:", error);
  }
};

  // Add this function to handle navigation to dashboard
  const handleNavigateToDashboard = () => {
    navigate("/dashboard");
  };

  const handleAddRow = () => {
    const newId = rows.length > 0 ? Math.min(...rows.map(row => row.id)) - 1 : 0;
    const newRow = { id: newId };
    columns.forEach(col => {
      newRow[col.field] = "";
    });
    setRows([newRow, ...rows]);
  };

  const handleDeleteRows = () => {
    if (selectedRows.length === 0) {
      alert("Please select at least one row to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${selectedRows.length} row(s)?`)) {
      const updatedRows = rows.filter(row => !selectedRows.includes(row.id));
      setRows(updatedRows);
      setSelectedRows([]);
    }
  };

  // Detect data types
  const detectDataTypes = (rows, columns) => {
    const types = {};
    if (rows.length === 0) return types;
    columns.forEach(col => {
      const sample = rows[0][col.field];
      types[col.headerName] = typeof sample === 'string' && sample.length === 0 ? 
        'empty' : 
        typeof sample;
    });
    return types;
  };
  
const handleCheckboxChange = useCallback((field) => {
  setColumnColors((prev) => ({
    ...prev,
    [field]: prev[field] === 'red' ? '' : 'red',
  }));
}, []);

  // Function to detect delimiter in text files
  const detectDelimiter = (text) => {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
    
    if (lines.length === 0) return ',';
    
    const delimiters = [',', ';', '\t', '|', ' ', ':'];
    
    // Count occurrences of each delimiter in first few lines
    const delimiterCounts = {};
    delimiters.forEach(delim => {
      delimiterCounts[delim] = 0;
    });
    
    const sampleLines = lines.slice(0, Math.min(5, lines.length));
    
    sampleLines.forEach(line => {
      delimiters.forEach(delim => {
        // Pour les délimiteurs spéciaux, utiliser une expression régulière
        let count;
        if (delim === '\t') {
          count = (line.split(/\t/).length - 1);
        } else if (delim === ' ') {
          count = (line.split(/\s+/).length - 1);
        } else {
          count = (line.split(delim).length - 1);
        }
        delimiterCounts[delim] += count;
      });
    });
    
    // Find the delimiter with the highest count
    let maxCount = 0;
    let detectedDelim = ',';
    
    for (const delim of delimiters) {
      if (delimiterCounts[delim] > maxCount) {
        maxCount = delimiterCounts[delim];
        detectedDelim = delim;
      }
    }
    
    // Si nous détectons un point-virgule, l'utiliser
    if (detectedDelim === ';') {
      return ';';
    }
    
    return detectedDelim;
  };

  // Function to parse CSV content avec délimiteur spécifique
  const parseCSV = (text, delimiter = ",") => {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
    
    return lines.map(line => {
      // Handle quoted values that might contain the delimiter
      if (line.includes('"') && (delimiter === ',' || delimiter === ';')) {
        const result = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        
        result.push(currentValue);
        return result;
      } else {
        return line.split(delimiter);
      }
    });
  };

  // Function to parse text with selected delimiter
  const processTextWithDelimiter = (text, delimiter) => {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
    
    // Handle case where delimiter is space (multiple spaces as one delimiter)
    if (delimiter === ' ') {
      return lines.map(line => line.trim().split(/\s+/));
    }
    
    return lines.map(line => {
      // Handle quoted values that might contain the delimiter
      if (line.includes('"') && (delimiter === ',' || delimiter === ';')) {
        const result = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        
        result.push(currentValue);
        return result;
      } else {
        return line.split(delimiter);
      }
    });
  };

  // Change file
  const handleFileChange = async (e) => {
    await checkTableLimit();

    if (userTableCount >= 10) {
      setTableLimitExceeded(true);
      return;
    }
    
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      alert("File is too large. Maximum allowed size is 200 MB.");
      e.target.value = "";
      return;
    }

    const fileOk = await validateFile(selectedFile);
    if (!fileOk) {
      alert("Invalid file. Only Excel (.xlsx), CSV (.csv) and Text (.txt) files are allowed.");
      e.target.value = "";
      return;
    }

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
      "text/csv", 
      "text/plain"
    ];
    
    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|csv|txt)$/i)) {
      alert("Only Excel (.xlsx), CSV (.csv) and Text (.txt) files are allowed!");
      e.target.value = "";
      return;
    }
    
    setFile(selectedFile);
    setFileInfo((prev) => ({
      ...prev,
      name: selectedFile.name,
      size: `${(selectedFile.size / 1024).toFixed(2)} KB`,
    }));
    
    // Simulate upload progress
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((oldProgress) => {
        if (oldProgress === 100) {
          clearInterval(interval);
          return 100;
        }
        return Math.min(oldProgress + 10, 100);
      });
    }, 100);
    
    readFile(selectedFile);
    setActiveStep(1);
  };

  // Read file
  const readFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // Handle CSV files with automatic parsing
        if (file.type === "text/csv" || file.name.match(/\.csv$/i)) {
          const text = e.target.result;
          const detectedDelim = detectDelimiter(text);
          setDetectedDelimiter(detectedDelim);
          setSelectedDelimiter(detectedDelim);
          
          // Store the raw text for later processing
          setRawData(text);
          setRawDataType("text");
          
          // For CSV files, show delimiter selection dialog
          setOpenDelimiterDialog(true);
        }
        // Handle TXT files with delimiter selection
        else if (file.type === "text/plain" || file.name.match(/\.txt$/i)) {
          const text = e.target.result;
          const detectedDelim = detectDelimiter(text);
          setDetectedDelimiter(detectedDelim);
          setSelectedDelimiter(detectedDelim);
          
          // Store the raw text for later processing
          setRawData(text);
          setRawDataType("text");
          
          // For text files, show delimiter selection dialog
          setOpenDelimiterDialog(true);
        } 
        // Handle Excel files
        else {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array", raw: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const dataArray = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          applyRawData(dataArray, true);
        }
      } catch (error) {
        console.error("Error reading file:", error);
        alert("Error reading the file");
      }
    };
    
    // Use appropriate read method based on file type
    if (file.type === "text/plain" || file.type === "text/csv" || file.name.match(/\.(csv|txt)$/i)) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  // Handle delimiter selection
  const handleDelimiterSelect = () => {
    let dataArray = rawData;
    if (rawDataType === "text") {
      if (file.type === "text/csv" || file.name.match(/\.csv$/i)) {
        // Pour les CSV, utiliser parseCSV avec le délimiteur sélectionné
        dataArray = parseCSV(rawData, selectedDelimiter);
      } else {
        // Pour les TXT, utiliser processTextWithDelimiter
        dataArray = processTextWithDelimiter(rawData, selectedDelimiter);
      }
    }
    setOpenDelimiterDialog(false);
    applyRawData(dataArray, true);
  };

  // Conserve le tableau brut complet et dérive colonnes/lignes selon si la
  // première ligne contient les entêtes. Remplace l'ancienne étape
  // "Column Configuration" par un simple choix inline (toggle) + bouton Rename.
  const applyRawData = (dataArray, hasHeader) => {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return;
    setRawData(dataArray);
    setRawDataType("array");
    setFirstRowIsHeader(hasHeader);
    deriveColumnsFromRaw(dataArray, hasHeader);
  };

  // Dérive columns + rows à partir du tableau brut.
  const deriveColumnsFromRaw = (dataArray, hasHeader) => {
    if (!Array.isArray(dataArray) || dataArray.length === 0) return;
    if (hasHeader) {
      const [headers, ...dataRows] = dataArray;
      processData(headers, dataRows);
    } else {
      const width = dataArray[0].length;
      const defaultNames = Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
      processData(defaultNames, dataArray);
    }
  };

  // Toggle "First row contains headers" depuis l'aperçu.
  const handleToggleFirstRowHeader = (checked) => {
    setFirstRowIsHeader(checked);
    if (Array.isArray(rawData)) {
      deriveColumnsFromRaw(rawData, checked);
    }
  };

  // Ouvre la boîte de renommage en pré-remplissant avec les entêtes ACTUELLES
  // (et non le tableau brut) : renommer ne réinjecte donc jamais la 1ère ligne
  // dans les données.
  const handleOpenRenameColumns = () => {
    setColumnNames(columns.map((c) => c.headerName));
    setNameErrors({});
    setOpenNameColumnsDialog(true);
  };

  // Applique les nouveaux noms directement sur les colonnes existantes.
  const handleColumnNamesSubmit = () => {
    const errors = collectColumnNameErrors(columnNames);
    if (Object.keys(errors).length > 0) {
      setNameErrors(errors);
      return;
    }
    const updatedColumns = columns.map((col, index) => ({
      ...col,
      headerName: (columnNames[index] ?? col.headerName).trim(),
    }));
    setColumns(updatedColumns);
    setFileInfo((prev) => ({
      ...prev,
      dataTypes: detectDataTypes(rows, updatedColumns),
    }));
    setOpenNameColumnsDialog(false);
  };

  // Process data
  const processData = (headers, rows) => {
    const columns = headers.map((header, index) => ({
      field: `col${index}`,
      headerName: header,
      width: 150,
      editable: true,
      originalIndex: index,
      
    }));
    const formattedRows = rows.map((row, rowIndex) => {
      const rowData = { id: rowIndex };
      row.forEach((cell, cellIndex) => {
        rowData[`col${cellIndex}`] = cell;
      });
      return rowData;
    });
    
    // Exclude 'id' columns from default selection
    const defaultSelectedColumns = columns
      .filter(col => col.headerName.toLowerCase() !== 'id')
      .map(col => col.field);
    
    setFileInfo({
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      rows: formattedRows.length,
      cols: headers.length,
      dataTypes: detectDataTypes(formattedRows, columns)
    });
    setColumns(columns);
    setRows(formattedRows);
    setSelectedColumns(defaultSelectedColumns); // Use filtered selection
    setUploadProgress(100);

    // Force rename when headers are unsafe for SQL / reserved / duplicate
    const headerNames = columns.map((c) => c.headerName);
    const headerErrors = collectColumnNameErrors(headerNames);
    if (Object.keys(headerErrors).length > 0) {
      setColumnNames(headerNames);
      setNameErrors(headerErrors);
      setOpenNameColumnsDialog(true);
    }
  };

  const isNumeric = (value) => {
    return !isNaN(parseFloat(value)) && isFinite(value);
  };

  // Save and next
  const handleSaveAndNext = () => {
    const headerNames = columns.map((c) => c.headerName);
    const headerErrors = collectColumnNameErrors(headerNames);
    if (Object.keys(headerErrors).length > 0) {
      setColumnNames(headerNames);
      setNameErrors(headerErrors);
      setOpenNameColumnsDialog(true);
      alert(
        "Some column names are invalid. Please rename them using only letters, numbers and underscores (must start with a letter or underscore). The name 'id' is reserved."
      );
      return;
    }
    setOpenPopup(true);
    setActiveStep(2);
  };

  // Close popup
  const handleClosePopup = () => {
    setOpenPopup(false);
  };

  // Change column selection
  const handleColumnSelectionChange = (field) => {
    setSelectedColumns((prev) =>
      prev.includes(field) ? prev.filter((col) => col !== field) : [...prev, field]
    );
  };

  // Save to database
const handleSaveDatabase = async () => {
  const cleanedBdName = normalizeDatasetName(bdName);
  const error = validateBdName(bdName);
  if (error) {
    setBdNameError(error);
    setBdNameTouched(true);
    alert(error);
    return;
  }
  
  const selectedCols = columns.filter(col => selectedColumns.includes(col.field));
  const selectedNames = selectedCols.map((col) => col.headerName);
  const selectedNameErrors = collectColumnNameErrors(selectedNames);
  if (Object.keys(selectedNameErrors).length > 0) {
    setColumnNames(columns.map((c) => c.headerName));
    setNameErrors(collectColumnNameErrors(columns.map((c) => c.headerName)));
    setOpenNameColumnsDialog(true);
    setOpenPopup(false);
    alert(
      "Selected columns have invalid names. Rename them before saving (letters, numbers, underscore only; 'id' is reserved)."
    );
    return;
  }

  setSaving(true);

  try {
    const dataToSave = {
      columns: selectedCols.map(col => col.headerName.trim()),
      rows: rows.map(row => {
        const filteredRow = {};
        selectedCols.forEach((col, index) => {
          filteredRow[`col${index}`] = row[col.field];
        });
        return filteredRow;
      })
    };

    const saveVersion = async (tableName) => {
      const versionData = {
        bdName: tableName,
        ...dataToSave
      };
      
      const response = await axios.post(`${backendUrl}/api/save-to-db`, versionData, { 
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });
      
      return response;
    };

    // Utiliser cleanedBdName
    setUploadProgress(33);
    await saveVersion(cleanedBdName);
    
    setUploadProgress(66);
    await saveVersion(`${cleanedBdName}_reset`);
    
    setUploadProgress(100);
    await saveVersion(`${cleanedBdName}_backup`);
    
    setSaving(false);
    alert("Saved successfully!");
    
    navigate("/data_preparation", { 
      state: { 
        bdName: cleanedBdName,
        stage: "target_selection",
        initialTab: 0
      }
    });

  } catch (error) {
    setSaving(false);
    setUploadProgress(0);
    console.error("Error:", error);
    alert(`Error saving: ${error.response?.data?.detail || error.message}`);
  }
};

  
  // Update row
  const handleProcessRowUpdate = (newRow) => {
    const updatedRows = rows.map((row) => (row.id === newRow.id ? newRow : row));
    setRows(updatedRows);
    return newRow;
  };

  return (
    <Box className="upload-file-container">
      <Typography variant="h4" component="h1" gutterBottom className="upload-title">
        Data Upload
      </Typography>
      
      {/* Stepper */}
      <Stepper activeStep={activeStep} className="upload-stepper">
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel className="upload-step-label">{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Dialog 0 - Select delimiter for TXT and CSV files */}
      <Dialog open={openDelimiterDialog} onClose={() => setOpenDelimiterDialog(false)} maxWidth="sm" fullWidth PaperProps={{ className: "upload-dialog" }}>
        <DialogTitle>
          <Box className="dialog-header">
            {file?.type === "text/csv" || file?.name.match(/\.csv$/i) 
              ? "CSV Field Separator Detection" 
              : "Select Field Separator"}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" icon={false} className="info-alert">
            {file?.type === "text/csv" || file?.name.match(/\.csv$/i) 
              ? `This CSV file uses "${detectedDelimiter === '\t' ? 'Tab' : detectedDelimiter}" as separator. Please confirm or select a different separator:` 
              : `Detected separator: "${detectedDelimiter === '\t' ? 'Tab' : detectedDelimiter}". Please confirm or select a different separator:`}
          </Alert>
          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              value={selectedDelimiter}
              onChange={(e) => setSelectedDelimiter(e.target.value)}
              className="delimiter-radio-group"
            >
              <FormControlLabel value="," control={<Radio />} label="Comma (,)" />
              <FormControlLabel value=";" control={<Radio />} label="Semicolon (;)" />
              <FormControlLabel value="\t" control={<Radio />} label="Tab" />
              <FormControlLabel value="|" control={<Radio />} label="Pipe (|)" />
              <FormControlLabel value=" " control={<Radio />} label="Space" />
            </RadioGroup>
          </FormControl>
          {rawDataType === "text" && (
            <Box className="dialog-preview-box">
              <Typography variant="caption" display="block" gutterBottom>
                First line preview:
              </Typography>
              <Typography variant="body2" className="dialog-preview-text">
                {rawData.split(/\r\n|\n/)[0]}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions className="dialog-actions">
          <Button onClick={() => setOpenDelimiterDialog(false)} className="cancel-button">Cancel</Button>
          <Button onClick={handleDelimiterSelect} variant="contained" className="confirm-button">
            Confirm Separator
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog - Rename the columns (opened on demand from the preview) */}
      <Dialog open={openNameColumnsDialog} onClose={() => setOpenNameColumnsDialog(false)} maxWidth="md" fullWidth PaperProps={{ className: "upload-dialog" }}>
        <DialogTitle>
          <Box className="dialog-header">
            Rename Columns
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" icon={false} className="info-alert">
            Column names must match: letters, numbers, underscore only; start with a letter or underscore.
            Spaces, accents, dashes and special characters are not allowed. The name <strong>id</strong> is reserved.
            Invalid names must be fixed before you can save the dataset.
          </Alert>
          <TableContainer component={Paper} variant="outlined" className="dialog-table">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Column Name</TableCell>
                  <TableCell>First Data Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {columnNames.map((name, index) => {
                  const issue = nameErrors[index] || getColumnNameIssue(name, columnNames, index);
                  const hasError = !!issue;
                  const sampleField = columns[index]?.field;
                  const sampleValue = sampleField && rows[0] ? rows[0][sampleField] : undefined;
                  return (
                    <TableRow key={index} className={hasError ? "error-row" : ""}>
                      <TableCell>
                        <Chip label={index + 1} size="small" className="column-chip" />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={name}
                          onChange={(e) => {
                            const newNames = [...columnNames];
                            newNames[index] = e.target.value;
                            setColumnNames(newNames);
                            setNameErrors(collectColumnNameErrors(newNames));
                          }}
                          error={hasError}
                          helperText={issue || ""}
                          fullWidth
                          required
                          size="small"
                          className="dialog-text-field"
                        />
                      </TableCell>
                      <TableCell className="dialog-preview-text">
                        {escapeHtml(String(sampleValue ?? 'empty'))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions className="dialog-actions">
          <Button onClick={() => setOpenNameColumnsDialog(false)} className="cancel-button">Cancel</Button>
          <Button 
            onClick={handleColumnNamesSubmit} 
            variant="contained" 
            className="confirm-button"
            disabled={Object.keys(collectColumnNameErrors(columnNames)).length > 0}
          >
            Apply Names
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Section */}
      {!file && (
        <StyledUploadArea className="upload-area">
          <input
            accept=".xlsx, .csv, .txt"
            style={{ display: 'none' }}
            id="raised-button-file"
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="raised-button-file">
            <Button
              variant="contained"
              component="span"
              startIcon={<UploadIcon />}
              size="large"
              className="upload-button"
            >
              Select File
            </Button>
          </label>
          <Typography variant="body1" className="upload-supported-formats">
            Supported formats: Excel (.xlsx), CSV (.csv), Text (.txt): max 200 MB
          </Typography>
        </StyledUploadArea>
      )}

      {/* Progress Bar */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <Box className="upload-progress">
          <LinearProgress variant="determinate" value={uploadProgress} className="upload-progress-bar" />
          <Typography variant="body2" className="upload-progress-text">
            Processing file... {uploadProgress}%
          </Typography>
        </Box>
      )}

      {/* File Information */}
      {fileInfo.name && (
        <FileInfoCard elevation={0} className="file-info-card">
          <CardContent>
            <Typography variant="h6" className="file-info-header">
              File Information
            </Typography>
            <Box className="file-info-content">
              <Box className="file-info-item">
                <Typography variant="body2" className="file-info-label">File name</Typography>
                <Typography variant="body1" className="file-info-value">{fileInfo.name}</Typography>
              </Box>
              <Box className="file-info-item">
                <Typography variant="body2" className="file-info-label">File size</Typography>
                <Typography variant="body1" className="file-info-value">{fileInfo.size}</Typography>
              </Box>
              <Box className="file-info-item">
                <Typography variant="body2" className="file-info-label">Number of rows</Typography>
                <Typography variant="body1" className="file-info-value">{fileInfo.rows}</Typography>
              </Box>
              <Box className="file-info-item">
                <Typography variant="body2" className="file-info-label">Number of columns</Typography>
                <Typography variant="body1" className="file-info-value">{fileInfo.cols}</Typography>
              </Box>
            </Box>
            
            <Typography variant="subtitle2" className="data-types-title">Data Types:</Typography>
            <Box className="data-types-container">
              {Object.entries(fileInfo.dataTypes).map(([colName, type]) => (
                <Chip 
                  key={colName} 
                  label={escapeHtml(`${colName}: ${type}`)} 
                  size="small" 
                  variant="outlined"
                  className={`data-type-chip ${type === 'empty' ? 'empty' : ''}`}
                />
              ))}
            </Box>
          </CardContent>
        </FileInfoCard>
      )}

      {/* Data Table */}
      {rows.length > 0 && (
        <Box className="data-preview-section">
          <Box className="data-preview-header">
            <Typography variant="h5" className="data-preview-title">Data Preview</Typography>
            <Box className="data-preview-actions">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={firstRowIsHeader}
                    onChange={(e) => handleToggleFirstRowHeader(e.target.checked)}
                    color="primary"
                    size="small"
                  />
                }
                label="First row contains headers"
                sx={{ mr: 1 }}
              />
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleOpenRenameColumns}
                className="rename-columns-button"
              >
                Rename Columns
              </Button>
              <Button
                variant="outlined"
                startIcon={<DeleteIcon/>}
                onClick={handleDeleteRows}
                disabled={selectedRows.length === 0}
                className="delete-button"
              >
                Delete Selected ({selectedRows.length})
              </Button>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddRow}
                className="add-button"
              >
                Add Row
              </Button>
              <Button 
                variant="contained" 
                startIcon={<SaveIcon />}
                onClick={handleSaveAndNext}
                className="save-button"
              >
                Save and Next
              </Button>
            </Box>
          </Box>
          
          <DataGridContainer className="data-grid-container">
            <DataGrid
              rows={rows}
              columns={columns}
              pageSize={5}
              rowsPerPageOptions={[5, 10, 25]}
              checkboxSelection
              disableSelectionOnClick
              onRowSelectionModelChange={(newSelection) => {
                setSelectedRows(newSelection);
              }}
              processRowUpdate={handleProcessRowUpdate}
              onProcessRowUpdateError={(error) => console.error(error)}
            />
          </DataGridContainer>
        </Box>
      )}

      {/* Popup for column selection */}
      <Modal open={openPopup} onClose={handleClosePopup} disableEnforceFocus>
        <Box className="column-selection-modal">
          <Box className="modal-header">
            <Typography variant="h6">
              Save to Database
            </Typography>
            <IconButton onClick={handleClosePopup} size="small" className="modal-close-button">
              <CloseIcon />
            </IconButton>
          </Box>
          <Box className="modal-body">
         <TextField
  label="Database name"
  value={bdName}
  onChange={handleBdNameChange}
  onBlur={() => setBdNameTouched(true)}
  fullWidth
  required
  className={`form-field ${bdNameTouched && bdNameError ? 'form-field-error' : ''}`}
  error={bdNameTouched && !!bdNameError}
  helperText={
    bdNameTouched
      ? bdNameError ||
        (normalizeDatasetName(bdName)
          ? `Will be saved as: ${normalizeDatasetName(bdName)}`
          : "Spaces become _, letters become lowercase")
      : "You can use spaces and capitals: they are cleaned when saving"
  }
/>
          
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Select columns to save:
          </Typography>
          
          <Box className="columns-list-container">
            <List dense className="columns-list">
              {columns.map((col) => {
                const isIdColumn = col.headerName.toLowerCase() === 'id';
                const isSelected = selectedColumns.includes(col.field);
                
                return (
                  <ListItem 
                    key={col.field} 
                    divider
                    className={`column-item ${isIdColumn ? 'id-column' : ''}`}
                  >
                    <Checkbox
                      checked={isSelected && !isIdColumn}
                      onChange={() => !isIdColumn && handleColumnSelectionChange(col.field)}
                      color="primary"
                      disabled={isIdColumn}
                    />
                    <ListItemText 
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {col.headerName}
                          {isIdColumn && (
                            <Chip 
                              label="Excluded" 
                              size="small" 
                              className="excluded-chip"
                            />
                          )}
                        </Box>
                      } 
                      secondary={`Field: ${col.field}`}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>
          
          <Alert severity="info" icon={false} className="info-alert">
            Note: Columns named "id" are automatically excluded and cannot be selected.
          </Alert>
          
          <Box className="dialog-actions">
            <Button onClick={handleClosePopup} className="cancel-button">
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleSaveDatabase} 
              className="confirm-button"
              disabled={selectedColumns.length === 0 || !!bdNameError}
            >
              Save Database
            </Button>
          </Box>
          </Box>
        </Box>
      </Modal>

      <Dialog open={tableLimitExceeded} onClose={() => setTableLimitExceeded(false)} PaperProps={{ className: "limit-dialog" }}>
        <DialogTitle>
          <Box className="limit-header">
            Table Limit Exceeded
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" icon={false} className="warning-alert">
            You have reached the maximum limit of 10 databases. Please delete some databases before uploading new ones.
          </Alert>
          <Typography variant="body1">
            Current databases: {userTableCount}/10
          </Typography>
        </DialogContent>
        <DialogActions className="dialog-actions">
          <Button onClick={() => setTableLimitExceeded(false)} className="cancel-button">Cancel</Button>
          <Button 
            onClick={handleNavigateToDashboard} 
            variant="contained" 
            className="go-to-dashboard-button"
          >
            Go to Dashboard
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={saving} onClose={() => {}} maxWidth="sm" fullWidth PaperProps={{ className: "saving-dialog" }}>
        <DialogTitle>
          <Box className="saving-header">
            <CircularProgress size={24} sx={{ mr: 1, color: "#ffffff" }} />
            Saving Database
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Please wait while we save your data. This may take a while for large datasets.
          </Typography>
          <Box className="saving-progress-container">
            <LinearProgress 
              variant="determinate" 
              value={uploadProgress} 
              className="saving-progress"
            />
            <Typography variant="body2" className="saving-progress-text">
              {uploadProgress}% Complete
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default UploadFile;