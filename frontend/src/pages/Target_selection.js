import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Typography, 
  Box, 
  Button, 
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider
} from "@mui/material";
import {
  Info as InfoIcon,
  Help as HelpIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Analytics as AnalyticsIcon,
  Search as SearchIcon
} from "@mui/icons-material";
import axios from "axios";
import { backendUrl } from "../config";
import './Target_selection.css';

const steps = [
  'Select target column',
  'Confirm selection',
  'Proceed to analysis'
];

function Target_selection() {
  const location = useLocation();
  const navigate = useNavigate();
  const { bdName, processedData, columns, rows, fromDashboard } = location.state || {};
  
  const [targetColumn, setTargetColumn] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCheckingBackup, setIsCheckingBackup] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [columnStats, setColumnStats] = useState({});
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [columnDetailsDialogOpen, setColumnDetailsDialogOpen] = useState(false);
  const [selectedColumnDetails, setSelectedColumnDetails] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedColumnType, setSelectedColumnType] = useState("all");

  const previewRows = useMemo(() => 
    rows?.slice(0, 10) || [], 
    [rows]
  );

  const filteredColumns = useMemo(() => {
    if (!columns) return [];
    
    return columns.filter(col => {
      const matchesSearch = col.headerName.toLowerCase().includes(searchTerm.toLowerCase());
      const colType = columnStats[col.field]?.type || 'unknown';
      // Map platform types (numerical) to legacy filter keys (numeric)
      const normalized =
        colType === 'numerical' ? 'numeric' :
        colType === 'boolean' ? 'categorical' :
        colType;
      const matchesType = selectedColumnType === "all" || 
                         (selectedColumnType === "numeric" && normalized === 'numeric') ||
                         (selectedColumnType === "categorical" && (normalized === 'categorical' || colType === 'boolean')) ||
                         (selectedColumnType === "text" && (normalized === 'text' || colType === 'date'));
      
      return matchesSearch && matchesType;
    });
  }, [columns, searchTerm, selectedColumnType, columnStats]);

  // Types + cardinality from /api/analyze-column-types (SQL): never from in-memory rows
  useEffect(() => {
    if (!bdName) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/analyze-column-types`, {
          params: { bdName },
          withCredentials: true,
        });
        if (cancelled) return;
        const stats = {};
        (res.data?.column_types || []).forEach((c) => {
          const t = c.column_type === 'numerical' ? 'numeric' : c.column_type;
          stats[c.column_name] = {
            name: c.column_name,
            type: t || 'unknown',
            uniqueCount: c.stats?.distinct ?? 0,
            sampleValues: [],
            hasNulls: c.stats
              ? (c.stats.total || 0) > (c.stats.non_null || 0)
              : false,
          };
        });
        setColumnStats(stats);
      } catch (err) {
        console.error("analyze-column-types failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [bdName]);

  // Initialization
  useEffect(() => {
    if (!bdName) {
      navigate("/upload");
      return;
    }

    const initializeData = async () => {
      try {
        if (fromDashboard) {
          setIsCheckingBackup(true);
          await axios.post(
            `${backendUrl}/api/check-create-backup`,
            { bdName },
            { withCredentials: true }
          );
          setSuccess("Dataset has been reset to original version");
        } else {
          setSuccess("Continuing with current dataset");
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setError("Failed to initialize dataset");
      } finally {
        setIsCheckingBackup(false);
      }
    };

    initializeData();
  }, [bdName, fromDashboard, navigate]);

  const handleTargetColumnSelect = useCallback((columnName) => {
    setTargetColumn(columnName);
    setError("");
  }, []);

  const handleSave = async () => {
    if (!targetColumn) {
      setError("Please select a target column first");
      return;
    }

    try {
      await axios.post(
        `${backendUrl}/api/save-target-column`,
        {
          dataset_name: bdName,
          target_column: targetColumn,
        },
        { withCredentials: true }
      );

      await axios.post(
        `${backendUrl}/api/update-stage`,
        {
          bdName: bdName,
          newStage: "group_optimizer"
        },
        { withCredentials: true }
      );

      navigate("/group_optimizer", { 
        state: { 
          bdName,
          processedData: processedData || rows,
          columns,
          targetColumn 
        }
      });
    } catch (err) {
      setError(err.response?.data?.detail || "Could not save the target column");
    }
  };

  const handleNext = () => {
    if (activeStep === 0 && !targetColumn) {
      setError("Please select a target column first");
      return;
    }
    
    if (activeStep === steps.length - 1) {
      handleSave();
    } else {
      setActiveStep(prev => prev + 1);
      setError("");
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError("");
  };

  const handleColumnClick = useCallback((columnName) => {
    const column = columns.find(col => col.headerName === columnName);
    if (column && columnStats[column.field]) {
      setSelectedColumnDetails(columnStats[column.field]);
      setColumnDetailsDialogOpen(true);
    }
  }, [columns, columnStats]);

  const targetColumnIndex = useMemo(() => 
    columns?.findIndex(col => col.headerName === targetColumn) ?? -1,
    [columns, targetColumn]
  );

  if (isCheckingBackup) {
    return (
      <Box className="loading-container">
        <CircularProgress size={60} />
        <Typography variant="h6" className="loading-text">
          {fromDashboard ? "Resetting dataset..." : "Loading..."}
        </Typography>
      </Box>
    );
  }

  if (!bdName || !columns) {
    return (
      <Box className="error-container">
        <Typography variant="h4" gutterBottom>
          No data available
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate("/upload")}
          startIcon={<ArrowBackIcon />}
        >
          Go to Upload
        </Button>
      </Box>
    );
  }

  return (
    <Box className="preprocessing-container">
      <Box className="preprocessing-header">
        <Typography variant="h4" className="preprocessing-title">
          Target Selection: {bdName}
        </Typography>
        <Tooltip title="Learn about target columns">
          <IconButton onClick={() => setHelpDialogOpen(true)}>
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {success && (
        <Alert severity={fromDashboard ? "info" : "success"} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 4 }}>
        {steps.map((step, index) => (
          <Step key={step}>
            <StepLabel>{step}</StepLabel>
            <StepContent>
              {index === 0 && (
                <Box>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    Select the variable you want to predict (target column) or choose unsupervised learning.
                  </Typography>
                  
                  <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant={targetColumn === "no-target-column" ? "contained" : "outlined"}
                      onClick={() => handleTargetColumnSelect("no-target-column")}
                      size="small"
                    >
                      No Target (Unsupervised)
                    </Button>
                    {columns.slice(0, 3).map(col => (
                      <Button
                        key={col.field}
                        variant={targetColumn === col.headerName ? "contained" : "outlined"}
                        onClick={() => handleTargetColumnSelect(col.headerName)}
                        size="small"
                      >
                        {col.headerName}
                      </Button>
                    ))}
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <TextField
                      fullWidth
                      placeholder="Search columns..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                      size="small"
                    />
                    <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                      {["all", "numeric", "categorical", "text"].map(type => (
                        <Chip
                          key={type}
                          label={type === "all" ? "All" : type === "numeric" ? "Numerical" : type === "categorical" ? "Categorical" : "Text"}
                          variant={selectedColumnType === type ? "filled" : "outlined"}
                          onClick={() => setSelectedColumnType(type)}
                          size="small"
                        />
                      ))}
                    </Box>
                  </Box>

                  <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                    <List dense>
                      <ListItem>
                        <ListItemText 
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                              <span>Column Name</span>
                              <span>Type / Unique Values</span>
                            </Box>
                          } 
                        />
                      </ListItem>
                      <Divider />
                      
                      <ListItemButton
                        selected={targetColumn === "no-target-column"}
                        onClick={() => handleTargetColumnSelect("no-target-column")}
                      >
                        <ListItemText 
                          primary="No target column (unsupervised learning)"
                          secondary="Use for clustering, dimensionality reduction"
                        />
                      </ListItemButton>
                      <Divider />

                      {filteredColumns.map((col) => (
                        <ListItemButton
                          key={col.field}
                          selected={targetColumn === col.headerName}
                          onClick={() => handleTargetColumnSelect(col.headerName)}
                        >
                          <ListItemText 
                            primary={col.headerName}
                            secondary={
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                                <Chip 
                                  label={columnStats[col.field]?.type === 'numeric' ? 'Numerical' : 
                                         columnStats[col.field]?.type === 'text' ? 'Text' : 'Categorical'} 
                                  size="small"
                                  color={columnStats[col.field]?.type === 'numeric' ? 'primary' : 
                                         columnStats[col.field]?.type === 'text' ? 'info' : 'secondary'}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {columnStats[col.field]?.uniqueCount || 0} unique values
                                </Typography>
                                {columnStats[col.field]?.hasNulls && (
                                  <Chip label="Has nulls" size="small" color="warning" />
                                )}
                              </Box>
                            }
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Paper>

                  {targetColumn && targetColumn !== "no-target-column" && (
                    <Button 
                      onClick={() => handleColumnClick(targetColumn)}
                      startIcon={<InfoIcon />}
                      size="small"
                      sx={{ mt: 1 }}
                    >
                      View details about {targetColumn}
                    </Button>
                  )}
                </Box>
              )}
              
              {index === 1 && targetColumn && (
                <Box>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    You've selected: <strong>{targetColumn === "no-target-column" ? "No target column" : targetColumn}</strong>
                  </Typography>
                  
                  {targetColumn !== "no-target-column" && (
                    <>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        This is a <strong>{columnStats[targetColumn]?.type === 'numeric' ? 'numerical' : 
                                          columnStats[targetColumn]?.type === 'text' ? 'text' : 'categorical'}</strong> column with {
                        columnStats[targetColumn]?.uniqueCount
                        } unique values.
                      </Alert>
                      
                      {columnStats[targetColumn]?.hasNulls && (
                        <Alert severity="warning">
                          This column contains missing values that will need to be handled.
                        </Alert>
                      )}
                    </>
                  )}
                </Box>
              )}
              
              {index === 2 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AnalyticsIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="body1">
                      Ready to proceed to data analysis and preprocessing.
                    </Typography>
                  </Box>
                </Box>
              )}
              
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  endIcon={activeStep === steps.length - 1 ? undefined : <ArrowForwardIcon />}
                  sx={{ mr: 1 }}
                >
                  {activeStep === steps.length - 1 ? 'Save and Continue' : 'Continue'}
                </Button>
                <Button
                  disabled={activeStep === 0}
                  onClick={handleBack}
                  startIcon={<ArrowBackIcon />}
                >
                  Back
                </Button>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Dataset Preview
            <Chip label={`${previewRows.length} rows, ${columns.length} columns`} size="small" sx={{ ml: 1 }} />
          </Typography>
          
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {columns.map((column, colIndex) => (
                    <TableCell 
                      key={colIndex}
                      sx={{ 
                        backgroundColor: colIndex === targetColumnIndex ? 'primary.light' : 'grey.100',
                        color: colIndex === targetColumnIndex ? 'primary.contrastText' : 'inherit',
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: colIndex === targetColumnIndex ? 'primary.main' : 'grey.200' }
                      }}
                      onClick={() => handleColumnClick(column.headerName)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {column.headerName}
                        <InfoIcon sx={{ ml: 0.5, fontSize: 16 }} />
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewRows.map((row, rowIndex) => (
                  <TableRow key={rowIndex} hover>
                    {columns.map((column, colIndex) => (
                      <TableCell 
                        key={colIndex}
                        sx={{ 
                          backgroundColor: colIndex === targetColumnIndex ? 'primary.50' : 'inherit'
                        }}
                      >
                        {row[column.field]?.toString() || (
                          <Typography variant="caption" color="text.secondary">
                            NULL
                          </Typography>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={helpDialogOpen} onClose={() => setHelpDialogOpen(false)} maxWidth="md">
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <HelpIcon sx={{ mr: 1 }} />
            About Target Columns
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            The <strong>target column</strong> is what you want to predict or explain in your analysis.
          </Typography>
          
          <Typography variant="h6" gutterBottom>Supervised Learning</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Select the column containing the values you want to predict (classification, regression).
          </Typography>
          
          <Typography variant="h6" gutterBottom>Unsupervised Learning</Typography>
          <Typography variant="body1">
            Select "No target column" for clustering, dimensionality reduction, or pattern discovery.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={columnDetailsDialogOpen} onClose={() => setColumnDetailsDialogOpen(false)} maxWidth="sm">
        <DialogTitle>
          Column Details: {selectedColumnDetails?.name}
        </DialogTitle>
        <DialogContent>
          {selectedColumnDetails && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Data Type</Typography>
                <Chip 
                  label={selectedColumnDetails.type === 'numeric' ? 'Numerical' : 
                         selectedColumnDetails.type === 'text' ? 'Text' : 'Categorical'} 
                  color={selectedColumnDetails.type === 'numeric' ? 'primary' : 
                         selectedColumnDetails.type === 'text' ? 'info' : 'secondary'}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Unique Values</Typography>
                <Typography>{selectedColumnDetails.uniqueCount}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2">Sample Values</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {selectedColumnDetails.sampleValues?.map((value, index) => (
                    <Chip key={index} label={String(value)} size="small" variant="outlined" />
                  ))}
                </Box>
              </Grid>
              {selectedColumnDetails.hasNulls && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    This column contains missing values.
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColumnDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Target_selection;