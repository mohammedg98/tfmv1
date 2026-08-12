// --- All display texts, alerts, and comments affecting UI are translated to English ---

import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import React, { useState, useEffect } from "react";
import Tooltip from '@mui/material/Tooltip';
import ArrowBackIos from '@mui/icons-material/ArrowBackIos';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Checkbox,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    FormControlLabel,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Grid,
    Slider,
    FormHelperText,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { backendUrl } from "../config";
import './Outlier_manager2.css';
import SaveIcon from '@mui/icons-material/Save';
import ClearIcon from '@mui/icons-material/Clear';

// ==================== STYLE CONSTANTS ====================
const COLORS = {
    primary: '#384850',
    primaryDark: '#003d54',
    accent: '#DE6B06',
    accentDark: '#c55a05',
    success: '#28a745',
    danger: '#dc3545',
    neutral: '#DDDEDF',
    white: '#ffffff',
    dark: '#343a40',
    bgLight: '#f8f9fa',
    bgSection: '#f4f6f8',
};

// ==================== HELP DIALOG COMPONENT ====================
const HelpDialog = ({ open, onClose }) => (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: COLORS.primary, color: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HelpOutlineIcon />
                <Typography variant="h5">User Guide   Advanced Outlier Manager</Typography>
            </Box>
        </DialogTitle>
        <DialogContent dividers>
            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                    <strong>How to use this page in 4 easy steps:</strong> Select columns → Choose a detection method → Click "Detect Outliers" → Review and delete detected outliers.
                </Typography>
            </Alert>

            <Typography variant="body1" paragraph>
                This page helps you detect outliers using advanced machine learning algorithms. 
                Unlike the basic outlier manager, this tool uses multivariate analysis to find outliers 
                by considering relationships between multiple numerical columns simultaneously.
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, pb: 0.5, mt: 2 }}>
                What Makes This Different?
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                    <strong>Multivariate Outlier Detection:</strong> Traditional outlier detection looks at one column at a time. 
                    This advanced tool analyzes <strong>multiple numerical columns together</strong> to find outliers that only appear 
                    when you consider the relationship between variables. A point might be normal in each individual column 
                    but become an outlier when looking at the combination of columns.
                    <ul style={{ marginTop: '8px', marginBottom: '4px' }}>
                        <li><strong>KMeans:</strong> Groups data into clusters   points far from cluster centers are outliers</li>
                        <li><strong>Isolation Forest:</strong> Isolates anomalies by randomly partitioning the data</li>
                        <li><strong>DBSCAN:</strong> Finds outliers as points in low-density regions</li>
                    </ul>
                </Typography>
            </Alert>

            <Typography variant="h6" gutterBottom sx={{ color: COLORS.primary, mt: 2, borderBottom: `2px solid ${COLORS.accent}`, pb: 0.5 }}>
                Step-by-Step Guide
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    {
                        step: '1',
                        title: 'Select Numerical Columns',
                        body: 'Choose which numerical columns to use for outlier detection. Multiple columns can be selected to find outliers based on relationships between variables.'
                    },
                    {
                        step: '2',
                        title: 'Choose a Detection Method',
                        body: (
                            <>
                                <strong>KMeans:</strong> Best for data with natural clusters. Points far from cluster centers are flagged as outliers.<br />
                                <strong>Isolation Forest:</strong> Excellent for high-dimensional data. Works by isolating anomalies.<br />
                                <strong>DBSCAN:</strong> Best for discovering clusters of arbitrary shape. Points not belonging to any dense cluster are outliers.
                            </>
                        )
                    },
                    {
                        step: '3',
                        title: 'Configure Parameters',
                        body: 'Each method has configurable parameters like number of clusters (KMeans), contamination rate (Isolation Forest), or neighborhood size (DBSCAN).'
                    },
                    {
                        step: '4',
                        title: 'Detect & Delete',
                        body: (
                            <>
                                <strong> Detect:</strong> Run the detection algorithm to find outliers.<br />
                                <strong> Visualize:</strong> See outliers projected onto 2D space using PCA.<br />
                                <strong> Delete:</strong> Remove individual outliers or all detected outliers at once.
                            </>
                        )
                    },
                ].map(({ step, title, body }) => (
                    <Grid item xs={12} sm={6} key={step}>
                        <Paper sx={{ p: 2, bgcolor: COLORS.bgSection, borderLeft: `4px solid ${COLORS.accent}`, height: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Box sx={{
                                    width: 28, height: 28, borderRadius: '50%',
                                    bgcolor: COLORS.accent, color: COLORS.white,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
                                }}>
                                    {step}
                                </Box>
                                <Typography variant="subtitle1" fontWeight="bold">{title}</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{body}</Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            <Typography variant="h6" gutterBottom sx={{ color: COLORS.primary, borderBottom: `2px solid ${COLORS.accent}`, pb: 0.5 }}>
                Standardization & PCA Visualization
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                    <strong> Standardization:</strong> When enabled, all columns are scaled to have mean=0 and variance=1. 
                    This is <strong>highly recommended</strong> when your columns have different units or scales (e.g., age in years vs. income in dollars).<br /><br />
                    <strong> PCA Visualization:</strong> After detection, outliers are visualized using Principal Component Analysis (PCA), 
                    which reduces high-dimensional data to 2D for easy interpretation. The chart shows normal points in blue and outliers in red.
                </Typography>
            </Alert>

         
        </DialogContent>
        <DialogActions>
            <Button
              onClick={onClose}
              color="primary"
              variant="contained"
              fullWidth
              size="large"
              sx={{ backgroundColor: COLORS.primary, textTransform: 'none', fontWeight: 700, '&:hover': { backgroundColor: '#003c56' } }}
            >
              Got it
            </Button>
        </DialogActions>
    </Dialog>
);

const Outlier_manager2 = ({ embedded = false, bdName: bdNameProp = null, originalBdName: originalBdNameProp = null, onClose = null } = {}) => {
    const [methodParams, setMethodParams] = useState({
        contamination: 0.05,
        nEstimators: 100,
        nClusters: 2,
        distancePercentile: 95,
        useStandardization: true,
        eps: 0.5,
        minPts: 5,
        maxDeleteRows: 500, // 0 = no safety cap
    });

    const [state, setState] = useState({
        isLoading: true,
        isDetecting: false,
        error: null,
        detectionError: null,
        data: null,
        columns: [],
        columnTypes: {},
        columnNumericContent: {},
        outliers: null,
        selectedColumns: [],
        kmeansResult: null,
        visualizationData: [],
        pcaVariance: [0, 0],
        selectedOutliers: [],
        detectionDetails: null,
    });

    const [hasDeletedOutliers, setHasDeletedOutliers] = useState(false);
    const { state: locationState } = useLocation();
    const navigate = useNavigate();
    const { bdName: bdNameState, originalBdName: originalBdNameState } = locationState || {};
    const bdName = bdNameProp ?? bdNameState;
    const originalBdName = originalBdNameProp ?? originalBdNameState;
    // Table de travail. En mode embarqué (nouveau workflow), on travaille directement sur la
    // table passée (originale, déjà numérisée). En mode legacy, on garde la version "_numerized".
    const workingBdName = embedded
        ? bdName
        : (bdName?.endsWith('_numerized') ? bdName : `${bdName}_numerized`);
    const [detectionMethod, setDetectionMethod] = useState('kmeans');
    const [outliersData, setOutliersData] = useState([]);
    // ==================== HELP DIALOG STATE ====================
    const [openHelpDialog, setOpenHelpDialog] = useState(false);
    const [firstTimeOpen, setFirstTimeOpen] = useState(true);

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

    // ==================== AUTO-OPEN HELP DIALOG ON FIRST LOAD ====================
    useEffect(() => {
        if (!state.isLoading && firstTimeOpen && state.columns?.length) {
            if (!embedded) {
                setOpenHelpDialog(true);
            }
            setFirstTimeOpen(false);
        }
    }, [state.isLoading, firstTimeOpen, state.columns, embedded]);

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

    // Check limit when dialog opens
    useEffect(() => {
        if (saveDialogOpen) {
            checkDatasetLimit();
            if (bdName) {
                const baseName = bdName.endsWith('_numerized')
                    ? bdName.replace('_numerized', '')
                    : bdName;
                const defaultName = `${baseName}_outlier_manager2`;
                setCopyName(defaultName);
            }
        }
    }, [saveDialogOpen, bdName]);

    const handleSaveCopy = async (overwrite = false) => {
        if (!copyName.trim()) {
            setError("Please enter a valid name for your copy");
            return;
        }

        try {
            setSaveCopyLoading(true);
            setError("");

            const baseBdName = bdName.endsWith('_numerized')
                ? bdName.replace('_numerized', '')
                : bdName;

            const response = await axios.post(
                `${backendUrl}/api/save-dataset-copy`,
                {
                    source_db: baseBdName,
                    copy_name: copyName.trim(),
                    copy_type: "outlier_manager2",
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

    // Load data on component mount
    useEffect(() => {
        if (!bdName) {
            if (!embedded) {
                navigate("/upload");
            }
            return;
        }

        const loadData = async () => {
            try {
                setState(prev => ({ ...prev, isLoading: true, error: null, detectionError: null }));

                const finalBdName = workingBdName;
                let typed = [];

                try {
                    const typesResponse = await axios.get(
                        `${backendUrl}/api/analyze-column-types`,
                        {
                            params: { bdName: finalBdName },
                            withCredentials: true,
                        }
                    );
                    typed = (typesResponse.data?.column_types || []).filter(
                        (c) => c.column_name !== "id" && c.column_name !== "split_type"
                    );
                } catch (typesErr) {
                    // Fallback: colonnes via preview paginée
                    const preview = await axios.post(
                        `${backendUrl}/api/get-paginated-data`,
                        { bdName: finalBdName, page: 0, pageSize: 5 },
                        { withCredentials: true }
                    );
                    const cols = (preview.data?.columns || []).filter(
                        (c) => c !== "id" && c !== "split_type"
                    );
                    typed = cols.map((name) => ({
                        column_name: name,
                        column_type: "numerical",
                        stats: { is_numeric_content: true },
                    }));
                }

                const columns = typed.map((c) => c.column_name);
                const columnTypes = {};
                const columnNumericContent = {};
                typed.forEach((c) => {
                    const t = c.column_type || "text";
                    columnTypes[c.column_name] = t;
                    const stats = c.stats || {};
                    // numerical / boolean / categorical (encodé 0,1,2…) → utilisable en multivarié
                    columnNumericContent[c.column_name] = !!(
                        stats.is_numeric_content ||
                        t === "numerical" ||
                        t === "boolean" ||
                        t === "categorical"
                    );
                });

                // Éligible: numerical + boolean + categorical (pas text/date)
                const isEligible = (col) => {
                    const t = columnTypes[col];
                    return t === "numerical" || t === "boolean" || t === "categorical";
                };
                const eligibleColumns = columns.filter(isEligible);

                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    isDetecting: false,
                    error: null,
                    data: [],
                    columns,
                    columnTypes,
                    columnNumericContent,
                    selectedColumns: eligibleColumns.length > 0 ? eligibleColumns : columns,
                }));

            } catch (error) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    isDetecting: false,
                    error: error.response?.data?.detail || error.message,
                    data: null,
                    columns: [],
                    columnTypes: {},
                    selectedColumns: [],
                }));
            }
        };

        loadData();
    }, [bdName, navigate, embedded, workingBdName]);

    // Method selection component
    const renderMethodSelection = () => {
        return (
            <Box sx={{ mt: 2 }}>
                <FormControl fullWidth sx={{ mb: 2 }} className="select-control">
                    <InputLabel className="form-label">Detection Method</InputLabel>
                    <Select
                        value={detectionMethod}
                        onChange={(e) => setDetectionMethod(e.target.value)}
                        label="Detection Method"
                    >
                        <MenuItem value="kmeans">KMeans (distance-based)</MenuItem>
                        <MenuItem value="isolation">Isolation Forest (isolation-based)</MenuItem>
                        <MenuItem value="dbscan">DBSCAN (density-based)</MenuItem>
                    </Select>
                </FormControl>

                <Box sx={{ mb: 2 }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                className="colored-checkbox"
                                checked={methodParams.useStandardization}
                                onChange={(e) => setMethodParams(prev => ({
                                    ...prev,
                                    useStandardization: e.target.checked
                                }))}
                            />
                        }
                        label={
                            <Box>
                                <Typography component="span" className="primary-text">Standardize data before detection</Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    {methodParams.useStandardization
                                        ? "Data will be standardized (recommended for features on different scales)"
                                        : "Using raw data values (only if features are already on similar scales)"}
                                </Typography>
                            </Box>
                        }
                    />
                </Box>

                {detectionMethod === 'kmeans' && (
                    <>
                        <TextField
                            fullWidth
                            label="Number of clusters"
                            type="number"
                            value={methodParams.nClusters}
                            onChange={(e) => setMethodParams(prev => ({
                                ...prev,
                                nClusters: Math.max(2, parseInt(e.target.value) || 2)
                            }))}
                            sx={{ mb: 2 }}
                        />
                        <Typography gutterBottom>
                            Distance sensitivity (percentile): {methodParams.distancePercentile}
                        </Typography>
                        <Slider
                            value={methodParams.distancePercentile}
                            min={80}
                            max={99}
                            step={1}
                            marks={[
                                { value: 80, label: '80' },
                                { value: 95, label: '95' },
                                { value: 99, label: '99' },
                            ]}
                            onChange={(_, v) => setMethodParams(prev => ({
                                ...prev,
                                distancePercentile: v
                            }))}
                            valueLabelDisplay="auto"
                            sx={{ mb: 1, color: COLORS.accent }}
                        />
                        <FormHelperText sx={{ mb: 2 }}>
                            Points farther from their cluster center than this percentile are flagged.
                            Higher = fewer outliers (~{(100 - methodParams.distancePercentile).toFixed(0)}% of train by distance).
                        </FormHelperText>
                    </>
                )}

                {detectionMethod === 'isolation' && (
                    <>
                        <TextField
                            fullWidth
                            label="Contamination (fraction of train expected as outliers)"
                            type="number"
                            inputProps={{ step: 0.01, min: 0.01, max: 0.5 }}
                            value={methodParams.contamination}
                            onChange={(e) => setMethodParams(prev => ({
                                ...prev,
                                contamination: Math.min(0.5, Math.max(0.01, parseFloat(e.target.value) || 0.05))
                            }))}
                            sx={{ mb: 1 }}
                            helperText={`≈ ${Math.round(methodParams.contamination * 100)}% of the TRAIN set will be flagged (e.g. 0.05 → ~5%). Same % on a small or large dataset: absolute count grows with train size. Lower to 0.01 if too aggressive.`}
                        />
                        <TextField
                            fullWidth
                            label="Number of trees"
                            type="number"
                            value={methodParams.nEstimators}
                            onChange={(e) => setMethodParams(prev => ({
                                ...prev,
                                nEstimators: Math.max(10, parseInt(e.target.value) || 100)
                            }))}
                            sx={{ mb: 2 }}
                        />
                    </>
                )}

                {detectionMethod === 'dbscan' && (
                    <>
                        <TextField
                            fullWidth
                            label="Maximum distance (eps)"
                            type="number"
                            inputProps={{ step: 0.1, min: 0.1 }}
                            value={methodParams.eps || 0.5}
                            onChange={(e) => setMethodParams(prev => ({
                                ...prev,
                                eps: Math.max(0.1, parseFloat(e.target.value) || 0.5)
                            }))}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Minimum number of points (minPts)"
                            type="number"
                            inputProps={{ min: 1 }}
                            value={methodParams.minPts || 5}
                            onChange={(e) => setMethodParams(prev => ({
                                ...prev,
                                minPts: Math.max(1, parseInt(e.target.value) || 5)
                            }))}
                            sx={{ mb: 2 }}
                        />
                    </>
                )}

                <TextField
                    fullWidth
                    label="Max rows to delete (safety cap)"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={methodParams.maxDeleteRows}
                    onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setMethodParams(prev => ({
                            ...prev,
                            maxDeleteRows: Number.isFinite(v) ? Math.max(0, v) : 0
                        }));
                    }}
                    helperText="Applies to Delete All: only the most severe outliers are removed, up to this limit. Set 0 for no cap."
                />
            </Box>
        );
    };

    // Detect outliers function
    const detectOutliers = async (columnsOverride = null) => {
        try {
            const cols =
                (columnsOverride && columnsOverride.length > 0
                    ? columnsOverride
                    : state.selectedColumns) || [];

            if (!cols.length) {
                setState(prev => ({
                    ...prev,
                    detectionError: "Please select at least one column for detection",
                    isDetecting: false,
                }));
                return;
            }

            setState(prev => ({
                ...prev,
                isDetecting: true,
                detectionError: null,
                selectedColumns: cols,
            }));

            const requestParams = {
                useStandardization: methodParams.useStandardization
            };

            switch (detectionMethod) {
                case 'kmeans':
                    requestParams.nClusters = Math.max(2, methodParams.nClusters);
                    requestParams.distancePercentile = Math.min(
                        99.9,
                        Math.max(80, methodParams.distancePercentile ?? 95)
                    );
                    break;
                case 'isolation':
                    requestParams.contamination = Math.min(0.5, Math.max(0.01, methodParams.contamination));
                    requestParams.nEstimators = Math.max(10, methodParams.nEstimators);
                    break;
                case 'dbscan':
                    requestParams.eps = Math.max(0.1, methodParams.eps);
                    requestParams.minPts = Math.max(1, methodParams.minPts);
                    break;
                default:
                    throw new Error("Invalid detection method");
            }

            const requestPayload = {
                bdName: workingBdName,
                columns: cols,
                method: detectionMethod,
                params: requestParams
            };

            const detectionResponse = await axios.post(
                `${backendUrl}/api/detect-outliers`,
                requestPayload,
                {
                    withCredentials: true,
                    timeout: 60000
                }
            );

            if (!detectionResponse.data || !detectionResponse.data.outliers) {
                throw new Error("Invalid response format from server");
            }

            const outlierIds = detectionResponse.data.outliers;
            const details = detectionResponse.data.details || {};

            const outliersResponse = await axios.post(
                `${backendUrl}/api/get-outliers-data`,
                {
                    bdName: workingBdName,
                    outlierIds: outlierIds
                },
                {
                    withCredentials: true,
                    timeout: 30000
                }
            );

            const formattedOutliersData = outlierIds.map((oid, index) => {
                const found = (outliersResponse.data || []).find(
                    (o) => o.id === oid || String(o.id) === String(oid)
                );
                return found
                    ? { ...found, id: found.id ?? oid }
                    : { id: oid };
            });

            // PCA depuis le backend (plus de ml-pca / get-data2)
            const pcaProj = detectionResponse.data.pca_projection || [];
            const pcaIds = detectionResponse.data.pca_ids || [];
            const pcaIsOutlier = detectionResponse.data.pca_is_outlier || [];
            const pcaVariance = detectionResponse.data.explained_variance || [0, 0];

            const visualizationData = pcaProj.map((coords, index) => ({
                id: pcaIds[index] ?? index,
                x: coords[0],
                y: coords[1] ?? 0,
                isOutlier: !!pcaIsOutlier[index],
            }));

            setState(prev => ({
                ...prev,
                isDetecting: false,
                error: null,
                detectionError: null,
                outliers: outlierIds,
                visualizationData,
                pcaVariance,
                detectionDetails: details,
                kmeansResult: {
                    clusters: detectionResponse.data.clusters || [],
                    centroids: detectionResponse.data.centroids || [],
                    threshold: detectionResponse.data.threshold,
                    method: detectionMethod
                }
            }));

            setOutliersData(formattedOutliersData);
            setHasDeletedOutliers(true);

        } catch (error) {
            console.error("Outlier detection failed:", error);

            let errorMessage = "An error occurred during outlier detection";

            if (error.response) {
                if (error.response.data && error.response.data.detail) {
                    errorMessage = Array.isArray(error.response.data.detail)
                        ? error.response.data.detail.map(d => d.msg).join(', ')
                        : error.response.data.detail;
                } else if (error.response.statusText) {
                    errorMessage = `${error.response.status}: ${error.response.statusText}`;
                }
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = "Request timeout - Try again with fewer columns or a smaller dataset";
            } else if (error.message && error.message.includes('Network Error')) {
                errorMessage = "Network error - Please check your connection";
            } else if (error.message) {
                errorMessage = error.message;
            }

            setState(prev => ({
                ...prev,
                isDetecting: false,
                detectionError: errorMessage,
            }));
        }
    };

    // Render outliers table
    const renderOutliersTable = () => {
        if (!state.outliers || state.outliers.length === 0) {
            return (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" gutterBottom className="primary-text">
                        Detected Outliers (0 records)
                    </Typography>
                    <Typography color="text.secondary">
                        No outliers detected
                    </Typography>
                </Box>
            );
        }

        if (outliersData.length === 0) {
            return (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" gutterBottom className="primary-text">
                        Detected Outliers ({state.outliers.length} records)
                    </Typography>
                    <Typography color="text.secondary">
                        Loading outlier data...
                    </Typography>
                </Box>
            );
        }

        const availableColumns = outliersData.length > 0
            ? Object.keys(outliersData[0]).filter(key => key !== 'id')
            : [];

        const columns = [
            {
                field: 'actions',
                headerName: 'Actions',
                width: 120,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                pinned: 'left',
                renderCell: (params) => (
                    <Button
                        variant="contained"
                        color="error"
                        size="small"
                        onClick={async (e) => {
                            e.stopPropagation();
                            try {
                                const message = await deleteOutliers(params.row.id);
                                alert(message);
                            } catch (error) {
                                console.error("Delete error:", error);
                            }
                        }}
                    >
                        Delete
                    </Button>
                ),
            },
            ...availableColumns.map(col => ({
                field: col,
                headerName: col,
                width: 150,
                headerClassName:
                    state.columnTypes[col] === "numerical"
                        ? "numerical-header"
                        : state.columnTypes[col] === "boolean"
                            ? "boolean-header"
                            : "text-header",
                cellClassName: (params) =>
                    state.columnTypes[col] === "numerical"
                        ? "numerical-cell"
                        : state.columnTypes[col] === "boolean"
                            ? "boolean-cell"
                            : "text-cell",
            })),
        ];

        const nTrain = state.detectionDetails?.n_samples || 0;
        const nOut = outliersData.length;
        const pct = nTrain > 0 ? ((nOut / nTrain) * 100).toFixed(2) : "N/A";
        const cap = methodParams.maxDeleteRows || 0;
        const willDelete = cap > 0 ? Math.min(nOut, cap) : nOut;

        return (
            <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom className="primary-text">
                    Detected Outliers ({nOut} records)
                </Typography>

                <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                        <strong>{nOut}</strong> outliers on <strong>{nTrain || "N/A"}</strong> rows
                        ({pct}% of {state.detectionDetails?.data_used === "full_dataset_no_split" ? "dataset" : "train"}).
                        {state.detectionDetails?.data_used === "full_dataset_no_split"
                            ? " No train/test split found: detection used the full dataset."
                            : " Detection and delete apply to the train set only."}
                        {cap > 0
                            ? ` Safety cap: Delete All will remove at most ${cap} most severe rows${nOut > cap ? ` (${nOut - cap} left untouched)` : ""}.`
                            : " No delete cap (max rows = 0)."}
                    </Typography>
                </Alert>

                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="contained"
                        className="secondary-button"
                        onClick={async () => {
                            const allIds = outliersData.map(row => row.id);
                            let idsToDelete = allIds;
                            if (cap > 0 && allIds.length > cap) {
                                idsToDelete = allIds.slice(0, cap);
                                if (!window.confirm(
                                    `Safety cap active: delete the ${cap} most severe outliers out of ${allIds.length}?\n\n` +
                                    `The remaining ${allIds.length - cap} will stay in the train set.`
                                )) {
                                    return;
                                }
                            } else if (!window.confirm(
                                `Delete ${willDelete} outlier(s) from the TRAIN set?\n\n` +
                                `(${nOut} detected · ${pct}% of ${nTrain} train rows)`
                            )) {
                                return;
                            }
                            try {
                                const message = await deleteOutliers(idsToDelete);
                                alert(message);
                            } catch (error) {
                                console.error("Delete all error:", error);
                            }
                        }}
                        disabled={outliersData.length === 0}
                    >
                        Delete All Outliers{cap > 0 && nOut > cap ? ` (max ${cap})` : ""}
                    </Button>
                </Box>

                <Box sx={{ height: 400, width: '100%' }}>
                    <DataGrid
                        rows={outliersData}
                        columns={columns}
                        pageSize={5}
                        rowsPerPageOptions={[5]}
                        checkboxSelection
                        getRowId={(row) => row.id}
                        onSelectionModelChange={(newSelection) => {
                            setState(prev => ({
                                ...prev,
                                selectedOutliers: newSelection
                            }));
                        }}
                    />
                </Box>
            </Box>
        );
    };

    // Delete outliers function
    const deleteOutliers = async (outlierIds) => {
        try {
            setState(prev => ({ ...prev, isLoading: true }));

            const response = await axios.post(
                `${backendUrl}/api/delete-outliers`,
                {
                    bdName: workingBdName,
                    outlierIds: Array.isArray(outlierIds) ? outlierIds : [outlierIds]
                },
                { withCredentials: true }
            );

            setState(prev => ({
                ...prev,
                isLoading: false,
                outliers: null,
                visualizationData: [],
                kmeansResult: null,
                detectionDetails: null,
                selectedOutliers: [],
            }));

            setOutliersData([]);
            setHasDeletedOutliers(true);
            return response.data.message;
        } catch (error) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error.response?.data?.detail || error.message,
            }));
            throw error;
        }
    };

    // Toggle column selection
    const toggleColumnSelection = (column) => {
        setState(prev => {
            const newSelected = prev.selectedColumns.includes(column)
                ? prev.selectedColumns.filter(c => c !== column)
                : [...prev.selectedColumns, column];
            return { ...prev, selectedColumns: newSelected };
        });
    };

    // Column type detection
    const detectColumnType = (sample) => {
        if (sample.every(val => val === null || val === "")) return "text";

        const boolValues = sample.map((val) => String(val).toLowerCase());
        if (boolValues.every((val) =>
            ["true", "false", "1", "0", "t", "f", "yes", "no"].includes(val)
        )) return "boolean";

        if (sample.every(val => val === null || val === "" || !isNaN(Number(val)))) return "numerical";

        return "text";
    };

    // Validate data for modeling (types from analyze-column-types: no full table needed)
    const isNumericCompatibleColumn = (col) => {
        const t = state.columnTypes[col];
        return t === "numerical" || t === "boolean" || t === "categorical";
    };

    const validateDataForModeling = () => {
        let hasInvalidColumns = false;
        let hasTextColumns = false;
        const dateColumnsList = [];

        state.columns.forEach(col => {
            if (col === 'split_type') return;

            if (isNumericCompatibleColumn(col)) return;

            const type = state.columnTypes[col];
            if (type === 'text') {
                hasTextColumns = true;
            } else if (type === 'date') {
                dateColumnsList.push(col);
            } else if (!type) {
                // Types not loaded yet: don't hard-block
            } else {
                hasInvalidColumns = true;
            }
        });

        if (dateColumnsList.length > 1) {
            hasInvalidColumns = true;
        }

        return { hasTextColumns, hasInvalidColumns, dateColumnsList };
    };

    // Navigate to model creation
    const handleNavigateToModelCreation = async () => {
        const { hasTextColumns, hasInvalidColumns, dateColumnsList } = validateDataForModeling();

        if (dateColumnsList?.length > 1) {
            alert(
                `Multiple date columns detected (${dateColumnsList.length}): ${dateColumnsList.join(', ')}\n\n` +
                `Only ONE date column is allowed.\n` +
                `Keep one (Auto Transform) or delete the extras before continuing.`
            );
            return;
        }

        if (hasInvalidColumns) {
            alert(
                `Some columns are not in a compatible format:
                
- Unencoded categorical columns
- Booleans not converted (true/false instead of 0/1)
- More than one date column

Note: At most one date column is allowed (optional Time Series validation).
The split_type column is ignored in these checks.

Please apply the necessary transformations before continuing.`
            );
            return;
        }

        if (hasTextColumns) {
            if (!window.confirm(
                `Warning: Your dataset contains text columns that will not be used for training.
                
Note: The split_type column is ignored.

Do you want to continue anyway?`
            )) {
                return;
            }
        }

        try {
            const finalBdName = workingBdName;

            await axios.post(
                `${backendUrl}/api/update-stage`,
                {
                    bdName: finalBdName,
                    newStage: "creat_Model"
                },
                { withCredentials: true }
            );

            navigate("/data_preparation", {
                state: {
                    bdName: originalBdName || bdName.replace('_numerized', ''),
                    initialTab: 4,
                    numerizedBdName: finalBdName,
                    originalBdName: originalBdName || bdName.replace('_numerized', '')
                }
            });

        } catch (error) {
            console.error("Error updating stage:", error);
            alert(`Error: ${error.response?.data?.detail || error.message}`);
        }
    };

    // Render outlier visualization
    const renderOutlierVisualization = () => {
        if (!state.kmeansResult || !state.visualizationData?.length || !state.outliers) {
            return null;
        }

        const CustomTooltip = ({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;

            const data = payload[0].payload;
            return (
                <Paper sx={{ p: 2 }} elevation={3} className="custom-tooltip">
                    <Typography variant="subtitle2" className="primary-text">
                        Row ID: {data.id}
                    </Typography>
                    <Typography>PC1: {data.x.toFixed(4)}</Typography>
                    <Typography>PC2: {data.y.toFixed(4)}</Typography>
                    <Typography color={data.isOutlier ? "error" : "success"}>
                        Status: {data.isOutlier ? "Outlier" : "Normal"}
                    </Typography>
                </Paper>
            );
        };

        const nTrain = state.detectionDetails?.n_samples || 0;
        const nOut = state.outliers?.length || 0;
        const pct = nTrain > 0 ? Math.round((nOut / nTrain) * 100) : 0;

        return (
            <Box sx={{ mt: 4 }} className="visualization-paper">
                <Typography variant="h6" gutterBottom className="primary-text">
                    Outlier Visualization (PCA Projection) - Method: {
                        state.kmeansResult.method === 'kmeans' ? 'KMeans'
                            : state.kmeansResult.method === 'dbscan' ? 'DBSCAN'
                                : 'Isolation Forest'
                    }
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Train only · {methodParams.useStandardization ? "standardized" : "raw values"} ·
                        Explained variance: PC1 ({Math.round((state.pcaVariance[0] || 0) * 100)}%),
                        PC2 ({Math.round((state.pcaVariance[1] || 0) * 100)}%)
                        {state.detectionDetails?.pca_display_points
                            ? ` · showing ${state.detectionDetails.pca_display_points} points`
                            : ''}
                    </Typography>
                    <Typography variant="body2" className="outlier-count">
                        {nOut} outliers ({pct}% of train)
                    </Typography>
                </Box>

                <Box sx={{ position: 'relative', height: '500px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                            margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                type="number"
                                dataKey="x"
                                name="PC1"
                                label={{
                                    value: 'First principal component (PC1)',
                                    position: 'bottom',
                                    offset: 30
                                }}
                                tickFormatter={(value) => value.toFixed(2)}
                                className="chart-axis"
                            />
                            <YAxis
                                type="number"
                                dataKey="y"
                                name="PC2"
                                label={{
                                    value: 'Second principal component (PC2)',
                                    angle: -90,
                                    position: 'left',
                                    offset: 0
                                }}
                                tickFormatter={(value) => value.toFixed(2)}
                                className="chart-axis"
                            />
                            <ZAxis range={[50, 200]} />
                            <RechartsTooltip
                                content={<CustomTooltip />}
                                cursor={{ strokeDasharray: '3 3' }}
                            />
                            <Legend
                                verticalAlign="top"
                                height={36}
                                wrapperStyle={{ paddingBottom: '20px' }}
                            />
                            <Scatter
                                name="Normal points"
                                data={state.visualizationData.filter(d => !d.isOutlier)}
                                fill="#384850"
                                shape="circle"
                                opacity={0.7}
                                className="normal-point"
                            />
                            <Scatter
                                name="Outliers"
                                data={state.visualizationData.filter(d => d.isOutlier)}
                                fill="#e15759"
                                shape="triangle"
                                opacity={0.9}
                                className="outlier-point"
                            />
                        </ScatterChart>
                    </ResponsiveContainer>
                </Box>

                <Box mt={2}>
                    <Typography variant="body2" color="text.secondary">
                        Columns used: {state.selectedColumns.join(', ')}
                    </Typography>
                </Box>
                {renderOutliersTable()}
            </Box>
        );
    };

    // Render outlier controls
    const renderOutlierControls = () => {
        const eligibleColumns = state.columns.filter((col) => {
            const t = state.columnTypes[col];
            return t === "numerical" || t === "boolean" || t === "categorical";
        });

        const selectedCount = state.selectedColumns.length;
        // Bouton actif dès qu'il y a au moins une colonne utilisable dans le dataset
        const canDetect = eligibleColumns.length >= 1 || state.columns.length >= 1;

        return (
            <Box sx={{ mt: 2 }} className="configuration-paper">
                <Typography variant="h6" gutterBottom className="primary-text">
                    Outlier Detection
                </Typography>

                {renderMethodSelection()}

                <Typography variant="body2" color="text.secondary" gutterBottom>
                    Select columns for multivariate detection (numerical, categorical codes, boolean 0/1):
                </Typography>

                {eligibleColumns.length === 0 && (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                        No eligible columns found. Check that the dataset loaded correctly.
                    </Alert>
                )}

                <Paper sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                    <List dense>
                        {(eligibleColumns.length > 0 ? eligibleColumns : state.columns).map(col => (
                            <ListItem key={col} button onClick={() => toggleColumnSelection(col)}>
                                <ListItemIcon>
                                    <Checkbox
                                        className="colored-checkbox"
                                        edge="start"
                                        checked={state.selectedColumns.includes(col)}
                                        tabIndex={-1}
                                        disableRipple
                                    />
                                </ListItemIcon>
                                <ListItemText primary={col} />
                                <Chip
                                    label={state.columnTypes[col] || "unknown"}
                                    size="small"
                                    className="selection-chip"
                                />
                            </ListItem>
                        ))}
                    </List>
                </Paper>

                <Box mt={2}>
                    <Typography variant="body2" className="selection-count">
                        Selected columns: {selectedCount} / {(eligibleColumns.length || state.columns.length)}
                    </Typography>
                </Box>

                <Box mt={2} sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 2,
                    alignItems: 'center'
                }} className="button-container">
                    <Button
                        variant="contained"
                        className="primary-button"
                        onClick={() => {
                            const pool = eligibleColumns.length > 0 ? eligibleColumns : state.columns;
                            const cols =
                                state.selectedColumns.length > 0
                                    ? state.selectedColumns
                                    : pool;
                            detectOutliers(cols);
                        }}
                        disabled={!canDetect || state.isDetecting}
                        sx={{
                            flex: 1,
                            py: 1.5,
                            '&.Mui-disabled': {
                                backgroundColor: '#9e9e9e !important',
                                color: '#fff !important',
                            },
                        }}
                    >
                        {state.isDetecting
                            ? "Detecting…"
                            : `Detect Outliers (${state.selectedColumns.length || eligibleColumns.length || state.columns.length} columns)`}
                    </Button>
                </Box>
            </Box>
        );
    };

    // Loading state
    if (state.isLoading) {
        return (
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight="300px"
            >
                <CircularProgress className="loading-spinner" />
            </Box>
        );
    }

    // Error state: seulement si le chargement initial a échoué (pas de colonnes)
    if (state.error && (!state.columns || state.columns.length === 0)) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error" sx={{ mb: 2 }} className="outlier-alert">
                    Error loading data: {state.error}
                </Alert>
                <Button onClick={() => window.location.reload()} variant="contained" className="primary-button">
                    Retry
                </Button>
            </Box>
        );
    }

    // Main render
    return (
        <Box sx={{ p: 3 }}>
            {state.detectionError && (
                <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    onClose={() => setState((prev) => ({ ...prev, detectionError: null }))}
                >
                    {state.detectionError}
                </Alert>
            )}
            {/* Help Dialog - Auto-opens on first load */}
            <HelpDialog
                open={openHelpDialog}
                onClose={() => setOpenHelpDialog(false)}
            />

            {/* Header with dataset name and top button */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3
            }}>
                <Typography variant="subtitle1" className="dataset-header">
                    Dataset: {originalBdName || bdName.replace('_numerized', '')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }} className="button-container">
                    {/* HELP BUTTON */}
                    <Tooltip title="Open user guide">
                        <Button
                            variant="outlined"
                            startIcon={<HelpOutlineIcon />}
                            onClick={() => setOpenHelpDialog(true)}
                            sx={{
                                height: 40,
                                textTransform: 'none',
                                borderColor: 'rgb(0, 80, 111)',
                                color: 'rgb(0, 80, 111)',
                                fontWeight: 600,
                            }}
                        >
                            Help
                        </Button>
                    </Tooltip>

                    {!embedded && (
                    <Tooltip title="Return to data transformation step">
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<ArrowBackIos sx={{ fontSize: '16px' }} />}
                            onClick={() => navigate("/data_preparation", {
                                state: {
                                    bdName: originalBdName || bdName.replace('_numerized', ''),
                                    initialTab: 3
                                }
                            })}
                            sx={{
                                minWidth: '220px',
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
                            Data Transformation
                        </Button>
                    </Tooltip>
                    )}
                    {!embedded && (
                    <Button
                        variant="outlined"
                        startIcon={<SaveIcon />}
                        onClick={() => setSaveDialogOpen(true)}
                        className="save-copy-button"
                        sx={{
                            height: 40,
                            textTransform: 'none',
                            borderColor: 'rgb(0, 80, 111)',
                            color: 'rgb(0, 80, 111)',
                            fontWeight: 600,
                            transition: 'all 0.2s ease-in-out'
                        }}
                    >
                        Save Copy
                    </Button>
                    )}

                    {embedded && onClose && (
                        <Button
                            variant="contained"
                            className="success-button"
                            onClick={onClose}
                            sx={{ py: 1.5 }}
                        >
                            Done
                        </Button>
                    )}

                    {!embedded && (
                    <Button
                        variant="contained"
                        className="success-button"
                        onClick={handleNavigateToModelCreation}
                        disabled={validateDataForModeling().hasInvalidColumns}
                        sx={{
                            py: 1.5
                        }}
                    >
                        Continue to Train Model
                    </Button>
                    )}
                </Box>
            </Box>

            {/* Main content */}
            {renderOutlierControls()}
            {renderOutlierVisualization()}

            {/* Bottom button */}
            {!embedded && (
            <Box sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                mt: 4
            }}>
                <Button
                    variant="contained"
                    className="success-button"
                    onClick={handleNavigateToModelCreation}
                    disabled={validateDataForModeling().hasInvalidColumns}
                    sx={{
                        py: 1.5
                    }}
                >
                    Continue to Train Model
                </Button>
            </Box>
            )}
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

                    {/* Option 1: Name conflict */}
                    {nameConflict && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                                Dataset Name Already Exists
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                The name "<strong>{copyName}</strong>" is already used. You can:
                            </Typography>

                            {/* List of existing datasets */}
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
                                        // Generate new unique name with timestamp
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

                    {/* Option 2: Limit reached */}
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

                    {/* General error message */}
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
};

export default Outlier_manager2;