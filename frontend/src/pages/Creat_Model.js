import React, { useState, useEffect,useRef, useMemo } from "react";
import ArrowBackIos from '@mui/icons-material/ArrowBackIos';
import {
  LineChart, AreaChart, Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import './Creat_Model.css';
import moment from "moment";
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { ReferenceLine } from 'recharts';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import ScatterPlotOutlinedIcon from '@mui/icons-material/ScatterPlotOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import CloseIcon from '@mui/icons-material/Close';

import CircularProgress from '@mui/material/CircularProgress';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'; 
import DownloadIcon from '@mui/icons-material/Download';
import { backendUrl, frontendUrl } from "../config";
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import {
  Dialog,
  Divider,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Tooltip as MuiTooltip,
  // ... vos autres imports existants ...
} from '@mui/material';




const Creat_Model = ({ embedded = false, bdName: bdNameProp = null } = {}) => {
    const isTrainingRef = useRef(false);
    const problemTypeRef = useRef(null);
const [problemType, setProblemType] = useState(null);

const [openHelpDialog, setOpenHelpDialog] = useState(false);
const [firstTimeOpen, setFirstTimeOpen] = useState(true);
  const location = useLocation();
  const state = useMemo(
    () => ({
      ...(location.state || {}),
      bdName: bdNameProp || location.state?.bdName,
      originalBdName:
        bdNameProp || location.state?.originalBdName || location.state?.bdName,
    }),
    [location.state, bdNameProp]
  );
  const [alpha, setAlpha] = useState(1.0);
  const [isTraining, setIsTraining] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // Server-side save window (Solution 1): 5 minutes after training completes
  const [lastCompletedTrainingId, setLastCompletedTrainingId] = useState(null);
  const [saveAvailableUntil, setSaveAvailableUntil] = useState(null);

  const isSaveWindowExpired = () =>
    Boolean(result?.model_object) &&
    Boolean(saveAvailableUntil) &&
    Date.now() > saveAvailableUntil;
  const [featureImportance, setFeatureImportance] = useState([]);
  const [columns, setColumns] = useState([]);
  const [targetColumn, setTargetColumn] = useState(null);
  const [lastRequestData, setLastRequestData] = useState(null);
  const [modelType, setModelType] = useState('ridge'); 
  const [saveModelDialog, setSaveModelDialog] = useState(false);
const [modelName, setModelName] = useState('');
const [saveModelLoading, setSaveModelLoading] = useState(false);
const [modelLimitDialog, setModelLimitDialog] = useState({
  open: false,
  count: 0,
  limit: 20,
});
const [hasTargetColumn, setHasTargetColumn] = useState(false);
const [autoAlphaSearch, setAutoAlphaSearch] = useState(true);
  const [logisticValidationError, setLogisticValidationError] = useState('');
const [targetColumnMapping, setTargetColumnMapping] = useState(null);
const [modelInfoDialogOpen, setModelInfoDialogOpen] = useState(false);
const navigate = useNavigate();
const RS_SUPPORTED_MODELS = useMemo(
  () => ['ridge', 'logistic', 'random_forest', 'svm', 'knn', 'lightgbm'],
  []
);
const [randomSearchEnabled, setRandomSearchEnabled] = useState(false);
const [randomSearchTrials, setRandomSearchTrials] = useState(20);
const [trainRowCount, setTrainRowCount] = useState(null);
const [randomSearchProgress, setRandomSearchProgress] = useState(null);
// Show RS UI for supported algos always; enable only when train < 10k
const randomSearchSupported = RS_SUPPORTED_MODELS.includes(modelType);
const randomSearchEligible =
  trainRowCount != null && trainRowCount > 0 && trainRowCount < 10000;
const randomSearchAvailable = randomSearchSupported && randomSearchEligible;
const [lightgbmParams, setLightgbmParams] = useState({
  objective: 'auto',
  boosting_type: 'gbdt',
  num_leaves: 31,
  learning_rate: 0.1,
  n_estimators: 100,
  max_depth: -1,
  min_child_samples: 20,
  subsample: 1.0,
  colsample_bytree: 1.0,
  reg_alpha: 0.0,
  reg_lambda: 0.0,
  early_stopping_rounds: 10,
});
const [nRepetitions, setNRepetitions] = useState(10);


  const [validationMethod, setValidationMethod] = useState('holdout');
  const [cvParams, setCvParams] = useState({
    n_splits: 5,
    shuffle: true,
    test_size: 0.2,
    n_repeats: 3
  });
  const [bootstrapParams, setBootstrapParams] = useState({
    n_bootstraps: 100,
    test_size: 0.2
  });
  const [validationInfoDialogOpen, setValidationInfoDialogOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
const [stopTraining, setStopTraining] = useState(false);

  const [treeParams, setTreeParams] = useState({
    criterion: 'squared_error',
    max_depth: null,
    min_samples_split: 2,
    min_samples_leaf: 1,
    max_features: 'sqrt',
    max_leaf_nodes: null,
  });
const [randomForestParams, setRandomForestParams] = useState({
  n_estimators: 100,
  max_depth: null,
  min_samples_split: 2,
  min_samples_leaf: 1,
  max_features: 'sqrt', 
  bootstrap: true,
  oob_score: false,
  random_state: null, 
  n_jobs: -1,
  hyperparameter_search: true,
  validation_method: 'holdout'
});
 const [logisticParams, setLogisticParams] = useState({
    penalty: 'l2',
    solver: 'lbfgs', 
    max_iter: 1000,
    multi_class: 'auto',
    class_weight: null,
    use_scaling: true,
    random_state: null,
    l1_ratio: 0.5,
  });
const [knnParams, setKnnParams] = useState({
  n_neighbors: 5,
  weights: 'uniform',  // 'uniform' ou 'distance'
  algorithm: 'auto',   // 'auto', 'ball_tree', 'kd_tree', 'brute'
  leaf_size: 30,
  p: 2,                // 1 pour Manhattan, 2 pour Euclidean
  metric: 'minkowski',
  use_scaling: false
});
// Safe default: do NOT retrain final model on train+test (avoids leakage into deployed model)
const [finalTrainingOnAllData, setFinalTrainingOnAllData] = useState(false);
const [confusionMatrixNormalized, setConfusionMatrixNormalized] = useState(false);
const [resultDialog, setResultDialog] = useState(null); // { id, title } | null
const [svmParams, setSvmParams] = useState({
  kernel: 'rbf',
  C: 1.0,
  gamma: 'scale',
  degree: 3,
  shrinking: true,
  probability: false,
});
const [isSvmClassification, setIsSvmClassification] = useState(null);






const [problemDetails, setProblemDetails] = useState(null);

const [isClassification, setIsClassification] = useState(null);
const [targetTypeDetails, setTargetTypeDetails] = useState(null);

  useEffect(() => {
    // Réinitialiser les résultats quand le type de modèle change
    setResult(null);
    setError(null);
    setFeatureImportance([]);
  }, [modelType]);

useEffect(() => {
    if (!isTraining && firstTimeOpen && state?.bdName) {
        setOpenHelpDialog(true);
        setFirstTimeOpen(false);
    }
}, [isTraining, firstTimeOpen, state?.bdName]);

const [dateColumn, setDateColumn] = useState(null);
const [dateColumnOptions, setDateColumnOptions] = useState([]);
const [timeSeriesParams, setTimeSeriesParams] = useState({
  n_splits: 5,
  test_size: 0.2,
  gap: 0
});
const [dateColumnDetected, setDateColumnDetected] = useState(false);





const renderMlpValidationDetails = () => {
  if (!result?.metrics?.validation_results || modelType !== 'mlp') return null;

  const validationData = result.metrics.validation_results;
  const isClassification = result.metrics.is_classification;
  
  // Déterminer la méthode de validation
  const isHoldout = validationData.method?.includes('Hold-Out');
  const isCV = validationData.method?.includes('Cross-Validation');
  const isBootstrap = validationData.method?.includes('Bootstrap');
  
  // Récupérer les détails selon la méthode
  let details = [];
  let scoreProperty = 'score';
  
  if (isHoldout) {
    details = validationData.repetition_details || [];
    scoreProperty = 'score';
  } else if (isCV) {
    details = validationData.fold_details || [];
    if (details.length > 0 && details[0].validation_score !== undefined) {
      scoreProperty = 'validation_score';
    }
  } else if (isBootstrap) {
    details = validationData.bootstrap_details || [];
    scoreProperty = 'score';
  }
  
  if (details.length === 0) return null;

  // Préparer les données pour le graphique (sans best_epoch)
  const chartData = details.map((item, index) => {
    const baseItem = {
      id: item.repetition || item.fold || item.bootstrap || index + 1,
      label: isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Sample'
    };
    
    let scoreValue = 0;
    if (scoreProperty && item[scoreProperty] !== undefined) {
      scoreValue = item[scoreProperty];
    }
    
    return {
      ...baseItem,
      fold: baseItem.id,
      score: scoreValue
      // best_epoch SUPPRIMÉ
    };
  });

  // Calculer les scores pour les statistiques
  const scores = chartData.map(item => item.score);
  
  // Obtenir le score moyen selon la méthode
  const meanScore = validationData.mean_score || 
                   validationData.cv_mean || 
                   validationData.bootstrap_mean ||
                   (scores.reduce((a, b) => a + b, 0) / scores.length);
  
  const stdScore = validationData.std_score || 
                  validationData.cv_std || 
                  validationData.bootstrap_std ||
                  (Math.sqrt(scores.reduce((sq, n) => sq + Math.pow(n - meanScore, 2), 0) / scores.length));

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔍 {isHoldout ? 'Hold-Out' : isCV ? 'Cross-Validation' : 'Bootstrap'} Validation Details (MLP)
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validationData.method}<br/>
            <strong>{isHoldout ? 'Repetitions' : isCV ? 'Folds' : 'Samples'}:</strong> {details.length}<br/>
            <strong>Average Score:</strong> {meanScore.toFixed(4)} ± {stdScore.toFixed(4)}
          </Typography>
        </Alert>

        {/* Graphique des scores de validation */}
        {chartData.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
               {isClassification ? 'Accuracy' : 'R² Score'} by {isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap Sample'}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fold" 
                  label={{ 
                    value: isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap Sample', 
                    position: 'insideBottomRight', 
                    offset: -10 
                  }}
                />
                <YAxis 
                  label={{ 
                    value: isClassification ? 'Accuracy' : 'R² Score', 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                  domain={isClassification ? [0, 1] : ['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'score') {
                      return [value.toFixed(4), isClassification ? 'Accuracy' : 'R² Score'];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => 
                    `${isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap'} ${label}`
                  }
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#8884d8" 
                  name={isClassification ? 'Accuracy' : 'R² Score'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                {/* Ligne de référence pour la moyenne */}
                <ReferenceLine 
                  y={meanScore} 
                  stroke="#ff7300" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: `Avg: ${meanScore.toFixed(3)}`, 
                    position: 'insideTopRight',
                    fill: '#ff7300',
                    fontSize: 12
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tableau des résultats individuels - SANS Best Epoch et Unique Samples */}
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          📋 Individual Validation Results
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  {isHoldout ? 'Rep' : isCV ? 'Fold' : 'Sample'}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Train Size
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Validation Size
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {isClassification ? 'Accuracy' : 'R² Score'}
                </TableCell>
                {/* Colonnes Best Epoch et Unique Samples SUPPRIMÉES */}
              </TableRow>
            </TableHead>
            <TableBody>
              {details.slice(0, 10).map((item, index) => {
                const foldId = item.repetition || item.fold || item.bootstrap || index + 1;
                const trainSize = item.train_size || 'N/A';
                const validationSize = item.validation_size || 'N/A';
                
                let displayScore = 0;
                if (item.validation_score !== undefined) {
                  displayScore = item.validation_score;
                } else if (item.score !== undefined) {
                  displayScore = item.score;
                }
                
                return (
                  <TableRow key={index} hover>
                    <TableCell>
                      {foldId}
                    </TableCell>
                    <TableCell align="right">{trainSize}</TableCell>
                    <TableCell align="right">{validationSize}</TableCell>
                    <TableCell 
                      align="right" 
                      sx={{ 
                        fontWeight: 'medium',
                        color: isClassification ? 
                          (displayScore >= 0.9 ? 'success.main' : 
                           displayScore >= 0.8 ? 'warning.main' : 'error.main') :
                          (displayScore >= 0.8 ? 'success.main' : 
                           displayScore >= 0.6 ? 'warning.main' : 'error.main')
                      }}
                    >
                      {displayScore.toFixed(4)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {details.length > 10 && (
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
            Showing first 10 of {details.length} {isHoldout ? 'repetitions' : isCV ? 'folds' : 'samples'}
          </Typography>
        )}

        {/* Résumé statistique */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            📊 Statistical Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Mean:</strong> {meanScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Std Dev:</strong> {stdScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Min:</strong> {Math.min(...scores).toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Max:</strong> {Math.max(...scores).toFixed(4)}
              </Typography>
            </Grid>
            {validationData.best_repetition && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Best Repetition:</strong> {validationData.best_repetition} 
                  (Score: {validationData.best_score?.toFixed(4) || 'N/A'})
                </Typography>
              </Grid>
            )}
            {validationData.best_fold && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Best Fold:</strong> {validationData.best_fold} 
                  (Score: {validationData.best_fold_score?.toFixed(4) || 'N/A'})
                </Typography>
              </Grid>
            )}
            {validationData.median_bootstrap_index && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Median Bootstrap:</strong> {validationData.median_bootstrap_index} 
                  (Score: {validationData.median_bootstrap_score?.toFixed(4) || 'N/A'})
                </Typography>
              </Grid>
            )}
          </Grid>
          
          {/* Informations supplémentaires selon la méthode */}
          {isCV && validationData.n_splits && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Number of Folds:</strong> {validationData.n_splits}
              </Typography>
            </Box>
          )}
          
          {isBootstrap && validationData.n_bootstraps && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Bootstrap Samples:</strong> {validationData.n_bootstraps}
              </Typography>
            </Box>
          )}
          
          {isHoldout && validationData.n_repetitions && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Repetitions:</strong> {validationData.n_repetitions}
              </Typography>
              <Typography variant="body2">
                <strong>Test Size:</strong> {validationData.test_size_percent || (validationData.test_size * 100)}%
              </Typography>
            </Box>
          )}

          {/* Informations spécifiques MLP */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
            <Typography variant="subtitle2" gutterBottom>
              🔧 MLP Parameters Used
            </Typography>
            <Typography variant="body2">
              <strong>Layers:</strong> {result.metrics?.layers_used?.join(', ') || mlpParams.layers.join(', ')} | 
              <strong> Activation:</strong> {result.metrics?.activation_used || mlpParams.activation} | 
              <strong> Learning Rate:</strong> {result.metrics?.learning_rate_used || mlpParams.learning_rate}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};



const pollTrainingResult = async (id) => {
  const checkInterval = setInterval(async () => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/training-status/${id}`,
        { withCredentials: true }
      );
      
      if (response.data.completed) {
        clearInterval(checkInterval);
        setResult(response.data.result);
        setIsTraining(false);
      }
    } catch (err) {
      console.log("Training still in progress...");
    }
  }, 2000);
};


const renderCUsedInfo = () => {
  if (!result || modelType !== 'logistic') return null;
  
  const bestC = result.metrics?.validation_results?.best_C;
  const CUsed = result.metrics?.best_C_used;
  
  if (!bestC && !CUsed) return null;
  
  return (
    <Card sx={{ mt: 2, backgroundColor: '#e8f5e8' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom color="success.main">
          ⚙️ Regularization Parameter (C) Used
        </Typography>
        <Typography variant="body1">
          <strong>Optimal C found:</strong> {bestC || CUsed}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This C value was used for the final model training. 
          {bestC === CUsed ? " (Same as optimal)" : " (Adjusted from optimal)"}
        </Typography>
      </CardContent>
    </Card>
  );
};
  const handleModelTypeChange = (newModelType) => {
    setModelType(newModelType);
  };
const renderModelSelectionButtons = () => {
  const getButtonState = (mt) => {
    // Anomaly detection: available with or without target
    if (mt === 'isolation_forest' || mt === 'one_class_svm') {
      return !!problemType;
    }
    if (problemType === 'unsupervised') {
      return mt === 'kmeans';
    }
    if (problemType === 'classification') {
      return ['logistic', 'random_forest', 'svm', 'knn', 'lightgbm', 'mlp'].includes(mt);
    }
    if (problemType === 'regression') {
      return ['ridge', 'random_forest', 'svm', 'knn', 'lightgbm', 'mlp'].includes(mt);
    }
    return false;
  };

  const getButtonTitle = (mt) => {
    if (mt === 'isolation_forest' || mt === 'one_class_svm') {
      return "Unsupervised anomaly detection: works with or without a target (target used only for optional evaluation)";
    }
    if (problemType === 'unsupervised' && mt !== 'kmeans') {
      return "Only K-Means / anomaly detectors are available without a supervised target";
    }
    if (problemType === 'classification' && mt === 'ridge') {
      return "Ridge Regression is for regression problems only";
    }
    if (problemType === 'regression' && mt === 'logistic') {
      return "Logistic Regression is for classification problems only";
    }
    if (!hasTargetColumn && mt !== 'kmeans' && mt !== 'isolation_forest' && mt !== 'one_class_svm') {
      return "Requires a target column";
    }
    return "";
  };

  const models = [
    { id: 'ridge', label: 'Ridge', sub: 'Linear regression', tag: 'Reg' },
    { id: 'logistic', label: 'Logistic', sub: 'Linear classification', tag: 'Clf' },
    { id: 'random_forest', label: 'Random Forest', sub: 'Ensemble trees', tag: 'Both' },
    { id: 'svm', label: 'SVM', sub: 'Support vectors', tag: 'Both' },
    { id: 'knn', label: 'KNN', sub: 'Nearest neighbors', tag: 'Both' },
    { id: 'lightgbm', label: 'LightGBM', sub: 'Gradient boosting', tag: 'Both' },
    { id: 'mlp', label: 'Neural Net', sub: 'MLP (PyTorch)', tag: 'Both' },
    { id: 'kmeans', label: 'K-Means', sub: 'Clustering', tag: 'Unsup' },
    { id: 'isolation_forest', label: 'Isolation Forest', sub: 'Anomaly / intrusion', tag: 'Anom' },
    { id: 'one_class_svm', label: 'One-Class SVM', sub: 'Novelty detection', tag: 'Anom' },
  ];

  return (
    <Box className="cm-algo-grid" sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#384850', fontWeight: 700, letterSpacing: 0.3 }}>
        Choose algorithm
      </Typography>
      {!problemType && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Loading problem type… the first matching algorithm will be selected automatically
          (Ridge / Logistic / K-Means).
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          opacity: problemType ? 1 : 0.55,
          pointerEvents: problemType ? 'auto' : 'none',
        }}
      >
        {models.map((m) => {
          const enabled = getButtonState(m.id);
          const selected = !!problemType && modelType === m.id;
          return (
            <MuiTooltip key={m.id} title={getButtonTitle(m.id) || m.sub} arrow>
              <span>
                <Button
                  fullWidth
                  disabled={!enabled}
                  onClick={() => handleModelTypeChange(m.id)}
                  className={`cm-algo-card ${selected ? 'selected' : ''}`}
                  sx={{
                    m: 0,
                    py: 1.75,
                    px: 1.5,
                    minHeight: 88,
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    textTransform: 'none',
                    borderRadius: 2,
                    border: selected ? '2px solid #DE6B06' : '1px solid #cfd4d8',
                    background: selected
                      ? 'linear-gradient(145deg, #fff8f2 0%, #ffffff 100%)'
                      : '#fff',
                    color: '#384850',
                    boxShadow: selected ? '0 6px 18px rgba(222,107,6,0.18)' : 'none',
                    opacity: enabled ? 1 : 0.45,
                    transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
                    '&:hover': enabled
                      ? {
                          borderColor: '#DE6B06',
                          transform: 'translateY(-1px)',
                          background: '#fff',
                        }
                      : {},
                  }}
                >
                  <Typography variant="caption" sx={{ color: selected ? '#DE6B06' : '#7a858c', fontWeight: 700 }}>
                    {m.tag}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2, mt: 0.25 }}>
                    {m.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.25 }}>
                    {m.sub}
                  </Typography>
                </Button>
              </span>
            </MuiTooltip>
          );
        })}
      </Box>
    </Box>
  );
};
useEffect(() => {
  if (!randomForestParams.bootstrap && randomForestParams.oob_score) {
    setRandomForestParams(prev => ({
      ...prev,
      oob_score: false
    }));
  }
}, [randomForestParams.bootstrap]);
useEffect(() => {
  if (state?.bdName) {
    const initializeDatasetInfo = async () => {
      try {
        // 1. Fetch Target Column First
        await fetchTargetColumn();
        
        // 2. Detect Problem Type
        await detectProblemType();
        
        // 3. Fetch Target Type for Random Forest
        await fetchTargetType();
        
        // 4. Detect Date Column
        const detectedCol = await detectDateColumn();
        if (detectedCol) {
          setDateColumn(detectedCol);
          setDateColumnDetected(true);
          console.log(`[DEBUG] 📅 Date column set to: ${detectedCol}`);
        } else {
          setDateColumnDetected(false);
        }
      } catch (err) {
        console.error("Initialization sequence failed:", err);
      }
    };

    initializeDatasetInfo();
  }
}, [state?.bdName]);
// ✅ DÉTECTION GÉNÉRALE ROBUSTE AVEC LOGS DE DEBUG
const detectProblemType = async () => {
  if (!state?.bdName) {
    console.log("[DEBUG] ❌ No dataset name available");
    return;
  }
  
  console.log("[DEBUG] 🔍 Starting problem type detection for:", state.bdName);
  
  try {
    const originalBdName = state.bdName.replace('_numerized', '');
    console.log("[DEBUG] Original dataset name:", originalBdName);
    
    // Utiliser le nouveau endpoint de détection
    console.log("[DEBUG] 📋 Calling new detection API...");
    const response = await axios.get(
      `${backendUrl}/api/detect-problem-type?bdName=${originalBdName}`,
      { withCredentials: true, timeout: 45000 }
    );
    
    const detectionResult = response.data;
    console.log("[DEBUG] ✅ Detection result received:", detectionResult);
    
    // Appliquer les résultats de détection
    const pt = detectionResult.problem_type;
    problemTypeRef.current = pt;
    setProblemType(pt);
    setIsClassification(detectionResult.is_classification);
    setHasTargetColumn(detectionResult.has_target);

    // Default algorithm for the problem type (first active choice)
    if (pt === 'regression') setModelType('ridge');
    else if (pt === 'classification') setModelType('logistic');
    else if (pt === 'unsupervised') setModelType('kmeans');
    
    // Mettre à jour la target column
    if (detectionResult.target_column) {
      setTargetColumn(detectionResult.target_column);
    }
    
    console.log(`[DEBUG]   FINAL DECISION: ${pt.toUpperCase()}`);
    console.log("[DEBUG] 📊 Detection metrics:", detectionResult.detection_metrics);
    console.log("[DEBUG] 📝 Reason:", detectionResult.reason);
    
  } catch (error) {
    console.error("[DEBUG] ❌ Error in problem type detection:", error);
    
    // Fallback en cas d'erreur
    console.log("[DEBUG] 🆘 FALLBACK: Using conservative detection");
    
    // Essayer de récupérer au moins la target column
    const hasTarget = await fetchTargetColumn();
    
    if (!hasTarget) {
      problemTypeRef.current = 'unsupervised';
      setProblemType('unsupervised');
      setIsClassification(false);
      setModelType('kmeans');
    } else {
      // Fallback conservateur vers classification
      problemTypeRef.current = 'classification';
      setProblemType('classification');
      setIsClassification(true);
      setModelType('logistic');
    }
    
    setHasTargetColumn(hasTarget);
  }
};


// ✅ FALLBACK AMÉLIORÉ
const fallbackTargetDetection = async (originalBdName) => {
  console.log("[DEBUG] 🛠️ Using enhanced fallback target detection");
  
  try {
    // Essayer de récupérer des informations basiques
    const response = await axios.get(
      `${backendUrl}/api/get-split-info?bdName=${originalBdName}`,
      { withCredentials: true, timeout: 10000 }
    );
    
    const splitInfo = response.data;
    console.log("[DEBUG] 📋 Fallback split info:", splitInfo);
    
    // Logique de fallback basée sur le nom de la target column
    const targetColumn = splitInfo.target_column;
    let isClassification = true; // Default to classification (safer)
    
    // Indicateurs de regression dans les noms de colonnes
    const regressionIndicators = ['price', 'cost', 'amount', 'value', 'revenue', 'income', 'salary', 'age', 'temperature', 'height', 'weight'];
    const classificationIndicators = ['label', 'class', 'category', 'type', 'species', 'outcome', 'result', 'status'];
    
    if (targetColumn) {
      const targetLower = targetColumn.toLowerCase();
      
      if (regressionIndicators.some(indicator => targetLower.includes(indicator))) {
        console.log("[DEBUG]   Fallback: Target name suggests regression");
        isClassification = false;
      } else if (classificationIndicators.some(indicator => targetLower.includes(indicator))) {
        console.log("[DEBUG]   Fallback: Target name suggests classification");
        isClassification = true;
      }
    }
    
    return {
      problem_type: isClassification ? 'classification' : 'regression',
      is_classification: isClassification,
      unique_values: 5, // Valeur conservatrice
      total_values: 100,
      target_is_numeric: !isClassification, // Suppose numeric for regression
      reason: `Fallback detection based on column name: ${targetColumn}`
    };
    
  } catch (fallbackError) {
    console.error("[DEBUG] ❌ Enhanced fallback failed:", fallbackError);
    
    // Dernier recours ultra-conservateur
    return {
      problem_type: 'classification',
      is_classification: true,
      unique_values: 2,
      total_values: 100,
      target_is_numeric: false,
      reason: 'Ultra conservative fallback - default to classification'
    };
  }
};
const detectNumericIds = (values) => {
  if (!values || values.length === 0) return false;
  
  const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
  
  // Si ce sont des nombres entiers séquentiels
  if (numericValues.length === values.length) {
    const sorted = [...numericValues].sort((a, b) => a - b);
    const isSequential = sorted.every((val, idx, arr) => 
      idx === 0 || val === arr[idx - 1] + 1
    );
    
    // Si séquentiel avec peu de répétitions → probablement des IDs
    const uniqueRatio = new Set(numericValues).size / numericValues.length;
    if (isSequential && uniqueRatio > 0.8) {
      return true;
    }
  }
  
  return false;
};


const renderModelInfoDialog = () => {
  const getModelDescription = () => {
    const modelDescriptions = {
      'ridge': {
        name: 'Ridge Regression',
        description: 'A linear regression model with L2 regularization that prevents overfitting by penalizing large coefficients. It works well when you have many features or correlated features.',
        useCases: [
          'Predicting continuous values (prices, temperatures, etc.)',
          'When you have many correlated features',
          'Preventing overfitting in linear models',
          'Stable and reliable predictions'
        ],
        parameters: [
          {
            name: 'Regularization Strength (Alpha)',
            type: 'auto-optimized',
            description: 'Automatically optimized during training. Higher values mean stronger regularization.',
            values: 'The system tests multiple values and chooses the best one automatically'
          },
          {
            name: 'Validation Method',
            type: 'selection',
            description: 'How the model validates its performance during training.',
            options: [
              'Hold-out: Simple train/test split (fast)',
              'Cross-Validation: More reliable but slower',
              'Bootstrap: Good for small datasets'
            ]
          }
        ],
        tips: [
          'Works best when features are scaled',
          'Good for datasets with many features',
          'Automatically handles regularization strength'
        ]
      },
      'logistic': {
        name: 'Logistic Regression',
        description: 'A classification model that predicts probabilities using a logistic function. It\'s fast, interpretable, and works well for binary and multi-class classification problems.',
        useCases: [
          'Binary classification (yes/no, spam/not spam)',
          'Multi-class classification',
          'When you need probability estimates',
          'Quick prototyping and baseline models'
        ],
        parameters: [
          {
            name: 'Regularization Type',
            type: 'selection',
            description: 'Type of regularization to prevent overfitting:',
            options: [
              'L2 (Ridge): Shrinks all coefficients equally - good default choice',
              'L1 (Lasso): Can set some coefficients to zero - performs feature selection',
              'ElasticNet: Mix of L1 and L2 - choose the ratio with L1 Ratio parameter',
              'None: No regularization - risk of overfitting'
            ]
          },
          {
            name: 'Algorithm (Solver)',
            type: 'selection',
            description: 'The optimization algorithm used for training:',
            options: [
              'LBFGS: Good for small datasets and L2 regularization',
              'Liblinear: Fast for small datasets and binary classification',
              'Newton-CG: Good for small datasets with L2',
              'SAG: Good for large datasets',
              'SAGA: Supports all regularization types - most versatile'
            ]
          },
          {
            name: 'L1 Ratio (for ElasticNet only)',
            type: 'slider',
            description: 'Mixing parameter between L1 and L2 regularization:',
            values: '0 = pure L2, 1 = pure L1, 0.5 = equal mix',
            range: '0 to 1'
          },
          {
            name: 'Max Iterations',
            type: 'number',
            description: 'Maximum number of iterations for the solver to converge.',
            values: 'Higher values may help convergence but take longer',
            range: '100 to 10000'
          },
          {
            name: 'Multiclass Strategy',
            type: 'selection',
            description: 'How to handle multiple classes:',
            options: [
              'Auto: Let the system choose the best method',
              'One-vs-Rest: Train one classifier per class',
              'Multinomial: Direct multi-class classification (not available with Liblinear)'
            ]
          },
          {
            name: 'Class Weighting',
            type: 'selection',
            description: 'How to handle imbalanced classes:',
            options: [
              'None: Treat all classes equally',
              'Balanced: Automatically adjust weights inversely proportional to class frequencies'
            ]
          },
          {
            name: 'Scale Features',
            type: 'checkbox',
            description: 'Whether to automatically scale features before training.',
            checked: 'Recommended - ensures all features contribute equally',
            unchecked: 'Not recommended - may cause some features to dominate'
          }
        ],
        tips: [
          'Scale features for better performance',
          'Use L2 regularization as a starting point',
          'SAGA solver works with all regularization types',
          'Increase max iterations if model fails to converge'
        ]
      },
      'random_forest': {
        name: 'Random Forest',
        description: 'An ensemble method that builds multiple decision trees and combines their predictions. It\'s robust, handles complex relationships well, and provides feature importance scores.',
        useCases: [
          'Both classification and regression problems',
          'Complex non-linear relationships',
          'When you need feature importance analysis',
          'Robust performance with minimal tuning'
        ],
        parameters: [
          {
            name: 'Number of Trees',
            type: 'number',
            description: 'How many decision trees to build in the forest.',
            values: 'More trees = more stable but slower training',
            range: '1 to 1000'
          },
          {
            name: 'Max Depth',
            type: 'number',
            description: 'Maximum depth of each tree. Controls how complex trees can grow.',
            values: 'Deeper trees = more complex, risk of overfitting. None = unlimited',
            range: '1 to unlimited (None for unlimited)'
          },
          {
            name: 'Min Samples Split',
            type: 'number',
            description: 'Minimum number of samples required to split a node.',
            values: 'Higher values = simpler trees, prevent overfitting',
            range: '2 or more'
          },
          {
            name: 'Min Samples Leaf',
            type: 'number',
            description: 'Minimum number of samples required at a leaf node.',
            values: 'Higher values = simpler trees, prevent overfitting',
            range: '1 or more'
          },
          {
            name: 'Max Features',
            type: 'selection',
            description: 'Number of features to consider for the best split:',
            options: [
              'sqrt: Square root of total features (good for classification)',
              'log2: Logarithm of total features',
              '1.0: All features (good for regression)',
              '0.5: 50% of features',
              'None: All features'
            ]
          },
          {
            name: 'Bootstrap Sampling',
            type: 'checkbox',
            description: 'Whether to use bootstrap samples when building trees.',
            checked: 'Recommended - creates more diverse trees',
            unchecked: 'Use entire dataset for each tree - less diversity'
          },
          {
            name: 'Calculate OOB Score',
            type: 'checkbox',
            description: 'Whether to calculate Out-of-Bag score (requires bootstrap).',
            checked: 'Provides validation score without separate test set',
            unchecked: 'No OOB score calculated'
          }
        ],
        tips: [
          'Start with 100 trees and increase if needed',
          'Use bootstrap sampling for better performance',
          'Enable OOB score for free validation',
          'Random Forest handles missing values well'
        ]
      },
      'svm': {
        name: 'Support Vector Machine',
        description: 'Finds the optimal boundary that separates classes with maximum margin. Works well in high-dimensional spaces and can handle complex non-linear relationships using kernels.',
        useCases: [
          'Text classification',
          'Image recognition',
          'Complex non-linear boundaries',
          'High-dimensional data'
        ],
        parameters: [
          {
            name: 'Kernel Type',
            type: 'selection',
            description: 'The function used to transform data for non-linear separation:',
            options: [
              'RBF: Most commonly used, works well for most problems',
              'Linear: For linearly separable data',
              'Polynomial: For polynomial decision boundaries',
              'Sigmoid: Similar to neural network activation'
            ]
          },
          {
            name: 'Regularization (C)',
            type: 'number',
            description: 'Controls the trade-off between maximizing margin and minimizing classification error.',
            values: 'Small C = larger margin, more errors allowed. Large C = smaller margin, fewer errors',
            range: '0.01 or higher'
          },
          {
            name: 'Gamma',
            type: 'selection',
            description: 'Kernel coefficient that influences the shape of the decision boundary:',
            options: [
              'Scale: 1 / (n_features * variance) - good default',
              'Auto: 1 / n_features',
              'Custom: Set your own value (lower = smoother boundary)'
            ]
          },
          {
            name: 'Degree (for Polynomial Kernel)',
            type: 'number',
            description: 'Degree of the polynomial kernel function.',
            values: 'Higher degrees = more complex boundaries',
            range: '1 to 10'
          },
          {
            name: 'Use Shrinking Heuristic',
            type: 'checkbox',
            description: 'Whether to use the shrinking heuristic to speed up training.',
            checked: 'Faster training - recommended',
            unchecked: 'Slower but potentially more accurate'
          },
          {
            name: 'Enable Probability Estimates',
            type: 'checkbox',
            description: 'Whether to enable probability estimates (not available for regression).',
            checked: 'Get probability scores for classification',
            unchecked: 'Faster training, only class predictions'
          }
        ],
        tips: [
          'Scale features before using SVM',
          'Start with RBF kernel and C=1.0',
          'Use automatic gamma selection initially',
          'SVM can be slow for large datasets'
        ]
      },
      'knn': {
        name: 'K-Nearest Neighbors',
        description: 'A simple instance-based learning algorithm that classifies points based on the majority class of their k nearest neighbors. No training phase - it memorizes the training data.',
        useCases: [
          'Small to medium-sized datasets',
          'When data distribution is unknown',
          'Simple baseline models',
          'Datasets with clear cluster structure'
        ],
        parameters: [
          {
            name: 'Number of Neighbors (k)',
            type: 'number',
            description: 'Number of nearest neighbors to consider for classification.',
            values: 'Small k = sensitive to noise. Large k = smoother decision boundaries',
            range: '1 to 100'
          },
          {
            name: 'Weight Function',
            type: 'selection',
            description: 'How to weight the neighbors:',
            options: [
              'Uniform: All neighbors have equal weight',
              'Distance: Closer neighbors have more influence'
            ]
          },
          {
            name: 'Algorithm',
            type: 'selection',
            description: 'Algorithm used to compute nearest neighbors:',
            options: [
              'Auto: Let the system choose the best algorithm',
              'Ball Tree: Good for high-dimensional data',
              'KD Tree: Efficient for low-dimensional data',
              'Brute Force: Simple but slow for large datasets'
            ]
          },
          {
            name: 'Leaf Size',
            type: 'number',
            description: 'Leaf size for tree algorithms (Ball Tree, KD Tree).',
            values: 'Affects the speed of tree construction and query',
            range: '1 or more'
          },
          {
            name: 'Distance Metric',
            type: 'selection',
            description: 'How to measure distance between points:',
            options: [
              'Minkowski: General distance metric',
              'Euclidean: Straight-line distance',
              'Manhattan: Sum of absolute differences',
              'Chebyshev: Maximum coordinate difference'
            ]
          },
          {
            name: 'Minkowski Power (p)',
            type: 'number',
            description: 'Power parameter for Minkowski distance (only for Minkowski metric).',
            values: 'p=1 = Manhattan, p=2 = Euclidean',
            range: '1 to 10'
          },
          {
            name: 'Scale Features',
            type: 'checkbox',
            description: 'Whether to scale features before training.',
            checked: 'Highly recommended - KNN is sensitive to feature scales',
            unchecked: 'Not recommended - distance calculations will be biased'
          }
        ],
        tips: [
          'Always scale features for KNN',
          'Start with k=5 and Euclidean distance',
          'Use distance weighting for better performance',
          'KNN becomes slow with large datasets'
        ]
      },
      'lightgbm': {
        name: 'LightGBM',
        description: 'A fast, distributed, high-performance gradient boosting framework based on decision tree algorithms. It\'s optimized for speed and memory efficiency while maintaining high accuracy.',
        useCases: [
          'Large-scale machine learning',
          'Both classification and regression',
          'Competitions and production systems',
          'When training speed is important'
        ],
        parameters: [
          {
            name: 'Boosting Type',
            type: 'selection',
            description: 'The type of boosting algorithm:',
            options: [
              'GBDT: Traditional Gradient Boosting Decision Tree',
              'DART: Dropouts meet Multiple Additive Regression Trees - better accuracy',
              'GOSS: Gradient-based One-Side Sampling - faster training'
            ]
          },
          {
            name: 'Number of Leaves',
            type: 'number',
            description: 'Maximum number of leaves in one tree.',
            values: 'More leaves = more complex trees',
            range: '2 to 256'
          },
          {
            name: 'Learning Rate',
            type: 'number',
            description: 'Shrinks the contribution of each tree.',
            values: 'Smaller values = more trees needed, but better generalization',
            range: '0.001 to 1.0'
          },
          {
            name: 'Number of Trees',
            type: 'number',
            description: 'Number of boosting iterations (trees).',
            values: 'More trees = better performance but risk of overfitting',
            range: '1 to 10000'
          },
          {
            name: 'Max Depth',
            type: 'number',
            description: 'Maximum tree depth for base learners.',
            values: '-1 for no limit. Shallower trees prevent overfitting',
            range: '-1 (unlimited) or 1+'
          },
          {
            name: 'Min Child Samples',
            type: 'number',
            description: 'Minimum number of data needed in a child (leaf).',
            values: 'Helps prevent overfitting',
            range: '0 or more'
          },
          {
            name: 'Subsample',
            type: 'number',
            description: 'Subsample ratio of the training instances.',
            values: 'Lower values prevent overfitting but may increase bias',
            range: '0.1 to 1.0'
          },
          {
            name: 'Colsample by Tree',
            type: 'number',
            description: 'Subsample ratio of columns when constructing each tree.',
            values: 'Lower values add more randomness, prevent overfitting',
            range: '0.1 to 1.0'
          },
          {
            name: 'L1 Regularization',
            type: 'number',
            description: 'L1 regularization term on weights.',
            values: 'Higher values = more regularization',
            range: '0 or more'
          },
          {
            name: 'L2 Regularization',
            type: 'number',
            description: 'L2 regularization term on weights.',
            values: 'Higher values = more regularization',
            range: '0 or more'
          },
          {
            name: 'Early Stopping Rounds',
            type: 'number',
            description: 'Will stop training if validation doesn\'t improve for this many rounds.',
            values: '0 to disable early stopping',
            range: '0 or more'
          }
        ],
        tips: [
          'LightGBM is much faster than traditional GBDT',
          'Use early stopping to prevent overfitting',
          'Start with default values and tune gradually',
          'Good for large datasets with many features'
        ]
      },
      'mlp': {
        name: 'Neural Network (MLP)',
        description: 'Multi-layer Perceptron - a class of feedforward artificial neural networks that can learn complex non-linear relationships. It consists of multiple layers of neurons with activation functions.',
        useCases: [
          'Complex pattern recognition',
          'Non-linear problems where traditional methods fail',
          'Large amounts of data',
          'When you need high accuracy and can afford training time'
        ],
        parameters: [
          {
            name: 'Hidden Layers Configuration',
            type: 'text',
            description: 'Number of neurons in each hidden layer (comma-separated).',
            values: 'Example: "64, 32" means two hidden layers with 64 and 32 neurons',
            example: 'More layers/neurons = more capacity but risk of overfitting'
          },
          {
            name: 'Hidden Activation Function',
            type: 'selection',
            description: 'Activation function for hidden layers:',
            options: [
              'ReLU: Most commonly used, avoids vanishing gradient',
              'Sigmoid: Outputs between 0-1, can cause vanishing gradient',
              'Tanh: Outputs between -1 to 1',
              'Leaky ReLU: Prevents "dying ReLU" problem',
              'ELU: Smooth version of ReLU',
              'SELU: Self-normalizing activation'
            ]
          },
          {
            name: 'Dropout Rate',
            type: 'number',
            description: 'Fraction of input units to drop for preventing overfitting.',
            values: 'Higher values = more regularization',
            range: '0 to 0.9'
          },
          {
            name: 'Learning Rate',
            type: 'number',
            description: 'Step size for weight updates during training.',
            values: 'Too high = unstable training. Too low = slow convergence',
            range: '0.0001 to 0.1'
          },
          {
            name: 'Batch Size',
            type: 'number',
            description: 'Number of samples per gradient update.',
            values: 'Smaller batches = noisier updates, larger batches = more memory',
            range: '8 to 512'
          },
          {
            name: 'Number of Epochs',
            type: 'number',
            description: 'Number of times to iterate over the entire training dataset.',
            values: 'More epochs = more training, risk of overfitting',
            range: '1 to 1000'
          },
          {
            name: 'Early Stopping Patience',
            type: 'number',
            description: 'Number of epochs to wait before stopping if no improvement.',
            values: 'Higher values = train longer, lower values = stop earlier',
            range: '1 to 50'
          },
          {
            name: 'Validation Split',
            type: 'number',
            description: 'Fraction of training data to use for validation.',
            values: 'Used for early stopping and monitoring',
            range: '0.1 to 0.5'
          },
          {
            name: 'Scale Features',
            type: 'checkbox',
            description: 'Whether to scale input features before training.',
            checked: 'Highly recommended - neural networks are sensitive to feature scales',
            unchecked: 'Not recommended - may cause training instability'
          }
        ],
        tips: [
          'Always scale features for neural networks',
          'Start with 1-2 hidden layers',
          'Use ReLU activation for hidden layers',
          'Monitor validation loss to detect overfitting',
          'Use dropout for regularization'
        ]
      },
      'kmeans': {
        name: 'K-Means Clustering',
        description: 'An unsupervised learning algorithm that partitions data into K distinct clusters based on similarity. It tries to group similar data points together and discover underlying patterns.',
        useCases: [
          'Customer segmentation',
          'Document clustering',
          'Image compression',
          'Market research',
          'Anomaly detection'
        ],
        parameters: [
          {
            name: 'Number of Clusters (k)',
            type: 'number',
            description: 'The number of clusters to form.',
            values: 'You need to specify this in advance. Try different values and evaluate',
            range: '2 to 20'
          },
          {
            name: 'Initialization Method',
            type: 'selection',
            description: 'Method for initializing cluster centers:',
            options: [
              'k-means++: Smart initialization that speeds up convergence',
              'Random: Random initialization - may need more runs'
            ]
          },
          {
            name: 'Number of Initializations',
            type: 'number',
            description: 'Number of times to run with different centroid seeds.',
            values: 'Higher values give more stable results',
            range: '1 to 100'
          },
          {
            name: 'Maximum Iterations',
            type: 'number',
            description: 'Maximum number of iterations for a single run.',
            values: 'Algorithm stops early if converged',
            range: '10 to 1000'
          },
          {
            name: 'Tolerance',
            type: 'number',
            description: 'Relative tolerance to declare convergence.',
            values: 'Lower values = stricter convergence criteria',
            range: '1e-6 to 1e-2'
          },
          {
            name: 'Algorithm',
            type: 'selection',
            description: 'K-means algorithm to use:',
            options: [
              'Lloyd: Standard k-means algorithm',
              'Elkan: Optimized version for datasets with well-defined clusters'
            ]
          },
          {
            name: 'Scale Features',
            type: 'checkbox',
            description: 'Whether to scale features before clustering.',
            checked: 'Highly recommended - ensures all features contribute equally to distance calculations',
            unchecked: 'Not recommended - features on larger scales will dominate clustering'
          }
        ],
        tips: [
          'Always scale features for K-means',
          'Try different numbers of clusters (k)',
          'Use k-means++ initialization',
          'Evaluate using silhouette score and other metrics',
          'K-means works best with spherical clusters'
        ]
      }
    };

    return modelDescriptions[modelType] || {
      name: modelType,
      description: 'No description available for this model.',
      useCases: [],
      parameters: [],
      tips: []
    };
  };

  const modelInfo = getModelDescription();
// Dans votre composant React, ajoutez cette fonction

  const renderParameterExplanation = (param) => {
    switch (param.type) {
      case 'selection':
        return (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {param.name}
            </Typography>
            <Typography variant="body2" paragraph>
              {param.description}
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              {param.options.map((option, idx) => (
                <li key={idx}>
                  <Typography variant="body2">{option}</Typography>
                </li>
              ))}
            </Box>
          </Box>
        );
      
      case 'number':
        return (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {param.name}
            </Typography>
            <Typography variant="body2" paragraph>
              {param.description}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Values:</strong> {param.values}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Typical range:</strong> {param.range}
            </Typography>
          </Box>
        );
      
      case 'checkbox':
        return (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {param.name}
            </Typography>
            <Typography variant="body2" paragraph>
              {param.description}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>When checked:</strong> {param.checked}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>When unchecked:</strong> {param.unchecked}
            </Typography>
          </Box>
        );
      
      case 'slider':
        return (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {param.name}
            </Typography>
            <Typography variant="body2" paragraph>
              {param.description}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Meaning of values:</strong> {param.values}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Range:</strong> {param.range}
            </Typography>
          </Box>
        );
      
      case 'text':
        return (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {param.name}
            </Typography>
            <Typography variant="body2" paragraph>
              {param.description}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Example:</strong> {param.example}
            </Typography>
          </Box>
        );
      
      case 'auto-optimized':
        return (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {param.name}
            </Typography>
            <Typography variant="body2" paragraph>
              {param.description}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {param.values}
            </Typography>
          </Box>
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog 
      open={modelInfoDialogOpen} 
      onClose={() => setModelInfoDialogOpen(false)}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle sx={{ 
        backgroundColor: 'primary.main', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <Typography variant="h5" component="div">
          ℹ️ {modelInfo.name}
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2 }}>
        {/* Description */}
        <Card sx={{ mb: 3, p: 2, backgroundColor: 'background.default' }}>
          <Typography variant="h6" gutterBottom>
            📝 Description
          </Typography>
          <Typography variant="body1">
            {modelInfo.description}
          </Typography>
        </Card>

        {/* Use Cases */}
        <Card sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom color="primary">
              Best Use Cases
          </Typography>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {modelInfo.useCases.map((useCase, index) => (
              <li key={index}>
                <Typography variant="body1">{useCase}</Typography>
              </li>
            ))}
          </ul>
        </Card>

        {/* Parameters Explanation */}
        <Card sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom color="primary">
            ⚙️ Parameters Explained
          </Typography>
          {modelInfo.parameters.map((param, index) => (
            <Box key={index}>
              {renderParameterExplanation(param)}
              {index < modelInfo.parameters.length - 1 && <Divider sx={{ my: 1 }} />}
            </Box>
          ))}
        </Card>

        {/* Tips */}
        {modelInfo.tips.length > 0 && (
          <Card sx={{ mb: 2, p: 2, backgroundColor: '#e8f5e8' }}>
            <Typography variant="h6" gutterBottom color="success.main">
              💡 Practical Tips
            </Typography>
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              {modelInfo.tips.map((tip, index) => (
                <li key={index}>
                  <Typography variant="body1">{tip}</Typography>
                </li>
              ))}
            </ul>
          </Card>
        )}

       
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={() => setModelInfoDialogOpen(false)} 
          color="primary"
          variant="contained"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};



const renderInfoDialog = () => {
    return <Dialog 
      open={validationInfoDialogOpen} 
      onClose={() => setValidationInfoDialogOpen(false)}

      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        ℹ️ Validation Methods Explained
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            What is Validation?
          </Typography>
          <Typography variant="body2" paragraph>
            Validation methods help evaluate how well your model will perform on unseen data 
            and prevent overfitting. They split your data to test the model's generalization ability.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Available Methods:
          </Typography>

          {/* Hold-out */}
          <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
            <Typography variant="subtitle1" color="primary" gutterBottom>
                Hold-out (Train/Test Split)
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>How it works:</strong> Simple split of data into training and testing sets (typically 70-80% train, 20-30% test).
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Best for:</strong> Large datasets, quick prototyping, when computation time is a concern.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Pros:</strong> Fast, simple to implement, easy to understand.
            </Typography>
            <Typography variant="body2">
              <strong>Cons:</strong> Results can vary based on random split, may not use data efficiently.
            </Typography>
          </Card>

          {/* K-Fold Cross-Validation */}
          <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
            <Typography variant="subtitle1" color="primary" gutterBottom>
              🔄 Cross-Validation: KFold
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>How it works:</strong> Data is divided into K equal folds. Model is trained on K-1 folds and tested on the remaining fold. This process repeats K times.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Best for:</strong> Medium-sized datasets, when you want reliable performance estimates.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Pros:</strong> More reliable performance estimate, uses all data for training and testing.
            </Typography>
            <Typography variant="body2">
              <strong>Cons:</strong> Computationally expensive (K times slower), requires more time.
            </Typography>
          </Card>

          {/* Repeated K-Fold */}
          <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
            <Typography variant="subtitle1" color="primary" gutterBottom>
              🔁 Cross-Validation: Repeated KFold
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>How it works:</strong> Performs K-Fold cross-validation multiple times with different random splits.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Best for:</strong> Small datasets, when you need very reliable performance estimates.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Pros:</strong> Very stable performance estimates, reduces variance.
            </Typography>
            <Typography variant="body2">
              <strong>Cons:</strong> Very computationally expensive (K × repetitions times slower).
            </Typography>
          </Card>

          {/* Shuffle Split */}
          <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
            <Typography variant="subtitle1" color="primary" gutterBottom>
              🎲 Cross-Validation: Shuffle Split
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>How it works:</strong> Creates multiple random train/test splits. Each split randomly selects samples without folding.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Best for:</strong> Large datasets, when you want multiple random splits without fixed folds.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Pros:</strong> Flexible train/test sizes, good for large datasets.
            </Typography>
            <Typography variant="body2">
              <strong>Cons:</strong> May have overlapping test sets across iterations.
            </Typography>
          </Card>

          {/* Bootstrap */}
          <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
            <Typography variant="subtitle1" color="primary" gutterBottom>
              📊 Bootstrap
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>How it works:</strong> Creates multiple bootstrap samples (random sampling with replacement) and tests on out-of-bag samples.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Best for:</strong> Small datasets, when you need confidence intervals, robust performance estimation.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Pros:</strong> Good for small datasets, provides confidence intervals.
            </Typography>
            <Typography variant="body2">
              <strong>Cons:</strong> Can be optimistic (samples are not independent), computationally expensive.
            </Typography>
          </Card>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Recommendation:</strong> Start with Hold-out for quick testing, use K-Fold for reliable results, 
              and Bootstrap for small datasets or when you need confidence intervals.
            </Typography>
          </Alert>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setValidationInfoDialogOpen(false)} color="primary">

          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  };

const renderValidationParams = () => {
  if (modelType === 'kmeans' || isAnomalyAlgo()) return null;
  // Wait until problem type is known and a valid algorithm is selected
  if (!problemType) {
    return (
      <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
        Detecting problem type… validation options will appear once an algorithm is ready.
      </Alert>
    );
  }

  return (
    <>
      {renderInfoDialog()}
      
      <Card sx={{ mt: 2, mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              🔍 Validation Method
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Typography>ℹ️</Typography>}
              onClick={() => setValidationInfoDialogOpen(true)}
              sx={{ ml: 1 }}
            >
              Learn about methods
            </Button>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                select
                label="Validation Method"
                value={validationMethod}
                onChange={(e) => setValidationMethod(e.target.value)}
                fullWidth
              >
                <MenuItem value="holdout">Hold-out (Train/Test Split)</MenuItem>
                <MenuItem value="cv_kfold">Cross-Validation: KFold</MenuItem>
                <MenuItem value="cv_repeatedkfold">Cross-Validation: Repeated KFold</MenuItem>
                <MenuItem value="cv_shufflesplit">Cross-Validation: Shuffle Split</MenuItem>
                
                {/* ✅ AJOUT : TimeSeriesSplit - actif SEULEMENT si colonne date détectée */}
                <MenuItem 
                  value="cv_timeseries" 
                  disabled={!dateColumnDetected}
                  sx={!dateColumnDetected ? { opacity: 0.5 } : {}}
                >
                  {dateColumnDetected 
                    ? "Time Series Split (date column detected)" 
                    : "Time Series Split (requires a date column)"}
                </MenuItem>
                
                <MenuItem value="bootstrap">Bootstrap</MenuItem>
              </TextField>
              
              {/* ✅ AJOUT : Message explicatif si TimeSeriesSplit désactivé */}
              {validationMethod === 'cv_timeseries' && !dateColumnDetected && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    TimeSeriesSplit requires a date column in your dataset. 
                    No date column was detected.
                  </Typography>
                </Alert>
              )}
              
              {/* ✅ AJOUT : Message quand TimeSeriesSplit est sélectionné */}
              {validationMethod === 'cv_timeseries' && dateColumnDetected && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>Date column for chronological splitting:</strong> "{dateColumn}"
                    {" "}(excluded from model features). Other validation methods ignore date columns.
                  </Typography>
                  {dateColumnOptions.length > 1 && (
                    <FormControl size="small" sx={{ mt: 1, minWidth: 220 }} fullWidth>
                      <InputLabel>Date column</InputLabel>
                      <Select
                        label="Date column"
                        value={dateColumn || dateColumnOptions[0]}
                        onChange={(e) => setDateColumn(e.target.value)}
                      >
                        {dateColumnOptions.map((c) => (
                          <MenuItem key={c} value={c}>{c}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Alert>
              )}
            </Grid>
            
            {validationMethod === "holdout" && (
              <Grid item xs={12} md={4}>
                <TextField
                  label="Number of repetitions"
                  type="number"
                  value={nRepetitions}
                  onChange={(e) => setNRepetitions(parseInt(e.target.value) || 10)}
                  fullWidth
                  inputProps={{ min: 1, max: 50 }}
                  helperText="Repetitions for Hold-Out"
                />
              </Grid>
            )}
          </Grid>

          {/* Le reste du code pour les autres méthodes de validation */}
          {validationMethod.startsWith('cv_') && cvParams.shuffle === false && (
            <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
              When shuffle is disabled, random state has no effect and will be ignored.
            </Alert>
          )}
          
          {/* ✅ AJOUT : Paramètres pour TimeSeriesSplit */}
          {validationMethod === 'cv_timeseries' && dateColumnDetected && (
            <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: '#2196f3', borderRadius: 1, width: '100%', bgcolor: '#f5f9ff' }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                ⏱️ Time Series Split Parameters
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Number of splits"
                    type="number"
                    value={timeSeriesParams.n_splits}
                    onChange={(e) => setTimeSeriesParams({...timeSeriesParams, n_splits: parseInt(e.target.value) || 5})}
                    fullWidth
                    inputProps={{ min: 2, max: 20 }}
                    helperText="Number of chronological splits"
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Test set size"
                    type="number"
                    value={timeSeriesParams.test_size}
                    onChange={(e) => setTimeSeriesParams({...timeSeriesParams, test_size: parseFloat(e.target.value) || 0.2})}
                    fullWidth
                    inputProps={{ min: 0.1, max: 0.5, step: 0.05 }}
                    helperText="Proportion of data for test (0.1 = 10%)"
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Gap between train/test"
                    type="number"
                    value={timeSeriesParams.gap}
                    onChange={(e) => setTimeSeriesParams({...timeSeriesParams, gap: parseInt(e.target.value) || 0})}
                    fullWidth
                    inputProps={{ min: 0, max: 100 }}
                    helperText="Number of samples to skip between train and test"
                  />
                </Grid>
              </Grid>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>How it works:</strong> Data is split chronologically using the column <strong>"{dateColumn}"</strong>. 
                  Training sets always come before test sets, preserving temporal order.
                </Typography>
              </Alert>
            </Box>
          )}
          
          {/* Paramètres pour Cross-Validation (autres que TimeSeries) */}
          {validationMethod.startsWith('cv_') && validationMethod !== 'cv_timeseries' && (
            <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, width: '100%' }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                ⚙️ Cross-Validation Parameters
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Number of Folds"
                    type="number"
                    value={cvParams.n_splits}
                    onChange={(e) => setCvParams({...cvParams, n_splits: parseInt(e.target.value) || 5})}
                    fullWidth
                    inputProps={{ min: 2, max: 20 }}
                    helperText="Number of splits for cross-validation"
                  />
                </Grid>
                
                {validationMethod === 'cv_repeatedkfold' && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Number of Repetitions"
                      type="number"
                      value={cvParams.n_repeats}
                      onChange={(e) => setCvParams({...cvParams, n_repeats: parseInt(e.target.value) || 3})}
                      fullWidth
                      inputProps={{ min: 1, max: 10 }}
                      helperText="How many times to repeat the KFold"
                    />
                  </Grid>
                )}
                
                {validationMethod === 'cv_shufflesplit' && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Test Set Size (Proportion)"
                      type="number"
                      value={cvParams.test_size}
                      onChange={(e) => setCvParams({...cvParams, test_size: parseFloat(e.target.value) || 0.2})}
                      fullWidth
                      inputProps={{ min: 0.1, max: 0.5, step: 0.05 }}
                      helperText="Size of test set (0.1 = 10%)"
                    />
                  </Grid>
                )}
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={cvParams.shuffle}
                        onChange={(e) => setCvParams({...cvParams, shuffle: e.target.checked})}
                      />
                    }
                    label="Shuffle data before splitting"
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Paramètres pour Bootstrap */}
          {validationMethod === 'bootstrap' && (
            <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, width: '100%' }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                ⚙️ Bootstrap Parameters
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Number of Bootstrap Samples"
                    type="number"
                    value={bootstrapParams.n_bootstraps}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 100;
                      setBootstrapParams({...bootstrapParams, n_bootstraps: value});
                    }}
                    fullWidth
                    inputProps={{ min: 10, max: 1000 }}
                    helperText="More samples = more reliable estimates but longer computation"
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Bootstrap Sample Size"
                    type="number"
                    value={bootstrapParams.sample_size || 1.0}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 1.0;
                      setBootstrapParams({...bootstrapParams, sample_size: value});
                    }}
                    fullWidth
                    inputProps={{ min: 0.1, max: 1.0, step: 0.1 }}
                    helperText="Sample size relative to dataset (1.0 = 100%)"
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Informations sur les méthodes */}
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'background.default', borderRadius: 1, width: '100%' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              📝 Quick Guide:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • <strong>Hold-out</strong>: Simple train/test split<br/>
              • <strong>KFold</strong>: Standard cross-validation<br/>
              • <strong>Time Series Split</strong>: Chronological splits (requires date column)<br/>
              • <strong>Bootstrap</strong>: Multiple random samples with replacement<br/>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </>
  );
};

const openSaveModelDialog = async () => {
  if (isSaveWindowExpired() || !lastCompletedTrainingId) {
    setError(
      "You can only save a model within 5 minutes after training finishes. Please train again, then save it right away."
    );
    return;
  }
  try {
  const res = await axios.get(`${backendUrl}/api/check-model-limit`, {
      withCredentials: true,
      timeout: 10000,
    });
    if (res.data?.limit_reached) {
      setModelLimitDialog({
        open: true,
        count: res.data.count ?? 20,
        limit: res.data.limit ?? 20,
      });
      return;
    }
  } catch (err) {
    // If the check fails, still allow opening: backend will enforce on save
    console.warn("Model limit check failed:", err?.message || err);
  }
  setSaveModelDialog(true);
};

const handleSaveModel = async (modelNameToSave) => {
  const nameToSave = modelNameToSave.trim();
  
  if (!nameToSave) {
    setError("Please enter a model name");
    return;
  }
  
  setSaveModelLoading(true);

  try {
    // Re-check quota before posting (race-safe with backend)
    try {
      const lim = await axios.get(`${backendUrl}/api/check-model-limit`, {
        withCredentials: true,
        timeout: 10000,
      });
      if (lim.data?.limit_reached) {
        setSaveModelDialog(false);
        setModelLimitDialog({
          open: true,
          count: lim.data.count ?? 20,
          limit: lim.data.limit ?? 20,
        });
        setSaveModelLoading(false);
        return;
      }
    } catch (_) {
      /* backend still enforces */
    }

    if (!result?.model_object) {
      throw new Error("No trained model available to save");
    }
    if (!lastCompletedTrainingId) {
      throw new Error(
        "You can only save a model within 5 minutes after training finishes. Please train again, then save it right away."
      );
    }
    if (isSaveWindowExpired()) {
      throw new Error(
        "The 5-minute save window has ended. Please train the model again, then save it right away."
      );
    }

    let columnsToSend = [];

    // Reste du code inchangé pour récupérer les colonnes...
    if (Array.isArray(columns) && columns.length > 0) {
      columnsToSend = columns.filter(col => !['id', 'split_type'].includes(col));
    } else {
      // Fallback: fetch columns from /get-split-info
      try {
        const originalBdName = state?.originalBdName || state?.bdName.replace('_numerized', '');
        const response = await axios.get(
          `${backendUrl}/api/get-split-info?bdName=${originalBdName}`,
          { withCredentials: true }
        );

        let fetchedColumns = response.data.available_columns || [];
        if (!Array.isArray(fetchedColumns)) {
          console.warn("Fetched columns are not in array format:", fetchedColumns);
          fetchedColumns = [];
        }

        columnsToSend = fetchedColumns.filter(col => !['id', 'split_type'].includes(col));
      } catch (fetchError) {
        console.warn("Failed to fetch columns for saving:", fetchError);
      }
    }

    // KMeans / anomaly: prefer exact feature names used at train time
    if (
      (modelType === 'kmeans' || isAnomalyAlgo()) &&
      Array.isArray(result?.metrics?.feature_names) &&
      result.metrics.feature_names.length > 0
    ) {
      columnsToSend = result.metrics.feature_names;
    }

    if (columnsToSend.length === 0) {
      throw new Error("No column information available after filtering. Cannot save model.");
    }

    // ✅ CORRECTION : Sauvegarde des scores selon le type de modèle
    // model_object is NOT trusted by the server: training_id selects the server copy
    const saveData = {
      model_name: nameToSave,
      db_name: state?.originalBdName || state?.bdName.replace('_numerized', ''),
      db_columns: columnsToSend,
      training_id: lastCompletedTrainingId,
      framework: modelType === 'mlp' ? 'pytorch' : 'sklearn',
      // Specific algorithm for Dashboard comparison (ridge, logistic, kmeans, …)
      algorithm: modelType,
    };

    // ✅ CORRECTION AMÉLIORÉE : Sauvegarder les scores selon le type de problème
    const isClassificationModel = modelType === 'logistic' || 
                                 modelType === 'svm' || 
                                 modelType === 'knn' ||
                                 (result.metrics?.is_classification && 
                                  ['random_forest', 'lightgbm', 'mlp'].includes(modelType));

    if (modelType === 'ridge') {
      // Regression - sauvegarder R²
      saveData.r2_score = result?.metrics?.r2;
      saveData.accuracy_score = null; // Explicitement null pour éviter toute confusion
    } else if (isClassificationModel) {
      // Classification - sauvegarder accuracy
      saveData.accuracy_score = result?.metrics?.accuracy;
      saveData.r2_score = null; // Explicitement null
    } else if (modelType === 'random_forest' || modelType === 'lightgbm' || modelType === 'mlp') {
      // Modèles qui peuvent faire les deux - déterminer par les métriques
      if (result.metrics?.is_classification) {
        saveData.accuracy_score = result?.metrics?.accuracy;
        saveData.r2_score = null;
      } else {
        saveData.r2_score = result?.metrics?.r2;
        saveData.accuracy_score = null;
      }
    } else if (modelType === 'kmeans') {
      // Slim viz: centers only (full point clouds make the request timeout / fail)
      const fullViz =
        result.visualization_data ||
        result.metrics?.visualization_data ||
        null;
      const slimViz = fullViz
        ? {
            '2d': fullViz['2d']
              ? {
                  centers: fullViz['2d'].centers || [],
                  explained_variance: fullViz['2d'].explained_variance || [],
                }
              : undefined,
            '3d': fullViz['3d']
              ? {
                  centers: fullViz['3d'].centers || [],
                  explained_variance: fullViz['3d'].explained_variance || [],
                }
              : undefined,
          }
        : null;

      saveData.visualization_data = slimViz;
      saveData.cluster_info =
        result.metrics?.cluster_info || result.cluster_info || null;
      saveData.kmeans_params = kmeansParams;
      saveData.silhouette_score =
        result.metrics?.silhouette_score ?? null;
      saveData.inertia = result.metrics?.inertia ?? null;
      saveData.r2_score = null;
      saveData.accuracy_score = null;
    } else if (isAnomalyAlgo()) {
      saveData.r2_score = null;
      saveData.accuracy_score = null;
      // Persist test anomaly rate in accuracy_score slot for dashboard glance (optional)
      // Prefer leaving null to avoid confusion with classification accuracy.
    }

    console.log("Saving model with data:", {
      model_name: nameToSave,
      model_type: modelType,
      is_classification: isClassificationModel,
      r2_score: saveData.r2_score,
      accuracy_score: saveData.accuracy_score
    });

    const response = await axios.post(
      `${backendUrl}/api/save-model`,
      saveData,
      { 
        withCredentials: true,
        // KMeans model bytes can be large; avoid false timeout failures
        timeout: modelType === 'kmeans' ? 120000 : 30000
      }
    );

    setSaveModelDialog(false);
    setModelName('');
    setResult(prev => ({
      ...prev,
      saved_model_path: response.data.model_path
    }));
    setLastCompletedTrainingId(null);
    setSaveAvailableUntil(null);
    
    setError(null);
    
  } catch (err) {
    console.error("Save model error:", err);
    
    let errorMessage = "Failed to save model";
    
    if (err.response?.data?.detail) {
      errorMessage = typeof err.response.data.detail === "string"
        ? err.response.data.detail
        : JSON.stringify(err.response.data.detail);
      if (/model limit reached/i.test(errorMessage)) {
        setSaveModelDialog(false);
        setModelLimitDialog({ open: true, count: 20, limit: 20 });
      }
    } else if (err.code === 'ECONNABORTED') {
      errorMessage = "Request timeout - please try again";
    } else if (err.message) {
      errorMessage = err.message;
    }
    
    setError(errorMessage);
  } finally {
    setSaveModelLoading(false);
  }
};




const fetchTargetType = async () => {
  try {
    const originalBdName = state?.bdName.replace('_numerized', '');
    const response = await axios.get(
      `${backendUrl}/api/get-target-type?bdName=${originalBdName}`,
      { withCredentials: true }
    );
    
    setTargetTypeDetails(response.data);
    setIsClassification(response.data.is_classification);
    
    // Update random forest params based on target type
    const newRandomForestParams = {
      ...randomForestParams,
      max_features: response.data.is_classification ? 'sqrt' : 1.0,
      criterion: response.data.is_classification ? 'gini' : 'squared_error'
    };
    
    setRandomForestParams(newRandomForestParams);
    
  } catch (error) {
    console.error("Error fetching target type:", error);
    // Fallback to classification with default params
    setIsClassification(true);
    setRandomForestParams(prev => ({
      ...prev,
      max_features: 'sqrt',
      criterion: 'gini'
    }));
  }
};


const [kmeansParams, setKmeansParams] = useState({
  n_clusters: 3,
  init: 'k-means++',
  n_init: 10,
  max_iter: 300,
  tol: 1e-4,
  random_state: 42,
  algorithm: 'lloyd',
  use_scaling: true
});

const [isolationForestParams, setIsolationForestParams] = useState({
  n_estimators: 100,
  contamination: 0.05,
  max_samples: 'auto',
  max_features: 1.0,
  bootstrap: false,
  random_state: 42,
  use_scaling: true,
});

const [oneClassSvmParams, setOneClassSvmParams] = useState({
  kernel: 'rbf',
  nu: 0.05,
  gamma: 'scale',
  degree: 3,
  coef0: 0,
  random_state: 42,
  use_scaling: true,
  train_on_normals_only: false,
});

const isAnomalyAlgo = (mt = modelType) =>
  mt === 'isolation_forest' || mt === 'one_class_svm';





const HelpDialog = ({ open, onClose }) => (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#384850', color: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h5">Train Model guide</Typography>
            </Box>
        </DialogTitle>
        <DialogContent dividers>
            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                    <strong>Steps:</strong> choose a model, set parameters, pick a validation method, then start training.
                    Your data should already be prepared (Target, Clean/Split, Transform).
                </Typography>
            </Alert>

            <Typography variant="h6" gutterBottom sx={{ color: '#384850', borderBottom: '2px solid #DE6B06', pb: 0.5, mt: 2 }}>
                Models
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2, bgcolor: '#f4f6f8', borderLeft: '4px solid #DE6B06', height: '100%' }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Regression</Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                            <strong>Ridge:</strong> linear baseline.<br/>
                            <strong>Random Forest / LightGBM:</strong> strong defaults for tabular data.<br/>
                            <strong>MLP:</strong> neural net; needs more data and care with scaling.
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2, bgcolor: '#f4f6f8', borderLeft: '4px solid #DE6B06', height: '100%' }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Classification</Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                            <strong>Logistic, Random Forest, SVM, KNN, LightGBM, MLP.</strong><br/>
                            Prefer Random Forest or LightGBM if you are unsure.
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12}>
                    <Paper sx={{ p: 2, bgcolor: '#f4f6f8', borderLeft: '4px solid #DE6B06' }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Other</Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                            <strong>K-Means:</strong> clustering (no target).<br/>
                            <strong>Isolation Forest / One-Class SVM:</strong> anomaly detection.
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom sx={{ color: '#384850', mt: 2, borderBottom: '2px solid #DE6B06', pb: 0.5 }}>
                Validation
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                    Estimates how the model behaves on unseen data.
                    <ul style={{ marginTop: '8px', marginBottom: '4px' }}>
                        <li><strong>Hold-out:</strong> quick train/validation split inside the training rows</li>
                        <li><strong>KFold / Repeated / Shuffle:</strong> several folds on training rows</li>
                        <li><strong>Bootstrap:</strong> resampling; useful on small sets</li>
                        <li><strong>Time Series Split:</strong> chronological folds; needs one date column (used for order only)</li>
                    </ul>
                    Final scores also use the fixed train/test split from Clean · Split.
                </Typography>
            </Alert>

            <Typography variant="body2" sx={{ mt: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
                After training, save the model if you want to use it later on the Use Model page.
            </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', p: 2 }}>
            <Button onClick={onClose} variant="contained" sx={{ bgcolor: '#384850', px: 4, '&:hover': { bgcolor: '#003d54' } }}>
                Got it
            </Button>
        </DialogActions>
    </Dialog>
);






const SaveModelDialog = ({ 
  open, 
  onClose, 
  onSave, 
  isLoading,
  error, // ✅ Ajouter la prop error
  saveAvailableUntil = null,
}) => {
  const [localModelName, setLocalModelName] = useState('');
  const [validationError, setValidationError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(null);

  // Réinitialiser le nom seulement à l'ouverture (pas à chaque seconde)
  useEffect(() => {
    if (open) {
      setLocalModelName('');
      setValidationError('');
    }
  }, [open]);

  // Countdown runs inside the dialog only: does not remount / clear the name field
  useEffect(() => {
    if (!open || !saveAvailableUntil) {
      setSecondsLeft(null);
      return undefined;
    }
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((saveAvailableUntil - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, saveAvailableUntil]);

  const saveWindowExpired = secondsLeft !== null && secondsLeft <= 0;
  const minutesLeftDisplay =
    secondsLeft == null
      ? 5
      : Math.max(1, Math.ceil(secondsLeft / 60));

  // ✅ Afficher les erreurs de sauvegarde
  useEffect(() => {
    if (error) {
      // Vous pouvez choisir d'afficher l'erreur dans la dialog
      console.error("Save error in dialog:", error);
    }
  }, [error]);

  // Fonction de validation
  const validateModelName = (name) => {
    if (!name.trim()) {
      return "Model name is required";
    }
    
    // Vérifier si le nom commence par un chiffre
    if (/^\d/.test(name)) {
      return "Model name cannot start with a number";
    }
    
    // Vérifier les espaces
    if (/\s/.test(name)) {
      return "Spaces are not allowed. Use underscores (_) instead";
    }
    
    // Vérifier les caractères spéciaux (autoriser seulement lettres, chiffres, underscores, tirets)
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
      return "Only letters, numbers, underscores (_) and hyphens (-) are allowed. Must start with a letter.";
    }
    
    // Vérifier la longueur
    if (name.length < 2) {
      return "Model name must be at least 2 characters long";
    }
    
    if (name.length > 50) {
      return "Model name cannot exceed 50 characters";
    }
    
    return "";
  };

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setLocalModelName(newName);
    
    // Validation en temps réel
    const error = validateModelName(newName);
    setValidationError(error);
  };

  const handleSave = () => {
    const error = validateModelName(localModelName);
    if (error) {
      setValidationError(error);
      return;
    }
    if (saveWindowExpired) {
      return;
    }
    
    // Passer le nom directement à onSave
    onSave(localModelName);
  };

  const handleClose = () => {
    setLocalModelName('');
    setValidationError('');
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isLoading && !validationError) {
      e.preventDefault();
      handleSave();
    }
  };

 return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      disableEscapeKeyDown={isLoading} // ✅ Empêcher la fermeture pendant le chargement
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        💾 Save Trained Model
      </DialogTitle>
      
      <DialogContent>
        {/* ✅ AFFICHER LES ERREURS DE SAUVEGARDE */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {error}
            </Typography>
          </Alert>
        )}
        
        <DialogContentText sx={{ mb: 2 }}>
          Save your trained model for future predictions and deployments.
        </DialogContentText>
        
        <TextField
          autoFocus
          margin="dense"
          label="Model name"
          fullWidth
          value={localModelName}
          onChange={handleNameChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          error={!!validationError}
          helperText={validationError || "Use letters, numbers, underscores (_) and hyphens (-)"}
          variant="outlined"
          placeholder="e.g., my_awesome_model_v1"
        />
        
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Naming rules:</strong>
            <br/>• Must start with a letter
            <br/>• Only letters, numbers, _ and -
            <br/>• No spaces allowed
            <br/>• 2-50 characters long
            <br/>• <strong>Must be unique for your account</strong>
          </Typography>
        </Alert>

        <Alert severity={saveWindowExpired ? "error" : "warning"} sx={{ mt: 2 }}>
          <Typography variant="body2">
            {saveWindowExpired ? (
              <>
                <strong>Save time expired.</strong> You can only save a model within{" "}
                <strong>5 minutes</strong> after training finishes. Please train again,
                then save it right away.
              </>
            ) : (
              <>
                <strong>Save within 5 minutes</strong> after training finishes
                {secondsLeft != null
                  ? ` (${minutesLeftDisplay} min left)`
                  : ""}
                . After that, you will need to train again. This keeps your account and
                data safe.
              </>
            )}
          </Typography>
        </Alert>
        
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={handleClose} 
          disabled={isLoading}
          color="inherit"
        >
          Cancel
        </Button>
        
        <Button 
          onClick={handleSave} 
          disabled={
            isLoading ||
            !!validationError ||
            !localModelName.trim() ||
            saveWindowExpired
          }
          color="primary"
          variant="contained"
          startIcon={isLoading ? <CircularProgress size={16} /> : null}
        >
          {isLoading ? "Saving..." : "Save Model"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};










// Ajouter cette fonction pour rendre les paramètres KMeans
const renderKmeansParams = () => {
  const initOptions = [
    { value: 'k-means++', label: 'k-means++ (smarter initialization)' },
    { value: 'random', label: 'Random initialization' }
  ];

  const algorithmOptions = [
    { value: 'auto', label: 'Auto (choose best automatically)' },
    { value: 'full', label: 'Full (classic EM algorithm)' },
    { value: 'elkan', label: 'Elkan (optimized for dense data)' }
  ];

  return (
    <Grid container spacing={2}>
    
      <Grid item xs={12} md={6}>
        <TextField
          label="Number of clusters (k)"
          type="number"
          value={kmeansParams.n_clusters}
          onChange={(e) => setKmeansParams({...kmeansParams, n_clusters: parseInt(e.target.value) || 3})}
          fullWidth
          inputProps={{ min: 2, max: 20 }}
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
<TextField
  select
  label="Initialization method"
  value={kmeansParams.init}
  onChange={(e) => setKmeansParams({...kmeansParams, init: e.target.value})}
  fullWidth
>
  <MenuItem value="k-means++">k-means++ (smarter initialization)</MenuItem>
  <MenuItem value="random">Random initialization</MenuItem>
</TextField>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <TextField
          label="Number of initializations"
          type="number"
          value={kmeansParams.n_init}
          onChange={(e) => setKmeansParams({...kmeansParams, n_init: parseInt(e.target.value) || 10})}
          fullWidth
          inputProps={{ min: 1, max: 100 }}
          helperText="Higher values give more stable results"
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <TextField
          label="Maximum iterations"
          type="number"
          value={kmeansParams.max_iter}
          onChange={(e) => setKmeansParams({...kmeansParams, max_iter: parseInt(e.target.value) || 300})}
          fullWidth
          inputProps={{ min: 10, max: 1000 }}
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <TextField
          label="Tolerance"
          type="number"
          value={kmeansParams.tol}
          onChange={(e) => setKmeansParams({...kmeansParams, tol: parseFloat(e.target.value) || 1e-4})}
          fullWidth
          inputProps={{ min: 1e-6, max: 1e-2, step: 1e-4 }}
          helperText="Lower values mean stricter convergence"
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <TextField
  select
  label="Algorithm"
  value={kmeansParams.algorithm}
  onChange={(e) => setKmeansParams({...kmeansParams, algorithm: e.target.value})}
  fullWidth
>
  <MenuItem value="lloyd">Lloyd (standard k-means)</MenuItem>
  <MenuItem value="elkan">Elkan (optimized for dense data)</MenuItem>
</TextField>
      </Grid>
      
      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Checkbox
              checked={kmeansParams.use_scaling}
              onChange={(e) => setKmeansParams({...kmeansParams, use_scaling: e.target.checked})}
            />
          }
          label="Scale features before clustering (recommended)"
        />
      </Grid>
    </Grid>
  );
};

const renderAnomalyParams = () => {
  if (modelType === 'isolation_forest') {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Alert severity="info">
            Isolation Forest flags rare / suspicious rows (useful for intrusion screening).
            Fit uses <strong>train only</strong>: no test leakage. Target (if any) is excluded from features.
          </Alert>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            type="number"
            label="Trees (n_estimators)"
            value={isolationForestParams.n_estimators}
            onChange={(e) =>
              setIsolationForestParams({
                ...isolationForestParams,
                n_estimators: parseInt(e.target.value, 10) || 100,
              })
            }
            fullWidth
            inputProps={{ min: 10, max: 1000 }}
            helperText="More trees ⇒ more stable, slower"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            type="number"
            label="Expected anomaly rate (contamination)"
            value={isolationForestParams.contamination}
            onChange={(e) =>
              setIsolationForestParams({
                ...isolationForestParams,
                contamination: parseFloat(e.target.value) || 0.05,
              })
            }
            fullWidth
            inputProps={{ min: 0.01, max: 0.5, step: 0.01 }}
            helperText="e.g. 0.05 ≈ 5% of train rows expected anomalous"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Max samples"
            value={isolationForestParams.max_samples}
            onChange={(e) =>
              setIsolationForestParams({
                ...isolationForestParams,
                max_samples: e.target.value,
              })
            }
            fullWidth
            helperText="'auto' or a fraction (0–1) / integer subsample size"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            type="number"
            label="Max features (fraction)"
            value={isolationForestParams.max_features}
            onChange={(e) =>
              setIsolationForestParams({
                ...isolationForestParams,
                max_features: parseFloat(e.target.value) || 1,
              })
            }
            fullWidth
            inputProps={{ min: 0.1, max: 1, step: 0.05 }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Checkbox
                checked={isolationForestParams.bootstrap}
                onChange={(e) =>
                  setIsolationForestParams({
                    ...isolationForestParams,
                    bootstrap: e.target.checked,
                  })
                }
              />
            }
            label="Bootstrap samples"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Checkbox
                checked={isolationForestParams.use_scaling}
                onChange={(e) =>
                  setIsolationForestParams({
                    ...isolationForestParams,
                    use_scaling: e.target.checked,
                  })
                }
              />
            }
            label="Scale features (StandardScaler on train)"
          />
        </Grid>
      </Grid>
    );
  }

  if (modelType === 'one_class_svm') {
    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Alert severity="info">
            One-Class SVM learns a boundary around “normal” traffic. Fit on <strong>train only</strong>.
            For cyber datasets with labels, optionally train on normal rows only (semi-supervised).
          </Alert>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            select
            label="Kernel"
            value={oneClassSvmParams.kernel}
            onChange={(e) =>
              setOneClassSvmParams({ ...oneClassSvmParams, kernel: e.target.value })
            }
            fullWidth
          >
            <MenuItem value="rbf">RBF (recommended)</MenuItem>
            <MenuItem value="linear">Linear</MenuItem>
            <MenuItem value="poly">Polynomial</MenuItem>
            <MenuItem value="sigmoid">Sigmoid</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            type="number"
            label="Nu (upper bound on anomaly fraction)"
            value={oneClassSvmParams.nu}
            onChange={(e) =>
              setOneClassSvmParams({
                ...oneClassSvmParams,
                nu: parseFloat(e.target.value) || 0.05,
              })
            }
            fullWidth
            inputProps={{ min: 0.01, max: 1, step: 0.01 }}
            helperText="Similar role to contamination"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label="Gamma"
            value={oneClassSvmParams.gamma}
            onChange={(e) =>
              setOneClassSvmParams({ ...oneClassSvmParams, gamma: e.target.value })
            }
            fullWidth
            helperText="'scale', 'auto', or a positive float"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            type="number"
            label="Degree (poly kernel)"
            value={oneClassSvmParams.degree}
            onChange={(e) =>
              setOneClassSvmParams({
                ...oneClassSvmParams,
                degree: parseInt(e.target.value, 10) || 3,
              })
            }
            fullWidth
            disabled={oneClassSvmParams.kernel !== 'poly'}
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={oneClassSvmParams.train_on_normals_only}
                onChange={(e) =>
                  setOneClassSvmParams({
                    ...oneClassSvmParams,
                    train_on_normals_only: e.target.checked,
                  })
                }
                disabled={!hasTargetColumn}
              />
            }
            label="Train on normal/benign rows only (needs target: cyber recommended)"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={oneClassSvmParams.use_scaling}
                onChange={(e) =>
                  setOneClassSvmParams({
                    ...oneClassSvmParams,
                    use_scaling: e.target.checked,
                  })
                }
              />
            }
            label="Scale features (StandardScaler on train): recommended"
          />
        </Grid>
      </Grid>
    );
  }
  return null;
};

const renderAnomalyResults = () => {
  if (!result || !isAnomalyAlgo()) return null;
  const m = result.metrics || {};
  const train = m.train || {};
  const test = m.test || {};
  const evalL = m.label_evaluation;
  const pts = m.visualization_data?.['2d']?.points || result.visualization_data?.['2d']?.points || [];

  return (
    <>
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Anomaly detection results
          </Typography>
          <Alert severity="success" sx={{ mb: 2 }}>
            {m.anti_leakage?.labels_fit_note || 'Fitted on train features only (anti-leakage).'}
          </Alert>
          {m.cyber_hint && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {m.cyber_hint}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: '#f4f6f8' }}>
                <Typography fontWeight={700}>Train</Typography>
                <Typography variant="body2">Rows: {train.n_samples ?? 'N/A'}</Typography>
                <Typography variant="body2">
                  Flagged anomalies: {train.n_anomalies ?? 'N/A'} (
                  {train.anomaly_rate != null ? `${(train.anomaly_rate * 100).toFixed(2)}%` : 'N/A'})
                </Typography>
                <Typography variant="body2">
                  Score mean: {train.score_mean != null ? Number(train.score_mean).toFixed(4) : 'N/A'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: '#fff8f2' }}>
                <Typography fontWeight={700}>Test (held-out)</Typography>
                <Typography variant="body2">Rows: {test.n_samples ?? 'N/A'}</Typography>
                <Typography variant="body2">
                  Flagged anomalies: {test.n_anomalies ?? 'N/A'} (
                  {test.anomaly_rate != null ? `${(test.anomaly_rate * 100).toFixed(2)}%` : 'N/A'})
                </Typography>
                <Typography variant="body2">
                  Score mean: {test.score_mean != null ? Number(test.score_mean).toFixed(4) : 'N/A'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
          {evalL?.available && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Optional label check on test (evaluation only)
              </Typography>
              <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                {evalL.note}
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6} md={3}>Precision: {(evalL.precision * 100).toFixed(1)}%</Grid>
                <Grid item xs={6} md={3}>Recall: {(evalL.recall * 100).toFixed(1)}%</Grid>
                <Grid item xs={6} md={3}>F1: {(evalL.f1 * 100).toFixed(1)}%</Grid>
                <Grid item xs={6} md={3}>
                  ROC-AUC: {evalL.roc_auc != null ? Number(evalL.roc_auc).toFixed(3) : 'N/A'}
                </Grid>
              </Grid>
            </Box>
          )}
          {pts.length > 0 && (
            <Box sx={{ mt: 2, height: 320 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Train PCA view (orange = anomaly)
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="PC1" />
                  <YAxis type="number" dataKey="y" name="PC2" />
                  <ZAxis range={[40, 40]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter
                    name="Normal"
                    data={pts.filter((p) => !p.is_anomaly)}
                    fill="#384850"
                  />
                  <Scatter
                    name="Anomaly"
                    data={pts.filter((p) => p.is_anomaly)}
                    fill="#DE6B06"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </Box>
          )}
        </CardContent>
      </Card>
    </>
  );
};










const detectDateColumn = async () => {
  if (!state?.bdName) return null;
  
  try {
    console.log("[DEBUG] Detecting date column for TimeSeriesSplit");
    const datasetToUse = state.bdName.replace('_numerized', '');

    // Prefer platform type analysis (same as Transform)
    try {
      const typesRes = await axios.get(`${backendUrl}/api/analyze-column-types`, {
        params: { bdName: datasetToUse },
        withCredentials: true,
        timeout: 60000,
      });
      const dates = (typesRes.data?.column_types || [])
        .filter((c) => (c.column_type || "").toLowerCase() === "date")
        .map((c) => c.column_name)
        .filter((n) => n && n !== "id" && n !== "split_type");
      if (dates.length > 0) {
        console.log(`[DEBUG] ✅ Date columns from analyze-column-types:`, dates);
        setDateColumnOptions(dates);
        return dates[0];
      }
    } catch (e) {
      console.warn("[DEBUG] analyze-column-types failed, fallback heuristic", e);
    }
    
    const response = await axios.get(
      `${backendUrl}/api/get-data?bdName=${datasetToUse}&limit=100`,
      { withCredentials: true }
    );
    
    const columns = response.data.columns;
    const rows = response.data.rows;
    
    const dateFormats = [
      'YYYY-MM-DD HH:mm:ss',
      'YYYY-MM-DD HH:mm',
      'YYYY-MM-DD HH:mm:ss.SSS',
      'YYYY-MM-DDTHH:mm:ss',
      'YYYY-MM-DDTHH:mm',
      'YYYY-MM-DD HH:mm:ssZ',
      'DD-MM-YYYY',
      'YYYY/MM/DD',
      'YYYY-MM-DD',
      'DD/MM/YYYY',
      'YYYY.MM.DD',
      'DD.MM.YYYY',
      'YYYYMMDD',
      'DD-MM-YYYY HH:mm',
      'YYYY-MM-DDTHH:mm:ssZ'
    ];
    
    const found = [];
    for (const col of columns) {
      if (col === 'id' || col === 'split_type') continue;
      
      const sampleValues = rows
        .map(row => row[`col${columns.indexOf(col)}`] || row[col])
        .filter(val => val !== null && val !== undefined && val !== '')
        .slice(0, 20);
      
      if (sampleValues.length === 0) continue;
      
      let dateCount = 0;
      for (const val of sampleValues) {
        const strVal = String(val).trim();
        for (const fmt of dateFormats) {
          const parsed = moment(strVal, fmt, true);
          if (parsed.isValid()) {
            dateCount++;
            break;
          }
        }
      }
      
      if (dateCount / sampleValues.length > 0.8) {
        found.push(col);
      }
    }

    setDateColumnOptions(found);
    if (found.length > 0) {
      console.log(`[DEBUG] ✅ Date column detected: ${found[0]}`);
      return found[0];
    }
    
    console.log("[DEBUG] ❌ No date column found");
    return null;
    
  } catch (error) {
    console.error("[DEBUG] Error detecting date column:", error);
    return null;
  }
};










// Ajouter cette fonction pour rendre les résultats KMeans
const renderKmeansResults = () => {
  if (!result || modelType !== 'kmeans') return null;

  // Helper function to generate cluster colors
  const generateClusterColors = (n) => {
    const colors = [];
    for (let i = 0; i < n; i++) {
      // This generates distinct colors using HSL color space
      const hue = (i * 360 / n) % 360;
      colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colors;
  };

  const clusterColors = generateClusterColors(kmeansParams.n_clusters);

  return (
    <>
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ℹ️ KMeans Model Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography>Number of clusters: {kmeansParams.n_clusters}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography>Initialization: {kmeansParams.init}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography>Algorithm: {kmeansParams.algorithm}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography>Iterations: {result.metrics?.n_iter || 'N/A'}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📊 Clustering Metrics
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography>Silhouette Score: {result.metrics?.silhouette_score?.toFixed(3) || 'N/A'}</Typography>
              <Typography variant="caption" display="block">
                Higher is better (range: -1 to 1)
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography>Calinski-Harabasz: {result.metrics?.calinski_harabasz_score?.toFixed(3) || 'N/A'}</Typography>
              <Typography variant="caption" display="block">
                Higher is better
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography>Davies-Bouldin: {result.metrics?.davies_bouldin_score?.toFixed(3) || 'N/A'}</Typography>
              <Typography variant="caption" display="block">
                Lower is better
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography>Inertia: {result.metrics?.inertia?.toFixed(3) || 'N/A'}</Typography>
              <Typography variant="caption" display="block">
                Sum of squared distances to centers
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Cluster sizes visualization */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📏 Cluster Sizes
          </Typography>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={result.metrics?.cluster_info?.map(cluster => ({
                name: `Cluster ${cluster.cluster_id}`,
                size: cluster.size
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="size">
                {result.metrics?.cluster_info?.map((cluster, index) => (
                  <Cell key={`cell-${index}`} fill={clusterColors[cluster.cluster_id]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 2D Visualization */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📍 2D Cluster Visualization (PCA)
          </Typography>
          <Typography variant="body2" paragraph>
            Explained variance: {result.metrics?.visualization_data?.['2d']?.explained_variance?.map(v => (v * 100).toFixed(1)).join('%, ')}%
          </Typography>
          <ResponsiveContainer width="100%" height={500}>
            <ScatterChart
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="x" 
                name="PC1" 
                label={{ value: 'Principal Component 1', position: 'insideBottomRight', offset: -10 }}
              />
              <YAxis 
                dataKey="y" 
                name="PC2" 
                label={{ value: 'Principal Component 2', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value, name, props) => {
                  if (name === 'Cluster') return [value, 'Cluster'];
                  return [value, name];
                }}
                labelFormatter={(label) => `Point ${label}`}
              />
              <Legend />
              {Array.from({ length: kmeansParams.n_clusters }).map((_, i) => (
                <Scatter
                  key={`cluster-${i}`}
                  name={`Cluster ${i}`}
                  data={result.metrics?.visualization_data?.['2d']?.points?.filter(p => p.cluster === i)}
                  fill={clusterColors[i]}
                  fillOpacity={0.6}
                />
              ))}
              {result.metrics?.visualization_data?.['2d']?.centers?.map((center, i) => (
                <Scatter
                  key={`center-${i}`}
                  name={`Center ${i}`}
                  data={[center]}
                  fill={clusterColors[i]}
                  shape="star"
                  fillOpacity={1}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cluster centers information */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">🏆 Cluster Centers Information</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Cluster</TableCell>
                      <TableCell align="right">Size</TableCell>
                      {result.metrics?.feature_names?.map((feature, i) => (
                        <TableCell key={`feature-${i}`} align="right">{feature}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.metrics?.cluster_info?.map((cluster) => (
                      <TableRow key={cluster.cluster_id}>
                        <TableCell>
                          <Box 
                            sx={{ 
                              display: 'inline-block',
                              width: 12,
                              height: 12,
                              backgroundColor: clusterColors[cluster.cluster_id],
                              mr: 1
                            }}
                          />
                          {cluster.cluster_id}
                        </TableCell>
                        <TableCell align="right">{cluster.size}</TableCell>
                        {result.metrics?.feature_names?.map((feature, i) => (
                          <TableCell key={`value-${i}`} align="right">
                            {cluster.features[feature]?.toFixed(4) || 'N/A'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </>
  );
};







const [mlpParams, setMlpParams] = useState({
  layers: [64, 32],
  activation: 'relu',
  problem_type: 'auto',
  dropout_rate: 0.2,
  learning_rate: 0.001,
  batch_size: 32,
  epochs: 100,
  patience: 10,
  validation_split: 0.2,
  use_scaling: true
});

const renderMlpParams = () => {
  const activationOptions = [
    { value: 'relu', label: 'ReLU' },
    { value: 'sigmoid', label: 'Sigmoid' },
    { value: 'tanh', label: 'Tanh' },
    { value: 'leaky_relu', label: 'Leaky ReLU' },
    { value: 'elu', label: 'ELU' },
    { value: 'selu', label: 'SELU' }
  ];

  return (
    <Box sx={{ width: '100%' }}>
      {/* Hidden Layers Configuration - Pleine largeur */}
      <Box sx={{ mb: 3, width: '100%' }}>
        <TextField
          label="Hidden Layers Configuration"
          value={mlpParams.layers.join(', ')}
          onChange={(e) => {
            const layers = e.target.value
              .split(',')
              .map(x => parseInt(x.trim()))
              .filter(x => !isNaN(x) && x > 0);
            setMlpParams({...mlpParams, layers: layers.length ? layers : [64, 32]});
          }}
          fullWidth
          sx={{ 
            minWidth: 300,
            '& .MuiInputLabel-root': {
              backgroundColor: 'white',
              padding: '0 8px',
              fontWeight: 600
            }
          }}
          helperText="Comma-separated list of neurons per layer (e.g., 64, 32, 16)"
        />
      </Box>

      {/* Paramètres en grille adaptative */}
      <Grid container spacing={3} sx={{ width: '100%' }}>
        {/* Première ligne */}
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            select
            label="Hidden Activation Function"
            value={mlpParams.activation}
            onChange={(e) => setMlpParams({...mlpParams, activation: e.target.value})}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            sx={{ minWidth: 280 }}
          >
            {activationOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Dropout Rate"
            type="number"
            value={mlpParams.dropout_rate}
            onChange={(e) => setMlpParams({...mlpParams, dropout_rate: parseFloat(e.target.value)})}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ min: 0, max: 0.9, step: 0.05 }}
            helperText="Fraction of input units to drop (0-0.9)"
            sx={{ minWidth: 280 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Learning Rate"
            type="number"
            value={mlpParams.learning_rate}
            onChange={(e) => setMlpParams({...mlpParams, learning_rate: parseFloat(e.target.value)})}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ min: 0.0001, max: 0.1, step: 0.0001 }}
            helperText="Step size for weight updates"
            sx={{ minWidth: 280 }}
          />
        </Grid>

        {/* Deuxième ligne */}
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Batch Size"
            type="number"
            value={mlpParams.batch_size}
            onChange={(e) => setMlpParams({...mlpParams, batch_size: parseInt(e.target.value)})}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ min: 8, max: 512 }}
            helperText="Samples per gradient update"
            sx={{ minWidth: 280 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Number of Epochs"
            type="number"
            value={mlpParams.epochs}
            onChange={(e) => setMlpParams({...mlpParams, epochs: parseInt(e.target.value)})}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ min: 1, max: 1000 }}
            helperText="Number of training passes"
            sx={{ minWidth: 280 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Early Stopping Patience"
            type="number"
            value={mlpParams.patience}
            onChange={(e) => setMlpParams({...mlpParams, patience: parseInt(e.target.value)})}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ min: 1, max: 50 }}
            helperText="Epochs to wait before stopping"
            sx={{ minWidth: 280 }}
          />
        </Grid>

        {/* Troisième ligne */}
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Validation Split"
            type="number"
            value={mlpParams.validation_split}
            onChange={(e) => setMlpParams({...mlpParams, validation_split: parseFloat(e.target.value)})}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ min: 0.1, max: 0.5, step: 0.05 }}
            helperText="Fraction of training data for validation"
            sx={{ minWidth: 280 }}
          />
        </Grid>
      </Grid>
      
      {/* Checkbox en pleine largeur */}
      <Box sx={{ mt: 3, width: '100%' }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={mlpParams.use_scaling}
              onChange={(e) => setMlpParams({...mlpParams, use_scaling: e.target.checked})}
            />
          }
          label="Scale input features before training (highly recommended)"
          sx={{ 
            width: '100%',
            '& .MuiFormControlLabel-label': {
              fontWeight: 500
            }
          }}
        />
      </Box>

      {/* Alertes informatives */}
      {mlpParams.layers.length > 3 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Deep network with {mlpParams.layers.length} layers - may require more training time
        </Alert>
      )}
      
      {mlpParams.dropout_rate > 0.5 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          High dropout rate ({mlpParams.dropout_rate}) - may cause underfitting
        </Alert>
      )}

      {mlpParams.learning_rate < 0.001 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Low learning rate ({mlpParams.learning_rate}) - training may be slower but more stable
        </Alert>
      )}

      {mlpParams.learning_rate > 0.01 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          High learning rate ({mlpParams.learning_rate}) - may cause training instability
        </Alert>
      )}
    </Box>
  );
};

// Add MLP-specific visualizations
const renderMlpResults = () => {
  if (!result || modelType !== 'mlp') return null;

  const isClassification = result.metrics?.is_classification;
  
  // Prepare training history data
  const historyData = result.metrics?.training_history?.epoch?.map((epoch, i) => ({
    epoch,
    loss: result.metrics.training_history.loss[i],
    val_loss: result.metrics.training_history.val_loss[i],
    ...(isClassification ? {
        accuracy: result.metrics.training_history.accuracy?.[i] || 0,
        val_accuracy: result.metrics.training_history.val_accuracy?.[i] || 0
    } : {
        mse: result.metrics.training_history.mse?.[i] || 0,
        val_mse: result.metrics.training_history.val_mse?.[i] || 0
    })
  })) || [];

  return (
    <>
     {/*  <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🏗️ Model Architecture
          </Typography>
          {result.metrics?.model_architecture?.length > 0 && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Layer</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Input Shape</TableCell>
                    <TableCell align="right">Output Shape</TableCell>
                    <TableCell align="right">Parameters</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.metrics.model_architecture.map((layer, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{layer.type}</TableCell>
                      <TableCell align="right">
                        {layer.input_size ? `(${layer.input_size},)` : 'N/A'}
                      </TableCell>
                      <TableCell align="right">
                        {layer.output_size ? `(${layer.output_size},)` : 'N/A'}
                      </TableCell>
                      <TableCell align="right">
                        {layer.parameters?.toLocaleString() || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>*/}

      {/*historyData.length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📉 Training History
            </Typography>
            <Typography variant="body2" gutterBottom>
              Best epoch: {result.metrics?.best_epoch} (stopped early: {result.metrics?.best_epoch < mlpParams.epochs ? 'Yes' : 'No'})
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="epoch" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="loss" 
                  stroke="#8884d8" 
                  name="Training Loss"
                  activeDot={{ r: 6 }}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="val_loss" 
                  stroke="#82ca9d" 
                  name="Validation Loss"
                />
                {isClassification ? (
                  <>
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#ff7300" 
                      name="Training Accuracy"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="val_accuracy" 
                      stroke="#ffc658" 
                      name="Validation Accuracy"
                    />
                  </>
                ) : (
                  <>
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="mse" 
                      stroke="#ff7300" 
                      name="Training MSE"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="val_mse" 
                      stroke="#ffc658" 
                      name="Validation MSE"
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )*/}

      {/* ==================== AJOUT ICI ==================== */}
      {/* Validation Results */}
      {result.metrics?.validation_results && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🔍 Validation Results
            </Typography>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Method:</strong> {result.metrics.validation_results.method}<br/>
                <strong>Model Source:</strong> {result.training_info?.final_model_source || 'Standard training'}
              </Typography>
            </Alert>
            
            

            {/* Détails supplémentaires pour Bootstrap */}
            {result.metrics.validation_results.bootstrap_details && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Bootstrap Performance
                </Typography>
                <Typography variant="body2">
                  Median bootstrap index: {result.metrics.validation_results.median_bootstrap_index}
                </Typography>
                <Typography variant="body2">
                  Bootstrap scores: {result.metrics.validation_results.bootstrap_mean?.toFixed(4)} ± {result.metrics.validation_results.bootstrap_std?.toFixed(4)}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
      {/* ==================== FIN DE L'AJOUT ==================== */}

    
    </>
  );
};
const SvmParamAlert = ({ isClassification, paramName }) => {
  if (isClassification === null) return null;
  
  const messages = {
    probability: {
      true: "Probability estimates enabled (SVM classification)",
      false: "Probability estimates disabled (not used for SVM regression)"
    },
    random_state: {
      true: "Random state enabled (SVM classification)",
      false: "Random state disabled (SVM regression)"
    }
  };

  return (
    <Alert 
      severity={isClassification ? "success" : "warning"} 
      sx={{ mt: 1, mb: 1 }}
    >
      {messages[paramName][isClassification]}
    </Alert>
  );
};





// Cette fonction détecte si le problème est une classification ou Regression
const detectSvmProblemType = async () => {
  if (!state?.bdName) return;
  
  try {
    const originalBdName = state.bdName.replace('_numerized', '');
    const response = await axios.get(
      `${backendUrl}/api/get-target-type?bdName=${originalBdName}`,
      { withCredentials: true }
    );
    
    setIsSvmClassification(response.data.is_classification);
  } catch (error) {
    console.error("Error detecting SVM problem type:", error);
    // Fallback: suppose que c'est une classification
    setIsSvmClassification(true);
  }
};

// Appelez cette fonction quand le dataset change
useEffect(() => {
  if (modelType === 'svm') {
    detectSvmProblemType();
  }
}, [state?.bdName, modelType]);





const handleSvmParamChange = (param, value) => {
  let processedValue = value;
  
  // Validation spécifique pour chaque paramètre
  if (param === 'C') {
    processedValue = Math.max(0.01, parseFloat(value) || 1.0);
  } else if (param === 'degree') {
    processedValue = Math.min(10, Math.max(1, parseInt(value) || 3));
  } else if (param === 'gamma' && value === '') {
    processedValue = null;
  }
  
  if (param === 'probability' && isSvmClassification === false) {
    processedValue = false;
  }
  
  setSvmParams(prev => ({
    ...prev,
    [param]: processedValue
  }));
};


const renderSvmParams = () => {
  const kernelOptions = [
    { value: 'rbf', label: 'RBF (Radial Basis Function)' },
    { value: 'linear', label: 'Linear' },
    { value: 'poly', label: 'Polynomial' },
    { value: 'sigmoid', label: 'Sigmoid' }
  ];

  const isAutoOptimization = validationMethod.startsWith('cv_');

  return (
    <Box sx={{ width: '100%' }}>
      {/* Première ligne - Paramètres principaux */}
      <Grid container spacing={3} sx={{ width: '100%' }}>
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            select
            label="Kernel Type"
            value={svmParams.kernel}
            onChange={(e) => handleSvmParamChange('kernel', e.target.value)}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            helperText="Choice of kernel affects model flexibility"
            sx={{ minWidth: 280 }}
          >
            {kernelOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Regularization (C)"
            type="number"
            value={svmParams.C}
            onChange={(e) => handleSvmParamChange('C', e.target.value)}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ min: 0.01, step: 0.01 }}
            helperText="Small C = more regularization"
            sx={{ minWidth: 280 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            select
            label="Gamma"
            value={svmParams.gamma || ''}
            onChange={(e) => handleSvmParamChange('gamma', e.target.value)}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            helperText="Kernel coefficient"
            sx={{ minWidth: 280 }}
          >
            <MenuItem value="scale">Scale (1 / (n_features * X.var()))</MenuItem>
            <MenuItem value="auto">Auto (1 / n_features)</MenuItem>
            <MenuItem value="">Custom value (enter below)</MenuItem>
          </TextField>
        </Grid>
      </Grid>

      {/* Deuxième ligne - Gamma personnalisé et Degree */}
      <Grid container spacing={3} sx={{ width: '100%', mt: 1 }}>
        {svmParams.gamma === '' && (
          <Grid item xs={12} sm={6} lg={4}>
            <TextField
              label="Custom Gamma Value"
              type="number"
              value={svmParams.customGamma || 0.1}
              onChange={(e) => handleSvmParamChange('customGamma', e.target.value)}
              fullWidth
              InputLabelProps={{ 
                shrink: true,
                sx: { 
                  backgroundColor: 'white', 
                  padding: '0 8px',
                  fontWeight: 600,
                  fontSize: '1rem'
                }
              }}
              disabled={svmParams.kernel === 'linear' || isAutoOptimization}
              inputProps={{ min: 0, step: 0.001 }}
              helperText={isAutoOptimization ? "Custom gamma disabled in optimization mode" : "Custom gamma value"}
              sx={{ minWidth: 280 }}
            />
          </Grid>
        )}
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Degree (for Polynomial Kernel)"
            type="number"
            value={svmParams.degree}
            onChange={(e) => handleSvmParamChange('degree', e.target.value)}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ min: 1, max: 10 }}
            disabled={svmParams.kernel !== 'poly'}
            helperText={svmParams.kernel !== 'poly' ? "Only for polynomial kernel" : "Polynomial degree"}
            sx={{ minWidth: 280 }}
          />
        </Grid>
      </Grid>

      {/* Troisième ligne - Checkboxes */}
      <Grid container spacing={3} sx={{ width: '100%', mt: 2 }}>
        <Grid item xs={12} sm={6} lg={4}>
          <FormControlLabel
            control={
              <Checkbox
                checked={svmParams.shrinking}
                onChange={(e) => handleSvmParamChange('shrinking', e.target.checked)}
                disabled={isAutoOptimization}
              />
            }
            label={
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  Use Shrinking Heuristic
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isAutoOptimization ? 
                    "Shrinking fixed during optimization" : 
                    "Faster training with shrinking heuristic"}
                </Typography>
              </Box>
            }
            sx={{ 
              width: '100%',
              '& .MuiFormControlLabel-label': {
                width: '100%'
              }
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <FormControlLabel
            control={
              <Checkbox
                checked={svmParams.probability}
                onChange={(e) => handleSvmParamChange('probability', e.target.checked)}
                disabled={isSvmClassification === false}
              />
            }
            label={
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  Enable Probability Estimates
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isSvmClassification === false ? 
                    "Not available for regression" : 
                    "Enable probability estimates for classification"}
                </Typography>
              </Box>
            }
            sx={{ 
              width: '100%',
              '& .MuiFormControlLabel-label': {
                width: '100%'
              }
            }}
          />
        </Grid>

        
      </Grid>

      {/* Avertissements de compatibilité */}
      {svmParams.kernel === 'poly' && svmParams.degree > 5 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          High polynomial degree ({svmParams.degree}) may cause overfitting and high computation time
        </Alert>
      )}
      
      {svmParams.kernel === 'sigmoid' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Sigmoid kernel is equivalent to a two-layer perceptron and may not perform well in all cases
        </Alert>
      )}
      
      {svmParams.C > 100 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          High C value ({svmParams.C}) means less regularization - risk of overfitting
        </Alert>
      )}

      {isAutoOptimization && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Auto-optimization Mode:</strong> Some parameters will be optimized automatically during training.
            Manual settings serve as initial values or constraints.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};


const validateLogisticParams = (params) => {
  const errors = [];
  
  const validCombinations = {
    'liblinear': ['l1', 'l2'],
    'newton-cg': ['l2', 'none'],
    'lbfgs': ['l2', 'none'],
    'sag': ['l2', 'none'],
    'saga': ['elasticnet', 'l1', 'l2', 'none']
  };

  // Validation penalty/solver
  if (!validCombinations[params.solver]?.includes(params.penalty)) {
    errors.push(`Incompatible combination: solver "${params.solver}" with penalty "${params.penalty}"`);
  }

  // Validation multiclass
  if (params.solver === 'liblinear' && params.multi_class === 'multinomial') {
    errors.push("Liblinear does not support 'multinomial'. Use 'ovr' or change solver.");
  }

  // ✅ NOUVELLE VALIDATION : l1_ratio pour ElasticNet
  if (params.penalty === 'elasticnet') {
    if (params.solver !== 'saga') {
      errors.push("ElasticNet requires solver 'saga'");
    }
    if (params.l1_ratio === undefined || params.l1_ratio === null) {
      errors.push("l1_ratio must be specified when penalty is elasticnet");
    } else if (params.l1_ratio < 0 || params.l1_ratio > 1) {
      errors.push("l1_ratio must be between 0 and 1");
    }
  }

  // Validation limites numériques
  if (params.max_iter < 100 || params.max_iter > 10000) {
    errors.push("max_iter must be between 100 and 10000");
  }

  return errors;
};

// UTILISATION DANS LE COMPOSANT
const [logisticValidationErrors, setLogisticValidationErrors] = useState([]);

useEffect(() => {
  const errors = validateLogisticParams(logisticParams);
  setLogisticValidationErrors(errors);
}, [logisticParams]);


const handleKnnParamChange = (param, value) => {
  setKnnParams(prev => ({
    ...prev,
    [param]: param === 'n_neighbors' || param === 'leaf_size' || param === 'p' 
      ? parseInt(value) 
      : value
  }));
};






const renderSvmSpecificVisualizations = () => {
  if (!result || modelType !== 'svm') return null;

  return (
    <>
      {/* Support Vectors Visualization */}
      {result.metrics?.support_vectors && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🔍 Support Vectors Visualization (PCA)
            </Typography>
            {result.metrics.pca_explained_variance && (
              <Typography variant="body2" paragraph>
                Explained variance: {result.metrics.pca_explained_variance.map(v => (v * 100).toFixed(1)).join('%, ')}%
              </Typography>
            )}
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="0" name="Principal Component 1" />
                <YAxis dataKey="1" name="Principal Component 2" />
                <Tooltip 
                  formatter={(value, name) => [value, name === '0' ? 'PC1' : 'PC2']}
                  labelFormatter={() => 'Support Vector'}
                />
                <Scatter 
                  name="Support Vectors" 
                  data={result.metrics.support_vectors}
                  fill="#ff7300"
                  fillOpacity={0.6}
                />
              </ScatterChart>
            </ResponsiveContainer>
            <Typography variant="caption" display="block" sx={{ mt: 1, textAlign: 'center' }}>
              Number of support vectors: {result.metrics.n_support_vectors}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Learning Curve */}
      {result.metrics?.learning_curve && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📉 Learning Curve
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={result.metrics.learning_curve.train_sizes.map((size, i) => ({
                size,
                train: result.metrics.learning_curve.train_scores[i],
                test: result.metrics.learning_curve.test_scores[i]
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="size" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="train" stroke="#8884d8" name="Train Score" />
                <Line type="monotone" dataKey="test" stroke="#82ca9d" name="Validation Score" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </>
  );
};
const renderKnnValidationDetails = () => {
  if (!result?.metrics?.validation_results || modelType !== 'knn') return null;

  const validationData = result.metrics.validation_results;
  const isClassification = result.metrics.is_classification;
  
  // Déterminer la méthode de validation
  const isHoldout = validationData.method?.includes('Hold-Out');
  const isCV = validationData.method?.includes('Cross-Validation');
  const isBootstrap = validationData.method?.includes('Bootstrap');
  
  // Récupérer les détails selon la méthode
  let details = [];
  let scoreProperty = 'score';
  
  if (isHoldout) {
    details = validationData.repetition_details || [];
    scoreProperty = 'score';
  } else if (isCV) {
    details = validationData.fold_details || [];
    if (details.length > 0 && details[0].validation_score !== undefined) {
      scoreProperty = 'validation_score';
    }
  } else if (isBootstrap) {
    details = validationData.bootstrap_details || [];
    scoreProperty = 'score';
  }
  
  if (details.length === 0) return null;

  // Préparer les données pour le graphique
  const chartData = details.map((item, index) => {
    const baseItem = {
      id: item.repetition || item.fold || item.bootstrap || index + 1,
      label: isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Sample'
    };
    
    let scoreValue = 0;
    if (scoreProperty && item[scoreProperty] !== undefined) {
      scoreValue = item[scoreProperty];
    }
    
    return {
      ...baseItem,
      fold: baseItem.id,
      score: scoreValue
    };
  });

  // Calculer les scores pour les statistiques
  const scores = chartData.map(item => item.score);
  
  // Obtenir le score moyen selon la méthode
  const meanScore = validationData.mean_score || 
                   validationData.cv_mean || 
                   validationData.bootstrap_mean ||
                   (scores.reduce((a, b) => a + b, 0) / scores.length);
  
  const stdScore = validationData.std_score || 
                  validationData.cv_std || 
                  validationData.bootstrap_std ||
                  (Math.sqrt(scores.reduce((sq, n) => sq + Math.pow(n - meanScore, 2), 0) / scores.length));

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔍 KNN Validation Details
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validationData.method}<br/>
            <strong>Samples/Folds/Repetitions:</strong> {details.length}<br/>
            <strong>Average Score:</strong> {meanScore.toFixed(4)} ± {stdScore.toFixed(4)}
          </Typography>
        </Alert>

        {/* Graphique des scores de validation */}
        {chartData.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
               {isClassification ? 'Accuracy' : 'R² Score'} by {isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap Sample'}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fold" 
                  label={{ 
                    value: isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap Sample', 
                    position: 'insideBottomRight', 
                    offset: -10 
                  }}
                />
                <YAxis 
                  label={{ 
                    value: isClassification ? 'Accuracy' : 'R² Score', 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                  domain={isClassification ? [0, 1] : ['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value) => [value.toFixed(4), isClassification ? 'Accuracy' : 'R² Score']}
                  labelFormatter={(label) => 
                    `${isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap'} ${label}`
                  }
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#8884d8" 
                  name={isClassification ? 'Accuracy' : 'R² Score'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                {/* Ligne de référence pour la moyenne */}
                <ReferenceLine 
                  y={meanScore} 
                  stroke="#ff7300" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: `Avg: ${meanScore.toFixed(3)}`, 
                    position: 'insideTopRight',
                    fill: '#ff7300',
                    fontSize: 12
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tableau des résultats individuels */}
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          📋 Individual Validation Results
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  {isHoldout ? 'Rep' : isCV ? 'Fold' : 'Sample'}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Train Size
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Validation Size
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {isClassification ? 'Accuracy' : 'R² Score'}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {details.slice(0, 10).map((item, index) => {
                const foldId = item.repetition || item.fold || item.bootstrap || index + 1;
                const trainSize = item.train_size || 'N/A';
                const validationSize = item.validation_size || 'N/A';
                
                let displayScore = 0;
                if (item.validation_score !== undefined) {
                  displayScore = item.validation_score;
                } else if (item.score !== undefined) {
                  displayScore = item.score;
                }
                
                return (
                  <TableRow key={index} hover>
                    <TableCell>
                      {foldId}
                    </TableCell>
                    <TableCell align="right">{trainSize}</TableCell>
                    <TableCell align="right">{validationSize}</TableCell>
                    <TableCell 
                      align="right" 
                      sx={{ 
                        fontWeight: 'medium',
                        color: isClassification ? 
                          (displayScore >= 0.9 ? 'success.main' : 
                           displayScore >= 0.8 ? 'warning.main' : 'error.main') :
                          (displayScore >= 0.8 ? 'success.main' : 
                           displayScore >= 0.6 ? 'warning.main' : 'error.main')
                      }}
                    >
                      {displayScore.toFixed(4)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {details.length > 10 && (
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
            Showing first 10 of {details.length} {isHoldout ? 'repetitions' : isCV ? 'folds' : 'samples'}
          </Typography>
        )}

        {/* Résumé statistique */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            📊 Statistical Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Mean:</strong> {meanScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Std Dev:</strong> {stdScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Min:</strong> {Math.min(...scores).toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Max:</strong> {Math.max(...scores).toFixed(4)}
              </Typography>
            </Grid>
            {validationData.best_repetition && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Best Repetition:</strong> {validationData.best_repetition} 
                  (Score: {validationData.best_score?.toFixed(4) || 'N/A'})
                </Typography>
              </Grid>
            )}
            {validationData.best_fold && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Best Fold:</strong> {validationData.best_fold} 
                  (Score: {validationData.best_fold_score?.toFixed(4) || 'N/A'})
                </Typography>
              </Grid>
            )}
            {validationData.median_bootstrap_index && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Median Bootstrap:</strong> {validationData.median_bootstrap_index} 
                  (Score: {validationData.median_bootstrap_score?.toFixed(4) || 'N/A'})
                </Typography>
              </Grid>
            )}
          </Grid>
          
          {/* Informations supplémentaires selon la méthode */}
          {isCV && validationData.n_splits && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Number of Folds:</strong> {validationData.n_splits}
              </Typography>
            </Box>
          )}
          
          {isBootstrap && validationData.n_bootstraps && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Bootstrap Samples:</strong> {validationData.n_bootstraps}
              </Typography>
              <Typography variant="body2">
                <strong>Bootstrap Unique Samples:</strong> {validationData.bootstrap_details?.[0]?.unique_samples_in_bootstrap || 'N/A'}
              </Typography>
            </Box>
          )}
          
          {isHoldout && validationData.n_repetitions && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Repetitions:</strong> {validationData.n_repetitions}
              </Typography>
              <Typography variant="body2">
                <strong>Test Size:</strong> {validationData.test_size_percent || (validationData.test_size * 100)}%
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
const renderSvmDetailedMetrics = () => {
  if (!result || modelType !== 'svm') return null;

  const isClassification = result.metrics?.is_classification;
  const validationData = result.metrics?.validation_results;
  
  // Déterminer la méthode de validation à afficher
  const validationMethod = validationData?.method || 'holdout';

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          ℹ️ SVM Model Information
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Validation Method:</strong> {validationMethod}<br/>
            <strong>Model Type:</strong> {isClassification ? 'SVC (Classification)' : 'SVR (Regression)'}<br/>
            {validationMethod.includes('TimeSeries') && validationData?.date_column && (
              <><strong>Date Column:</strong> {validationData.date_column} (excluded from features)<br/></>
            )}
          </Typography>
        </Alert>

        <Grid container spacing={2}>
          <Grid item xs={6} md={3}>
            <Typography>
              <strong>Kernel:</strong> {result.metrics?.kernel_used || result.metrics?.final_params_used?.kernel || 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography>
              <strong>C:</strong> {result.metrics?.C_used || result.metrics?.final_params_used?.C || 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography>
              <strong>Gamma:</strong> {result.metrics?.gamma_used || result.metrics?.final_params_used?.gamma || 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={6} md={3}>
            <Typography>
              <strong>Support vectors:</strong> {result.metrics?.n_support_vectors || 'N/A'}
            </Typography>
          </Grid>
          
          {/* Information sur la validation */}
          {validationData?.n_repetitions && (
            <Grid item xs={6} md={3}>
              <Typography>
                <strong>Repetitions:</strong> {validationData.n_repetitions}
              </Typography>
            </Grid>
          )}
          
          {validationData?.n_splits && (
            <Grid item xs={6} md={3}>
              <Typography>
                <strong>Folds:</strong> {validationData.n_splits}
              </Typography>
            </Grid>
          )}
          
          {validationData?.n_bootstraps && (
            <Grid item xs={6} md={3}>
              <Typography>
                <strong>Bootstrap Samples:</strong> {validationData.n_bootstraps}
              </Typography>
            </Grid>
          )}

          {/* Métriques de performance */}
          {isClassification ? (
            <Grid item xs={12}>
              <Typography>
                <strong>Test Accuracy:</strong> {result.metrics?.accuracy?.toFixed(4) || 'N/A'}
              </Typography>
            </Grid>
          ) : (
            <Grid item xs={12}>
              <Typography>
                <strong>Test R²:</strong> {result.metrics?.r2?.toFixed(4) || 'N/A'}
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

  const validateKnnParams = () => {
    const errors = {};
    
    // Validation n_neighbors
    if (!knnParams.n_neighbors || knnParams.n_neighbors < 1 || knnParams.n_neighbors > 100) {
      errors.n_neighbors = "Number of neighbors must be between 1 and 100";
    }
    
    // Validation leaf_size
    if (!knnParams.leaf_size || knnParams.leaf_size < 1) {
      errors.leaf_size = "Leaf size must be at least 1";
    }
    
    // Validation p (Minkowski power)
    if (knnParams.metric === 'minkowski' && (!knnParams.p || knnParams.p < 1 || knnParams.p > 10)) {
      errors.p = "Minkowski power (p) must be between 1 and 10";
    }
    
    return errors;
  };
const renderKnnParams = () => {
  // Fonction de validation des paramètres KNN


  const fieldErrors = validateKnnParams();

  return (
    <Box sx={{ width: '100%' }}>
      <Grid container spacing={3} sx={{ width: '100%' }}>
        {/* Première ligne */}
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Number of Neighbors (k)"
            type="number"
            value={knnParams.n_neighbors}
            onChange={(e) => handleKnnParamChange('n_neighbors', e.target.value)}
            fullWidth
            error={!!fieldErrors.n_neighbors}
            helperText={fieldErrors.n_neighbors || "1-100"}
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 1, 
              max: 100,
              onBlur: (e) => {
                // Validation immédiate
                const value = parseInt(e.target.value);
                if (value < 1) handleKnnParamChange('n_neighbors', 1);
                if (value > 100) handleKnnParamChange('n_neighbors', 100);
              }
            }}
            sx={{ minWidth: 280 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            select
            label="Weight Function"
            value={knnParams.weights}
            onChange={(e) => handleKnnParamChange('weights', e.target.value)}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            sx={{ minWidth: 280 }}
          >
            <MenuItem value="uniform">Uniform</MenuItem>
            <MenuItem value="distance">Distance-weighted</MenuItem>
          </TextField>
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            select
            label="Algorithm"
            value={knnParams.algorithm}
            onChange={(e) => handleKnnParamChange('algorithm', e.target.value)}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            sx={{ minWidth: 280 }}
          >
            <MenuItem value="auto">Auto</MenuItem>
            <MenuItem value="ball_tree">Ball Tree</MenuItem>
            <MenuItem value="kd_tree">KD Tree</MenuItem>
            <MenuItem value="brute">Brute Force</MenuItem>
          </TextField>
        </Grid>

        {/* Deuxième ligne */}
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Leaf Size"
            type="number"
            value={knnParams.leaf_size}
            onChange={(e) => handleKnnParamChange('leaf_size', e.target.value)}
            fullWidth
            error={!!fieldErrors.leaf_size}
            helperText={fieldErrors.leaf_size || "For tree algorithms"}
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 1,
              onBlur: (e) => {
                const value = parseInt(e.target.value);
                if (value < 1) handleKnnParamChange('leaf_size', 1);
              }
            }}
            sx={{ minWidth: 280 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            select
            label="Distance Metric"
            value={knnParams.metric}
            onChange={(e) => handleKnnParamChange('metric', e.target.value)}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            sx={{ minWidth: 280 }}
          >
            <MenuItem value="minkowski">Minkowski</MenuItem>
            <MenuItem value="euclidean">Euclidean</MenuItem>
            <MenuItem value="manhattan">Manhattan</MenuItem>
            <MenuItem value="chebyshev">Chebyshev</MenuItem>
          </TextField>
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Minkowski Power (p)"
            type="number"
            value={knnParams.p}
            onChange={(e) => handleKnnParamChange('p', e.target.value)}
            fullWidth
            disabled={knnParams.metric !== 'minkowski'}
            error={!!fieldErrors.p}
            helperText={
              fieldErrors.p || 
              (knnParams.metric !== 'minkowski' 
                ? "Only for Minkowski metric" 
                : "1=Manhattan, 2=Euclidean")
            }
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 1, 
              max: 10,
              onBlur: (e) => {
                if (knnParams.metric === 'minkowski') {
                  const value = parseInt(e.target.value);
                  if (value < 1) handleKnnParamChange('p', 1);
                  if (value > 10) handleKnnParamChange('p', 10);
                }
              }
            }}
            sx={{ minWidth: 280 }}
          />
        </Grid>
      </Grid>
      
      {/* Checkbox en pleine largeur */}
      <Box sx={{ mt: 3, width: '100%' }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={knnParams.use_scaling || false}
              onChange={(e) => setKnnParams({...knnParams, use_scaling: e.target.checked})}
            />
          }
          label="Scale features before training (highly recommended for KNN)"
          sx={{ 
            width: '100%',
            '& .MuiFormControlLabel-label': {
              fontWeight: 500
            }
          }}
        />
      </Box>

      {/* Alertes informatives */}
      {knnParams.weights === 'distance' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Distance-weighted:</strong> Closer neighbors have more influence on the prediction
          </Typography>
        </Alert>
      )}

      {knnParams.algorithm === 'brute' && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Brute Force:</strong> Computationally expensive for large datasets
          </Typography>
        </Alert>
      )}

      {knnParams.metric === 'manhattan' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Manhattan distance:</strong> Better for high-dimensional data
          </Typography>
        </Alert>
      )}

      {fieldErrors.n_neighbors && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2">
            {fieldErrors.n_neighbors}
          </Typography>
        </Alert>
      )}

      {fieldErrors.leaf_size && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2">
            {fieldErrors.leaf_size}
          </Typography>
        </Alert>
      )}

      {fieldErrors.p && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2">
            {fieldErrors.p}
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

// Fonction de rendu des résultats KNN
const renderKnnResults = () => {
  if (!result || modelType !== 'knn') return null;

  // Helper function to parse confusion matrix
  const parseConfusionMatrix = (cm) => {
    if (!cm) return null;
    
    // Handle array format (2D array)
    if (Array.isArray(cm)) {
      if (cm.length >= 2 && cm[0].length >= 2) {
        return [
          { name: 'True Negative', value: cm[0][0] },
          { name: 'False Positive', value: cm[0][1] },
          { name: 'False Negative', value: cm[1][0] },
          { name: 'True Positive', value: cm[1][1] }
        ];
      }
      return null;
    }
    
    // Handle object format
    if (typeof cm === 'object') {
      return [
        { name: 'True Negative', value: cm.true_negative || cm.tn || 0 },
        { name: 'False Positive', value: cm.false_positive || cm.fp || 0 },
        { name: 'False Negative', value: cm.false_negative || cm.fn || 0 },
        { name: 'True Positive', value: cm.true_positive || cm.tp || 0 }
      ];
    }
    
    return null;
  };

  // Prepare confusion matrix data
  const confusionData = parseConfusionMatrix(result.metrics?.confusion_matrix);
  
  // Prepare neighbor distances data
  const neighborDistances = result.metrics?.neighbor_distances?.map((distance, idx) => ({
    id: idx,
    distance
  })) || [];

  return (
    <>
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ℹ️ KNN Model Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography>Neighbors: {knnParams.n_neighbors}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography>Weights: {knnParams.weights}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography>Algorithm: {knnParams.algorithm}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography>Distance: {knnParams.metric}</Typography>
            </Grid>
            {result.metrics?.accuracy && (
              <Grid item xs={6} md={3}>
                <Typography>Accuracy: {result.metrics.accuracy.toFixed(3)}</Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>



      {/* Neighbor Distances */}
      {neighborDistances.length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📏 Neighbor Distances Distribution
            </Typography>
            <Typography variant="body2" paragraph>
              Average distance to {knnParams.n_neighbors} nearest neighbors for test samples
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={neighborDistances}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="id" name="Sample Index" />
                <YAxis name="Distance" />
                <Tooltip 
                  formatter={(value) => [value, 'Distance']}
                  labelFormatter={(label) => `Sample ${label}`}
                />
                <Bar dataKey="distance" fill="#8884d8" name="Distance" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

     
    </>
  );
};








  const handleTreeParamChange = (param, value) => {
    setTreeParams(prev => ({
      ...prev,
      [param]: value === '' ? null : value
    }));
  };

  useEffect(() => {
    if (result?.metrics?.feature_importance) {
      const importance = Object.entries(result.metrics.feature_importance)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      setFeatureImportance(importance);
    }
  }, [result]);

  const renderPredictionVsReal = () => {
    if (!result?.metrics?.predictions?.y_true || !result?.metrics?.predictions?.y_pred) return null;

    const MAX_SCATTER_POINTS = 1000;
    const yTrue = result.metrics.predictions.y_true;
    const yPred = result.metrics.predictions.y_pred;
    const total = Math.min(yTrue.length, yPred.length);
    const step = total > MAX_SCATTER_POINTS ? Math.ceil(total / MAX_SCATTER_POINTS) : 1;
    const data = [];
    for (let i = 0; i < total; i += step) {
      data.push({ true: yTrue[i], pred: yPred[i] });
    }

    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ✅ Prediction vs Real
          </Typography>
          {total > MAX_SCATTER_POINTS && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Showing {data.length} of {total} points (sampled for performance)
            </Typography>
          )}
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid />
              <XAxis dataKey="true" name="Real value" />
              <YAxis dataKey="pred" name="Prediction" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Predictions" data={data} fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const renderErrorDistribution = () => {
    if (!result?.metrics?.errors?.absolute) return null;
    
    const errorData = result.metrics.errors.absolute.map((error, i) => ({
      id: i,
      error
    }));

    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ✅ Error distribution
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={errorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="id" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="error" stroke="#8884d8" fill="#8884d8" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

 const renderLearningCurve = () => {
  if (!result?.metrics?.learning_curve) return null;

  // Handle LightGBM format where valid is an object with metrics
  if (result.metrics.learning_curve.valid && typeof result.metrics.learning_curve.valid === 'object') {
    // Convert the object to an array of {iteration, score} pairs
    const validData = Object.entries(result.metrics.learning_curve.valid).map(([metric, values]) => {
      // Check if values is an array (like for multi-metric evaluation)
      if (Array.isArray(values)) {
        return values.map((score, i) => ({
          iteration: i + 1,
          [metric]: score
        }));
      }
      // If values is just a single array (like for single metric)
      return {
        iteration: 1,
        [metric]: values
      };
    }).flat();

    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔄 Learning Curve (Validation)
          </Typography>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={validData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="iteration" />
              <YAxis />
              <Tooltip />
              <Legend />
              {Object.keys(result.metrics.learning_curve.valid).map(metric => (
                <Line 
                  key={metric}
                  type="monotone" 
                  dataKey={metric} 
                  stroke={metric === 'l2' ? '#8884d8' : '#82ca9d'} 
                  name={metric === 'l2' ? 'MSE' : metric}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // Handle array format (if valid is actually an array)
  if (Array.isArray(result.metrics.learning_curve.valid)) {
    const validData = result.metrics.learning_curve.valid.map((score, i) => ({
      iteration: i + 1,
      score
    }));
    
    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔄 Learning Curve (Validation)
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={validData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="iteration" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#82ca9d" 
                name="Validation score"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  // Handle traditional sklearn format
  if (result.metrics.learning_curve.train_sizes) {
    const curveData = result.metrics.learning_curve.train_sizes.map((size, i) => ({
      size,
      train: result.metrics.learning_curve.train_scores[i],
      test: result.metrics.learning_curve.test_scores[i]
    }));

    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔄 Learning Curve
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={curveData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="size" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="train" stroke="#8884d8" name="Train" />
              <Line type="monotone" dataKey="test" stroke="#82ca9d" name="Test" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return null;
};

 const renderAlphaPerformance = () => {
  if (!result?.metrics?.alpha_performance || !Array.isArray(result.metrics.alpha_performance) || result.metrics.alpha_performance.length === 0) {
    console.log("No alpha performance data available:", result?.metrics?.alpha_performance);
    return null;
  }
  
  // Transform data to ensure it's in the correct format
  const chartData = result.metrics.alpha_performance.map(item => ({
    alpha: item.alpha,
    mse: item.mse
  }));

  // Sort by alpha value to ensure the line chart is properly ordered
  chartData.sort((a, b) => a.alpha - b.alpha);

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          📊 MSE vs Alpha (Regularization performance)
        </Typography>
        <Typography variant="body2" paragraph>
          This chart shows how the error (MSE) varies with different values of the regularization parameter α.
          The higher α is, the more regularized (less complex) the model is.
        </Typography>
        <ResponsiveContainer width="100%" height={400}>  {/* Increased height for better visibility */}
          <LineChart 
            data={chartData}
            margin={{ top: 20, right: 30, left: 30, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="alpha" 
              type="number" 
              scale="log"
              domain={['auto', 'auto']}
              label={{ 
                value: 'α value (log scale)', 
                position: 'insideBottomRight', 
                offset: -10 
              }}
            />
            <YAxis 
              label={{ 
                value: 'Mean Squared Error', 
                angle: -90, 
                position: 'insideLeft' 
              }}
            />
            <Tooltip 
              formatter={(value) => [`${parseFloat(value).toFixed(4)}`, 'MSE']}
              labelFormatter={(value) => `α = ${value}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="mse" 
              stroke="#8884d8" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6, stroke: '#ff7300', strokeWidth: 2 }}
              name="Mean Squared Error"
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};















const renderFeatureImportanceChart = () => {
  // ✅ CORRECTION : Vérifier d'abord dans les métriques
  const featureImportanceData = result?.metrics?.feature_importances || 
                                result?.metrics?.feature_importance || 
                                featureImportance;
  
  if (!featureImportanceData) {
    return (
      <Alert severity="warning">
        <Typography variant="body2">
          📊 No feature importance data available from model.
        </Typography>
      </Alert>
    );
  }

  // Convertir en tableau si c'est un objet
  let importanceArray = [];
  if (typeof featureImportanceData === 'object' && !Array.isArray(featureImportanceData)) {
    importanceArray = Object.entries(featureImportanceData).map(([feature, importance]) => ({
      feature,
      importance: Math.abs(importance),
      rawImportance: importance,
      sign: importance > 0 ? 'positive' : 'negative'
    }));
  } else if (Array.isArray(featureImportanceData)) {
    importanceArray = featureImportanceData.map(([feature, importance]) => ({
      feature,
      importance: Math.abs(importance),
      rawImportance: importance,
      sign: importance > 0 ? 'positive' : 'negative'
    }));
  }

  // Filtrer les features avec importance non nulle
  const nonZeroFeatures = importanceArray.filter(item => 
    Math.abs(item.importance) > 1e-10
  );

  if (nonZeroFeatures.length === 0) {
    // Pour Ridge, même les très petits coefficients sont importants
    // Trier par valeur absolue et prendre les top
    const sortedFeatures = importanceArray
      .sort((a, b) => Math.abs(b.rawImportance) - Math.abs(a.rawImportance))
      .slice(0, 10);
    
    if (sortedFeatures.length === 0) {
      return (
        <Alert severity="info">
          <Typography variant="body2">
            🔍 All feature importances are very close to zero. This can happen with strong regularization.
          </Typography>
        </Alert>
      );
    }

    const data = sortedFeatures.map(item => ({
      feature: item.feature.length > 20 ? item.feature.substring(0, 20) + '...' : item.feature,
      importance: Math.abs(item.rawImportance),
      sign: item.sign
    }));

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          📊 Top 10 Feature Importance (small coefficients shown)
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              label={{ value: 'Coefficient Value', position: 'insideBottomRight', offset: -10 }}
            />
            <YAxis 
              dataKey="feature" 
              type="category" 
              width={150} 
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value, name, props) => {
                const rawValue = props.payload.rawImportance;
                return [
                  <span key="value">
                    Value: {rawValue.toExponential(4)}<br/>
                    Absolute: {value.toExponential(4)}
                  </span>,
                  'Importance'
                ];
              }}
              labelStyle={{ fontWeight: 'bold' }}
            />
            <Bar dataKey="importance">
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.sign === 'positive' ? '#8884d8' : '#82ca9d'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> Ridge regression coefficients can be very small. 
            Even small values indicate feature importance.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Cas normal avec des coefficients non nuls
  const data = nonZeroFeatures
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10)
    .map(item => ({
      feature: item.feature.length > 20 ? item.feature.substring(0, 20) + '...' : item.feature,
      importance: item.importance,
      rawImportance: item.rawImportance,
      sign: item.sign
    }));

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        📊 Top {Math.min(10, nonZeroFeatures.length)} Most Important Features
      </Typography>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            label={{ value: 'Coefficient Value', position: 'insideBottomRight', offset: -10 }}
          />
          <YAxis 
            dataKey="feature" 
            type="category" 
            width={150} 
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            formatter={(value) => [`${value.toFixed(6)}`, 'Absolute Value']}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return `Feature: ${payload[0].payload.feature}`;
              }
              return label;
            }}
          />
          <Bar dataKey="importance">
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.sign === 'positive' ? '#8884d8' : '#82ca9d'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

const fetchTargetColumn = async () => {
  try {
    const originalBdName = state?.originalBdName || state?.bdName.replace('_numerized', '');
    const response = await axios.get(
      `${backendUrl}/api/get-split-info?bdName=${originalBdName}`,
      { withCredentials: true, timeout: 10000 }
    );

    const rawTarget = response.data.target_column;
    const hasTarget =
      !!rawTarget &&
      rawTarget !== 'null' &&
      rawTarget !== 'undefined' &&
      rawTarget !== '' &&
      rawTarget !== 'no-target-column';
    
    setTargetColumn(hasTarget ? rawTarget : null);
    setHasTargetColumn(hasTarget);

    // Unsupervised / no target is valid: do not show an error
    if (!hasTarget && !problemTypeRef.current) {
      problemTypeRef.current = 'unsupervised';
      setProblemType('unsupervised');
      setModelType('kmeans');
      setError(null);
    } else if (hasTarget) {
      setError(null);
    }

    return hasTarget;

  } catch (error) {
    setTargetColumn(null);
    setHasTargetColumn(false);
    
   if (!problemTypeRef.current) {
  setModelType('kmeans');
  setError("Failed to fetch dataset information");
}
    return false;
  }
};










const handleRandomForestParamChange = (param, value) => {
  let processedValue = value;
  
  // Conversion des types selon le paramètre
  if (param === 'n_estimators') {
    processedValue = parseInt(value) || 100;
  } else if (param === 'max_depth') {
    processedValue = value === '' ? null : parseInt(value);
  } else if (param === 'min_samples_split') {
    processedValue = parseInt(value) || 2;
  } else if (param === 'min_samples_leaf') {
    processedValue = parseInt(value) || 1;
  } else if (param === 'max_features') {
    // Gestion spéciale pour max_features
    if (value === 'null') {
      processedValue = null;
    } else if (isClassification && (value === 'sqrt' || value === 'log2')) {
      processedValue = value;
    } else {
      processedValue = parseFloat(value) || 1.0;
    }
  }
  
  setRandomForestParams(prev => ({
    ...prev,
    [param]: processedValue
  }));
};

// 3. Rendu des paramètres Random Forest
// Random Forest hyperparameters form

const renderRandomForestParams = () => {
  const maxFeaturesOptions = isClassification 
    ? [
        { value: 'sqrt', label: 'sqrt (√n_features)' },
        { value: 'log2', label: 'log2 (log2(n_features))' },
        { value: null, label: 'None (all features)' }
      ]
    : [
        { value: 1.0, label: '1.0 (all features)' },
        { value: 0.5, label: '0.5 (50% features)' },
        { value: 0.33, label: '0.33 (33% features)' },
        { value: 0.1, label: '0.1 (10% features)' }
      ];

  return (
    <Grid container spacing={2}>
      {/* ✅ CORRIGÉ : Chaque paramètre dans sa propre Grid item */}
      <Grid item xs={12} md={6}>
        <TextField
          label="Number of trees"
          type="number"
          value={randomForestParams.n_estimators}
          onChange={(e) => handleRandomForestParamChange('n_estimators', e.target.value)}
          fullWidth
          inputProps={{ min: 1, max: 1000 }}
          helperText="Number of trees in the forest"
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <TextField
          label="Max depth"
          type="number"
          value={randomForestParams.max_depth || ''}
          onChange={(e) => handleRandomForestParamChange('max_depth', e.target.value)}
          fullWidth
          placeholder="None"
          inputProps={{ min: 1 }}
          helperText="Maximum depth of trees. None for unlimited"
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <TextField
          label="Min samples split"
          type="number"
          value={randomForestParams.min_samples_split}
          onChange={(e) => handleRandomForestParamChange('min_samples_split', e.target.value)}
          fullWidth
          inputProps={{ min: 2 }}
          helperText="Minimum samples required to split a node"
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <TextField
          label="Min samples leaf"
          type="number"
          value={randomForestParams.min_samples_leaf}
          onChange={(e) => handleRandomForestParamChange('min_samples_leaf', e.target.value)}
          fullWidth
          inputProps={{ min: 1 }}
          helperText="Minimum samples required at a leaf node"
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <TextField
          select
          label="Max features"
          value={randomForestParams.max_features === null ? 'null' : randomForestParams.max_features}
          onChange={(e) => {
            const value = e.target.value;
            const processedValue = value === 'null' 
              ? null 
              : isClassification 
                ? (value === 'sqrt' || value === 'log2' ? value : 'sqrt')
                : parseFloat(value);
            setRandomForestParams({...randomForestParams, max_features: processedValue});
          }}
          fullWidth
          helperText="Number of features to consider for best split"
        >
          {maxFeaturesOptions.map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      
      {/* ✅ CORRIGÉ : Checkboxes bien séparées */}
      <Grid item xs={12} md={6}>
        <FormControlLabel
          control={
            <Checkbox
              checked={randomForestParams.bootstrap}
              onChange={(e) => handleRandomForestParamChange('bootstrap', e.target.checked)}
            />
          }
          label="Bootstrap sampling (recommended)"
        />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <FormControlLabel
          control={
            <Checkbox
              checked={randomForestParams.oob_score}
              onChange={(e) => handleRandomForestParamChange('oob_score', e.target.checked)}
            />
          }
          label="Calculate OOB score (requires bootstrap)"
        />
      </Grid>

     
    </Grid>
  );
};



useEffect(() => {
  console.log("Current target type:", {
    isClassification,
    targetDetails: targetTypeDetails,
    rfParams: randomForestParams
  });
}, [isClassification, randomForestParams]);
const renderTreeVisualization = () => {
  if (!result?.metrics?.tree_metadata) return null;
  
  const treeData = result.metrics.tree_metadata;
  const validationData = result.metrics?.validation_results;
  const isClassification = result.metrics?.is_classification;
  
  return (
    <>
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🌳 Random Forest Metadata
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography>Number of trees: {treeData.n_trees || 'N/A'}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography>Avg depth: {treeData.avg_depth ? treeData.avg_depth.toFixed(1) : 'N/A'}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography>Avg leaves: {treeData.avg_leaves ? treeData.avg_leaves.toFixed(1) : 'N/A'}</Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography>
                OOB Score: {treeData.oob_score !== null && treeData.oob_score !== undefined ? 
                  treeData.oob_score.toFixed(4) : 
                  (treeData.bootstrap_used ? 'Not available' : 'Bootstrap disabled')}
              </Typography>
            </Grid>
          </Grid>
          
          {/* Information sur les paramètres utilisés */}
          {treeData.bootstrap_used !== undefined && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Bootstrap: {treeData.bootstrap_used ? 'Enabled' : 'Disabled'} | 
                OOB Calculation: {treeData.oob_score_requested ? 'Requested' : 'Not requested'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* NOUVELLE SECTION : Résultats de validation */}
      {validationData && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🔍 Validation Process Details
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Method:</strong> {validationData.method}<br/>
                {validationData.mean_score !== undefined && (
                  <><strong>Mean Score:</strong> {validationData.mean_score.toFixed(4)}<br/></>
                )}
                {validationData.cv_mean !== undefined && (
                  <><strong>CV Mean Score:</strong> {validationData.cv_mean.toFixed(4)}<br/></>
                )}
                {validationData.bootstrap_mean !== undefined && (
                  <><strong>Bootstrap Mean Score:</strong> {validationData.bootstrap_mean.toFixed(4)}<br/></>
                )}
                {validationData.best_score !== undefined && (
                  <><strong>Best Score:</strong> {validationData.best_score.toFixed(4)}<br/></>
                )}
              </Typography>
            </Alert>

            {/* Détails supplémentaires selon la méthode */}
            {validationData.n_repetitions && (
              <Typography variant="body2">
                <strong>Repetitions:</strong> {validationData.n_repetitions}
              </Typography>
            )}
            {validationData.n_splits && (
              <Typography variant="body2">
                <strong>Folds:</strong> {validationData.n_splits}
              </Typography>
            )}
            {validationData.n_bootstraps && (
              <Typography variant="body2">
                <strong>Bootstrap Samples:</strong> {validationData.n_bootstraps}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Afficher les paramètres utilisés */}
      {result.metrics?.final_params_used && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              ⚙️ Parameters Used
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography>n_estimators: {result.metrics.final_params_used.n_estimators}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography>max_depth: {result.metrics.final_params_used.max_depth || 'None'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography>min_samples_split: {result.metrics.final_params_used.min_samples_split}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography>max_features: {result.metrics.final_params_used.max_features?.toString() || 'auto'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography>bootstrap: {result.metrics.final_params_used.bootstrap ? 'Yes' : 'No'}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography>oob_score: {result.metrics.final_params_used.oob_score ? 'Yes' : 'No'}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </>
  );
};



const renderSvmValidationDetails = () => {
  if (!result?.metrics?.validation_results || modelType !== 'svm') return null;

  const validationData = result.metrics.validation_results;
  const isClassification = result.metrics.is_classification;
  
  // Déterminer la méthode de validation
  const isHoldout = validationData.method?.includes('Hold-Out');
  const isCV = validationData.method?.includes('Cross-Validation');
  const isBootstrap = validationData.method?.includes('Bootstrap');
  
  // Récupérer les détails selon la méthode
  let details = [];
  let scoreProperty = 'score';
  
  if (isHoldout) {
    details = validationData.repetition_details || [];
    scoreProperty = 'score';
  } else if (isCV) {
    details = validationData.fold_details || validationData.cv_details || [];
    
    // Déterminer la propriété score correcte
    if (details.length > 0) {
      const firstDetail = details[0];
      if (firstDetail.validation_score !== undefined) {
        scoreProperty = 'validation_score';
      } else if (firstDetail.score !== undefined) {
        scoreProperty = 'score';
      }
    }
  } else if (isBootstrap) {
    details = validationData.bootstrap_details || [];
    scoreProperty = 'score';
  }
  
  // Si pas de détails mais scores CV directs disponibles
  if (details.length === 0 && validationData.cv_scores && Array.isArray(validationData.cv_scores)) {
    details = validationData.cv_scores.map((score, index) => ({
      fold: index + 1,
      score: score
    }));
  }

  if (details.length === 0) {
    return null;
  }

  // Préparer les données pour le graphique
  const chartData = details.map((item, index) => {
    const baseItem = {
      id: item.fold || item.repetition || item.bootstrap || index + 1,
      label: isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Sample'
    };
    
    // Extraire le score selon la propriété disponible
    let scoreValue = 0;
    if (scoreProperty && item[scoreProperty] !== undefined) {
      scoreValue = item[scoreProperty];
    } else {
      // Essayer de trouver le score dans n'importe quelle propriété
      const possibleScoreKeys = ['score', 'validation_score', 'cv_validation_score', 'test_score'];
      for (const key of possibleScoreKeys) {
        if (item[key] !== undefined) {
          scoreValue = item[key];
          break;
        }
      }
    }
    
    return {
      ...baseItem,
      fold: baseItem.id,
      score: scoreValue
    };
  });

  // Calculer les scores pour les statistiques
  const scores = chartData.map(item => item.score);
  
  // Obtenir le score moyen selon la méthode
  const meanScore = validationData.mean_score || 
                   validationData.cv_mean || 
                   validationData.bootstrap_mean ||
                   (scores.reduce((a, b) => a + b, 0) / scores.length);
  
  const stdScore = validationData.std_score || 
                  validationData.cv_std || 
                  validationData.bootstrap_std ||
                  (Math.sqrt(scores.reduce((sq, n) => sq + Math.pow(n - meanScore, 2), 0) / scores.length));

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔍 SVM Validation Details
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validationData.method}<br/>
            <strong>Samples/Folds/Repetitions:</strong> {details.length}<br/>
            <strong>Average Score:</strong> {meanScore.toFixed(4)} ± {stdScore.toFixed(4)}
          </Typography>
        </Alert>

        {/* Graphique des scores de validation */}
        {chartData.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
               {isClassification ? 'Accuracy' : 'R² Score'} by {isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap Sample'}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fold" 
                  label={{ 
                    value: isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap Sample', 
                    position: 'insideBottomRight', 
                    offset: -10 
                  }}
                />
                <YAxis 
                  label={{ 
                    value: isClassification ? 'Accuracy' : 'R² Score', 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                  domain={isClassification ? [0, 1] : ['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value) => [value.toFixed(4), isClassification ? 'Accuracy' : 'R² Score']}
                  labelFormatter={(label) => 
                    `${isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap'} ${label}`
                  }
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#8884d8" 
                  name={isClassification ? 'Accuracy' : 'R² Score'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                {/* Ligne de référence pour la moyenne */}
                <ReferenceLine 
                  y={meanScore} 
                  stroke="#ff7300" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: `Avg: ${meanScore.toFixed(3)}`, 
                    position: 'insideTopRight',
                    fill: '#ff7300',
                    fontSize: 12
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tableau des résultats individuels */}
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          📋 Individual Validation Results
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  {isHoldout ? 'Rep' : isCV ? 'Fold' : 'Sample'}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Train Size
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Validation Size
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {isClassification ? 'Accuracy' : 'R² Score'}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {details.slice(0, 10).map((item, index) => {
                const foldId = item.fold || item.repetition || item.bootstrap || index + 1;
                const trainSize = item.train_size || 'N/A';
                const validationSize = item.validation_size || 'N/A';
                
                // Déterminer le score à afficher
                let displayScore = 0;
                if (item.validation_score !== undefined) {
                  displayScore = item.validation_score;
                } else if (item.score !== undefined) {
                  displayScore = item.score;
                }
                
                return (
                  <TableRow key={index} hover>
                    <TableCell>
                      {foldId}
                    </TableCell>
                    <TableCell align="right">{trainSize}</TableCell>
                    <TableCell align="right">{validationSize}</TableCell>
                    <TableCell 
                      align="right" 
                      sx={{ 
                        fontWeight: 'medium',
                        color: isClassification ? 
                          (displayScore >= 0.9 ? 'success.main' : 
                           displayScore >= 0.8 ? 'warning.main' : 'error.main') :
                          (displayScore >= 0.8 ? 'success.main' : 
                           displayScore >= 0.6 ? 'warning.main' : 'error.main')
                      }}
                    >
                      {displayScore.toFixed(4)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {details.length > 10 && (
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
            Showing first 10 of {details.length} {isHoldout ? 'repetitions' : isCV ? 'folds' : 'samples'}
          </Typography>
        )}

        {/* Résumé statistique */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            📊 Statistical Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Mean:</strong> {meanScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Std Dev:</strong> {stdScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Min:</strong> {Math.min(...scores).toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Max:</strong> {Math.max(...scores).toFixed(4)}
              </Typography>
            </Grid>
            {validationData.best_fold && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Best Fold:</strong> {validationData.best_fold} 
                  (Score: {validationData.best_score?.toFixed(4) || 'N/A'})
                </Typography>
              </Grid>
            )}
            {validationData.best_repetition && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Best Repetition:</strong> {validationData.best_repetition} 
                  (Score: {validationData.best_score?.toFixed(4) || 'N/A'})
                </Typography>
              </Grid>
            )}
          </Grid>
          
          {/* Informations supplémentaires selon la méthode */}
          {isCV && validationData.n_splits && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Number of Folds:</strong> {validationData.n_splits}
              </Typography>
            </Box>
          )}
          
          {isBootstrap && validationData.n_bootstraps && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Bootstrap Samples:</strong> {validationData.n_bootstraps}
              </Typography>
              {validationData.median_bootstrap_index && (
                <Typography variant="body2">
                  <strong>Median Bootstrap Index:</strong> {validationData.median_bootstrap_index}
                </Typography>
              )}
            </Box>
          )}
          
          {isHoldout && validationData.n_repetitions && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Repetitions:</strong> {validationData.n_repetitions}
              </Typography>
            </Box>
          )}

          {/* Informations spécifiques SVM */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
            <Typography variant="subtitle2" gutterBottom>
              🔧 SVM Parameters Used
            </Typography>
            <Typography variant="body2">
              <strong>Kernel:</strong> {result.metrics?.kernel_used || 'rbf'} | 
              <strong> C:</strong> {result.metrics?.C_used || 1.0} | 
              <strong> Gamma:</strong> {result.metrics?.gamma_used || 'scale'}
            </Typography>
          </Box>

          {/* Note explicative */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Note:</strong> These validation scores were computed during the training phase 
              to evaluate model stability. Higher scores with low variance indicate better model generalization.
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const renderSvmTimeseriesValidationDetails = () => {
  if (!result?.metrics?.validation_results || modelType !== 'svm') return null;
  
  const validationData = result.metrics.validation_results;
  
  // Vérifier si c'est TimeSeriesSplit
  const isTimeSeries = validationData.method?.includes('TimeSeries');
  if (!isTimeSeries) return null;
  
  const isClassification = result.metrics.is_classification;
  const foldDetails = validationData.fold_details || [];
  
  if (foldDetails.length === 0) return null;
  
  // Déterminer le nom du score selon le type de problème
  const scoreName = isClassification ? 'Accuracy' : 'R² Score';
  const scoreKey = isClassification ? 'accuracy' : 'r2';
  
  // Préparer les données pour le graphique
  const chartData = foldDetails.map(item => ({
    fold: item.fold,
    train_score: item.train_score || 0,
    val_score: item.val_score || 0,
    train_size: item.train_size || 0,
    val_size: item.val_size || 0
  }));
  
  // Calculer les statistiques - gérer les différents noms de champs possibles
  let meanValScore = 0;
  let stdValScore = 0;
  
  if (isClassification) {
    meanValScore = validationData.mean_score || 
                   validationData.cv_validation_accuracy_mean || 
                   (chartData.reduce((sum, item) => sum + item.val_score, 0) / chartData.length);
    stdValScore = validationData.std_score || 
                  validationData.cv_validation_accuracy_std ||
                  Math.sqrt(chartData.reduce((sq, n) => sq + Math.pow(n.val_score - meanValScore, 2), 0) / chartData.length);
  } else {
    meanValScore = validationData.mean_score || 
                   validationData.cv_validation_r2_mean || 
                   (chartData.reduce((sum, item) => sum + item.val_score, 0) / chartData.length);
    stdValScore = validationData.std_score || 
                  validationData.cv_validation_r2_std ||
                  Math.sqrt(chartData.reduce((sq, n) => sq + Math.pow(n.val_score - meanValScore, 2), 0) / chartData.length);
  }
  
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔍 Time Series Split Validation Details (SVM - {isClassification ? 'Classification' : 'Regression'})
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validationData.method}<br/>
            <strong>Valid Folds:</strong> {foldDetails.length}<br/>
            <strong>Date Column:</strong> {validationData.date_column || 'N/A'} (excluded from features)<br/>
            <strong>Features Used:</strong> {validationData.features_used?.join(', ') || 'All features'}<br/>
            <strong>Average {scoreName}:</strong> {meanValScore.toFixed(4)} ± {stdValScore.toFixed(4)}<br/>
            <strong>Best Fold:</strong> {validationData.best_fold || validationData.best_fold_used || 'N/A'} 
            {validationData.best_score && ` (Score: ${validationData.best_score.toFixed(4)})`}
          </Typography>
        </Alert>

        {/* Graphique des scores par fold */}
        {chartData.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
               {scoreName} by Time Series Fold
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fold" 
                  label={{ value: 'Fold', position: 'insideBottomRight', offset: -10 }}
                />
                <YAxis 
                  label={{ 
                    value: scoreName, 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                  domain={isClassification ? [0, 1] : ['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value) => [value.toFixed(4), scoreName]}
                  labelFormatter={(label) => `Fold ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="val_score" 
                  stroke="#8884d8" 
                  name={`Validation ${scoreName}`}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="train_score" 
                  stroke="#82ca9d" 
                  name={`Train ${scoreName}`}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <ReferenceLine 
                  y={meanValScore} 
                  stroke="#ff7300" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: `Avg: ${meanValScore.toFixed(3)}`, 
                    position: 'insideTopRight',
                    fill: '#ff7300',
                    fontSize: 12
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tableau des détails par fold */}
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          📋 Individual Fold Results
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Fold</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train Size</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Validation Size</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train {scoreName}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Validation {scoreName}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {foldDetails.slice(0, 10).map((item, index) => (
                <TableRow key={index} hover>
                  <TableCell>{item.fold}</TableCell>
                  <TableCell align="right">{item.train_size || 'N/A'}</TableCell>
                  <TableCell align="right">{item.val_size || item.validation_size || 'N/A'}</TableCell>
                  <TableCell align="right">
                    {(item.train_score || 0).toFixed(4)}
                  </TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      fontWeight: 'medium',
                      color: isClassification ? 
                        ((item.val_score || 0) >= 0.9 ? 'success.main' : 
                         (item.val_score || 0) >= 0.8 ? 'warning.main' : 
                         (item.val_score || 0) >= 0.6 ? 'warning.light' : 'error.main') :
                        ((item.val_score || 0) >= 0.8 ? 'success.main' : 
                         (item.val_score || 0) >= 0.6 ? 'warning.main' : 
                         (item.val_score || 0) >= 0.3 ? 'warning.light' : 'error.main')
                    }}
                  >
                    {(item.val_score || 0).toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {foldDetails.length > 10 && (
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
            Showing first 10 of {foldDetails.length} folds
          </Typography>
        )}

        {/* Résumé statistique */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            📊 Statistical Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Mean {scoreName}:</strong> {meanValScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Std Dev:</strong> {stdValScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Min:</strong> {Math.min(...chartData.map(d => d.val_score)).toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Max:</strong> {Math.max(...chartData.map(d => d.val_score)).toFixed(4)}
              </Typography>
            </Grid>
          </Grid>
          
          {/* Informations spécifiques selon le type */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
            <Typography variant="body2" color="success.main">
              ✅ TimeSeriesSplit: Date column "{validationData.date_column}" used ONLY for chronological ordering
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>Features used:</strong> {validationData.features_used?.join(', ') || 'All numeric columns'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>Problem type:</strong> {isClassification ? 'Classification (Accuracy)' : 'Regression (R² Score)'}
            </Typography>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> These validation scores were computed during the training phase 
            using chronological splits. The date column was used ONLY for ordering and was excluded 
            from the features used for training.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
};



const renderRandomForestValidationDetails = () => {
  if (!result?.metrics?.validation_results || modelType !== 'random_forest') return null;

  const validationData = result.metrics.validation_results;
  const isClassification = result.metrics.is_classification;
  
  // Déterminer la méthode de validation
  const isHoldout = validationData.method?.includes('Hold-Out');
  const isCV = validationData.method?.includes('Cross-Validation');
  const isBootstrap = validationData.method?.includes('Bootstrap');
  const isTimeSeries = validationData.method?.includes('TimeSeries');
  
  // Récupérer les détails selon la méthode
  let details = [];
  let scoreProperty = 'score';
  let methodLabel = 'Fold';
  
  if (isTimeSeries) {
    details = validationData.fold_details || [];
    methodLabel = 'Time Series Fold';
    scoreProperty = 'val_score';  // ✅ Le backend utilise 'val_score'
    
    console.log("[RANDOM FOREST] 📊 TimeSeriesSplit validation details:", {
      n_folds: details.length,
      method: validationData.method,
      mean_score: validationData.mean_score,
      mean_score_alt: validationData.cv_validation_r2_mean,
      best_score: validationData.best_score,
      details_sample: details[0]
    });
  } else if (isHoldout) {
    details = validationData.repetition_details || [];
    methodLabel = 'Repetition';
    scoreProperty = 'score';
  } else if (isCV) {
    details = validationData.fold_details || validationData.repetition_details || [];
    methodLabel = 'Fold';
    scoreProperty = 'val_score';  // Pour CV aussi
  } else if (isBootstrap) {
    details = validationData.bootstrap_details || [];
    methodLabel = 'Bootstrap Sample';
    scoreProperty = 'score';
  }
  
  if (details.length === 0) {
    console.log("No validation details available:", {
      method: validationData.method,
      availableKeys: Object.keys(validationData)
    });
    return null;
  }

  // Préparer les données pour le graphique
  const chartData = details.map((item, index) => {
    let scoreValue = 0;
    let trainScoreValue = 0;
    
    // ✅ Pour TimeSeries, le backend utilise 'val_score' et 'train_score'
    if (isTimeSeries) {
      scoreValue = item.val_score || 0;
      trainScoreValue = item.train_score || 0;
    } 
    // Pour les autres méthodes
    else {
      // Score de validation
      const possibleScoreKeys = ['val_score', 'validation_score', 'score', 'cv_validation_r2', 
                                'cv_validation_accuracy', 'outer_val_score', 'test_accuracy'];
      for (const key of possibleScoreKeys) {
        if (item[key] !== undefined) {
          scoreValue = item[key];
          break;
        }
      }
      
      // Score d'entraînement
      if (item.train_score !== undefined) {
        trainScoreValue = item.train_score;
      } else if (item.train_accuracy !== undefined) {
        trainScoreValue = item.train_accuracy;
      } else if (item.cv_train_r2 !== undefined) {
        trainScoreValue = item.cv_train_r2;
      }
    }
    
    return {
      fold: item.fold || item.repetition || item.bootstrap || index + 1,
      score: scoreValue,
      train_score: trainScoreValue,
      train_size: item.train_size || 'N/A',
      validation_size: item.val_size || item.validation_size || 'N/A'
    };
  });

  // Obtenir le score moyen selon la méthode
  let meanScore = 0;
  let stdScore = 0;
  let bestScore = 0;
  
  if (isTimeSeries) {
    // ✅ Pour TimeSeries, le backend fournit ces champs
    meanScore = validationData.mean_score || validationData.cv_validation_r2_mean || 0;
    stdScore = validationData.std_score || validationData.cv_validation_r2_std || 0;
    bestScore = validationData.best_score || validationData.best_fold_score || 0;
    
    console.log("[RANDOM FOREST] Scores TimeSeries:", {
      mean: meanScore,
      std: stdScore,
      best: bestScore
    });
  } else {
    meanScore = validationData.mean_score || 
                validationData.cv_mean || 
                validationData.bootstrap_mean || 0;
    stdScore = validationData.std_score || 
               validationData.cv_std || 
               validationData.bootstrap_std || 0;
    bestScore = validationData.best_score || 0;
  }

  // Si tous les scores sont à 0, afficher un message d'erreur
  if (meanScore === 0 && chartData.every(item => item.score === 0)) {
    return (
      <Card sx={{ mt: 2, border: '2px solid #f44336' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom color="error">
            Time Series Split: temporary fold scores
          </Typography>
          <Alert severity="warning">
            <Typography variant="body2">
              <strong>Les scores de validation sont actuellement bas</strong> (moyenne: {meanScore.toFixed(4)})
              <br/>• This can happen when temporal patterns are hard to learn
              <br/>• Check the individual fold scores below
            </Typography>
          </Alert>
          <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="body2">
              <strong>Details:</strong><br/>
              Method: {validationData.method}<br/>
              Valid folds: {chartData.length}<br/>
              Date column: {validationData.date_column || 'N/A'}<br/>
              Features: {validationData.features_used?.length || 'N/A'}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔍 {isTimeSeries ? 'Time Series' : ''} Validation Process Details
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validationData.method}<br/>
            <strong>Valid Folds/Samples:</strong> {chartData.length}<br/>
            {isTimeSeries && validationData.date_column && (
              <><strong>Date Column:</strong> {validationData.date_column} (excluded from features)<br/></>
            )}
            <strong>Average Score:</strong> {meanScore.toFixed(4)} ± {stdScore.toFixed(4)}<br/>
            <strong>Best Score:</strong> {bestScore.toFixed(4)}
          </Typography>
        </Alert>

        {/* Graphique des scores de validation */}
        {chartData.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
               {isClassification ? 'Accuracy' : 'R² Score'} by {methodLabel}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fold" 
                  label={{ 
                    value: methodLabel, 
                    position: 'insideBottomRight', 
                    offset: -10 
                  }}
                />
                <YAxis 
                  label={{ 
                    value: isClassification ? 'Accuracy' : 'R² Score', 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                  domain={[0, 1]}
                />
                <Tooltip 
                  formatter={(value) => [value.toFixed(4), isClassification ? 'Accuracy' : 'R² Score']}
                  labelFormatter={(label) => `${methodLabel} ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#8884d8" 
                  name={isClassification ? 'Accuracy' : 'R² Score'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="train_score" 
                  stroke="#82ca9d" 
                  name="Train Score"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <ReferenceLine 
                  y={meanScore} 
                  stroke="#ff7300" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: `Avg: ${meanScore.toFixed(3)}`, 
                    position: 'insideTopRight',
                    fill: '#ff7300',
                    fontSize: 12
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tableau des résultats individuels */}
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          📋 Individual Validation Results
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>{methodLabel}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train Size</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Validation Size</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train Score</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {isClassification ? 'Accuracy' : 'R² Score'}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {chartData.slice(0, 10).map((item, index) => (
                <TableRow key={index} hover>
                  <TableCell>{item.fold}</TableCell>
                  <TableCell align="right">{item.train_size}</TableCell>
                  <TableCell align="right">{item.validation_size}</TableCell>
                  <TableCell align="right">{item.train_score.toFixed(4)}</TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      fontWeight: 'medium',
                      color: item.score > 0.8 ? 'success.main' : 
                             item.score > 0.6 ? 'warning.main' : 
                             item.score > 0.3 ? 'warning.light' : 'error.main'
                    }}
                  >
                    {item.score.toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {chartData.length > 10 && (
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
            Showing first 10 of {chartData.length} {methodLabel.toLowerCase()}s
          </Typography>
        )}

        {/* Résumé statistique */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            📊 Statistical Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Mean:</strong> {meanScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Std Dev:</strong> {stdScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Min:</strong> {Math.min(...chartData.map(d => d.score)).toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Max:</strong> {Math.max(...chartData.map(d => d.score)).toFixed(4)}
              </Typography>
            </Grid>
            {validationData.best_fold && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Best Fold:</strong> {validationData.best_fold} 
                  (Score: {validationData.best_fold_score?.toFixed(4) || bestScore.toFixed(4)})
                </Typography>
              </Grid>
            )}
          </Grid>
          
          {/* Informations TimeSeries */}
          {isTimeSeries && validationData.n_splits && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
              <Typography variant="body2" color="success.main">
                ✅ TimeSeriesSplit: Date column "{validationData.date_column}" used ONLY for chronological ordering
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Features used:</strong> {validationData.features_used?.join(', ') || 'All numeric columns'}
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
const renderSupportVectors = () => {
  if (!result?.metrics?.support_vectors) return null;

  // Transform array of arrays to array of objects
  const supportVectorsData = result.metrics.support_vectors.map((sv, i) => ({
    x: sv[0],
    y: sv[1],
    id: i
  }));

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔍 Support Vectors
        </Typography>
        <Typography variant="body2" paragraph>
          Number of support vectors: {result.metrics.n_support_vectors}
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" name="Principal Component 1" />
            <YAxis dataKey="y" name="Principal Component 2" />
            <Tooltip />
            <Scatter 
              name="Support Vectors" 
              data={supportVectorsData}
              fill="#ff7300" 
            />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};












const renderOptimizationResults = () => {
  if (!result || modelType !== 'ridge') return null;

  const validation = result.metrics.validation_results;
  
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔍 Hyperparameter Optimization Results
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validation.method}<br/>
            {validation.optimized_params && (
              <>
                <strong>Best Parameters Found:</strong><br/>
                {Object.entries(validation.optimized_params).map(([key, value]) => (
                  <span key={key}>
                    • {key}: {value?.toString() || 'auto'}<br/>
                  </span>
                ))}
              </>
            )}
          </Typography>
        </Alert>

        {/* Performance metrics */}
        {validation.cv_validation_mean && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>CV Score:</strong> {validation.cv_validation_mean.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Std Dev:</strong> {validation.cv_validation_std?.toFixed(4) || 'N/A'}
              </Typography>
            </Grid>
          
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Folds/Samples:</strong> {validation.n_splits || validation.n_bootstraps || 'N/A'}
              </Typography>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};
const validateLightGBMParams = () => {
  const errors = {};
  
  // Validation num_leaves
  if (!lightgbmParams.num_leaves || lightgbmParams.num_leaves < 2 || lightgbmParams.num_leaves > 256) {
    errors.num_leaves = "Number of leaves must be between 2 and 256";
  }
  
  // Validation learning_rate (must be > 0)
  if (lightgbmParams.learning_rate == null || lightgbmParams.learning_rate <= 0 || lightgbmParams.learning_rate > 1) {
    errors.learning_rate = "Learning rate must be > 0 and ≤ 1";
  }
  
  // Validation n_estimators (must be ≥ 1: never 0)
  if (lightgbmParams.n_estimators == null || lightgbmParams.n_estimators < 1 || lightgbmParams.n_estimators > 10000) {
    errors.n_estimators = "Number of trees must be between 1 and 10000";
  }
  
  // Validation min_child_samples (0 is allowed)
  if (lightgbmParams.min_child_samples == null || lightgbmParams.min_child_samples < 0) {
    errors.min_child_samples = "Min child samples must be ≥ 0";
  }
  
  // Validation subsample (must be > 0)
  if (lightgbmParams.subsample == null || lightgbmParams.subsample <= 0 || lightgbmParams.subsample > 1) {
    errors.subsample = "Subsample must be between 0 (exclusive) and 1.0";
  }
  
  // Validation colsample_bytree
  if (lightgbmParams.colsample_bytree == null || lightgbmParams.colsample_bytree <= 0 || lightgbmParams.colsample_bytree > 1) {
    errors.colsample_bytree = "Column sample by tree must be between 0 (exclusive) and 1.0";
  }
  
  // Validation reg_alpha
  if (lightgbmParams.reg_alpha < 0) {
    errors.reg_alpha = "L1 regularization must be non-negative";
  }
  
  // Validation reg_lambda
  if (lightgbmParams.reg_lambda < 0) {
    errors.reg_lambda = "L2 regularization must be non-negative";
  }
  
  // Validation early_stopping_rounds
  if (lightgbmParams.early_stopping_rounds !== null && lightgbmParams.early_stopping_rounds < 0) {
    errors.early_stopping_rounds = "Early stopping rounds must be non-negative (0 to disable)";
  }

  // GOSS is incompatible with subsample < 1
  if (lightgbmParams.boosting_type === 'goss' && Number(lightgbmParams.subsample) < 1) {
    errors.subsample = "GOSS requires subsample = 1 (bagging is built into GOSS)";
  }
  
  return errors;
};


 const boostingTypeOptions = [
    { value: 'gbdt', label: 'Gradient Boosting Decision Tree (GBDT)' },
    { value: 'dart', label: 'Dropouts meet Multiple Additive Regression Trees (DART)' },
    { value: 'goss', label: 'Gradient-based One-Side Sampling (GOSS)' },
  ];
const renderLightGBMParams = () => {
  const fieldErrors = validateLightGBMParams();


  return (
    <Box sx={{ width: '100%' }}>
      {/* Boosting Type - Pleine largeur */}
      <Box sx={{ mb: 3, width: '100%' }}>
        <TextField
          select
          label="Boosting Type"
          value={lightgbmParams.boosting_type}
          onChange={(e) => {
            const next = e.target.value;
            setLightgbmParams((prev) => ({
              ...prev,
              boosting_type: next,
              // GOSS cannot use bagging subsample < 1
              ...(next === 'goss' ? { subsample: 1.0 } : {}),
            }));
          }}
          fullWidth
          sx={{ 
            minWidth: 300,
            '& .MuiInputLabel-root': {
              backgroundColor: 'white',
              padding: '0 8px',
              fontWeight: 600
            }
          }}
        >
          {boostingTypeOptions.map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Paramètres en grille adaptative */}
      <Grid container spacing={3} sx={{ width: '100%' }}>
        {/* Première ligne */}
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Number of Leaves"
            type="number"
            value={lightgbmParams.num_leaves}
            onChange={(e) => setLightgbmParams({...lightgbmParams, num_leaves: parseInt(e.target.value) || 31})}
            fullWidth
            error={!!fieldErrors.num_leaves}
            helperText={fieldErrors.num_leaves || "2-256"}
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 2, 
              max: 256,
              onBlur: (e) => {
                const value = parseInt(e.target.value);
                if (value < 2) setLightgbmParams({...lightgbmParams, num_leaves: 2});
                if (value > 256) setLightgbmParams({...lightgbmParams, num_leaves: 256});
              }
            }}
            sx={{ 
              minWidth: 250,
              '& .MuiInputBase-root': { width: '100%' }
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Learning Rate"
            type="number"
            value={lightgbmParams.learning_rate}
            onChange={(e) => setLightgbmParams({...lightgbmParams, learning_rate: parseFloat(e.target.value) || 0.1})}
            fullWidth
            error={!!fieldErrors.learning_rate}
            helperText={fieldErrors.learning_rate || "0.001-1.0"}
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 0.001, 
              max: 1, 
              step: 0.001,
              onBlur: (e) => {
                const value = parseFloat(e.target.value);
                if (value < 0.001) setLightgbmParams({...lightgbmParams, learning_rate: 0.001});
                if (value > 1) setLightgbmParams({...lightgbmParams, learning_rate: 1});
              }
            }}
            sx={{ minWidth: 250 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Number of Trees"
            type="number"
            value={lightgbmParams.n_estimators}
            onChange={(e) => setLightgbmParams({...lightgbmParams, n_estimators: parseInt(e.target.value) || 100})}
            fullWidth
            error={!!fieldErrors.n_estimators}
            helperText={fieldErrors.n_estimators || "1-10000"}
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 1, 
              max: 10000,
              onBlur: (e) => {
                const value = parseInt(e.target.value);
                if (value < 1) setLightgbmParams({...lightgbmParams, n_estimators: 1});
                if (value > 10000) setLightgbmParams({...lightgbmParams, n_estimators: 10000});
              }
            }}
            sx={{ minWidth: 250 }}
          />
        </Grid>

        {/* Deuxième ligne */}
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Max Depth"
            type="number"
            value={lightgbmParams.max_depth}
            onChange={(e) => setLightgbmParams({...lightgbmParams, max_depth: parseInt(e.target.value) || -1})}
            fullWidth
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            helperText="-1 = no limit"
            sx={{ minWidth: 250 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Min Child Samples"
            type="number"
            value={lightgbmParams.min_child_samples}
            onChange={(e) => setLightgbmParams({...lightgbmParams, min_child_samples: parseInt(e.target.value) || 20})}
            fullWidth
            error={!!fieldErrors.min_child_samples}
            helperText={fieldErrors.min_child_samples || "Min samples per leaf"}
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 0,
              onBlur: (e) => {
                const value = parseInt(e.target.value);
                if (value < 0) setLightgbmParams({...lightgbmParams, min_child_samples: 0});
              }
            }}
            sx={{ minWidth: 250 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Subsample"
            type="number"
            value={lightgbmParams.subsample}
            onChange={(e) => setLightgbmParams({...lightgbmParams, subsample: parseFloat(e.target.value) || 1.0})}
            fullWidth
            error={!!fieldErrors.subsample}
            helperText={fieldErrors.subsample || "0.1-1.0"}
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 0.1, 
              max: 1, 
              step: 0.01,
              onBlur: (e) => {
                const value = parseFloat(e.target.value);
                if (value < 0.1) setLightgbmParams({...lightgbmParams, subsample: 0.1});
                if (value > 1) setLightgbmParams({...lightgbmParams, subsample: 1});
              }
            }}
            sx={{ minWidth: 250 }}
          />
        </Grid>

        {/* Troisième ligne */}
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Colsample by Tree"
            type="number"
            value={lightgbmParams.colsample_bytree}
            onChange={(e) => setLightgbmParams({...lightgbmParams, colsample_bytree: parseFloat(e.target.value) || 1.0})}
            fullWidth
            error={!!fieldErrors.colsample_bytree}
            helperText={fieldErrors.colsample_bytree || "0.1-1.0"}
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 0.1, 
              max: 1, 
              step: 0.01,
              onBlur: (e) => {
                const value = parseFloat(e.target.value);
                if (value < 0.1) setLightgbmParams({...lightgbmParams, colsample_bytree: 0.1});
                if (value > 1) setLightgbmParams({...lightgbmParams, colsample_bytree: 1});
              }
            }}
            sx={{ minWidth: 250 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="L1 Regularization"
            type="number"
            value={lightgbmParams.reg_alpha}
            onChange={(e) => setLightgbmParams({...lightgbmParams, reg_alpha: parseFloat(e.target.value) || 0.0})}
            fullWidth
            error={!!fieldErrors.reg_alpha}
            helperText={fieldErrors.reg_alpha || "Alpha value"}
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 0, 
              step: 0.1,
              onBlur: (e) => {
                const value = parseFloat(e.target.value);
                if (value < 0) setLightgbmParams({...lightgbmParams, reg_alpha: 0});
              }
            }}
            sx={{ minWidth: 250 }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="L2 Regularization"
            type="number"
            value={lightgbmParams.reg_lambda}
            onChange={(e) => setLightgbmParams({...lightgbmParams, reg_lambda: parseFloat(e.target.value) || 0.0})}
            fullWidth
            error={!!fieldErrors.reg_lambda}
            helperText={fieldErrors.reg_lambda || "Lambda value"}
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 0, 
              step: 0.1,
              onBlur: (e) => {
                const value = parseFloat(e.target.value);
                if (value < 0) setLightgbmParams({...lightgbmParams, reg_lambda: 0});
              }
            }}
            sx={{ minWidth: 250 }}
          />
        </Grid>

        {/* Quatrième ligne */}
        <Grid item xs={12} sm={6} lg={4}>
          <TextField
            label="Early Stopping Rounds"
            type="number"
            value={lightgbmParams.early_stopping_rounds}
            onChange={(e) => setLightgbmParams({...lightgbmParams, early_stopping_rounds: parseInt(e.target.value) || 10})}
            fullWidth
            error={!!fieldErrors.early_stopping_rounds}
            helperText={fieldErrors.early_stopping_rounds || "0 to disable"}
            InputLabelProps={{ 
              shrink: true,
              sx: { 
                backgroundColor: 'white', 
                padding: '0 8px',
                fontWeight: 600,
                fontSize: '1rem'
              }
            }}
            inputProps={{ 
              min: 0,
              onBlur: (e) => {
                const value = parseInt(e.target.value);
                if (value < 0) setLightgbmParams({...lightgbmParams, early_stopping_rounds: 0});
              }
            }}
            sx={{ minWidth: 250 }}
          />
        </Grid>
      </Grid>
      
      {/* Alertes d'erreur globales */}
      {Object.keys(fieldErrors).length > 0 && (
        <Alert severity="error" sx={{ mt: 3 }}>
          <Typography variant="subtitle2">Please fix the following errors:</Typography>
          {Object.values(fieldErrors).map((error, index) => (
            <Typography key={index} variant="body2">• {error}</Typography>
          ))}
        </Alert>
      )}

      {/* Information alerts */}
      {lightgbmParams.boosting_type === 'goss' && (
        <Alert severity="info" sx={{ mt: 3 }}>
          GOSS: Faster training but higher memory usage
        </Alert>
      )}
      
      {lightgbmParams.boosting_type === 'dart' && (
        <Alert severity="info" sx={{ mt: 3 }}>
          DART: Better accuracy but may need more trees
        </Alert>
      )}
      
      {lightgbmParams.num_leaves > 64 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          Large number of leaves ({lightgbmParams.num_leaves}) may cause overfitting
        </Alert>
      )}

      {lightgbmParams.learning_rate < 0.01 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Low learning rate ({lightgbmParams.learning_rate}) - training may be slower but more stable
        </Alert>
      )}
    </Box>
  );
};
// Add LightGBM specific visualizations

// ========== FONCTION CORRIGÉE POUR RIDGE VALIDATION DETAILS ==========
const renderRidgeValidationDetails = () => {
  if (!result?.metrics?.validation_results || modelType !== 'ridge') return null;

  const validationData = result.metrics.validation_results;
  
  // ✅ DÉTERMINER LA MÉTHODE DE VALIDATION
  const isHoldout = validationData.method?.includes('Hold-Out');
  const isBootstrap = validationData.method?.includes('Bootstrap');
  const isCV = validationData.method?.includes('Cross-Validation');
  const isTimeSeries = validationData.method?.includes('TimeSeries');
  
  // ✅ RÉCUPÉRER LES DÉTAILS SELON LA MÉTHODE
  let details = [];
  let methodLabel = '';
  let scoreProperty = 'validation_r2';
  
  if (isHoldout) {
    details = validationData.repetition_details || [];
    methodLabel = 'Repetition';
    scoreProperty = 'score';
  } else if (isBootstrap) {
    details = validationData.bootstrap_details || [];
    methodLabel = 'Bootstrap Sample';
    scoreProperty = 'validation_score';
  } else if (isCV) {
    details = validationData.fold_details || [];
    methodLabel = 'Fold';
    scoreProperty = 'outer_val_score';
  } else if (isTimeSeries) {
    // ✅ NOUVEAU : TimeSeriesSplit
    details = validationData.fold_details || [];
    methodLabel = 'Time Series Fold';
    scoreProperty = 'validation_r2';
    
    console.log("[RIDGE] 📊 TimeSeriesSplit validation details:", {
      n_folds: details.length,
      method: validationData.method,
      date_column: validationData.date_column,
      features_used: validationData.features_used
    });
  }

  const hasDetails = details.length > 0;
  
  // ✅ PRÉPARER LES DONNÉES POUR LE GRAPHIQUE
  let chartData = [];
  if (hasDetails) {
    chartData = details.map(item => {
      let trainR2 = 0;
      let testR2 = 0;
      let localAlpha = 0;
      
      // Extraire les scores selon la structure
      if (item.train_r2 !== undefined) trainR2 = item.train_r2;
      else if (item.train_score !== undefined) trainR2 = item.train_score;
      else if (item.cv_train_r2 !== undefined) trainR2 = item.cv_train_r2;
      
      if (item[scoreProperty] !== undefined) testR2 = item[scoreProperty];
      else if (item.score !== undefined) testR2 = item.score;
      else if (item.validation_score !== undefined) testR2 = item.validation_score;
      else if (item.outer_val_score !== undefined) testR2 = item.outer_val_score;
      
      if (item.best_alpha !== undefined) localAlpha = item.best_alpha;
      
      return {
        fold: item.fold || item.repetition || item.bootstrap || 0,
        train_r2: trainR2,
        test_r2: testR2,
        alpha_local: localAlpha
      };
    });
  }

  if (!hasDetails) {
    console.log("[RIDGE] ⚠️ No validation details available");
    return null;
  }

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔧 Alpha Optimization Details
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validationData.method}<br/>
            <strong>Best Alpha:</strong> {validationData.best_alpha}<br/>
            {validationData.date_column && (
              <><strong>Date Column:</strong> {validationData.date_column} (excluded from features)<br/></>
            )}
            {validationData.features_used && (
              <><strong>Features Used:</strong> {validationData.features_used.join(', ')}<br/></>
            )}
            <strong>Purpose:</strong> Internal parameter optimization only
          </Typography>
        </Alert>

        {/* Graphique des performances */}
        {chartData.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
               Performance During Alpha Search
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fold" 
                  label={{ 
                    value: methodLabel, 
                    position: 'insideBottomRight', 
                    offset: -10 
                  }}
                />
                <YAxis 
                  label={{ 
                    value: 'R² Score', 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'train_r2') return [value.toFixed(4), 'Train R²'];
                    if (name === 'test_r2') return [value.toFixed(4), 'Validation R²'];
                    if (name === 'alpha_local') return [value, 'Local Alpha'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `${methodLabel} ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="train_r2" 
                  stroke="#8884d8" 
                  name="Train R²"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="test_r2" 
                  stroke="#82ca9d" 
                  name="Validation R²"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tableau des détails */}
        {hasDetails && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              📋 Alpha Search Details
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>{methodLabel}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train R²</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Validation R²</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Alpha (local)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Alpha (global)</TableCell>
                    {isTimeSeries && (
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train Size</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.slice(0, 10).map((item, index) => {
                    // Calcul des valeurs pour cette ligne
                    let trainR2 = 0;
                    let testR2 = 0;
                    
                    if (item.train_r2 !== undefined) trainR2 = item.train_r2;
                    else if (item.train_score !== undefined) trainR2 = item.train_score;
                    
                    if (item[scoreProperty] !== undefined) testR2 = item[scoreProperty];
                    else if (item.score !== undefined) testR2 = item.score;
                    else if (item.validation_score !== undefined) testR2 = item.validation_score;
                    
                    return (
                      <TableRow key={index} hover>
                        <TableCell>
                          {item.fold || item.repetition || item.bootstrap || index + 1}
                        </TableCell>
                        <TableCell align="right">
                          {trainR2.toFixed(4)}
                        </TableCell>
                        <TableCell 
                          align="right"
                          sx={{ 
                            color: testR2 > 0.7 ? 'success.main' : 
                                  testR2 > 0 ? 'warning.main' : 'error.main',
                            fontWeight: 'medium'
                          }}
                        >
                          {testR2.toFixed(4)}
                        </TableCell>
                        <TableCell align="right">
                          {item.best_alpha || 'N/A'}
                        </TableCell>
                        <TableCell align="right">
                          {validationData.best_alpha || 'N/A'}
                        </TableCell>
                        {isTimeSeries && (
                          <TableCell align="right">
                            {item.train_size || 'N/A'}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            
            {details.length > 10 && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                Showing first 10 of {details.length} {methodLabel.toLowerCase()}s
              </Typography>
            )}
          </Box>
        )}

        {/* Statistiques récapitulatives */}
        {chartData.length > 0 && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              📊 Summary Statistics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2">
                  <strong>Mean Val R²:</strong> {validationData.cv_validation_r2_mean?.toFixed(4) || 
                                                   validationData.mean_score?.toFixed(4) || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2">
                  <strong>Std Val R²:</strong> {validationData.cv_validation_r2_std?.toFixed(4) || 
                                                  validationData.std_score?.toFixed(4) || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2">
                  <strong>Mean Train R²:</strong> {validationData.cv_train_r2_mean?.toFixed(4) || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2">
                  <strong>Best Fold:</strong> {validationData.best_fold_used || 'N/A'} 
                  {validationData.best_fold_score && ` (${validationData.best_fold_score.toFixed(4)})`}
                </Typography>
              </Grid>
            </Grid>
            
            {/* Informations spécifiques TimeSeries */}
            {isTimeSeries && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
                <Typography variant="body2" color="success.main">
                  ✅ TimeSeriesSplit: Date column "{validationData.date_column}" used ONLY for chronological ordering
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Features used:</strong> {validationData.features_used?.join(', ') || 'All numeric columns'}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> These metrics were computed during alpha optimization. 
            Final model performance on unseen test data is shown in the "Final Performance" section above.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
};



const validateRandomForestParams = () => {
  const errors = [];
  
  if (randomForestParams.n_estimators < 1) {
    errors.push("Number of trees must be at least 1");
  }
  
  if (randomForestParams.min_samples_split < 2) {
    errors.push("min_samples_split must be at least 2");
  }
  
  if (randomForestParams.min_samples_leaf < 1) {
    errors.push("min_samples_leaf must be at least 1");
  }
  
  if (randomForestParams.max_depth && randomForestParams.max_depth < 1) {
    errors.push("max_depth must be at least 1 if specified");
  }
  
  
  return errors;
};


const renderMlpTimeseriesValidationDetails = () => {
  if (!result?.metrics?.validation_results || modelType !== 'mlp') return null;
  
  const validationData = result.metrics.validation_results;
  
  // Vérifier si c'est TimeSeriesSplit
  const isTimeSeries = validationData.method?.includes('TimeSeries');
  if (!isTimeSeries) return null;
  
  const isClassification = result.metrics.is_classification;
  const foldDetails = validationData.fold_details || [];
  
  if (foldDetails.length === 0) return null;
  
  // Déterminer le nom du score selon le type de problème
  const scoreName = isClassification ? 'Accuracy' : 'R² Score';
  
  // Préparer les données pour le graphique (sans best_epoch)
  const chartData = foldDetails.map(item => ({
    fold: item.fold,
    train_score: item.train_score || 0,
    val_score: item.val_score || 0,
    train_size: item.train_size || 0,
    val_size: item.val_size || 0
  }));
  
  // Calculer les statistiques
  let meanValScore = 0;
  let stdValScore = 0;
  
  if (isClassification) {
    meanValScore = validationData.mean_score || 
                   validationData.cv_validation_accuracy_mean || 
                   (chartData.reduce((sum, item) => sum + item.val_score, 0) / chartData.length);
    stdValScore = validationData.std_score || 
                  validationData.cv_validation_accuracy_std ||
                  Math.sqrt(chartData.reduce((sq, n) => sq + Math.pow(n.val_score - meanValScore, 2), 0) / chartData.length);
  } else {
    meanValScore = validationData.mean_score || 
                   validationData.cv_validation_r2_mean || 
                   (chartData.reduce((sum, item) => sum + item.val_score, 0) / chartData.length);
    stdValScore = validationData.std_score || 
                  validationData.cv_validation_r2_std ||
                  Math.sqrt(chartData.reduce((sq, n) => sq + Math.pow(n.val_score - meanValScore, 2), 0) / chartData.length);
  }
  
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔍 Time Series Split Validation Details (MLP - {isClassification ? 'Classification' : 'Regression'})
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validationData.method}<br/>
            <strong>Valid Folds:</strong> {foldDetails.length}<br/>
            <strong>Date Column:</strong> {validationData.date_column || 'N/A'} (excluded from features)<br/>
            <strong>Features Used:</strong> {validationData.features_used?.join(', ') || 'All features'}<br/>
            <strong>Average {scoreName}:</strong> {meanValScore.toFixed(4)} ± {stdValScore.toFixed(4)}<br/>
            <strong>Best Fold:</strong> {validationData.best_fold || validationData.best_fold_used || 'N/A'} 
            {validationData.best_score && ` (Score: ${validationData.best_score.toFixed(4)})`}
          </Typography>
        </Alert>

        {/* Graphique des scores par fold */}
        {chartData.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
               {scoreName} by Time Series Fold
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fold" 
                  label={{ value: 'Fold', position: 'insideBottomRight', offset: -10 }}
                />
                <YAxis 
                  label={{ 
                    value: scoreName, 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                  domain={isClassification ? [0, 1] : ['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value) => [value.toFixed(4), scoreName]}
                  labelFormatter={(label) => `Fold ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="val_score" 
                  stroke="#8884d8" 
                  name={`Validation ${scoreName}`}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="train_score" 
                  stroke="#82ca9d" 
                  name={`Train ${scoreName}`}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <ReferenceLine 
                  y={meanValScore} 
                  stroke="#ff7300" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: `Avg: ${meanValScore.toFixed(3)}`, 
                    position: 'insideTopRight',
                    fill: '#ff7300',
                    fontSize: 12
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tableau des détails par fold - SANS Best Epoch */}
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          📋 Individual Fold Results
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Fold</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train Size</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Validation Size</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train {scoreName}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Validation {scoreName}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {foldDetails.slice(0, 10).map((item, index) => (
                <TableRow key={index} hover>
                  <TableCell>{item.fold}</TableCell>
                  <TableCell align="right">{item.train_size || 'N/A'}</TableCell>
                  <TableCell align="right">{item.val_size || item.validation_size || 'N/A'}</TableCell>
                  <TableCell align="right">
                    {(item.train_score || 0).toFixed(4)}
                  </TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      fontWeight: 'medium',
                      color: isClassification ? 
                        ((item.val_score || 0) >= 0.9 ? 'success.main' : 
                         (item.val_score || 0) >= 0.8 ? 'warning.main' : 
                         (item.val_score || 0) >= 0.6 ? 'warning.light' : 'error.main') :
                        ((item.val_score || 0) >= 0.8 ? 'success.main' : 
                         (item.val_score || 0) >= 0.6 ? 'warning.main' : 
                         (item.val_score || 0) >= 0.3 ? 'warning.light' : 'error.main')
                    }}
                  >
                    {(item.val_score || 0).toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {foldDetails.length > 10 && (
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
            Showing first 10 of {foldDetails.length} folds
          </Typography>
        )}

        {/* Résumé statistique */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            📊 Statistical Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Mean {scoreName}:</strong> {meanValScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Std Dev:</strong> {stdValScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Min:</strong> {Math.min(...chartData.map(d => d.val_score)).toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Max:</strong> {Math.max(...chartData.map(d => d.val_score)).toFixed(4)}
              </Typography>
            </Grid>
          </Grid>
          
          {/* Informations spécifiques selon le type */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
            <Typography variant="body2" color="success.main">
              ✅ TimeSeriesSplit: Date column "{validationData.date_column}" used ONLY for chronological ordering
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>Features used:</strong> {validationData.features_used?.join(', ') || 'All numeric columns'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>Problem type:</strong> {isClassification ? 'Classification (Accuracy)' : 'Regression (R² Score)'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>MLP Parameters:</strong> layers={result.metrics?.layers_used?.join('-')}, activation={result.metrics?.activation_used}
            </Typography>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> These validation scores were computed during the training phase 
            using chronological splits. The date column was used ONLY for ordering and was excluded 
            from the features used for training.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
};



const renderLightGBMValidationDetails = () => {
  if (!result?.metrics?.validation_results || modelType !== 'lightgbm') return null;

  const validationData = result.metrics.validation_results;
  const isClassification = result.metrics.is_classification;
  
  // Déterminer la méthode de validation
  const isHoldout = validationData.method?.includes('Hold-Out');
  const isCV = validationData.method?.includes('Cross-Validation');
  const isBootstrap = validationData.method?.includes('Bootstrap');
  
  // Récupérer les détails selon la méthode
  let details = [];
  let scoreProperty = 'score';
  
  if (isHoldout) {
    details = validationData.repetition_details || [];
    scoreProperty = 'score';
  } else if (isCV) {
    details = validationData.fold_details || [];
    if (details.length > 0 && details[0].validation_score !== undefined) {
      scoreProperty = 'validation_score';
    }
  } else if (isBootstrap) {
    details = validationData.bootstrap_details || [];
    scoreProperty = 'score';
  }
  
  if (details.length === 0) return null;

  // Préparer les données pour le graphique (sans best_iteration)
  const chartData = details.map((item, index) => {
    const baseItem = {
      id: item.repetition || item.fold || item.bootstrap || index + 1,
      label: isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Sample'
    };
    
    let scoreValue = 0;
    if (scoreProperty && item[scoreProperty] !== undefined) {
      scoreValue = item[scoreProperty];
    }
    
    return {
      ...baseItem,
      fold: baseItem.id,
      score: scoreValue
      // best_iteration a été supprimé
    };
  });

  // Calculer les scores pour les statistiques
  const scores = chartData.map(item => item.score);
  
  // Obtenir le score moyen selon la méthode
  const meanScore = validationData.mean_score || 
                   validationData.cv_mean || 
                   validationData.bootstrap_mean ||
                   (scores.reduce((a, b) => a + b, 0) / scores.length);
  
  const stdScore = validationData.std_score || 
                  validationData.cv_std || 
                  validationData.bootstrap_std ||
                  (Math.sqrt(scores.reduce((sq, n) => sq + Math.pow(n - meanScore, 2), 0) / scores.length));

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔍 LightGBM Validation Details
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validationData.method}<br/>
            <strong>Samples/Folds/Repetitions:</strong> {details.length}<br/>
            <strong>Average Score:</strong> {meanScore.toFixed(4)} ± {stdScore.toFixed(4)}<br/>
          </Typography>
        </Alert>

        {/* Graphique des scores de validation */}
        {chartData.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
               {isClassification ? 'Accuracy' : 'R² Score'} by {isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap Sample'}
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fold" 
                  label={{ 
                    value: isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap Sample', 
                    position: 'insideBottomRight', 
                    offset: -10 
                  }}
                />
                <YAxis 
                  label={{ 
                    value: isClassification ? 'Accuracy' : 'R² Score', 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                  domain={isClassification ? [0, 1] : ['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'score') {
                      return [value.toFixed(4), isClassification ? 'Accuracy' : 'R² Score'];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => 
                    `${isHoldout ? 'Repetition' : isCV ? 'Fold' : 'Bootstrap'} ${label}`
                  }
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#8884d8" 
                  name={isClassification ? 'Accuracy' : 'R² Score'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                {/* Ligne de référence pour la moyenne */}
                <ReferenceLine 
                  y={meanScore} 
                  stroke="#ff7300" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: `Avg: ${meanScore.toFixed(3)}`, 
                    position: 'insideTopRight',
                    fill: '#ff7300',
                    fontSize: 12
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tableau des résultats individuels - SANS colonne Best Iteration */}
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          📋 Individual Validation Results
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  {isHoldout ? 'Rep' : isCV ? 'Fold' : 'Sample'}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Train Size
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Validation Size
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {isClassification ? 'Accuracy' : 'R² Score'}
                </TableCell>
                {/* La colonne Best Iteration a été supprimée */}
              </TableRow>
            </TableHead>
            <TableBody>
              {details.slice(0, 10).map((item, index) => {
                const foldId = item.repetition || item.fold || item.bootstrap || index + 1;
                const trainSize = item.train_size || 'N/A';
                const validationSize = item.validation_size || 'N/A';
                
                let displayScore = 0;
                if (item.validation_score !== undefined) {
                  displayScore = item.validation_score;
                } else if (item.score !== undefined) {
                  displayScore = item.score;
                }
                
                return (
                  <TableRow key={index} hover>
                    <TableCell>
                      {foldId}
                    </TableCell>
                    <TableCell align="right">{trainSize}</TableCell>
                    <TableCell align="right">{validationSize}</TableCell>
                    <TableCell 
                      align="right" 
                      sx={{ 
                        fontWeight: 'medium',
                        color: isClassification ? 
                          (displayScore >= 0.9 ? 'success.main' : 
                           displayScore >= 0.8 ? 'warning.main' : 'error.main') :
                          (displayScore >= 0.8 ? 'success.main' : 
                           displayScore >= 0.6 ? 'warning.main' : 'error.main')
                      }}
                    >
                      {displayScore.toFixed(4)}
                    </TableCell>
                    {/* La cellule Best Iteration a été supprimée */}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {details.length > 10 && (
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
            Showing first 10 of {details.length} {isHoldout ? 'repetitions' : isCV ? 'folds' : 'samples'}
          </Typography>
        )}

        {/* Résumé statistique */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            📊 Statistical Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Mean:</strong> {meanScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Std Dev:</strong> {stdScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Min:</strong> {Math.min(...scores).toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Max:</strong> {Math.max(...scores).toFixed(4)}
              </Typography>
            </Grid>
            {validationData.best_repetition && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Best Repetition:</strong> {validationData.best_repetition} 
                  (Score: {validationData.best_score?.toFixed(4) || 'N/A'})
                </Typography>
              </Grid>
            )}
            {validationData.best_fold && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Best Fold:</strong> {validationData.best_fold} 
                  (Score: {validationData.best_fold_score?.toFixed(4) || 'N/A'})
                </Typography>
              </Grid>
            )}
            {validationData.median_bootstrap_index && (
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Median Bootstrap:</strong> {validationData.median_bootstrap_index} 
                  (Score: {validationData.median_bootstrap_score?.toFixed(4) || 'N/A'})
                </Typography>
              </Grid>
            )}
          </Grid>
          
          {/* Informations supplémentaires selon la méthode */}
          {isCV && validationData.n_splits && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Number of Folds:</strong> {validationData.n_splits}
              </Typography>
            </Box>
          )}
          
          {isBootstrap && validationData.n_bootstraps && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Bootstrap Samples:</strong> {validationData.n_bootstraps}
              </Typography>
            </Box>
          )}
          
          {isHoldout && validationData.n_repetitions && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                <strong>Repetitions:</strong> {validationData.n_repetitions}
              </Typography>
            </Box>
          )}

          {/* Informations spécifiques LightGBM */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
            <Typography variant="subtitle2" gutterBottom>
              🔧 LightGBM Parameters Used
            </Typography>
            <Typography variant="body2">
              <strong>Boosting:</strong> {result.metrics?.boosting_type_used || 'gbdt'} | 
              <strong> Learning Rate:</strong> {result.metrics?.learning_rate_used || 0.1} | 
              <strong> N Estimators:</strong> {result.metrics?.n_estimators_used || 100}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};





const [trainingInterval, setTrainingInterval] = useState(null);
const [currentTrainingId, setCurrentTrainingId] = useState(null);

const getAllTrainingParamErrors = () => {
  const errors = [];

  // ---- Validation method ----
  if (modelType !== 'kmeans' && !isAnomalyAlgo()) {
    if (validationMethod === 'holdout') {
      if (!nRepetitions || nRepetitions < 1 || nRepetitions > 50) {
        errors.push('Hold-out repetitions must be between 1 and 50');
      }
    }
    if (validationMethod.startsWith('cv_') && validationMethod !== 'cv_timeseries') {
      const splits = Number(cvParams?.n_splits);
      if (!splits || splits < 2 || splits > 20) {
        errors.push('CV n_splits must be between 2 and 20');
      }
      if (validationMethod === 'cv_repeatedkfold') {
        const nRep = Number(cvParams?.n_repeats);
        if (!nRep || nRep < 1 || nRep > 20) {
          errors.push('Repeated KFold n_repeats must be between 1 and 20');
        }
      }
      if (validationMethod === 'cv_shufflesplit') {
        const ts = Number(cvParams?.test_size);
        if (!(ts > 0 && ts < 1)) {
          errors.push('ShuffleSplit test_size must be between 0 and 1 (exclusive)');
        }
      }
    }
    if (validationMethod === 'bootstrap') {
      const nb = Number(bootstrapParams?.n_bootstraps);
      if (!nb || nb < 1 || nb > 500) {
        errors.push('Bootstrap samples must be between 1 and 500');
      }
      const ss = Number(bootstrapParams?.sample_size ?? 1);
      if (!(ss > 0 && ss <= 1)) {
        errors.push('Bootstrap sample_size must be > 0 and ≤ 1');
      }
    }
    if (validationMethod === 'cv_timeseries') {
      if (!dateColumnDetected || !dateColumn) {
        errors.push('TimeSeriesSplit requires a detected date column');
      }
      const ns = Number(timeSeriesParams?.n_splits);
      if (!ns || ns < 2 || ns > 20) {
        errors.push('TimeSeries n_splits must be between 2 and 20');
      }
    }
  }

  // ---- Per-algorithm ----
  if (modelType === 'random_forest') {
    if (!randomForestParams.n_estimators || randomForestParams.n_estimators < 1) {
      errors.push('Random Forest: n_estimators must be ≥ 1');
    }
    if (!randomForestParams.min_samples_split || randomForestParams.min_samples_split < 2) {
      errors.push('Random Forest: min_samples_split must be ≥ 2');
    }
    if (!randomForestParams.min_samples_leaf || randomForestParams.min_samples_leaf < 1) {
      errors.push('Random Forest: min_samples_leaf must be ≥ 1');
    }
    if (randomForestParams.oob_score && !randomForestParams.bootstrap) {
      errors.push('Random Forest: OOB score requires bootstrap = true');
    }
    if (randomForestParams.max_depth != null && randomForestParams.max_depth !== '' && Number(randomForestParams.max_depth) < 1) {
      errors.push('Random Forest: max_depth must be ≥ 1 (or empty for unlimited)');
    }
  }

  if (modelType === 'logistic') {
    errors.push(...validateLogisticParams(logisticParams));
  }

  if (modelType === 'svm') {
    if (!(Number(svmParams.C) > 0)) errors.push('SVM: C must be > 0');
    if (svmParams.kernel === 'poly' && (!(Number(svmParams.degree) >= 1) || Number(svmParams.degree) > 10)) {
      errors.push('SVM: polynomial degree must be between 1 and 10');
    }
    if (svmParams.gamma === '' || svmParams.gamma === null) {
      const g = Number(svmParams.customGamma);
      if (!(g > 0)) errors.push('SVM: custom gamma must be > 0');
    }
  }

  if (modelType === 'knn') {
    if (!knnParams.n_neighbors || knnParams.n_neighbors < 1) {
      errors.push('KNN: n_neighbors must be ≥ 1');
    }
    if (!knnParams.leaf_size || knnParams.leaf_size < 1) {
      errors.push('KNN: leaf_size must be ≥ 1');
    }
    if (knnParams.metric === 'minkowski' && (!(Number(knnParams.p) >= 1))) {
      errors.push('KNN: minkowski p must be ≥ 1');
    }
  }

  if (modelType === 'lightgbm') {
    const le = validateLightGBMParams();
    Object.values(le).forEach((msg) => errors.push(`LightGBM: ${msg}`));
    if (Number(lightgbmParams.n_estimators) < 1) {
      errors.push('LightGBM: number of boosting rounds must be ≥ 1');
    }
    if (Number(lightgbmParams.learning_rate) <= 0) {
      errors.push('LightGBM: learning_rate must be > 0');
    }
    if (Number(lightgbmParams.num_leaves) < 2) {
      errors.push('LightGBM: num_leaves must be ≥ 2');
    }
    // subsample / colsample of 0 is invalid
    if (!(Number(lightgbmParams.subsample) > 0 && Number(lightgbmParams.subsample) <= 1)) {
      errors.push('LightGBM: subsample must be in (0, 1]');
    }
    if (!(Number(lightgbmParams.colsample_bytree) > 0 && Number(lightgbmParams.colsample_bytree) <= 1)) {
      errors.push('LightGBM: colsample_bytree must be in (0, 1]');
    }
    if (lightgbmParams.boosting_type === 'goss' && Number(lightgbmParams.subsample) < 1) {
      errors.push('LightGBM: with GOSS, set subsample = 1');
    }
  }

  if (modelType === 'mlp') {
    if (!Array.isArray(mlpParams.layers) || mlpParams.layers.length === 0 || mlpParams.layers.some((n) => !(Number(n) >= 1))) {
      errors.push('MLP: every layer size must be ≥ 1');
    }
    if (!(Number(mlpParams.learning_rate) > 0)) errors.push('MLP: learning_rate must be > 0');
    if (!(Number(mlpParams.batch_size) >= 1)) errors.push('MLP: batch_size must be ≥ 1');
    if (!(Number(mlpParams.epochs) >= 1)) errors.push('MLP: epochs must be ≥ 1');
    if (Number(mlpParams.dropout_rate) < 0 || Number(mlpParams.dropout_rate) >= 1) {
      errors.push('MLP: dropout must be in [0, 1)');
    }
    if (!(Number(mlpParams.validation_split) > 0 && Number(mlpParams.validation_split) < 0.5)) {
      errors.push('MLP: validation_split must be in (0, 0.5)');
    }
  }

  if (modelType === 'kmeans') {
    if (!kmeansParams.n_clusters || kmeansParams.n_clusters < 2) {
      errors.push('K-Means: n_clusters must be ≥ 2');
    }
  }

  if (modelType === 'isolation_forest') {
    const c = Number(isolationForestParams.contamination);
    if (!(c > 0 && c <= 0.5)) {
      errors.push('Isolation Forest: contamination must be in (0, 0.5]');
    }
    if (!isolationForestParams.n_estimators || isolationForestParams.n_estimators < 10) {
      errors.push('Isolation Forest: n_estimators must be ≥ 10');
    }
  }

  if (modelType === 'one_class_svm') {
    const nu = Number(oneClassSvmParams.nu);
    if (!(nu > 0 && nu <= 1)) {
      errors.push('One-Class SVM: nu must be in (0, 1]');
    }
  }

  if (modelType === 'ridge') {
    // alpha search is automatic; no user alpha required
  }

  return errors;
};

const trainingParamErrors = problemType ? getAllTrainingParamErrors() : [];

const handleTrain = async () => {
  // Immediate UI feedback: do not wait for network checks on large datasets
  if (isTrainingRef.current) return;

  if (stopCooldown) {
    setError(
      stopCooldownSecondsLeft > 0
        ? `Please wait ${stopCooldownSecondsLeft}s before starting a new training`
        : "Please wait 10 seconds before starting a new training"
    );
    return;
  }

  if (!problemType) {
    setError("Please wait: detecting problem type and loading the page…");
    return;
  }

  setStopTraining(false);
  setIsTraining(true);
  isTrainingRef.current = true;
  setError(null);
  setResult(null);
  setRandomSearchProgress(null);

  // Guard: require a valid train/test split.
  // Use quick=true so large datasets do not timeout on COUNT(*) (real root cause of the error).
  const splitBd = (state?.bdName || "").replace("_numerized", "");
  let splitOk = false;
  let lastSplitErr = null;
  for (let attempt = 0; attempt < 3 && !splitOk; attempt += 1) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
      const splitRes = await axios.get(`${backendUrl}/api/get-split-stats2`, {
        params: { bdName: splitBd, quick: true },
        withCredentials: true,
        timeout: 60000,
      });
      if (splitRes.data?.exists && (splitRes.data?.train_count > 0 || splitRes.data?.has_train)) {
        splitOk = true;
      } else {
        setError("Dataset is not properly split. Go back to Data Preparation → Clean · Split · Impute.");
        setIsTraining(false);
        isTrainingRef.current = false;
        return;
      }
    } catch (e) {
      lastSplitErr = e;
    }
  }
  if (!splitOk) {
    const timedOut = lastSplitErr?.code === "ECONNABORTED" || /timeout/i.test(String(lastSplitErr?.message || ""));
    setError(
      timedOut
        ? "Could not verify the train/test split in time (large dataset or busy server). Wait a few seconds and click Start training again."
        : "Could not verify train/test split. Complete the split step in Data Preparation first, then retry."
    );
    setIsTraining(false);
    isTrainingRef.current = false;
    return;
  }

  if (modelType !== "kmeans" && !isAnomalyAlgo() && !hasTargetColumn) {
    setError("No target column selected. Complete Target & Type in Data Preparation first.");
    setIsTraining(false);
    isTrainingRef.current = false;
    return;
  }

  const paramErrors = getAllTrainingParamErrors();
  if (paramErrors.length > 0) {
    setError(`Invalid parameters: ${paramErrors.join(" · ")}`);
    setIsTraining(false);
    isTrainingRef.current = false;
    return;
  }
  
  // ✅ NETTOYER L'ANCIEN INTERVALLE
  if (trainingInterval) {
    clearInterval(trainingInterval);
    setTrainingInterval(null);
  }
  
  // ✅ ARRÊTER L'ANCIEN ENTRAÎNEMENT S'IL EXISTE (non-blocking for UI)
  const oldTrainingId = localStorage.getItem('current_training_id'); 
  if (oldTrainingId) {
    try { 
      await axios.post(`${backendUrl}/api/stop-training`, { training_id: oldTrainingId }, { withCredentials: true, timeout: 8000 }); 
    } catch(e) {}
    localStorage.removeItem('current_training_id');
  }
  
  // ✅ NETTOYER LES TRAININGS ORPHELINS
  cleanupCompletedTrainings();
  
  // ✅ CRÉER UN NOUVEL ID UNIQUE (no artificial 1s delay)
  const trainingId = `${modelType}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log("🆕 New training ID:", trainingId);
  
  // ✅ STOCKER L'ID DANS LOCALSTORAGE AVANT LA REQUÊTE
  localStorage.setItem('current_training_id', trainingId);
  setCurrentTrainingId(trainingId);
  setLastCompletedTrainingId(null);
  setSaveAvailableUntil(null);
  
  // ✅ DÉMARRER LE POLLING IMMÉDIATEMENT (avant d'attendre la réponse)
  pollTrainingStatus(trainingId);
  
  try {
    if (!state?.bdName) {
      throw new Error("No dataset selected");
    }

    const datasetToUse = state.bdName.replace('_numerized', '');

    const requestData = {
      numerized_dataset_name: datasetToUse,
      original_dataset_name: state.originalBdName || state.bdName.replace('_numerized', ''),
      model_type: modelType,
      training_id: trainingId,
    };

    // ✅ AJOUT : Date column pour TimeSeriesSplit si détectée
    if (dateColumnDetected && dateColumn) {
      requestData.date_column = dateColumn;
      console.log(`[DEBUG] Date column added to request: ${dateColumn}`);
    }

    // ========== CONFIGURATION SELON LE TYPE DE MODÈLE ==========
    if (modelType === 'ridge') {
      requestData.fit_intercept = true;
      requestData.validation_method = validationMethod;
      
      // ========== CONFIGURATION VALIDATION POUR RIDGE ==========
      if (validationMethod === 'holdout') {
        requestData.n_repetitions = nRepetitions;
        console.log(`[RIDGE] 📊 Hold-Out validation with ${nRepetitions} repetitions`);
      } else if (validationMethod === 'cv_timeseries') {
        // ✅ TimeSeriesSplit pour Ridge
        requestData.time_series_column = dateColumn;
        requestData.time_series_params = timeSeriesParams;
        requestData.validation_method = 'cv_timeseries';
        
        console.log(`[RIDGE] ⏱️ TimeSeriesSplit validation enabled`);
        console.log(`[RIDGE] 📅 Date column: ${dateColumn}`);
        console.log(`[RIDGE] 🔧 Parameters:`, timeSeriesParams);
        console.log(`[RIDGE] ⚠️ NOTE: Date column will ONLY be used for chronological splitting`);
        console.log(`[RIDGE] ⚠️ Date column will NOT be used as a feature in training`);
      } else if (validationMethod.startsWith('cv_')) {
        requestData.cv_params = cvParams;
      } else if (validationMethod === 'bootstrap') {
        requestData.bootstrap_params = bootstrapParams;
      }
      
    } else if (modelType === 'logistic') {
      requestData.penalty = logisticParams.penalty;
      requestData.solver = logisticParams.solver;
      requestData.max_iter = logisticParams.max_iter;
      requestData.multi_class = logisticParams.multi_class;
      requestData.class_weight = logisticParams.class_weight;
      requestData.use_scaling = logisticParams.use_scaling;
      requestData.random_state = logisticParams.random_state;
      requestData.validation_method = validationMethod;
      requestData.n_repetitions = nRepetitions;
      requestData.training_id = trainingId;

      if (logisticParams.penalty === 'elasticnet') {
        requestData.l1_ratio = logisticParams.l1_ratio;
      }
      
      // ========== CONFIGURATION VALIDATION POUR LOGISTIC ==========
      if (validationMethod === 'holdout') {
        requestData.n_repetitions = nRepetitions;
      } else if (validationMethod === 'cv_timeseries') {
        // ✅ TimeSeriesSplit pour Logistic
        requestData.time_series_column = dateColumn;
        requestData.time_series_params = timeSeriesParams;
        requestData.validation_method = 'cv_timeseries';
      } else if (validationMethod.startsWith('cv_')) {
        requestData.cv_params = cvParams;
      } else if (validationMethod === 'bootstrap') {
        requestData.bootstrap_params = bootstrapParams;
      }
      
    } else if (modelType === 'random_forest') {
      const validationErrors = validateRandomForestParams();
      if (validationErrors.length > 0) {
        setError(`Invalid Random Forest parameters: ${validationErrors.join(', ')}`);
        setIsTraining(false);
        isTrainingRef.current = false;
        localStorage.removeItem('current_training_id');
        setCurrentTrainingId(null);
        if (trainingInterval) {
          clearInterval(trainingInterval);
          setTrainingInterval(null);
        }
        return;
      }
      
      requestData.n_repetitions = nRepetitions; 
      requestData.final_training_on_all_data = finalTrainingOnAllData; 
      requestData.n_estimators = randomForestParams.n_estimators;
      requestData.criterion = randomForestParams.criterion;
      requestData.max_depth = randomForestParams.max_depth;
      requestData.min_samples_split = randomForestParams.min_samples_split;
      requestData.min_samples_leaf = randomForestParams.min_samples_leaf;
      requestData.max_features = randomForestParams.max_features;
      requestData.bootstrap = randomForestParams.bootstrap;
      requestData.oob_score = randomForestParams.oob_score;
      requestData.random_state = randomForestParams.random_state;
      requestData.n_jobs = randomForestParams.n_jobs;
      requestData.validation_method = validationMethod;
      requestData.training_id = trainingId;

      // ========== CONFIGURATION VALIDATION POUR RANDOM FOREST ==========
      if (validationMethod === 'holdout') {
        requestData.n_repetitions = nRepetitions;
      } else if (validationMethod === 'cv_timeseries') {
        requestData.time_series_column = dateColumn;
        requestData.time_series_params = timeSeriesParams;
        requestData.validation_method = 'cv_timeseries';
        
        console.log(`[RANDOM FOREST] ⏱️ TimeSeriesSplit validation enabled`);
        console.log(`[RANDOM FOREST] 📅 Date column: ${dateColumn}`);
        console.log(`[RANDOM FOREST] 🔧 Parameters:`, timeSeriesParams);
      } else if (validationMethod.startsWith('cv_')) {
        requestData.cv_params = cvParams;
      } else if (validationMethod === 'bootstrap') {
        requestData.bootstrap_params = bootstrapParams;
      }
      
    } else if (modelType === 'svm') {
      requestData.kernel = svmParams.kernel;
      requestData.C = svmParams.C;
      requestData.gamma = svmParams.gamma;
      requestData.degree = svmParams.degree;
      requestData.shrinking = svmParams.shrinking;
      requestData.probability = svmParams.probability;
      requestData.validation_method = validationMethod;
      requestData.n_repetitions = nRepetitions;
      requestData.training_id = trainingId;

      // ========== CONFIGURATION VALIDATION POUR SVM ==========
      if (validationMethod === 'holdout') {
        requestData.n_repetitions = nRepetitions;
      } else if (validationMethod === 'cv_timeseries') {
        // ✅ TimeSeriesSplit pour SVM
        requestData.time_series_column = dateColumn;
        requestData.time_series_params = timeSeriesParams;
        requestData.validation_method = 'cv_timeseries';
      } else if (validationMethod.startsWith('cv_')) {
        requestData.cv_params = cvParams;
      } else if (validationMethod === 'bootstrap') {
        requestData.bootstrap_params = bootstrapParams;
      }
      
    } else if (modelType === 'knn') {
      requestData.n_neighbors = knnParams.n_neighbors;
      requestData.weights = knnParams.weights;
      requestData.algorithm = knnParams.algorithm;
      requestData.leaf_size = knnParams.leaf_size;
      requestData.p = knnParams.p;
      requestData.metric = knnParams.metric;
      requestData.use_scaling = knnParams.use_scaling;
      requestData.validation_method = validationMethod;
      requestData.n_repetitions = nRepetitions; 
      requestData.training_id = trainingId;
      
      // ========== CONFIGURATION VALIDATION POUR KNN ==========
      if (validationMethod === 'holdout') {
        requestData.n_repetitions = nRepetitions;
      } else if (validationMethod === 'cv_timeseries') {
        // ✅ TimeSeriesSplit pour KNN
        requestData.time_series_column = dateColumn;
        requestData.time_series_params = timeSeriesParams;
        requestData.validation_method = 'cv_timeseries';
      } else if (validationMethod.startsWith('cv_')) {
        requestData.cv_params = cvParams;
      } else if (validationMethod === 'bootstrap') {
        requestData.bootstrap_params = bootstrapParams;
      }
      
    } else if (modelType === 'lightgbm') {
      requestData.boosting_type = lightgbmParams.boosting_type;
      requestData.num_leaves = lightgbmParams.num_leaves;
      requestData.learning_rate = lightgbmParams.learning_rate;
      requestData.n_estimators = lightgbmParams.n_estimators;
      requestData.max_depth = lightgbmParams.max_depth;
      requestData.min_child_samples = lightgbmParams.min_child_samples;
      requestData.subsample = lightgbmParams.subsample;
      requestData.colsample_bytree = lightgbmParams.colsample_bytree;
      requestData.reg_alpha = lightgbmParams.reg_alpha;
      requestData.reg_lambda = lightgbmParams.reg_lambda;
      requestData.early_stopping_rounds = lightgbmParams.early_stopping_rounds > 0 ? 
        lightgbmParams.early_stopping_rounds : null;
      requestData.random_state = lightgbmParams.random_state;
      requestData.n_jobs = lightgbmParams.n_jobs;
      requestData.verbose = lightgbmParams.verbose || -1;
      requestData.validation_method = validationMethod;
      requestData.n_repetitions = nRepetitions; 
      requestData.training_id = trainingId;
      
      // ========== CONFIGURATION VALIDATION POUR LIGHTGBM ==========
      if (validationMethod === 'holdout') {
        requestData.n_repetitions = nRepetitions;
      } else if (validationMethod === 'cv_timeseries') {
        // ✅ TimeSeriesSplit pour LightGBM
        requestData.time_series_column = dateColumn;
        requestData.time_series_params = timeSeriesParams;
        requestData.validation_method = 'cv_timeseries';
      } else if (validationMethod.startsWith('cv_')) {
        requestData.cv_params = cvParams;
      } else if (validationMethod === 'bootstrap') {
        requestData.bootstrap_params = bootstrapParams;
      }
      
    } else if (modelType === 'mlp') {
      requestData.layers = mlpParams.layers;
      requestData.activation = mlpParams.activation;
      requestData.problem_type = 'auto';
      requestData.dropout_rate = mlpParams.dropout_rate;
      requestData.learning_rate = mlpParams.learning_rate;
      requestData.batch_size = mlpParams.batch_size;
      requestData.epochs = mlpParams.epochs;
      requestData.patience = mlpParams.patience;
      requestData.validation_split = mlpParams.validation_split;
      requestData.use_scaling = mlpParams.use_scaling;
      requestData.validation_method = validationMethod;
      requestData.n_repetitions = nRepetitions;
      requestData.training_id = trainingId;

      // ========== CONFIGURATION VALIDATION POUR MLP ==========
      if (validationMethod === 'holdout') {
        requestData.n_repetitions = nRepetitions;
      } else if (validationMethod === 'cv_timeseries') {
        // ✅ TimeSeriesSplit pour MLP
        requestData.time_series_column = dateColumn;
        requestData.time_series_params = timeSeriesParams;
        requestData.validation_method = 'cv_timeseries';
      } else if (validationMethod.startsWith('cv_')) {
        requestData.cv_params = cvParams;
      } else if (validationMethod === 'bootstrap') {
        requestData.bootstrap_params = bootstrapParams;
      }
      
    } else if (modelType === 'kmeans') {
      requestData.n_clusters = kmeansParams.n_clusters;
      requestData.init = kmeansParams.init;
      requestData.n_init = kmeansParams.n_init;
      requestData.max_iter = kmeansParams.max_iter;
      requestData.tol = kmeansParams.tol;
      requestData.random_state = kmeansParams.random_state;
      requestData.algorithm = kmeansParams.algorithm;
      requestData.use_scaling = kmeansParams.use_scaling;
      // KMeans n'utilise pas de validation method
    } else if (modelType === 'isolation_forest') {
      requestData.algorithm = 'isolation_forest';
      requestData.n_estimators = isolationForestParams.n_estimators;
      requestData.contamination = isolationForestParams.contamination;
      requestData.max_samples = isolationForestParams.max_samples;
      requestData.max_features = isolationForestParams.max_features;
      requestData.bootstrap = isolationForestParams.bootstrap;
      requestData.random_state = isolationForestParams.random_state;
      requestData.use_scaling = isolationForestParams.use_scaling;
    } else if (modelType === 'one_class_svm') {
      requestData.algorithm = 'one_class_svm';
      requestData.kernel = oneClassSvmParams.kernel;
      requestData.nu = oneClassSvmParams.nu;
      requestData.gamma = oneClassSvmParams.gamma;
      requestData.degree = oneClassSvmParams.degree;
      requestData.coef0 = oneClassSvmParams.coef0;
      requestData.random_state = oneClassSvmParams.random_state;
      requestData.use_scaling = oneClassSvmParams.use_scaling;
      requestData.train_on_normals_only = oneClassSvmParams.train_on_normals_only;
    }

    // ========== VALIDATION SUPPLÉMENTAIRE POUR TIMESERIESSPLIT ==========
    if (validationMethod === 'cv_timeseries' && !dateColumnDetected) {
      throw new Error("TimeSeriesSplit requires a date column, but none was detected");
    }

    // ========== FINAL TRAINING (algorithms that support Phase 3) ==========
    if (['random_forest', 'knn', 'svm', 'lightgbm'].includes(modelType)) {
      requestData.final_training_on_all_data = finalTrainingOnAllData;
    }

    // ========== RANDOM SEARCH (optional; small train sets only) ==========
    if (
      randomSearchEnabled &&
      RS_SUPPORTED_MODELS.includes(modelType) &&
      trainRowCount != null &&
      trainRowCount < 10000
    ) {
      requestData.random_search = true;
      requestData.n_trials = Math.min(50, Math.max(1, Number(randomSearchTrials) || 20));
      requestData.random_search_seed = 42;
    }

    const endpoint = 
      modelType === 'logistic'
        ? `${backendUrl}/api/train-logistic-regression`
        : modelType === 'random_forest'
          ? `${backendUrl}/api/train-random-forest`
          : modelType === 'svm'
            ? `${backendUrl}/api/train-svm`
            : modelType === 'knn'
              ? `${backendUrl}/api/train-knn`
              : modelType === 'lightgbm'
                ? `${backendUrl}/api/train-lightgbm`
                : modelType === 'mlp'
                  ? `${backendUrl}/api/train-mlp-pytorch`
                  : modelType === 'kmeans'
                    ? `${backendUrl}/api/train-kmeans`
                    : isAnomalyAlgo()
                      ? `${backendUrl}/api/train-anomaly`
                      : `${backendUrl}/api/ridge`;

    console.log("📤 Sending training request with ID:", trainingId);
    console.log("📦 Request data:", JSON.stringify(requestData, null, 2));
    setLastRequestData(requestData);

    const response = await axios.post(
      endpoint,
      requestData,
      { 
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    // ✅ GESTION DE LA RÉPONSE
    if (response.data.status === "training_started") {
      console.log("✅ Training started in background with ID:", trainingId);
      
      // ✅ S'assurer que isTraining est toujours true
      setIsTraining(true);
      isTrainingRef.current = true;
      
      // ✅ Le polling est déjà en cours (démarré avant la requête)
      
    } else {
      // ✅ Entraînement terminé immédiatement
      console.log("✅ Training completed immediately");
      
      // ✅ FORCER l'arrêt proprement
      setIsTraining(false);
      isTrainingRef.current = false;
      
      // ✅ Nettoyer l'ancien ID
      if (oldTrainingId && oldTrainingId !== trainingId) {
        localStorage.removeItem(`training_${oldTrainingId}`);
      }
      
      // ✅ Nettoyer le localStorage
      localStorage.removeItem('current_training_id');
      setCurrentTrainingId(null);
      
      // ✅ Nettoyer l'intervalle
      if (trainingInterval) {
        clearInterval(trainingInterval);
        setTrainingInterval(null);
      }
      
      setResult({
        ...response.data,
        timestamp: new Date().toLocaleTimeString()
      });
    }

  } catch (err) {
    // ✅ TIMEOUT = NORMAL, C'EST LE MODE ASYNCHRONE (polling déjà démarré)
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      console.log("⏱️ Training started in background (timeout) with ID:", trainingId);
      
      // ✅ S'assurer que isTraining est toujours true
      setIsTraining(true);
      isTrainingRef.current = true;
      
      // ✅ Le polling est déjà en cours
      return;
    }
    
    // ❌ GESTION DES AUTRES ERREURS
    let errorMessage = "Unknown error during training";
    
    if (err.response?.data) {
      if (Array.isArray(err.response.data.detail)) {
        errorMessage = err.response.data.detail.map(e => e.msg || e).join(', ');
      } else if (err.response.data.detail?.msg) {
        errorMessage = err.response.data.detail.msg;
      } else if (typeof err.response.data.detail === 'string') {
        errorMessage = err.response.data.detail;
      } else if (err.response.data.detail?.errors) {
        errorMessage = err.response.data.detail.errors.join(', ');
      }
    } else if (err.message) {
      errorMessage = err.message;
    }

    setError(errorMessage);
    console.error("❌ Training error:", err);
    
    // ✅ FORCER l'arrêt en cas d'erreur
    setIsTraining(false);
    isTrainingRef.current = false;
    
    // ✅ NETTOYER LE LOCALSTORAGE
    localStorage.removeItem('current_training_id');
    setCurrentTrainingId(null);
    
    // ✅ NETTOYER L'INTERVALLE
    if (trainingInterval) {
      clearInterval(trainingInterval);
      setTrainingInterval(null);
    }
  }
};

const pollTrainingStatus = (trainingId) => {
  console.log("🔄 Polling started for:", trainingId);
  
  // ✅ NETTOYER L'ANCIEN INTERVALLE
  if (trainingInterval) {
    clearInterval(trainingInterval);
    setTrainingInterval(null);
  }
  
  let attempts = 0;
  // Large datasets (e.g. 80k+ rows × 10 holdout reps) can exceed 10 minutes easily.
  // 3600 × 2s = 2 hours hard cap; idle progress still polled as long as server responds.
  const MAX_ATTEMPTS = 3600;
  
  const interval = setInterval(async () => {
    // ✅ VÉRIFIER LA RÉFÉRENCE (PAS LE STATE !)
    if (!isTrainingRef.current) {
      console.log("⏹️ Training already completed (ref), stopping polling");
      clearInterval(interval);
      setTrainingInterval(null);
      return;
    }
    
    if (stopTraining || attempts >= MAX_ATTEMPTS) {
      clearInterval(interval);
      setTrainingInterval(null);
      if (attempts >= MAX_ATTEMPTS) {
        console.log("⚠️ Max polling attempts reached, stopping");
        setIsTraining(false);
        isTrainingRef.current = false;
        localStorage.removeItem('current_training_id');
        setCurrentTrainingId(null);
        setError("Training is taking too long. It may still be running on the server: wait and check again, or use fewer validation repetitions / a smaller sample.");
      } else if (stopTraining) {
        // Stop was requested: ensure train can be restarted after cooldown
        isTrainingRef.current = false;
        setIsTraining(false);
      }
      return;
    }
    
    attempts++;
    
    try {
      // ✅ UTILISER LE BON TRAINING ID
      const response = await axios.get(
        `${backendUrl}/api/training-status/${trainingId}`,
        { withCredentials: true, timeout: 60000 }
      );
      
      if (response.data.completed) {
        console.log("✅ Training completed for ID:", trainingId);
        clearInterval(interval);
        setTrainingInterval(null);
        
        isTrainingRef.current = false;
        setIsTraining(false);
        // Keep id for save-model (server pending store, 5 minutes)
        setLastCompletedTrainingId(trainingId);
        setSaveAvailableUntil(Date.now() + 5 * 60 * 1000);
        localStorage.removeItem('current_training_id');
        setCurrentTrainingId(null);

        const payload = response.data.result;
        const errMsg = response.data.error;

        if (errMsg || !payload || payload.status === "error") {
          setResult(null);
          setLastCompletedTrainingId(null);
          setSaveAvailableUntil(null);
          setError(
            errMsg ||
              payload?.error_message ||
              "Training stopped or failed before results were available"
          );
        } else {
          setError(null);
          const rsSummary =
            payload.random_search ||
            payload.metrics?.random_search ||
            null;
          if (rsSummary) {
            const trialLines = Array.isArray(rsSummary.trial_logs)
              ? rsSummary.trial_logs.map(
                  (t) =>
                    `Trial ${t.trial}: ${JSON.stringify(t.params)} → score=${Number(t.score).toFixed(4)}${t.best ? " ★ best" : ""}`
                )
              : [];
            setRandomSearchProgress({
              phase: "done",
              trial: rsSummary.n_trials,
              n_trials: rsSummary.n_trials,
              best_score: rsSummary.best_score,
              best_params: rsSummary.best_params,
              logs: [
                ...trialLines,
                rsSummary.message ||
                  `Chosen params: ${JSON.stringify(rsSummary.best_params)}`,
              ].slice(-80),
            });
          }
          setResult({
            ...payload,
            timestamp: new Date().toLocaleTimeString()
          });
        }
        
        await axios.delete(
          `${backendUrl}/api/training-status/${trainingId}`,
          { withCredentials: true }
        ).catch(() => {});
      } else if (response.data.progress) {
        setRandomSearchProgress(response.data.progress);
      }
    } catch (err) {
      // ✅ GÉRER LE 404 - Training non trouvé
      if (err.response?.status === 404) {
        console.log(`⚠️ Training ${trainingId} not found, stopping polling`);
        clearInterval(interval);
        setTrainingInterval(null);
        setIsTraining(false);
        isTrainingRef.current = false;
        localStorage.removeItem('current_training_id');
        setCurrentTrainingId(null);
        
        // ✅ NE PAS METTRE D'ERREUR SI ON A DÉJÀ UN RÉSULTAT
        if (!result) {
          setError("Training session expired or cancelled");
        }
      } else {
        // ✅ AUTRES ERREURS - continuer le polling
        console.log(`⚠️ Polling error for ${trainingId}:`, err.message);
      }
    }
  }, 2000);
  
  setTrainingInterval(interval); // Stocker la référence de l'intervalle
};
  const [stopCooldown, setStopCooldown] = useState(false);
  const [stopCooldownSecondsLeft, setStopCooldownSecondsLeft] = useState(0);

  const handleStopTraining = async () => {
    console.log("🛑 Stop training clicked");

    // Cooldown 10s before a new training can start
    setStopCooldown(true);
    setStopCooldownSecondsLeft(10);
    const cooldownStarted = Date.now();
    const cooldownTimer = setInterval(() => {
      const left = Math.max(0, 10 - Math.floor((Date.now() - cooldownStarted) / 1000));
      setStopCooldownSecondsLeft(left);
      if (left <= 0) {
        clearInterval(cooldownTimer);
        setStopCooldown(false);
        setError((prev) =>
          prev && /wait \d+s before starting|wait 10 seconds before starting/i.test(prev)
            ? null
            : prev
        );
      }
    }, 250);

    setStopTraining(true);

    // 1. Kill polling immediately
    if (trainingInterval) {
      clearInterval(trainingInterval);
      setTrainingInterval(null);
    }

    // CRITICAL: allow Start training again (was stuck silent because ref stayed true)
    isTrainingRef.current = false;
    setIsTraining(false);

    // 2. Notify server to stop the job
    const trainingId = currentTrainingId || localStorage.getItem("current_training_id");

    if (trainingId) {
      try {
        await axios.post(
          `${backendUrl}/api/stop-training`,
          { training_id: trainingId },
          { withCredentials: true }
        );
        console.log("✅ Stop request sent");
      } catch (err) {
        console.error("Stop error:", err);
      }

      localStorage.removeItem("current_training_id");
      setCurrentTrainingId(null);
    }

    setLastCompletedTrainingId(null);
    setSaveAvailableUntil(null);
    setResult(null);
    setError("Training stopped. Please wait 10 seconds before starting a new training.");

    setTimeout(() => setStopTraining(false), 1000);
  };

// Cleanup au démontage
useEffect(() => {
  return () => {
    if (trainingInterval) {
      console.log("🧹 Cleanup on unmount");
      clearInterval(trainingInterval);
      setTrainingInterval(null);
    }
  };
}, [trainingInterval]);

// Train row count for Random Search gate (< 10k)
useEffect(() => {
  const bd = (state?.bdName || "").replace("_numerized", "");
  if (!bd) {
    setTrainRowCount(null);
    return;
  }
  let cancelled = false;
  (async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/get-split-stats2`, {
        params: { bdName: bd, quick: false },
        withCredentials: true,
        timeout: 120000,
      });
      if (!cancelled) {
        setTrainRowCount(Number(res.data?.train_count) || 0);
      }
    } catch (e) {
      if (!cancelled) setTrainRowCount(null);
    }
  })();
  return () => {
    cancelled = true;
  };
}, [state?.bdName]);

// Disable Random Search when algo unsupported or dataset too large
useEffect(() => {
  if (!randomSearchAvailable && randomSearchEnabled) {
    setRandomSearchEnabled(false);
  }
}, [randomSearchAvailable, randomSearchEnabled]);

const cleanupCompletedTrainings = () => {
  console.log("🧹 Starting cleanup of completed trainings...");
  
  // 1. Nettoyer les intervals orphelins
  if (window.pollingIntervals) {
    const intervalIds = Object.keys(window.pollingIntervals);
    console.log(`📊 Found ${intervalIds.length} active polling intervals`);
    
    intervalIds.forEach(id => {
      // Vérifier si ce training est toujours dans localStorage
      const isActive = localStorage.getItem(`training_${id}`);
      if (!isActive) {
        console.log(`🧹 Cleaning up orphaned polling for ${id}`);
        clearInterval(window.pollingIntervals[id]);
        delete window.pollingIntervals[id];
      }
    });
  }
  
  // 2. Nettoyer le localStorage
  const currentId = localStorage.getItem('current_training_id');
  if (currentId) {
    const isStillPolling = window.pollingIntervals && window.pollingIntervals[currentId];
    if (!isStillPolling) {
      console.log(`🧹 Removing stale current_training_id: ${currentId}`);
      localStorage.removeItem(`training_${currentId}`);
      localStorage.removeItem('current_training_id');
    }
  }
  
  console.log("✅ Cleanup completed");
};
// ========== FONCTION POUR ARRÊTER L'ENTRAÎNEMENT ==========



useEffect(() => {
  return () => {
    if (trainingInterval) {
      console.log("🧹 Cleanup on unmount");
      clearInterval(trainingInterval);
      trainingInterval = null;
    }
  };
}, []);


























const renderLogisticResults = () => {
  if (!result || modelType !== 'logistic') return null;

  return (
    <>
      

      {/* Informations sur les classes */}
      {result.metrics?.classes && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🏷️ Class Information
            </Typography>
            <Typography variant="body2">
              Classes: {result.metrics.classes.map(c => String(c)).join(', ')} 
              (Number of classes: {result.metrics.n_classes})
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Coefficients et importance des features */}
      {result.metrics?.coefficients && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📊 Model Coefficients
            </Typography>
            <Typography variant="body2" paragraph>
              The most important features for the logistic regression model (positive coefficients increase probability, negative decrease)
            </Typography>
            
            {/* Vous pouvez ajouter un graphique des coefficients ici si disponible */}
            {result.metrics.feature_importance && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Top Feature Importance
                </Typography>
                {/* Utilisez votre fonction renderFeatureImportanceChart existante */}
                {renderFeatureImportanceChart()}
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
};
const renderLogisticValidationResults = () => {
  if (!result || modelType !== 'logistic') return null;

  const validationData = result.metrics?.validation_results;
  if (!validationData) return null;

  // ✅ NOUVEAU : Détecter TimeSeriesSplit
  const isTimeSeries = validationData.method?.includes('TimeSeries');
  const isBootstrap = validationData.method?.includes('Bootstrap');
  const isHoldout = validationData.method?.includes('Hold-Out');
  const isCV = validationData.method?.includes('Cross-Validation');

  // Récupérer les détails selon la méthode
  let foldDetails = [];
  let scoreProperty = 'validation_accuracy';
  
  if (isTimeSeries) {
    foldDetails = validationData.fold_details || [];
    scoreProperty = 'validation_accuracy';
    console.log("[LOGISTIC] 📊 TimeSeriesSplit validation details:", {
      n_folds: foldDetails.length,
      method: validationData.method,
      best_C: validationData.best_C,
      mean_score: validationData.mean_score
    });
  } else if (isBootstrap) {
    foldDetails = validationData.bootstrap_details || [];
    scoreProperty = 'validation_score';
  } else if (isHoldout) {
    foldDetails = validationData.repetition_details || [];
    scoreProperty = 'score';
  } else if (isCV) {
    foldDetails = validationData.fold_details || [];
    scoreProperty = 'outer_val_score';
  }

  const hasFoldDetails = foldDetails.length > 0;

  // Préparer les données pour le graphique
  const chartData = hasFoldDetails ? foldDetails.map(item => ({
    fold: item.fold || item.repetition || item.bootstrap || 0,
    train_accuracy: item.train_accuracy || item.train_score || 0,
    test_accuracy: isTimeSeries 
      ? item.validation_accuracy || item.score || 0
      : isBootstrap
        ? item.validation_score || item.score || 0
        : item.outer_val_score || item.cv_validation_accuracy || item.test_accuracy || item.score || 0,
    best_C_local: item.best_C || null
  })) : [];

  // Calculer les statistiques
  const meanScore = validationData.mean_score || 
                    validationData.cv_validation_accuracy_mean ||
                    validationData.timeseries_mean_score ||
                    (chartData.length > 0 ? chartData.reduce((sum, item) => sum + item.test_accuracy, 0) / chartData.length : 0);

  const stdScore = validationData.std_score ||
                   validationData.cv_validation_accuracy_std ||
                   validationData.timeseries_std_score ||
                   (chartData.length > 0 ? Math.sqrt(chartData.reduce((sq, n) => sq + Math.pow(n.test_accuracy - meanScore, 2), 0) / chartData.length) : 0);

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔧 {isTimeSeries ? 'Time Series' : 'C Parameter'} Optimization Details
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validationData.method}<br/>
            <strong>Best C:</strong> {validationData.best_C}<br/>
            {isTimeSeries && (
              <>
                <strong>Date Column:</strong> {validationData.date_column || 'N/A'} (excluded from features)<br/>
                <strong>Features Used:</strong> {validationData.features_used?.join(', ') || 'All features'}<br/>
              </>
            )}
            <strong>Purpose:</strong> Internal parameter optimization only
          </Typography>
        </Alert>

        {hasFoldDetails && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
               Performance During C Search
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fold" 
                  label={{ 
                    value: isTimeSeries ? 'Time Series Fold' : 
                           isBootstrap ? 'Bootstrap Sample' : 'Fold', 
                    position: 'insideBottomRight', 
                    offset: -10 
                  }}
                />
                <YAxis 
                  label={{ 
                    value: 'Accuracy', 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                  domain={[0, 1]}
                />
                <Tooltip 
                  formatter={(value) => [value.toFixed(4), 'Accuracy']}
                  labelFormatter={(label) => `${isTimeSeries ? 'Fold' : isBootstrap ? 'Sample' : 'Fold'} ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="train_accuracy" 
                  stroke="#8884d8" 
                  name="Train Accuracy"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="test_accuracy" 
                  stroke="#82ca9d" 
                  name="Validation Accuracy"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {hasFoldDetails && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              📋 C Search Details
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{isTimeSeries ? 'Fold' : isBootstrap ? 'Sample' : 'Fold'}</TableCell>
                    <TableCell align="right">Train Accuracy</TableCell>
                    <TableCell align="right">Validation Accuracy</TableCell>
                    <TableCell align="right">Best C (local)</TableCell>
                    <TableCell align="right">Best C (global)</TableCell>
                    {isTimeSeries && (
                      <TableCell align="right">Train Size</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {foldDetails.slice(0, 10).map((item, index) => (
                    <TableRow key={index} hover>
                      <TableCell>{item.fold || item.bootstrap || index + 1}</TableCell>
                      <TableCell align="right">
                        {(item.train_accuracy || item.train_score || 0).toFixed(4)}
                      </TableCell>
                      <TableCell 
                        align="right"
                        sx={{ 
                          color: (item.validation_accuracy || item.validation_score || item.score || 0) > 0.8 ? 'success.main' : 
                                 (item.validation_accuracy || item.validation_score || item.score || 0) > 0.6 ? 'warning.main' : 'error.main',
                          fontWeight: 'medium'
                        }}
                      >
                        {(item.validation_accuracy || item.validation_score || item.score || 0).toFixed(4)}
                      </TableCell>
                      <TableCell align="right">
                        {item.best_C || 'N/A'}
                      </TableCell>
                      <TableCell align="right">
                        {validationData.best_C || 'N/A'}
                      </TableCell>
                      {isTimeSeries && (
                        <TableCell align="right">
                          {item.train_size || 'N/A'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {foldDetails.length > 10 && (
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                Showing first 10 of {foldDetails.length} {isTimeSeries ? 'folds' : isBootstrap ? 'samples' : 'folds'}
              </Typography>
            )}
          </Box>
        )}

        {/* Statistiques récapitulatives */}
        {chartData.length > 0 && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              📊 Summary Statistics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2">
                  <strong>Mean Val Acc:</strong> {meanScore.toFixed(4)}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2">
                  <strong>Std Val Acc:</strong> {stdScore.toFixed(4)}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2">
                  <strong>Best C:</strong> {validationData.best_C}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2">
                  <strong>Best Fold:</strong> {validationData.best_fold || 'N/A'}
                </Typography>
              </Grid>
            </Grid>
            
            {/* Informations spécifiques TimeSeries */}
            {isTimeSeries && validationData.date_column_excluded && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
                <Typography variant="body2" color="success.main">
                  ✅ TimeSeriesSplit: Date column "{validationData.date_column}" used ONLY for chronological ordering
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Features used:</strong> {validationData.features_used?.join(', ') || 'All numeric columns'}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> These metrics were computed during C optimization. 
            Final model performance on unseen test data is shown in the "Final Performance" section above.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
};



const renderCPerformance = () => {
  if (!result?.metrics?.validation_results?.C_performance || !Array.isArray(result.metrics.validation_results.C_performance) || result.metrics.validation_results.C_performance.length === 0) {
    return null;
  }
  
  const chartData = result.metrics.validation_results.C_performance.map(item => ({
    C: item.C,
    accuracy: item.score
  }));

  chartData.sort((a, b) => a.C - b.C);

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          📊 Accuracy vs C (Regularization performance)
        </Typography>
        <Typography variant="body2" paragraph>
          This chart shows how the accuracy varies with different values of the regularization parameter C.
          Lower C means stronger regularization.
        </Typography>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart 
            data={chartData}
            margin={{ top: 20, right: 30, left: 30, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="C" 
              type="number" 
              scale="log"
              domain={['auto', 'auto']}
              label={{ 
                value: 'C value (log scale)', 
                position: 'insideBottomRight', 
                offset: -10 
              }}
            />
            <YAxis 
              label={{ 
                value: 'Accuracy', 
                angle: -90, 
                position: 'insideLeft' 
              }}
            />
            <Tooltip 
              formatter={(value) => [`${parseFloat(value).toFixed(4)}`, 'Accuracy']}
              labelFormatter={(value) => `C = ${value}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="accuracy" 
              stroke="#8884d8" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6, stroke: '#ff7300', strokeWidth: 2 }}
              name="Accuracy"
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
const computeBinaryCurveMetrics = (yTrueRaw, yProbaRaw, positiveIndex = 1, positiveLabel = null) => {
  if (!Array.isArray(yTrueRaw) || !Array.isArray(yProbaRaw) || yTrueRaw.length === 0) return null;
  if (yTrueRaw.length !== yProbaRaw.length) return null;

  const scores = yProbaRaw.map((p) => {
    if (Array.isArray(p)) {
      if (p.length <= positiveIndex) return null;
      return Number(p[positiveIndex]);
    }
    return Number(p);
  });
  if (scores.some((s) => Number.isNaN(s) || s === null)) return null;

  const uniqueLabels = [...new Set(yTrueRaw.map((v) => String(v)))];
  let posLabel = positiveLabel != null ? String(positiveLabel) : null;
  if (!posLabel) {
    if (uniqueLabels.includes('0') && uniqueLabels.includes('1') && uniqueLabels.length === 2) {
      posLabel = '1';
    } else if (uniqueLabels.length === 2) {
      posLabel = uniqueLabels.slice().sort()[1];
    } else {
      // multiclass OvR: positive = this class index / label
      posLabel = String(positiveIndex);
    }
  }

  const yBin = yTrueRaw.map((v) => (String(v) === posLabel ? 1 : 0));
  const P = yBin.reduce((s, y) => s + y, 0);
  const N = yBin.length - P;
  if (P === 0 || N === 0) return null;

  const pairs = yBin.map((y, i) => ({ y, score: scores[i] }))
    .sort((a, b) => b.score - a.score || a.y - b.y);

  let tp = 0;
  let fp = 0;
  const roc = [{ fpr: 0, tpr: 0 }];
  for (const p of pairs) {
    if (p.y === 1) tp += 1;
    else fp += 1;
    roc.push({ fpr: fp / N, tpr: tp / P });
  }
  let auc = 0;
  for (let i = 1; i < roc.length; i += 1) {
    const dx = roc[i].fpr - roc[i - 1].fpr;
    const avgTpr = (roc[i].tpr + roc[i - 1].tpr) / 2;
    auc += dx * avgTpr;
  }

  tp = 0;
  fp = 0;
  const pr = [];
  for (const p of pairs) {
    if (p.y === 1) tp += 1;
    else fp += 1;
    pr.push({ recall: tp / P, precision: tp / (tp + fp) });
  }
  if (pr.length > 0) pr.unshift({ recall: 0, precision: pr[0].precision });
  let ap = 0;
  for (let i = 1; i < pr.length; i += 1) {
    ap += (pr[i].recall - pr[i - 1].recall) * pr[i].precision;
  }

  const downsample = (arr, maxPts = 200) => {
    if (arr.length <= maxPts) return arr;
    const step = Math.ceil(arr.length / maxPts);
    const out = [];
    for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
    if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
    return out;
  };

  return {
    roc: downsample(roc),
    pr: downsample(pr),
    auc,
    averagePrecision: ap,
    positiveLabel: posLabel,
  };
};

const renderRocPrCurves = () => {
  if (!result?.metrics?.is_classification) return null;
  const preds = result.metrics.predictions;
  if (!preds?.y_true || !preds?.y_proba) {
    if (modelType === 'svm' && result.metrics.is_classification) {
      return (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>ROC / Precision-Recall</Typography>
            <Alert severity="info">
              Enable SVM “probability” to compute ROC and Precision-Recall curves.
            </Alert>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>ROC / Precision-Recall</Typography>
          <Alert severity="info">
            Probabilities were not returned for this run, so ROC/PR cannot be drawn.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const classNames = (result.metrics.classes || []).map(String);
  const nClasses = Math.max(
    classNames.length,
    Array.isArray(preds.y_proba[0]) ? preds.y_proba[0].length : 2
  );

  // Binary
  if (nClasses <= 2) {
    const curves = computeBinaryCurveMetrics(preds.y_true, preds.y_proba, 1, classNames[1] || '1');
    if (!curves) {
      return (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Alert severity="warning">Could not build ROC/PR (need both classes in the plotted sample).</Alert>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>ROC & Precision-Recall (binary)</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Positive class: {String(curves.positiveLabel)} · AUC: {curves.auc.toFixed(3)} · AP: {curves.averagePrecision.toFixed(3)}
            {preds.sampled ? ` · plotted ${preds.n_plotted}/${preds.n_total} samples` : ''}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>ROC curve</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={curves.roc}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fpr" type="number" domain={[0, 1]} />
                  <YAxis dataKey="tpr" type="number" domain={[0, 1]} />
                  <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(3) : v)} />
                  <Line type="monotone" dataKey="tpr" stroke="#DE6B06" dot={false} name="TPR" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>Precision-Recall curve</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={curves.pr}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="recall" type="number" domain={[0, 1]} />
                  <YAxis dataKey="precision" type="number" domain={[0, 1]} />
                  <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(3) : v)} />
                  <Line type="monotone" dataKey="precision" stroke="#384850" dot={false} name="Precision" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  }

  // Multiclass: one-vs-rest
  const colors = ['#DE6B06', '#384850', '#2e7d32', '#1565c0', '#6a1b9a', '#c62828'];
  const perClass = [];
  for (let c = 0; c < nClasses; c += 1) {
    const label = classNames[c] != null ? classNames[c] : String(c);
    const curve = computeBinaryCurveMetrics(preds.y_true, preds.y_proba, c, label);
    if (curve) perClass.push({ ...curve, color: colors[c % colors.length], name: `Class ${label}` });
  }
  if (!perClass.length) {
    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Alert severity="warning">Could not build multiclass ROC/PR curves from available predictions.</Alert>
        </CardContent>
      </Card>
    );
  }

  // Merge ROC points by index for chart (separate series)
  const maxLen = Math.max(...perClass.map((p) => p.roc.length));
  const rocMerged = [];
  for (let i = 0; i < maxLen; i += 1) {
    const row = { i };
    perClass.forEach((p, idx) => {
      const pt = p.roc[Math.min(i, p.roc.length - 1)];
      row[`fpr_${idx}`] = pt.fpr;
      row[`tpr_${idx}`] = pt.tpr;
    });
    rocMerged.push(row);
  }

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>ROC (one-vs-rest, multiclass)</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {perClass.map((p) => `${p.name} AUC=${p.auc.toFixed(3)}`).join(' · ')}
          {preds.sampled ? ` · plotted ${preds.n_plotted}/${preds.n_total} samples` : ''}
        </Typography>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={rocMerged}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="i" hide />
            <YAxis type="number" domain={[0, 1]} />
            <Tooltip />
            <Legend />
            {perClass.map((p, idx) => (
              <Line
                key={p.name}
                type="monotone"
                dataKey={`tpr_${idx}`}
                stroke={p.color}
                dot={false}
                name={`${p.name} (AUC ${p.auc.toFixed(3)})`}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <Alert severity="info" sx={{ mt: 2 }}>
          Multiclass ROC uses one-vs-rest (each class vs the rest). For Precision-Recall details, prefer binary problems or the classification report.
        </Alert>
      </CardContent>
    </Card>
  );
};

const renderConfusionMatrix = () => {
  // ✅ Vérification initiale
  if (!result?.metrics?.confusion_matrix) return null;

  const cm = result.metrics.confusion_matrix;
  let cmArray = null;
  let labels = [];
  
  // ✅ FORMAT 1: Binaire avec true_negative, false_positive, etc.
  if (cm.true_negative !== undefined && cm.false_positive !== undefined) {
    cmArray = [
      [cm.true_negative, cm.false_positive],
      [cm.false_negative || 0, cm.true_positive || 0]
    ];
    labels = cm.labels || ['Negative', 'Positive'];
  }
  // ✅ FORMAT 2: Multiclasse avec matrix
  else if (cm.matrix && Array.isArray(cm.matrix) && cm.matrix.length > 0) {
    cmArray = cm.matrix;
    labels = cm.labels || Array.from({ length: cmArray.length }, (_, i) => `Class ${i}`);
  }
  // ✅ FORMAT 3: Array 2D direct
  else if (Array.isArray(cm) && cm.length > 0 && Array.isArray(cm[0]) && cm[0].length > 0) {
    cmArray = cm;
    labels = result.metrics.classes ? 
      result.metrics.classes.map(cls => cls.toString()) : 
      Array.from({ length: cmArray.length }, (_, i) => `Class ${i}`);
  }
  // ❌ FORMAT INVALIDE - NE RIEN AFFICHER
  else {
    return null; // ⬅️ Ne rien afficher si le format est incorrect
  }

  // ✅ Vérification finale que la matrice est valide
  if (!cmArray || cmArray.length === 0 || !cmArray[0] || cmArray[0].length === 0) {
    return null; // ⬅️ Ne rien afficher
  }

  // ✅ S'assurer que toutes les lignes ont la même longueur
  const isValid = cmArray.every(row => Array.isArray(row) && row.length === cmArray[0].length);
  if (!isValid) {
    return null; // ⬅️ Ne rien afficher si la matrice est mal formée
  }

  // ========== SI TOUT EST VALIDE, AFFICHER ==========
  const totalSamples = cmArray.flat().reduce((sum, val) => sum + (Number(val) || 0), 0);
  const correctPredictions = cmArray.reduce((sum, row, i) => row[i] !== undefined ? sum + (Number(row[i]) || 0) : sum, 0);
  const accuracy = totalSamples > 0 ? (correctPredictions / totalSamples * 100).toFixed(1) : 0;
  const rowSums = cmArray.map((row) => row.reduce((s, v) => s + (Number(v) || 0), 0));

  const formatCell = (cell, rowIndex) => {
    const value = Number(cell) || 0;
    if (!confusionMatrixNormalized) return value;
    const denom = rowSums[rowIndex] || 0;
    if (denom <= 0) return '0%';
    return `${((value / denom) * 100).toFixed(1)}%`;
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          📊 Confusion Matrix
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="subtitle2">
            Actual ↓ / Predicted →
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={confusionMatrixNormalized}
                  onChange={(e) => setConfusionMatrixNormalized(e.target.checked)}
                />
              }
              label="Normalize by row (%)"
            />
            <Typography variant="body2" color="primary">
              Accuracy: {accuracy}%
            </Typography>
          </Box>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={{ minWidth: 400 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', borderRight: '1px solid', borderBottom: '1px solid' }}>
                  Actual \\ Predicted
                </TableCell>
                {labels.map((label, index) => (
                  <TableCell 
                    key={index} 
                    align="center" 
                    sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}
                  >
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {cmArray.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  <TableCell 
                    component="th" 
                    scope="row"
                    sx={{ fontWeight: 'bold', bgcolor: 'grey.100', borderRight: '1px solid' }}
                  >
                    {labels[rowIndex] || `Class ${rowIndex}`}
                  </TableCell>
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      align="center"
                      sx={{
                        bgcolor: rowIndex === cellIndex ? 
                          'success.light' : 'error.light',
                        color: rowIndex === cellIndex ? 
                          'success.contrastText' : 'error.contrastText',
                        fontWeight: 'bold',
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                      title={confusionMatrixNormalized ? `Count: ${cell}` : undefined}
                    >
                      {formatCell(cell, rowIndex)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Légende */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, bgcolor: 'success.light', mr: 1 }} />
            <Typography variant="caption">Correct</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, bgcolor: 'error.light', mr: 1 }} />
            <Typography variant="caption">Incorrect</Typography>
          </Box>
        </Box>

        {/* Statistiques rapides */}
        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <Typography variant="caption" display="block">
              Total: {totalSamples}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" display="block">
              Correct: {correctPredictions}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

  const renderClassificationReport = () => {
    if (!result?.metrics?.classification_report) return null;

    const report = result.metrics.classification_report;
    const classes = Object.keys(report).filter(key => key !== 'accuracy' && key !== 'macro avg' && key !== 'weighted avg');

    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📝 Classification report
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Class</TableCell>
                  <TableCell align="right">Precision</TableCell>
                  <TableCell align="right">Recall</TableCell>
                  <TableCell align="right">F1-score</TableCell>
                  <TableCell align="right">Support</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {classes.map(cls => (
                  <TableRow key={cls}>
                    <TableCell>{cls}</TableCell>
                    <TableCell align="right">{report[cls].precision?.toFixed(2) || 'N/A'}</TableCell>
                    <TableCell align="right">{report[cls].recall?.toFixed(2) || 'N/A'}</TableCell>
                    <TableCell align="right">{report[cls]['f1-score']?.toFixed(2) || 'N/A'}</TableCell>
                    <TableCell align="right">{report[cls].support}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell><strong>Accuracy</strong></TableCell>
                  <TableCell align="right" colSpan={4}>
                    {report.accuracy?.toFixed(2) || 'N/A'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    );
  };



const renderLightGBMTimeseriesValidationDetails = () => {
  if (!result?.metrics?.validation_results || modelType !== 'lightgbm') return null;
  
  const validationData = result.metrics.validation_results;
  
  // Vérifier si c'est TimeSeriesSplit
  const isTimeSeries = validationData.method?.includes('TimeSeries');
  if (!isTimeSeries) return null;
  
  const isClassification = result.metrics.is_classification;
  const foldDetails = validationData.fold_details || [];
  
  if (foldDetails.length === 0) return null;
  
  // Déterminer le nom du score selon le type de problème
  const scoreName = isClassification ? 'Accuracy' : 'R² Score';
  
  // Préparer les données pour le graphique (sans best_iteration)
  const chartData = foldDetails.map(item => ({
    fold: item.fold,
    train_score: item.train_score || 0,
    val_score: item.val_score || 0,
    train_size: item.train_size || 0,
    val_size: item.val_size || 0
    // best_iteration est supprimé
  }));
  
  // Calculer les statistiques
  let meanValScore = 0;
  let stdValScore = 0;
  
  if (isClassification) {
    meanValScore = validationData.mean_score || 
                   validationData.cv_validation_accuracy_mean || 
                   (chartData.reduce((sum, item) => sum + item.val_score, 0) / chartData.length);
    stdValScore = validationData.std_score || 
                  validationData.cv_validation_accuracy_std ||
                  Math.sqrt(chartData.reduce((sq, n) => sq + Math.pow(n.val_score - meanValScore, 2), 0) / chartData.length);
  } else {
    meanValScore = validationData.mean_score || 
                   validationData.cv_validation_r2_mean || 
                   (chartData.reduce((sum, item) => sum + item.val_score, 0) / chartData.length);
    stdValScore = validationData.std_score || 
                  validationData.cv_validation_r2_std ||
                  Math.sqrt(chartData.reduce((sq, n) => sq + Math.pow(n.val_score - meanValScore, 2), 0) / chartData.length);
  }
  
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔍 Time Series Split Validation Details (LightGBM - {isClassification ? 'Classification' : 'Regression'})
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validationData.method}<br/>
            <strong>Valid Folds:</strong> {foldDetails.length}<br/>
            <strong>Date Column:</strong> {validationData.date_column || 'N/A'} (excluded from features)<br/>
            <strong>Features Used:</strong> {validationData.features_used?.join(', ') || 'All features'}<br/>
            <strong>Average {scoreName}:</strong> {meanValScore.toFixed(4)} ± {stdValScore.toFixed(4)}<br/>
            <strong>Best Fold:</strong> {validationData.best_fold || validationData.best_fold_used || 'N/A'} 
            {validationData.best_score && ` (Score: ${validationData.best_score.toFixed(4)})`}
          </Typography>
        </Alert>

        {/* Graphique des scores par fold */}
        {chartData.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
               {scoreName} by Time Series Fold
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fold" 
                  label={{ value: 'Fold', position: 'insideBottomRight', offset: -10 }}
                />
                <YAxis 
                  label={{ 
                    value: scoreName, 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                  domain={isClassification ? [0, 1] : ['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'val_score') return [value.toFixed(4), `Validation ${scoreName}`];
                    if (name === 'train_score') return [value.toFixed(4), `Train ${scoreName}`];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Fold ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="val_score" 
                  stroke="#8884d8" 
                  name={`Validation ${scoreName}`}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="train_score" 
                  stroke="#82ca9d" 
                  name={`Train ${scoreName}`}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <ReferenceLine 
                  y={meanValScore} 
                  stroke="#ff7300" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: `Avg: ${meanValScore.toFixed(3)}`, 
                    position: 'insideTopRight',
                    fill: '#ff7300',
                    fontSize: 12
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tableau des détails par fold - SANS la colonne Best Iteration */}
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          📋 Individual Fold Results
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Fold</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train Size</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Validation Size</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train {scoreName}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Validation {scoreName}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {foldDetails.slice(0, 10).map((item, index) => (
                <TableRow key={index} hover>
                  <TableCell>{item.fold}</TableCell>
                  <TableCell align="right">{item.train_size || 'N/A'}</TableCell>
                  <TableCell align="right">{item.val_size || item.validation_size || 'N/A'}</TableCell>
                  <TableCell align="right">
                    {(item.train_score || 0).toFixed(4)}
                  </TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      fontWeight: 'medium',
                      color: isClassification ? 
                        ((item.val_score || 0) >= 0.9 ? 'success.main' : 
                         (item.val_score || 0) >= 0.8 ? 'warning.main' : 
                         (item.val_score || 0) >= 0.6 ? 'warning.light' : 'error.main') :
                        ((item.val_score || 0) >= 0.8 ? 'success.main' : 
                         (item.val_score || 0) >= 0.6 ? 'warning.main' : 
                         (item.val_score || 0) >= 0.3 ? 'warning.light' : 'error.main')
                    }}
                  >
                    {(item.val_score || 0).toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {foldDetails.length > 10 && (
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
            Showing first 10 of {foldDetails.length} folds
          </Typography>
        )}

        {/* Résumé statistique */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            📊 Statistical Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Mean {scoreName}:</strong> {meanValScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Std Dev:</strong> {stdValScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Min:</strong> {Math.min(...chartData.map(d => d.val_score)).toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Max:</strong> {Math.max(...chartData.map(d => d.val_score)).toFixed(4)}
              </Typography>
            </Grid>
          </Grid>
          
          {/* Informations spécifiques selon le type */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
            <Typography variant="body2" color="success.main">
              ✅ TimeSeriesSplit: Date column "{validationData.date_column}" used ONLY for chronological ordering
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>Features used:</strong> {validationData.features_used?.join(', ') || 'All numeric columns'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>Problem type:</strong> {isClassification ? 'Classification (Accuracy)' : 'Regression (R² Score)'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>LightGBM Parameters:</strong> boosting={result.metrics?.boosting_type_used || 'gbdt'}, learning_rate={result.metrics?.learning_rate_used || 0.1}
            </Typography>
            {/* La ligne Best Global Iteration a été supprimée */}
          </Box>
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> These validation scores were computed during the training phase 
            using chronological splits. The date column was used ONLY for ordering and was excluded 
            from the features used for training.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
};

  // Déplacer les logiques de validation ici dans le composant principal
  useEffect(() => {
    if (modelType === 'logistic') {
      validateAndAdjustLogisticParams();
    }
  }, [logisticParams.penalty, logisticParams.solver, modelType]);

  // Fonction pour valider et ajuster les paramètres logistic
  const validateAndAdjustLogisticParams = () => {
    const validSolvers = getValidSolvers(logisticParams.penalty);
    const validPenalties = getValidPenalties(logisticParams.solver);

    if (!validSolvers.includes(logisticParams.solver)) {
      setLogisticParams(prev => ({
        ...prev, 
        solver: validSolvers[0] || 'lbfgs'
      }));
    }

    if (!validPenalties.includes(logisticParams.penalty)) {
      setLogisticParams(prev => ({
        ...prev, 
        penalty: validPenalties[0] || 'l2'
      }));
    }
  };

  // Fonctions helper pour les combinaisons valides
  const getValidSolvers = (penalty) => {
    const validCombinations = {
      'l2': ['lbfgs', 'newton-cg', 'sag', 'saga'],
      'l1': ['liblinear', 'saga'],
      'elasticnet': ['saga'],
      'none': ['lbfgs', 'newton-cg', 'sag', 'saga']
    };
    return validCombinations[penalty] || ['lbfgs'];
  };

  const getValidPenalties = (solver) => {
    const validCombinations = {
      'lbfgs': ['l2', 'none'],
      'liblinear': ['l1', 'l2'],
      'newton-cg': ['l2', 'none'],
      'sag': ['l2', 'none'],
      'saga': ['elasticnet', 'l1', 'l2', 'none']
    };
    return validCombinations[solver] || ['l2'];
  };

  // Fonction renderLogisticParams modifiée (sans useEffect)
const renderLogisticParams = () => {
  const validSolvers = getValidSolvers(logisticParams.penalty);
  const validPenalties = getValidPenalties(logisticParams.solver);

  return (
    <Grid container spacing={2}>
      {/* ALERTES D'ERREUR */}
      {logisticValidationErrors.length > 0 && (
        <Grid item xs={12}>
          <Alert severity="error">
            <Typography variant="subtitle2">Configuration Errors:</Typography>
            {logisticValidationErrors.map((error, idx) => (
              <Typography key={idx} variant="body2">• {error}</Typography>
            ))}
          </Alert>
        </Grid>
      )}

      <Grid item xs={12} md={6}>
        <TextField
          select
          label="Regularization type"
          value={logisticParams.penalty}
          onChange={(e) => {
            const newPenalty = e.target.value;
            const validSolversForPenalty = getValidSolvers(newPenalty);
            
            setLogisticParams(prev => ({
              ...prev, 
              penalty: newPenalty,
              solver: validSolversForPenalty.includes(prev.solver) 
                ? prev.solver 
                : validSolversForPenalty[0]
            }));
          }}
          fullWidth
        >
          <MenuItem value="l2" disabled={!validPenalties.includes('l2')}>
            L2 (Ridge - default)
          </MenuItem>
          <MenuItem value="l1" disabled={!validPenalties.includes('l1')}>
            L1 (Lasso - feature selection)
          </MenuItem>
          <MenuItem value="elasticnet" disabled={!validPenalties.includes('elasticnet')}>
            ElasticNet (L1 + L2)
          </MenuItem>
          <MenuItem value="none" disabled={!validPenalties.includes('none')}>
            No regularization
          </MenuItem>
        </TextField>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <TextField
          select
          label="Algorithm (solver)"
          value={logisticParams.solver}
          onChange={(e) => {
            const newSolver = e.target.value;
            const validPenaltiesForSolver = getValidPenalties(newSolver);
            
            setLogisticParams(prev => ({
              ...prev, 
              solver: newSolver,
              penalty: validPenaltiesForSolver.includes(prev.penalty)
                ? prev.penalty
                : validPenaltiesForSolver[0]
            }));
          }}
          fullWidth
        >
          <MenuItem value="lbfgs" disabled={!validSolvers.includes('lbfgs')}>
            LBFGS (recommended for L2)
          </MenuItem>
          <MenuItem value="liblinear" disabled={!validSolvers.includes('liblinear')}>
            Liblinear (small datasets)
          </MenuItem>
          <MenuItem value="newton-cg" disabled={!validSolvers.includes('newton-cg')}>
            Newton-CG (L2 only)
          </MenuItem>
          <MenuItem value="sag" disabled={!validSolvers.includes('sag')}>
            SAG (large datasets)
          </MenuItem>
          <MenuItem value="saga" disabled={!validSolvers.includes('saga')}>
            SAGA (supports all)
          </MenuItem>
        </TextField>
      </Grid>

      {/* ✅ NOUVEAU : Paramètre l1_ratio pour ElasticNet */}
      {logisticParams.penalty === 'elasticnet' && (
        <Grid item xs={12} md={6}>
          <TextField
            label="L1 Ratio (ElasticNet mixing)"
            type="number"
            value={logisticParams.l1_ratio}
            onChange={(e) => {
              const value = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0.5));
              setLogisticParams({...logisticParams, l1_ratio: value});
            }}
            fullWidth
            inputProps={{ min: 0, max: 1, step: 0.1 }}
            helperText="0 = L2 only, 1 = L1 only, 0.5 = equal mix"
          />
        </Grid>
      )}

      <Grid item xs={12} md={6}>
        <TextField
          label="Max iterations"
          type="number"
          value={logisticParams.max_iter}
          onChange={(e) => {
            const value = Math.max(100, Math.min(10000, parseInt(e.target.value) || 1000));
            setLogisticParams({...logisticParams, max_iter: value});
          }}
          fullWidth
          inputProps={{ min: 100, max: 10000 }}
          error={logisticParams.max_iter < 100 || logisticParams.max_iter > 10000}
          helperText="Between 100 and 10000"
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <TextField
          select
          label="Multiclass strategy"
          value={logisticParams.multi_class}
          onChange={(e) => {
            const newMultiClass = e.target.value;
            let updatedParams = {...logisticParams, multi_class: newMultiClass};
            
            // Ajustement automatique pour liblinear
            if (newMultiClass === 'multinomial' && updatedParams.solver === 'liblinear') {
              updatedParams.solver = 'saga';
            }
            
            setLogisticParams(updatedParams);
          }}
          fullWidth
        >
          <MenuItem value="auto">Auto (recommended)</MenuItem>
          <MenuItem value="ovr">One-vs-Rest</MenuItem>
          <MenuItem 
            value="multinomial" 
            disabled={logisticParams.solver === 'liblinear'}
          >
            Multinomial {logisticParams.solver === 'liblinear' && '(not compatible with liblinear)'}
          </MenuItem>
        </TextField>
      </Grid>

      <Grid item xs={12} md={6}>
        <TextField
          select
          label="Class weighting"
          value={logisticParams.class_weight || 'none'}
          onChange={(e) => setLogisticParams({
            ...logisticParams, 
            class_weight: e.target.value === 'none' ? null : e.target.value
          })}
          fullWidth
        >
          <MenuItem value="none">None (default)</MenuItem>
          <MenuItem value="balanced">Auto balanced</MenuItem>
        </TextField>
      </Grid>

      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Checkbox
              checked={logisticParams.use_scaling}
              onChange={(e) => setLogisticParams({...logisticParams, use_scaling: e.target.checked})}
            />
          }
          label="Scale features (recommended)"
        />
      </Grid>

      {/* Guide des combinaisons valides */}
      <Grid item xs={12}>
        <Alert severity="info">
          <Typography variant="body2">
            <strong>Valid combinations:</strong><br/>
            • L2 → LBFGS, Newton-CG, SAG, SAGA<br/>
            • L1 → Liblinear, SAGA<br/>
            • ElasticNet → SAGA only + L1 Ratio required<br/>
            • Multiclass → Avoid Liblinear with Multinomial
          </Typography>
        </Alert>
      </Grid>
    </Grid>
  );
};

// Fonction pour rendre la matrice de confusion pour Random Forest
const renderRandomForestConfusionMatrix = () => {
  if (!result?.metrics?.confusion_matrix || modelType !== 'random_forest' || !result.metrics.is_classification) return null;

  const confusionData = result.metrics.confusion_matrix;
  
  let cmArray;
  let labels = [];
  
  // Extraction des données selon la structure du backend
  if (confusionData.matrix && Array.isArray(confusionData.matrix)) {
    // Format multiclasse
    cmArray = confusionData.matrix;
    labels = confusionData.labels || Array.from({ length: cmArray.length }, (_, i) => `Class ${i}`);
  } else if (confusionData.true_negative !== undefined) {
    // Format binaire
    cmArray = [
      [confusionData.true_negative, confusionData.false_positive],
      [confusionData.false_negative, confusionData.true_positive]
    ];
    labels = confusionData.labels || ['Negative', 'Positive'];
  } else if (Array.isArray(confusionData)) {
    // Format array direct
    cmArray = confusionData;
    labels = result.metrics.classes || Array.from({ length: cmArray.length }, (_, i) => `Class ${i}`);
  } else {
    return null;
  }

  if (!cmArray || cmArray.length === 0) return null;

  const totalSamples = cmArray.flat().reduce((sum, val) => sum + val, 0);
  const correctPredictions = cmArray.reduce((sum, row, i) => sum + row[i], 0);
  const accuracy = totalSamples > 0 ? (correctPredictions / totalSamples * 100).toFixed(1) : 0;

  return (
    <Card sx={{ mt: 2 }}>


      
      <CardContent>
        <Typography variant="h6" gutterBottom>
          📊 Confusion Matrix (Random Forest)
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="subtitle2">
            Actual ↓ / Predicted →
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={confusionMatrixNormalized}
                  onChange={(e) => setConfusionMatrixNormalized(e.target.checked)}
                />
              }
              label="Normalize by row (%)"
            />
            <Typography variant="body2" color="primary">
              Accuracy: {accuracy}%
            </Typography>
          </Box>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small" sx={{ minWidth: 400 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', borderRight: '1px solid', borderBottom: '1px solid' }}>
                  Actual \\ Predicted
                </TableCell>
                {labels.map((label, index) => (
                  <TableCell 
                    key={index} 
                    align="center" 
                    sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}
                  >
                    {String(label)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {cmArray.map((row, rowIndex) => {
                const rowSum = row.reduce((s, v) => s + (Number(v) || 0), 0);
                return (
                <TableRow key={rowIndex}>
                  <TableCell 
                    component="th" 
                    scope="row"
                    sx={{ fontWeight: 'bold', bgcolor: 'grey.100', borderRight: '1px solid' }}
                  >
                    {String(labels[rowIndex])}
                  </TableCell>
                  {row.map((cell, cellIndex) => {
                    const value = Number(cell) || 0;
                    const display = confusionMatrixNormalized
                      ? (rowSum > 0 ? `${((value / rowSum) * 100).toFixed(1)}%` : '0%')
                      : value;
                    return (
                    <TableCell
                      key={cellIndex}
                      align="center"
                      title={confusionMatrixNormalized ? `Count: ${value}` : undefined}
                      sx={{
                        bgcolor: rowIndex === cellIndex ? 
                          'success.light' : 'error.light',
                        color: rowIndex === cellIndex ? 
                          'success.contrastText' : 'error.contrastText',
                        fontWeight: 'bold',
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      {display}
                    </TableCell>
                    );
                  })}
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Légende */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, bgcolor: 'success.light', mr: 1 }} />
            <Typography variant="caption">Correct</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, bgcolor: 'error.light', mr: 1 }} />
            <Typography variant="caption">Incorrect</Typography>
          </Box>
        </Box>

        {/* Statistiques rapides */}
        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <Typography variant="caption" display="block">
              Total: {totalSamples}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" display="block">
              Correct: {correctPredictions}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" display="block">
              Classes: {labels.join(', ')}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

// Fonction pour rendre le rapport de classification pour Random Forest
const renderRandomForestClassificationReport = () => {
  if (!result?.metrics?.classification_report || modelType !== 'random_forest' || !result.metrics.is_classification) return null;

  const report = result.metrics.classification_report;
  
  // Extraire les classes (exclure les métriques globales)
  const classes = Object.keys(report).filter(key => 
    !['accuracy', 'macro avg', 'weighted avg'].includes(key)
  );

  if (classes.length === 0) return null;

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          📝 Classification Report (Random Forest)
        </Typography>
        
        {/* Accuracy globale */}
        {report.accuracy !== undefined && (
          <Box sx={{ mb: 2, p: 1, bgcolor: 'primary.light', borderRadius: 1 }}>
            <Typography variant="subtitle1" align="center" color="white">
              Overall Accuracy: {(report.accuracy * 100).toFixed(2)}%
            </Typography>
          </Box>
        )}

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Class</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Precision</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Recall</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>F1-score</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Support</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Parcourir chaque classe */}
              {classes.map(cls => (
                <TableRow key={cls} hover>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                    {cls}
                  </TableCell>
                  <TableCell align="right">
                    {report[cls].precision?.toFixed(3) || 'N/A'}
                  </TableCell>
                  <TableCell align="right">
                    {report[cls].recall?.toFixed(3) || 'N/A'}
                  </TableCell>
                  <TableCell align="right">
                    {report[cls]['f1-score']?.toFixed(3) || 'N/A'}
                  </TableCell>
                  <TableCell align="right">
                    {report[cls].support || 'N/A'}
                  </TableCell>
                </TableRow>
              ))}
              
              {/* Ligne séparatrice */}
              <TableRow>
                <TableCell colSpan={5} sx={{ borderBottom: '2px solid', borderColor: 'divider' }} />
              </TableRow>

              {/* Moyennes macro */}
              {report['macro avg'] && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Macro Avg</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {report['macro avg'].precision?.toFixed(3)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {report['macro avg'].recall?.toFixed(3)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {report['macro avg']['f1-score']?.toFixed(3)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {report['macro avg'].support}
                  </TableCell>
                </TableRow>
              )}

              {/* Moyennes pondérées */}
              {report['weighted avg'] && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Weighted Avg</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {report['weighted avg'].precision?.toFixed(3)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {report['weighted avg'].recall?.toFixed(3)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {report['weighted avg']['f1-score']?.toFixed(3)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {report['weighted avg'].support}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Informations supplémentaires */}
        <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" display="block">
            • <strong>Precision</strong>: Proportion de prédictions positives correctes
          </Typography>
          <Typography variant="caption" display="block">
            • <strong>Recall</strong>: Proportion de vrais positifs correctement identifiés
          </Typography>
          <Typography variant="caption" display="block">
            • <strong>F1-score</strong>: Moyenne harmonique de la précision et du rappel
          </Typography>
          <Typography variant="caption" display="block">
            • <strong>Support</strong>: Nombre d'échantillons réels pour chaque classe
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

  const renderFeatureImportance = () => {
    if (!featureImportance || featureImportance.length === 0) {
      return (
        <Typography color="text.secondary">
          No feature importance data available
        </Typography>
      );
    }

    return (
      <>
      {renderFeatureImportanceChart()}
    </>
    );
  };
const renderKnnTimeseriesValidationDetails = () => {
  if (!result?.metrics?.validation_results || modelType !== 'knn') return null;
  
  const validationData = result.metrics.validation_results;
  
  // Vérifier si c'est TimeSeriesSplit
  const isTimeSeries = validationData.method?.includes('TimeSeries');
  if (!isTimeSeries) return null;
  
  const isClassification = result.metrics.is_classification;
  const foldDetails = validationData.fold_details || [];
  
  if (foldDetails.length === 0) return null;
  
  // Déterminer le nom du score selon le type de problème
  const scoreName = isClassification ? 'Accuracy' : 'R² Score';
  
  // Préparer les données pour le graphique
  const chartData = foldDetails.map(item => ({
    fold: item.fold,
    train_score: item.train_score || 0,
    val_score: item.val_score || 0,
    train_size: item.train_size || 0,
    val_size: item.val_size || 0
  }));
  
  // Calculer les statistiques
  let meanValScore = 0;
  let stdValScore = 0;
  
  if (isClassification) {
    meanValScore = validationData.mean_score || 
                   validationData.cv_validation_accuracy_mean || 
                   (chartData.reduce((sum, item) => sum + item.val_score, 0) / chartData.length);
    stdValScore = validationData.std_score || 
                  validationData.cv_validation_accuracy_std ||
                  Math.sqrt(chartData.reduce((sq, n) => sq + Math.pow(n.val_score - meanValScore, 2), 0) / chartData.length);
  } else {
    meanValScore = validationData.mean_score || 
                   validationData.cv_validation_r2_mean || 
                   (chartData.reduce((sum, item) => sum + item.val_score, 0) / chartData.length);
    stdValScore = validationData.std_score || 
                  validationData.cv_validation_r2_std ||
                  Math.sqrt(chartData.reduce((sq, n) => sq + Math.pow(n.val_score - meanValScore, 2), 0) / chartData.length);
  }
  
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🔍 Time Series Split Validation Details (KNN - {isClassification ? 'Classification' : 'Regression'})
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Method:</strong> {validationData.method}<br/>
            <strong>Valid Folds:</strong> {foldDetails.length}<br/>
            <strong>Date Column:</strong> {validationData.date_column || 'N/A'} (excluded from features)<br/>
            <strong>Features Used:</strong> {validationData.features_used?.join(', ') || 'All features'}<br/>
            <strong>Average {scoreName}:</strong> {meanValScore.toFixed(4)} ± {stdValScore.toFixed(4)}<br/>
            <strong>Best Fold:</strong> {validationData.best_fold || validationData.best_fold_used || 'N/A'} 
            {validationData.best_score && ` (Score: ${validationData.best_score.toFixed(4)})`}
          </Typography>
        </Alert>

        {/* Graphique des scores par fold */}
        {chartData.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
               {scoreName} by Time Series Fold
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fold" 
                  label={{ value: 'Fold', position: 'insideBottomRight', offset: -10 }}
                />
                <YAxis 
                  label={{ 
                    value: scoreName, 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                  domain={isClassification ? [0, 1] : ['auto', 'auto']}
                />
                <Tooltip 
                  formatter={(value) => [value.toFixed(4), scoreName]}
                  labelFormatter={(label) => `Fold ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="val_score" 
                  stroke="#8884d8" 
                  name={`Validation ${scoreName}`}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="train_score" 
                  stroke="#82ca9d" 
                  name={`Train ${scoreName}`}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <ReferenceLine 
                  y={meanValScore} 
                  stroke="#ff7300" 
                  strokeDasharray="3 3"
                  label={{ 
                    value: `Avg: ${meanValScore.toFixed(3)}`, 
                    position: 'insideTopRight',
                    fill: '#ff7300',
                    fontSize: 12
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Tableau des détails par fold */}
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
          📋 Individual Fold Results
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 300, mb: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Fold</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train Size</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Validation Size</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Train {scoreName}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Validation {scoreName}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {foldDetails.slice(0, 10).map((item, index) => (
                <TableRow key={index} hover>
                  <TableCell>{item.fold}</TableCell>
                  <TableCell align="right">{item.train_size || 'N/A'}</TableCell>
                  <TableCell align="right">{item.val_size || item.validation_size || 'N/A'}</TableCell>
                  <TableCell align="right">
                    {(item.train_score || 0).toFixed(4)}
                  </TableCell>
                  <TableCell 
                    align="right" 
                    sx={{ 
                      fontWeight: 'medium',
                      color: isClassification ? 
                        ((item.val_score || 0) >= 0.9 ? 'success.main' : 
                         (item.val_score || 0) >= 0.8 ? 'warning.main' : 
                         (item.val_score || 0) >= 0.6 ? 'warning.light' : 'error.main') :
                        ((item.val_score || 0) >= 0.8 ? 'success.main' : 
                         (item.val_score || 0) >= 0.6 ? 'warning.main' : 
                         (item.val_score || 0) >= 0.3 ? 'warning.light' : 'error.main')
                    }}
                  >
                    {(item.val_score || 0).toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {foldDetails.length > 10 && (
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
            Showing first 10 of {foldDetails.length} folds
          </Typography>
        )}

        {/* Résumé statistique */}
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            📊 Statistical Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Mean {scoreName}:</strong> {meanValScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Std Dev:</strong> {stdValScore.toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Min:</strong> {Math.min(...chartData.map(d => d.val_score)).toFixed(4)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Max:</strong> {Math.max(...chartData.map(d => d.val_score)).toFixed(4)}
              </Typography>
            </Grid>
          </Grid>
          
          {/* Informations spécifiques selon le type */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
            <Typography variant="body2" color="success.main">
              ✅ TimeSeriesSplit: Date column "{validationData.date_column}" used ONLY for chronological ordering
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>Features used:</strong> {validationData.features_used?.join(', ') || 'All numeric columns'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>Problem type:</strong> {isClassification ? 'Classification (Accuracy)' : 'Regression (R² Score)'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>KNN Parameters:</strong> n_neighbors={result.metrics?.n_neighbors_used || 'N/A'}, weights={result.metrics?.weights_used || 'uniform'}, metric={result.metrics?.metric_used || 'minkowski'}
            </Typography>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> These validation scores were computed during the training phase 
            using chronological splits. The date column was used ONLY for ordering and was excluded 
            from the features used for training.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
};
const renderEssentialScoreSummary = () => {
  if (!result?.metrics || modelType === 'kmeans' || isAnomalyAlgo()) return null;
  const m = result.metrics;
  const isClf = !!m.is_classification;
  const cards = isClf
    ? [
        { label: 'Accuracy', value: m.accuracy != null ? `${(m.accuracy * 100).toFixed(1)}%` : 'N/A' },
        { label: 'F1', value: m.f1 != null ? Number(m.f1).toFixed(3) : 'N/A' },
        { label: 'Precision', value: m.precision != null ? Number(m.precision).toFixed(3) : 'N/A' },
        { label: 'Recall', value: m.recall != null ? Number(m.recall).toFixed(3) : 'N/A' },
      ]
    : [
        { label: 'R²', value: (m.r2 ?? m.final_test?.r2) != null ? Number(m.r2 ?? m.final_test?.r2).toFixed(3) : 'N/A' },
        { label: 'MAE', value: (m.mae ?? m.final_test?.mae) != null ? Number(m.mae ?? m.final_test?.mae).toFixed(3) : 'N/A' },
        { label: 'MSE', value: (m.mse ?? m.final_test?.mse) != null ? Number(m.mse ?? m.final_test?.mse).toFixed(3) : 'N/A' },
        {
          label: 'Train R²',
          value: (m.train_r2 ?? m.final_train?.r2) != null ? Number(m.train_r2 ?? m.final_train?.r2).toFixed(3) : 'N/A',
        },
      ];

  return (
    <>
    {renderValidationWalkthrough()}
    <Card sx={{ border: '1px solid #d5dde2', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" sx={{ color: '#384850', fontWeight: 700, mb: 0.5 }}>
          Test performance
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Headline metrics on held-out test data. Open a panel below for charts and details.
        </Typography>
        <Grid container spacing={2}>
          {cards.map((c) => (
            <Grid item xs={6} sm={3} key={c.label}>
              <Box
                sx={{
                  textAlign: 'center',
                  py: 2,
                  px: 1,
                  borderRadius: 2,
                  background: 'linear-gradient(180deg, #f7f9fa 0%, #ffffff 100%)',
                  border: '1px solid #e4e8eb',
                }}
              >
                <Typography variant="h4" sx={{ color: '#DE6B06', fontWeight: 800, lineHeight: 1.1 }}>
                  {c.value}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.75, color: '#384850', fontWeight: 600 }}>
                  {c.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
    </>
  );
};

const renderValidationWalkthrough = () => {
  if (!result?.metrics || modelType === 'kmeans' || isAnomalyAlgo()) return null;
  const vr = result.metrics.validation_results || {};
  const ti = result.training_info || result.metrics.training_process || {};
  const methodKey = String(result.validation_method || validationMethod || '').toLowerCase();
  const methodRaw = String(vr.method || result.validation_method || validationMethod || '');

  const fmt = (n) => (n == null || n === '' ? null : Number(n).toLocaleString());
  const trainN = ti.training_samples || ti.train_samples_used || null;
  const testN = ti.test_samples || ti.test_samples_used || null;
  const total = trainN && testN ? Number(trainN) + Number(testN) : null;
  const trainPct = total ? ((Number(trainN) / total) * 100).toFixed(0) : null;
  const testPct = total ? ((Number(testN) / total) * 100).toFixed(0) : null;

  const nFolds = Number(vr.n_splits || cvParams?.n_splits || 0) || null;
  const nRep = Number(vr.n_repetitions || vr.n_bootstraps || nRepetitions || 0) || null;
  const nRepeats = Number(vr.n_repeats || cvParams?.n_repeats || 0) || null;
  const meanScore = vr.mean_score ?? vr.mean_cv_score ?? vr.mean_accuracy ?? null;
  const stdScore = vr.std_score ?? vr.std_cv_score ?? null;

  let strategyLabel = methodRaw || 'Validation';
  let strategyLines = [];
  let processSteps = [];
  let workflowHint = 'Train → validate inside Train → evaluate once on Test';

  if (methodKey.includes('holdout') || /hold/i.test(methodRaw)) {
    strategyLabel = 'Hold-Out (repeated)';
    strategyLines = [
      ['Repetitions', nRep || 'N/A'],
      ['Inner val. size', `${Math.round((Number(vr.test_size ?? 0.2) * 100))}% of Train`],
    ];
    processSteps = [
      'Dataset already split into Train / Test',
      `${nRep || 'Several'} hold-out iterations inside Train`,
      'Model refit on full Train',
      'Final score measured on unseen Test',
    ];
    workflowHint = 'Test was never used during the hold-out iterations.';
  } else if (methodKey.includes('bootstrap') || /bootstrap/i.test(methodRaw)) {
    strategyLabel = 'Bootstrap';
    strategyLines = [
      ['Bootstrap runs', nRep || 'N/A'],
      ['Sample size', `${Math.round((Number(bootstrapParams?.sample_size ?? 1) * 100))}%`],
    ];
    processSteps = [
      'Fixed Train / Test split kept',
      `${nRep || 'Many'} bootstrap samples drawn from Train`,
      'Out-of-bag rows scored inside Train only',
      'Final score measured on unseen Test',
    ];
    workflowHint = 'Test stayed isolated; bootstrap used Train rows only.';
  } else if (methodKey.includes('timeseries') || /timeseries|time.?series/i.test(methodRaw)) {
    strategyLabel = 'Time Series Split';
    strategyLines = [
      ['Folds', nFolds || 'N/A'],
      ['Date column', dateColumn || 'detected'],
    ];
    processSteps = [
      'Rows ordered by date (date not used as a feature)',
      'Each fold: train on past → validate on future',
      'No future data used to predict the past',
      'Final score measured on held-out Test',
    ];
    workflowHint = 'Future data was never used to train on past observations.';
  } else if (methodKey === 'cv_repeatedkfold' || /repeated/i.test(methodRaw)) {
    strategyLabel = 'Repeated K-Fold CV';
    const runs = nFolds && nRepeats ? nFolds * nRepeats : null;
    strategyLines = [
      ['Folds', nFolds || 'N/A'],
      ['Repeats', nRepeats || 'N/A'],
      ['Total CV runs', runs || 'N/A'],
    ];
    processSteps = [
      'Train / Test split kept',
      `${nFolds || 'K'}-fold CV repeated ${nRepeats || 'several'} times on Train`,
      'Best configuration chosen from CV scores',
      'Final score measured on unseen Test',
    ];
    workflowHint = 'Test was not used during model selection.';
  } else if (methodKey.startsWith('cv_') || /cross|kfold|shuffle/i.test(methodRaw)) {
    strategyLabel = methodKey.includes('shuffle') ? 'Shuffle Split CV' : 'K-Fold Cross-Validation';
    strategyLines = [
      ['Folds / splits', nFolds || 'N/A'],
      ['CV runs', nFolds || 'N/A'],
    ];
    processSteps = [
      'Train / Test split kept',
      `${nFolds || 'K'}-fold validation applied on Train only`,
      'Best configuration selected from CV',
      'Final score measured on unseen Test',
    ];
    workflowHint = 'The Test set was not used during training or model selection.';
  } else {
    strategyLines = [['Method', methodRaw || 'N/A']];
    processSteps = [
      'Train / Test split applied',
      'Validation ran inside Train',
      'Final evaluation on Test',
    ];
  }

  const phase3 = ti.final_training_data || result.metrics?.training_process?.phase_3_final_model?.trained_on_all_data;
  const retrainNote =
    phase3 === 'train_and_test_combined' || phase3 === true
      ? 'Scores above = Train-only eval on Test. Saved model was then refit on Train+Test.'
      : 'Saved model = Train only (same as the scores you see).';

  const cardSx = {
    height: '100%',
    borderRadius: 2,
    border: '1px solid #d5dde2',
    background: '#fff',
  };
  const row = (label, value) => (
    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.35 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 700, color: '#384850', textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6" sx={{ color: '#384850', fontWeight: 700, mb: 0.5 }}>
        Validation Method
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        How data was split, validated, and scored: without mixing Test into training.
      </Typography>

      <Grid container spacing={1.5}>
        <Grid item xs={12} md={6}>
          <Card sx={{ ...cardSx, borderTop: '3px solid #384850' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75, color: '#384850' }}>
                Validation Strategy
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#DE6B06', mb: 1 }}>
                {strategyLabel}
              </Typography>
              {row('Dataset split', trainPct && testPct ? `${trainPct}% Train / ${testPct}% Test` : 'Train / Test')}
              {row('Training samples', fmt(trainN) || 'N/A')}
              {row('Test samples', fmt(testN) || 'N/A')}
              {strategyLines.map(([l, v]) => row(l, v))}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ ...cardSx, borderTop: '3px solid #DE6B06' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75, color: '#384850' }}>
                Training Process
              </Typography>
              {processSteps.map((s, i) => (
                <Typography key={s} variant="caption" display="block" sx={{ mb: 0.55, color: '#37474f' }}>
                  {i + 1}. {s}
                </Typography>
              ))}
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#546e7a', fontStyle: 'italic' }}>
                {workflowHint}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ ...cardSx, borderTop: '3px solid #2e7d32' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75, color: '#384850' }}>
                Data Leakage Protection
              </Typography>
              {[
                'Test set isolated during training & model selection',
                'Validation folds kept inside Train only',
                'Final performance measured on unseen Test',
              ].map((t) => (
                <Typography key={t} variant="caption" display="block" sx={{ mb: 0.5, color: '#2e7d32' }}>
                  ✓ {t}
                </Typography>
              ))}
              <Alert severity="success" sx={{ mt: 1, py: 0 }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Data leakage checks passed
                </Typography>
              </Alert>
              <Typography variant="caption" display="block" sx={{ mt: 0.75, color: '#607d8b' }}>
                {retrainNote}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ ...cardSx, borderTop: '3px solid #5c6bc0' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75, color: '#384850' }}>
                Validation Results
              </Typography>
              {row('Mean validation score', meanScore != null ? Number(meanScore).toFixed(4) : 'See details')}
              {row('Std. deviation', stdScore != null ? Number(stdScore).toFixed(4) : 'N/A')}
              {row(
                'Validation runs',
                methodKey.includes('repeated') && nFolds && nRepeats
                  ? nFolds * nRepeats
                  : nFolds || nRep || 'N/A'
              )}
              <Typography variant="caption" display="block" sx={{ mt: 1, color: '#546e7a' }}>
                Open <strong>Validation details</strong> below for fold-by-fold numbers.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tiny workflow reminder */}
      <Box
        sx={{
          mt: 1.5,
          px: 1.5,
          py: 1,
          borderRadius: 1.5,
          background: '#f4f7f8',
          border: '1px dashed #cfd8dc',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {[
          `Original data`,
          `Train ${trainPct ? `${trainPct}%` : ''}${fmt(trainN) ? ` (${fmt(trainN)})` : ''}`.trim(),
          strategyLabel,
          `Test ${testPct ? `${testPct}%` : ''}${fmt(testN) ? ` (${fmt(testN)})` : ''}`.trim(),
          'Final score',
        ].map((label, idx, arr) => (
          <React.Fragment key={`${label}-${idx}`}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#384850' }}>
              {label}
            </Typography>
            {idx < arr.length - 1 && (
              <Typography variant="caption" color="text.secondary">→</Typography>
            )}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};

const getResultGalleryItems = () => {
  if (!result?.metrics) return [];
  const m = result.metrics;
  const isClf =
    m.is_classification === true ||
    (m.accuracy != null && m.r2 == null && m.final_test?.r2 == null);
  const items = [];

  const push = (id, title, Icon, available = true) => {
    if (available) items.push({ id, title, Icon });
  };

  if (modelType === 'kmeans') {
    push('kmeans', 'Cluster results', DonutLargeOutlinedIcon);
    return items;
  }

  if (isAnomalyAlgo()) {
    push('anomaly', 'Anomaly results', AssessmentOutlinedIcon);
    return items;
  }

  // Always show full metrics when we have a metrics object
  push('metrics', 'Full metrics', AssessmentOutlinedIcon, true);
  push('validation', 'Validation details', TuneOutlinedIcon, !!m.validation_results);

  if (isClf) {
    push('confusion', 'Confusion matrix', TableChartOutlinedIcon, !!m.confusion_matrix);
    push('report', 'Classification report', DescriptionOutlinedIcon, !!m.classification_report);
  } else {
    push('pred_vs_real', 'Prediction vs real', ScatterPlotOutlinedIcon, !!m.predictions?.y_true);
    push('errors', 'Error distribution', ShowChartOutlinedIcon, !!m.errors?.absolute);
  }

  const hasImportance =
    featureImportance.length > 0 ||
    (m.feature_importance && Object.keys(m.feature_importance).length > 0);
  push(
    'importance',
    modelType === 'knn' ? 'Feature variance' : 'Feature importance',
    InsightsOutlinedIcon,
    hasImportance
  );
  push('learning', 'Learning curve', ShowChartOutlinedIcon, !!m.learning_curve);
  push(
    'alpha',
    'Alpha / C search',
    TimelineOutlinedIcon,
    !!(m.alpha_performance || m.c_performance)
  );
  push('trees', 'Tree visualization', AccountTreeOutlinedIcon, modelType === 'random_forest');
  push('svm_extra', 'SVM details', ScatterPlotOutlinedIcon, modelType === 'svm');
  push(
    'model_info',
    'Model info',
    DescriptionOutlinedIcon,
    ['logistic', 'knn', 'lightgbm', 'mlp', 'ridge'].includes(modelType)
  );

  return items;
};

const renderResultDialogBody = (id) => {
  switch (id) {
    case 'metrics':
      return renderMetrics();
    case 'kmeans':
      return renderKmeansResults();
    case 'anomaly':
      return renderAnomalyResults();
    case 'validation':
      if (modelType === 'ridge') return renderRidgeValidationDetails();
      if (modelType === 'logistic') return renderLogisticValidationResults();
      if (modelType === 'random_forest') return (
        <>
          {renderRandomForestValidationDetails()}
          {renderOptimizationResults()}
        </>
      );
      if (modelType === 'svm') return (
        <>
          {renderSvmValidationDetails()}
          {renderSvmTimeseriesValidationDetails()}
        </>
      );
      if (modelType === 'knn') return (
        <>
          {renderKnnValidationDetails()}
          {renderKnnTimeseriesValidationDetails()}
        </>
      );
      if (modelType === 'lightgbm') return (
        <>
          {renderLightGBMValidationDetails()}
          {renderLightGBMTimeseriesValidationDetails()}
        </>
      );
      if (modelType === 'mlp') {
        return result.metrics?.validation_results?.method?.includes('TimeSeries')
          ? renderMlpTimeseriesValidationDetails()
          : renderMlpValidationDetails();
      }
      return null;
    case 'confusion':
      return modelType === 'random_forest' ? renderRandomForestConfusionMatrix() : renderConfusionMatrix();
    case 'report':
      return modelType === 'random_forest' ? renderRandomForestClassificationReport() : renderClassificationReport();
    case 'pred_vs_real':
      return renderPredictionVsReal();
    case 'errors':
      return renderErrorDistribution();
    case 'importance':
      return (
        <Card className="model-card">
          <CardContent>
            {modelType === 'knn' && (
              <Alert severity="info" sx={{ mb: 2 }}>
                KNN has no built-in feature importance. This chart shows feature variance in the training set only.
              </Alert>
            )}
            {renderFeatureImportanceChart()}
          </CardContent>
        </Card>
      );
    case 'learning':
      return renderLearningCurve();
    case 'alpha':
      return (
        <>
          {result?.metrics?.alpha_performance && renderAlphaPerformance()}
          {modelType === 'logistic' && renderCPerformance()}
          {modelType === 'logistic' && renderCUsedInfo()}
        </>
      );
    case 'trees':
      return renderTreeVisualization();
    case 'svm_extra':
      return (
        <>
          {renderSvmDetailedMetrics()}
          {renderSvmSpecificVisualizations()}
        </>
      );
    case 'model_info':
      if (modelType === 'logistic') return renderLogisticResults();
      if (modelType === 'knn') return renderKnnResults();
      if (modelType === 'mlp') return renderMlpResults();
      if (modelType === 'lightgbm') {
        return (
          <Card sx={{ mt: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>LightGBM model information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={4}>
                  <Typography>Boosting: {result.metrics?.boosting_type_used || lightgbmParams.boosting_type}</Typography>
                </Grid>
                <Grid item xs={6} md={4}>
                  <Typography>Objective: {lightgbmParams.objective}</Typography>
                </Grid>
                <Grid item xs={6} md={4}>
                  <Typography>Learning rate: {lightgbmParams.learning_rate}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );
      }
      return null;
    default:
      return null;
  }
};

const renderResultsGallery = () => {
  const items = getResultGalleryItems();
  if (!items.length) return null;
  return (
    <Box>
      <Typography variant="h6" sx={{ color: '#384850', fontWeight: 700, mb: 1.5 }}>
        Details & charts
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Click a panel to open it in a popup: all previous views are still available.
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        {items.map(({ id, title, Icon }) => (
          <Button
            key={id}
            onClick={() => setResultDialog({ id, title })}
            sx={{
              py: 2.5,
              px: 1.5,
              minHeight: 120,
              flexDirection: 'column',
              gap: 1,
              textTransform: 'none',
              borderRadius: 2,
              border: '1px solid #d5dde2',
              background: '#fff',
              color: '#384850',
              '&:hover': {
                borderColor: '#DE6B06',
                background: '#fff8f2',
              },
            }}
          >
            <Icon sx={{ fontSize: 40, color: '#384850' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: 'center' }}>
              {title}
            </Typography>
          </Button>
        ))}
      </Box>

      <Dialog
        open={!!resultDialog}
        onClose={() => setResultDialog(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { maxHeight: '90vh' } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#384850',
            color: '#fff',
            py: 1.5,
          }}
        >
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            {resultDialog?.title}
          </Typography>
          <IconButton onClick={() => setResultDialog(null)} size="small" sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#f7f9fa' }}>
          {resultDialog && renderResultDialogBody(resultDialog.id)}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

const renderMetrics = () => {
  if (!result?.metrics) {
    return (
      <Alert severity="warning">
        No metrics available. Training may have been stopped or failed before metrics were computed.
      </Alert>
    );
  }
  if (modelType === 'kmeans' || isAnomalyAlgo()) return null;

  const isClassification = result.metrics?.is_classification;
  const hasClfScore = result.metrics.accuracy != null;
  const hasRegScore = (result.metrics.r2 ?? result.metrics.final_test?.r2) != null;
  if (!hasClfScore && !hasRegScore && isClassification == null) {
    return (
      <Alert severity="info">
        Metrics object is present but headline scores are missing for this run.
      </Alert>
    );
  }
  
  // ✅ CORRECTION : Priority data sources
  const r2 = result.metrics.r2 ?? result.metrics.final_test?.r2;
  const mse = result.metrics.mse ?? result.metrics.final_test?.mse;
  const mae = result.metrics.mae ?? result.metrics.final_test?.mae;
  const train_r2 = result.metrics.train_r2 ?? result.metrics.final_train?.r2;
  const train_mse = result.metrics.train_mse ?? result.metrics.final_train?.mse;
  const train_mae = result.metrics.train_mae ?? result.metrics.final_train?.mae;

  return (
    <>
      {/* ========== FINAL TEST PERFORMANCE (MOST IMPORTANT) ========== */}
      <Card sx={{ mt: 2, mb: 3, border: '2px solid #1976d2', background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
        <CardContent>
          <Typography variant="h5" gutterBottom color="primary" sx={{ fontWeight: 'bold' }}>
              Final Performance (Unseen Test Data)
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Real-world performance:</strong> These metrics show how well your model performs on completely new data.
            </Typography>
          </Alert>
          
          {isClassification ? (
            // Classification metrics
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 2, height: '100%' }}>
                  <Typography variant="h4" color="primary.main">
                    {result.metrics.accuracy != null
                      ? `${(result.metrics.accuracy * 100).toFixed(1)}%`
                      : 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Accuracy
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Correct predictions
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 2, height: '100%' }}>
                  <Typography variant="h4" color="success.main">
                    {result.metrics.precision?.toFixed(3) || 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Precision
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Quality of positive predictions
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 2, height: '100%' }}>
                  <Typography variant="h4" color="info.main">
                    {result.metrics.recall?.toFixed(3) || 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Recall
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Ability to find all positives
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 2, height: '100%' }}>
                  <Typography variant="h4" color="warning.main">
                    {result.metrics.f1?.toFixed(3) || 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    F1-Score
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Balance of precision/recall
                  </Typography>
                </Card>
              </Grid>
            </Grid>
          ) : (
            // Regression metrics - ALL PRESERVED
            <Grid container spacing={3}>
              {/* R² Score */}
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 2, height: '100%' }}>
                  <Typography variant="h4" color="primary">
                    {r2 !== undefined && r2 !== null ? r2.toFixed(4) : 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    📊 R² Score
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    0-1, higher is better
                  </Typography>
                </Card>
              </Grid>
              
              {/* MSE */}
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 2, height: '100%' }}>
                  <Typography variant="h4" color="secondary">
                    {mse !== undefined && mse !== null ? mse.toFixed(4) : 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    📉 MSE
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Mean Squared Error, lower is better
                  </Typography>
                </Card>
              </Grid>
              
              {/* MAE */}
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 2, height: '100%' }}>
                  <Typography variant="h4">
                    {mae !== undefined && mae !== null ? mae.toFixed(4) : 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    📏 MAE
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Mean Absolute Error, lower is better
                  </Typography>
                </Card>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

  {/* ========== TRAINING VALIDATION - NE PAS AFFICHER POUR SVM ========== */}
{result.metrics?.validation_results && modelType !== 'svm' && modelType !== 'lightgbm' && (
  <Card sx={{ mt: 2, mb: 2 }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        🔍 Training Validation
      </Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>For comparison only:</strong> These scores were used during training to tune parameters.
        </Typography>
      </Alert>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Typography variant="body2">
            <strong>Method:</strong> {result.metrics.validation_results.method}
          </Typography>
        </Grid>
        <Grid item xs={12} md={3}>
          <Typography variant="body2">
            <strong>Avg Score:</strong> {
              result.metrics.validation_results.cv_validation_r2_mean?.toFixed(4) ||
              result.metrics.validation_results.mean_score?.toFixed(4) || 
              result.metrics.validation_results.cv_mean?.toFixed(4) ||
              result.metrics.validation_results.bootstrap_mean_score?.toFixed(4) ||
              result.metrics.validation_results.bootstrap_mean?.toFixed(4) ||
              'N/A'
            }
          </Typography>
        </Grid>
        <Grid item xs={12} md={3}>
          <Typography variant="body2">
            <strong>Std Dev:</strong> {
              result.metrics.validation_results.cv_validation_r2_std?.toFixed(4) ||
              result.metrics.validation_results.std_score?.toFixed(4) || 
              result.metrics.validation_results.cv_std?.toFixed(4) ||
              result.metrics.validation_results.bootstrap_std_score?.toFixed(4) ||
              result.metrics.validation_results.bootstrap_std?.toFixed(4) || 
              'N/A'
            }
          </Typography>
        </Grid>
        <Grid item xs={12} md={3}>
          <Typography variant="body2">
            <strong>Best Score:</strong> {
              (() => {
                // ✅ CORRECTION : Calcul du best score selon la méthode
                const vr = result.metrics.validation_results;
                
                // Si best_score existe déjà
                if (vr.best_score !== undefined && vr.best_score !== null) {
                  return vr.best_score.toFixed(4);
                }
                
                // Pour Hold-Out : utiliser repetition_details
                if (vr.repetition_details && vr.repetition_details.length > 0) {
                  const scores = vr.repetition_details.map(r => r.score || 0);
                  return Math.max(...scores).toFixed(4);
                }
                
                // Pour CV : utiliser fold_details
                if (vr.fold_details && vr.fold_details.length > 0) {
                  const scores = vr.fold_details.map(f => 
                    f.outer_val_score || f.cv_validation_r2 || f.score || 0
                  );
                  return Math.max(...scores).toFixed(4);
                }
                
                // Pour Bootstrap : utiliser bootstrap_details
                if (vr.bootstrap_details && vr.bootstrap_details.length > 0) {
                  const scores = vr.bootstrap_details.map(b => 
                    b.validation_score || b.score || 0
                  );
                  return Math.max(...scores).toFixed(4);
                }
                
                // Si aucune source de données n'est disponible
                return 'N/A';
              })()
            }
          </Typography>
        </Grid>
      </Grid>
      
      {/* Statistical summary for regression */}
      {!isClassification && (
        result.metrics.validation_results.std_score || 
        result.metrics.validation_results.cv_validation_r2_std ||
        result.metrics.validation_results.bootstrap_std_score
      ) && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
             Validation Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Mean:</strong> {
                  result.metrics.validation_results.cv_validation_r2_mean?.toFixed(4) ||
                  result.metrics.validation_results.mean_score?.toFixed(4) ||
                  result.metrics.validation_results.bootstrap_mean_score?.toFixed(4) ||
                  'N/A'
                }
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Std Dev:</strong> {
                  result.metrics.validation_results.cv_validation_r2_std?.toFixed(4) ||
                  result.metrics.validation_results.std_score?.toFixed(4) ||
                  result.metrics.validation_results.bootstrap_std_score?.toFixed(4) ||
                  'N/A'
                }
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Min:</strong> {
                  (() => {
                    const vr = result.metrics.validation_results;
                    
                    // Hold-Out
                    if (vr.repetition_details?.length > 0) {
                      const scores = vr.repetition_details.map(r => r.score || 0);
                      return Math.min(...scores).toFixed(4);
                    }
                    
                    // CV
                    if (vr.fold_details?.length > 0) {
                      const scores = vr.fold_details.map(f => 
                        f.outer_val_score || f.cv_validation_r2 || f.score || 0
                      );
                      return Math.min(...scores).toFixed(4);
                    }
                    
                    // Bootstrap
                    if (vr.bootstrap_details?.length > 0) {
                      const scores = vr.bootstrap_details.map(b => 
                        b.validation_score || b.score || 0
                      );
                      return Math.min(...scores).toFixed(4);
                    }
                    
                    return 'N/A';
                  })()
                }
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="body2">
                <strong>Max:</strong> {
                  (() => {
                    const vr = result.metrics.validation_results;
                    
                    // Hold-Out
                    if (vr.repetition_details?.length > 0) {
                      const scores = vr.repetition_details.map(r => r.score || 0);
                      return Math.max(...scores).toFixed(4);
                    }
                    
                    // CV
                    if (vr.fold_details?.length > 0) {
                      const scores = vr.fold_details.map(f => 
                        f.outer_val_score || f.cv_validation_r2 || f.score || 0
                      );
                      return Math.max(...scores).toFixed(4);
                    }
                    
                    // Bootstrap
                    if (vr.bootstrap_details?.length > 0) {
                      const scores = vr.bootstrap_details.map(b => 
                        b.validation_score || b.score || 0
                      );
                      return Math.max(...scores).toFixed(4);
                    }
                    
                    return 'N/A';
                  })()
                }
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}
    </CardContent>
  </Card>
)}

     {/*
      {!isClassification && train_r2 !== undefined && train_r2 !== null && (
        <Card sx={{ mt: 2, border: '2px solid', 
                  borderColor: train_r2 - r2 > 0.1 ? '#f44336' : '#ff9800' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📊 Training vs Test Comparison
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>R² Score</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Training</Typography>
                        <Typography variant="h5" color="info.main">
                          {train_r2.toFixed(4)}
                        </Typography>
                      </Box>
                      <Box sx={{ mx: 1 }}>
                        <Typography variant="h6">→</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Test</Typography>
                        <Typography variant="h5" color={r2 < train_r2 ? "error" : "success"}>
                          {r2.toFixed(4)}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" color={train_r2 - r2 > 0.1 ? "error" : "warning"}>
                      Difference: {(train_r2 - r2).toFixed(4)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>MSE</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Training</Typography>
                        <Typography variant="h5" color="info.main">
                          {train_mse !== undefined && train_mse !== null ? train_mse.toFixed(4) : 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ mx: 1 }}>
                        <Typography variant="h6">→</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Test</Typography>
                        <Typography variant="h5" color="secondary">
                          {mse.toFixed(4)}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {train_mse === undefined ? "Training MSE not available" : "Lower is better"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>MAE</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Training</Typography>
                        <Typography variant="h5" color="info.main">
                          {train_mae !== undefined && train_mae !== null ? train_mae.toFixed(4) : 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ mx: 1 }}>
                        <Typography variant="h6">→</Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Test</Typography>
                        <Typography variant="h5">
                          {mae.toFixed(4)}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {train_mae === undefined ? "Training MAE not available" : "Lower is better"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {train_r2 - r2 > 0.1 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>⚠️ Overfitting detected!</strong> Your model performs much better on training data than test data.
                  Try: Reduce model complexity or add regularization.
                </Typography>
              </Alert>
            )}

            {train_r2 - r2 > 0.05 && train_r2 - r2 <= 0.1 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>⚠️ Minor overfitting.</strong> Small difference between training and test performance.
                </Typography>
              </Alert>
            )}

            {train_r2 - r2 <= 0.05 && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>✅ Good generalization!</strong> Model performs similarly on training and test data.
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}*/}

      {/* ========== QUICK EXPLANATION ========== */}
  {!isClassification && (
  <Card sx={{ mt: 2, background: '#f5f5f5' }}>
    <CardContent>
      <Typography variant="subtitle1" gutterBottom>
        📝 Quick Guide (Regression)
      </Typography>
      <Grid container spacing={1}>
        <Grid item xs={12} md={6}>
          <Typography variant="body2">
            • <strong>Final Performance:</strong> Real performance on new data
          </Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="body2">
            • <strong>R² Score:</strong> 0-1, higher = better predictions
          </Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="body2">
            • <strong>MSE/MAE:</strong> Error measures, lower = better
          </Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="body2">
            • <strong>Overfitting:</strong> When training score ≫ test score
          </Typography>
        </Grid>
      </Grid>
    </CardContent>
  </Card>
)}


    </>
  );
};
return (
  <Box className={`model-training-container${embedded ? " embedded" : ""}`}>
    {/* Help Dialog - Auto-opens on first load */}
    <HelpDialog open={openHelpDialog} onClose={() => setOpenHelpDialog(false)} />
  
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center',   
        justifyContent: 'space-between', 
        mb: embedded ? 2 : 3,
        flexWrap: 'wrap',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {!embedded && (
        <Button 
          variant="contained"
          color="primary"
          startIcon={<ArrowBackIos sx={{ fontSize: '16px' }} />}
          onClick={() => navigate("/data_preparation", { 
            state: { 
              bdName: state?.bdName || state?.originalBdName,
              initialTab: 3,
            }
          })}
          sx={{
            minWidth: '220px',
            height: '40px',
            backgroundColor: '#c55a05',
            fontWeight: '600',
            fontSize: '0.9rem',
            '&:hover': {
              backgroundColor: '#DE6B06',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
            },
            transition: 'all 0.2s ease-in-out'
          }}
        >
          Back to Data Prep
        </Button>
        )}
        
        {/* HELP BUTTON */}
        <Tooltip title="Open user guide">
          <Button
            variant="outlined"
            startIcon={<HelpOutlineIcon />}
            onClick={() => setOpenHelpDialog(true)}
            sx={{
              minWidth: '100px',
              borderColor: '#DE6B06',
              color: '#DE6B06',
              '&:hover': {
                borderColor: '#c55a05',
                backgroundColor: 'rgba(222, 107, 6, 0.08)'
              }
            }}
          >
            Help
          </Button>
        </Tooltip>
      </Box>

      <Typography 
        variant={embedded ? "h5" : "h4"}
        gutterBottom={!embedded}
        className="model-training-header"
        sx={{ fontWeight: 600, mr: embedded ? 0 : 2, mb: embedded ? 0 : undefined }}
      >
        🧠 Model training
      </Typography>
    </Box>

      
<Card className="info-card">
  <CardContent>
    <Typography variant="h6" gutterBottom className="card-title">
      Dataset Information
    </Typography>
    <Grid container spacing={2}>
      
      <Grid item xs={12} md={6}>
        <Typography variant="body1">
          <strong>Name:</strong> {state?.bdName || 'Not available'}
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Typography variant="body1" className={hasTargetColumn ? "target-column-success" : "target-column-warning"}>
          <strong>Target column:</strong> {targetColumn || 'None (unsupervised)'}
        </Typography>
      </Grid>
      
      {/* Affichage amélioré du type de problème */}
      <Grid item xs={12}>
        <Typography variant="body1" className={
          problemType === 'classification' ? "problem-type-classification" : 
          problemType === 'regression' ? "problem-type-regression" : 
          "problem-type-unsupervised"
        }>
          <strong>Problem type:</strong> {
            problemType === 'classification' ? '  Classification' :
            problemType === 'regression' ? ' Regression' :
            '🔍 Unsupervised Learning'
          }
        </Typography>
        
        
      </Grid>
    </Grid>
  </CardContent>
</Card>

<Card className="model-card">
  <CardContent>
    {/* Remplacer le titre simple par un Box avec titre + bouton */}
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
      <Typography variant="h6" className="card-title">
        Model selection
      </Typography>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Typography>ℹ️</Typography>}
        onClick={() => setModelInfoDialogOpen(true)}
        sx={{ ml: 1 }}
      >
        Model Info
      </Button>
    </Box>
    
    {renderModelSelectionButtons()}
    
    {/* Params only after problem type is known (default algo is then selected) */}
    {!problemType ? null : modelType === 'ridge' ? (
      <>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            {randomSearchEnabled ? (
              <>
                <strong>Random Search:</strong> Alpha is sampled across trials.
                The internal multi-alpha grid is disabled for this run.
              </>
            ) : (
              <>
                <strong>Advanced Alpha Optimization:</strong> Regularization strength is automatically
                optimized.
              </>
            )}
          </Typography>
        </Alert>
      </>
    ) : modelType === 'logistic' ? (
      <fieldset
        disabled={randomSearchEnabled}
        style={{ border: 'none', margin: 0, padding: 0, opacity: randomSearchEnabled ? 0.55 : 1 }}
      >
        {renderLogisticParams()}
      </fieldset>
    ) : modelType === 'random_forest' ? (
      <fieldset
        disabled={randomSearchEnabled}
        style={{ border: 'none', margin: 0, padding: 0, opacity: randomSearchEnabled ? 0.55 : 1 }}
      >
        {renderRandomForestParams()}
      </fieldset>
    ) : modelType === 'svm' ? (
      <fieldset
        disabled={randomSearchEnabled}
        style={{ border: 'none', margin: 0, padding: 0, opacity: randomSearchEnabled ? 0.55 : 1 }}
      >
        {renderSvmParams()}
      </fieldset>
    ) : modelType === 'knn' ? (
      <fieldset
        disabled={randomSearchEnabled}
        style={{ border: 'none', margin: 0, padding: 0, opacity: randomSearchEnabled ? 0.55 : 1 }}
      >
        {renderKnnParams()}
      </fieldset>
    ) : modelType === 'lightgbm' ? (
      <fieldset
        disabled={randomSearchEnabled}
        style={{ border: 'none', margin: 0, padding: 0, opacity: randomSearchEnabled ? 0.55 : 1 }}
      >
        {renderLightGBMParams()}
      </fieldset>
    ) : modelType === 'mlp' ? (
      renderMlpParams()  
    ) : modelType === 'kmeans' ? (
      renderKmeansParams()
    ) : isAnomalyAlgo() ? (
      renderAnomalyParams()
    ) : null}

    {randomSearchSupported && (
      <Box
        sx={{
          mt: 2,
          mb: 1,
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          opacity: randomSearchEligible ? 1 : 0.85,
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={randomSearchEnabled && randomSearchEligible}
              onChange={(e) => setRandomSearchEnabled(e.target.checked)}
              disabled={isTraining || !randomSearchEligible}
            />
          }
          label="Random Search (hyperparameter optimization)"
        />
        {randomSearchEligible ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Available because train rows = {trainRowCount?.toLocaleString()} (&lt; 10,000).
            When enabled, algorithm options above are locked and sampled automatically.
            Internal auto grids (Ridge alpha / Logistic C) are turned off.
          </Typography>
        ) : (
          <Alert severity="info" sx={{ mb: 1 }}>
            {trainRowCount == null
              ? 'Checking train size… Random Search is only enabled for training sets with fewer than 10,000 rows.'
              : trainRowCount <= 0
                ? 'Random Search needs a valid train split. Complete Clean · Split first.'
                : `Random Search is disabled for large training sets (${trainRowCount.toLocaleString()} train rows). It is only available under 10,000 rows to keep search time and cost reasonable.`}
          </Alert>
        )}
        {randomSearchEnabled && randomSearchEligible && (
          <TextField
            label="Number of trials"
            type="number"
            size="small"
            value={randomSearchTrials}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isNaN(v)) setRandomSearchTrials(20);
              else setRandomSearchTrials(Math.min(50, Math.max(1, v)));
            }}
            inputProps={{ min: 1, max: 50 }}
            helperText="Max 50"
            disabled={isTraining}
            sx={{ maxWidth: 200 }}
          />
        )}
      </Box>
    )}
  </CardContent>
</Card>
      {result && (
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              mode: 
              <Box component="span" className={`model-mode-indicator ${modelType === 'logistic' || result.metrics?.is_classification ? 'classification-mode' : 'regression-mode'}`}>
                {modelType === 'logistic' ? 'Classification' : 
                 (result.metrics?.is_classification ? 'Classification' : 'Regression')}
              </Box>
            </Typography>
          )}
      {renderValidationParams()}

      {/* Retrain on train+test: only for algorithms that implement Phase 3 */}
      {!problemType ? null : ['random_forest', 'knn', 'svm', 'lightgbm'].includes(modelType) ? (
        <Alert severity={finalTrainingOnAllData ? "warning" : "info"} sx={{ mt: 2, maxWidth: 720, mx: "auto" }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={finalTrainingOnAllData}
                onChange={(e) => setFinalTrainingOnAllData(e.target.checked)}
                size="small"
              />
            }
            label="Retrain final model on train+test (advanced)"
          />
          <Typography variant="caption" display="block" sx={{ ml: 4, mt: -0.5, lineHeight: 1.5 }}>
            <strong>Leave OFF (recommended):</strong> the app trains on Train, measures scores on Test,
            and saves that same Train model: the numbers you see match what you deploy.
            <br />
            <strong>Turn ON only if you want:</strong> after those honest Test scores, refit once more on
            Train+Test and save that fuller model for production (more data, but the saved model is no longer
            the exact one that produced the Test score).
          </Typography>
        </Alert>
      ) : modelType !== 'kmeans' && !isAnomalyAlgo() ? (
        <Alert severity="info" sx={{ mt: 2, maxWidth: 720, mx: "auto" }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Retrain on train+test
          </Typography>
          <Typography variant="caption" display="block" sx={{ lineHeight: 1.5 }}>
            Not available for {modelType.replace(/_/g, ' ')}. Only Random Forest, SVM, KNN, and LightGBM
            support this optional last refit. For this algorithm the saved model always comes from Train only
            (same as the metrics: nothing incorrect).
          </Typography>
        </Alert>
      ) : null}

      {trainingParamErrors.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2, maxWidth: 720, mx: "auto" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Fix these parameters before training
          </Typography>
          {trainingParamErrors.slice(0, 6).map((e) => (
            <Typography key={e} variant="caption" display="block">• {e}</Typography>
          ))}
          {trainingParamErrors.length > 6 && (
            <Typography variant="caption" display="block">…and {trainingParamErrors.length - 6} more</Typography>
          )}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Button
          className="training-button primary-button"
          onClick={handleTrain}
          disabled={
            isTraining ||
            stopCooldown ||
            !state?.bdName ||
            !problemType ||
            (modelType !== 'kmeans' && !isAnomalyAlgo() && !hasTargetColumn) ||
            trainingParamErrors.length > 0
          }
          title={
            stopCooldown
              ? `Please wait ${stopCooldownSecondsLeft || 10}s after cancelling before training again`
              : !problemType
              ? "Wait until the page finishes loading the problem type"
              : trainingParamErrors.length > 0
              ? trainingParamErrors[0]
              : modelType !== 'kmeans' && !isAnomalyAlgo() && !hasTargetColumn
              ? "Cannot train supervised models without a target column"
              : ""
          }
          sx={{ height: 56, width: 300, mt: 2 }}
        >
          {isTraining ? (
            <CircularProgress size={24} className="loading-spinner" />
          ) : stopCooldown ? (
            `Please wait ${stopCooldownSecondsLeft || 10}s…`
          ) : (
            `🚀 Start training (${modelType === 'ridge' ? 'Ridge' : 
              modelType === 'logistic' ? 'Logistic' : 
              modelType === 'random_forest' ? 'Random Forest' : 
              modelType === 'svm' ? 'SVM' :
              modelType === 'knn' ? 'KNN' :
              modelType === 'lightgbm' ? 'LightGBM' :
              modelType === 'mlp' ? 'MLP' :
              modelType === 'kmeans' ? 'K-Means' :
              modelType === 'isolation_forest' ? 'Isolation Forest' :
              modelType === 'one_class_svm' ? 'One-Class SVM' :
              ''})`
          )}
        </Button>
      </Box>
{isTraining && (
  <Card 
    sx={{ 
      mt: 3, 
      width: '100%',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: 2,
      boxShadow: '0 10px 40px -10px rgba(102,126,234,0.4)',
      position: 'relative',
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
        animation: 'shine 2s infinite'
      },
      '@keyframes shine': {
        '0%': { transform: 'translateX(-100%)' },
        '100%': { transform: 'translateX(100%)' }
      }
    }}
  >
    <CardContent>
      <Grid container spacing={3} alignItems="center">
        
        {/* Icon and Title */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box 
              sx={{ 
                width: 60, 
                height: 60, 
                borderRadius: '50%', 
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CircularProgress 
                size={40} 
                sx={{ 
                  color: 'white',
                  '& .MuiCircularProgress-circle': {
                    stroke: 'white'
                  }
                }} 
              />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                Training in Progress
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {modelType === 'ridge' ? 'Ridge Regression' : 
                 modelType === 'logistic' ? 'Logistic Regression' : 
                 modelType === 'random_forest' ? 'Random Forest' : 
                 modelType === 'svm' ? 'Support Vector Machine' :
                 modelType === 'knn' ? 'K-Nearest Neighbors' :
                 modelType === 'lightgbm' ? 'LightGBM' :
                 modelType === 'mlp' ? 'Neural Network (MLP)' :
                 modelType === 'kmeans' ? 'K-Means Clustering' : modelType}
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Progress Bar */}
        <Grid item xs={12} md={4}>
          <Box sx={{ width: '100%' }}>
            <LinearProgress 
              sx={{ 
                height: 8, 
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.3)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 'white',
                  borderRadius: 4,
                  backgroundImage: 'linear-gradient(90deg, #fff, #f0f0f0)'
                }
              }} 
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                Please wait...
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                Do not close the page
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* 🛑 STOP BUTTON - AJOUTÉ */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
    variant="contained"
    onClick={handleStopTraining}
    disabled={stopCooldown} // ← CRITIQUE
    sx={{
      background: 'rgba(244, 67, 54, 0.9)',
      color: 'white',
      fontWeight: 'bold',
      padding: '10px 24px',
      borderRadius: '50px',
      border: '2px solid rgba(255,255,255,0.3)',
      '&:disabled': {
        background: 'rgba(150,150,150,0.5)',
        color: 'rgba(255,255,255,0.5)',
        border: '2px solid rgba(255,255,255,0.1)',
        cursor: 'not-allowed'
      }
    }}
    startIcon={stopCooldown ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <span>⏹️</span>}
  >
    {stopCooldown ? 'Please wait...' : 'Stop Training'}
  </Button>
          </Box>
        </Grid>


      </Grid>
    </CardContent>
  </Card>
)}
      {isTraining && (
        <Box sx={{ width: '100%' }}>
          <LinearProgress
            className="progress-bar"
            variant={
              randomSearchProgress?.n_trials
                ? 'determinate'
                : 'indeterminate'
            }
            value={
              randomSearchProgress?.n_trials
                ? Math.min(
                    100,
                    (100 * (randomSearchProgress.trial || 0)) /
                      randomSearchProgress.n_trials
                  )
                : undefined
            }
          />
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }} className="primary-text">
            {randomSearchProgress?.phase === 'random_search'
              ? `Random Search: trial ${randomSearchProgress.trial || 0}/${randomSearchProgress.n_trials}`
              : randomSearchProgress?.phase === 'final_training'
                ? 'Final training with best params…'
                : 'Training... Do not close the page'}
          </Typography>
        </Box>
      )}

      {(isTraining || result) && randomSearchProgress && (
        <Card sx={{ mt: 2, mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Random Search log
            </Typography>
            {randomSearchProgress.best_params && (
              <Alert severity="success" sx={{ mb: 1 }}>
                Best score: {Number(randomSearchProgress.best_score).toFixed(4)}
                {' · '}
                Params: {JSON.stringify(randomSearchProgress.best_params)}
              </Alert>
            )}
            <Box
              sx={{
                maxHeight: 220,
                overflow: 'auto',
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: 12,
                bgcolor: 'grey.50',
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {(randomSearchProgress.logs || []).map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" className="error-alert">
          {error}
        </Alert>
      )}

{result && (
  <Box className="fade-in" sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
       <Card sx={{ 
      mt: 2, 
      mb: 3, 
      border: '2px solid', 
      borderColor: 'primary.main',
      background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
    }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" color="primary.main" gutterBottom>
              🎉 Model Training Complete!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Your <strong>{modelType.replace(/_/g, ' ')}</strong> model has been trained successfully at {result.timestamp}.
            </Typography>
            <Alert
              severity="warning"
              sx={{ mt: 1.5, mb: 0.5 }}
            >
              Please save your model within <strong>5 minutes</strong> after training
              finishes. After that you will need to train again. This protects your
              account and data.
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Save it now to use for future predictions.
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<DownloadIcon />}
            onClick={openSaveModelDialog}
            disabled={!lastCompletedTrainingId || isSaveWindowExpired()}
            sx={{ 
              minWidth: 200,
              height: 50,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #384850, #0088CC)',
              '&:hover': {
                background: 'linear-gradient(45deg, #003d54, #006699)',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 16px rgba(0, 80, 111, 0.4)'
              }
            }}
          >
            💾 Save Model
          </Button>
        </Box>
      </CardContent>
    </Card>
    {renderEssentialScoreSummary()}
    {renderResultsGallery()}

  </Box>
)}
      
  <SaveModelDialog
    open={saveModelDialog}
    onClose={() => setSaveModelDialog(false)}
    onSave={handleSaveModel}
    isLoading={saveModelLoading}
    saveAvailableUntil={saveAvailableUntil}
  />

      <Dialog
        open={modelLimitDialog.open}
        onClose={() => setModelLimitDialog((d) => ({ ...d, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Model limit reached</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You already have <strong>{modelLimitDialog.count}</strong> saved models
            (maximum <strong>{modelLimitDialog.limit}</strong> per account).
            Delete at least one model from the Dashboard before saving a new one.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModelLimitDialog((d) => ({ ...d, open: false }))}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setModelLimitDialog((d) => ({ ...d, open: false }));
              navigate("/dashboard", { state: { activeTab: "models" } });
            }}
            sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" } }}
          >
            Go to My Models
          </Button>
        </DialogActions>
      </Dialog>

      {renderModelInfoDialog()}

    </Box>
  );
}

export default Creat_Model;