import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Typography,
  Button,
  Slider,
  Checkbox,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip
} from "@mui/material";
import "./Preprocessing5.css";

function Preprocessing5() {
  const [state, setState] = useState({
    isLoading: true,
    error: null,
    datasetInfo: null,
    trainSize: 70, // Por defecto 70% entrenamiento, 30% prueba
    splitMethod: "random",
    useSeed: false,
    seedValue: 42,
    balanceClasses: false,
    balanceMethod: "oversampling",
    isSupervised: true // Indica si el conjunto de datos es supervisado
  });

  const location = useLocation();
  const navigate = useNavigate();
  const bdName = location.state?.bdName;

  useEffect(() => {
    if (!bdName) {
      navigate("/upload");
      return;
    }

    const fetchDatasetInfo = async () => {
      try {
        const [dataResponse, splitInfoResponse] = await Promise.all([
          axios.get(`http://localhost:8000/get-data?bdName=${bdName}`, { 
            withCredentials: true 
          }),
          axios.get(`http://localhost:8000/get-split-info?bdName=${bdName}`, {
            withCredentials: true 
          })
        ]);

        // Determinar si es supervisado comprobando si existe columna objetivo
        const isSupervised = !!splitInfoResponse.data?.target_column;

        setState(prev => ({
          ...prev,
          isLoading: false,
          isSupervised,
          datasetInfo: {
            ...dataResponse.data,
            targetColumn: splitInfoResponse.data?.target_column || null
          },
          // Restablecer estos valores si el conjunto de datos es no supervisado
          ...(!isSupervised && {
            splitMethod: "random",
            balanceClasses: false
          })
        }));

      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.response?.data?.detail || error.message
        }));
      }
    };

    fetchDatasetInfo();
  }, [bdName, navigate]);

  const handleSplitData = async () => {
    const validationErrors = validateSplitParams();
    if (validationErrors.length > 0) {
      setState(prev => ({ ...prev, error: validationErrors.join("\n") }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const requestPayload = {
        bdName,
        trainSize: state.trainSize / 100, // Convertir porcentaje a fracción
        splitMethod: state.splitMethod,
        useSeed: state.useSeed,
        seedValue: state.seedValue,
        balanceClasses: state.balanceClasses,
        balanceMethod: state.balanceMethod,
        targetColumn: state.datasetInfo?.targetColumn || null
      };

      console.log("Enviando solicitud de división:", requestPayload);

      const response = await axios.post(
        "http://localhost:8000/split-data2",
        requestPayload,
        { withCredentials: true }
      );

      console.log("División exitosa:", response.data);

      navigate("/Preprocessing6", {
        state: {
          bdName,
          splitConfig: {
            ...requestPayload,
            stats: response.data.statistics,
            columns: state.datasetInfo?.columns
          }
        }
      });

    } catch (error) {
      console.error("Error en la división:", error);
      const errorMessage = error.response?.data?.detail || 
                          error.message || 
                          "Ocurrió un error desconocido";
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  };

  const validateSplitParams = () => {
    const errors = [];
    
    if (state.trainSize < 10 || state.trainSize > 90) {
      errors.push("El tamaño de entrenamiento debe estar entre 10% y 90%");
    }
    
    if (state.splitMethod === "stratified" && !state.datasetInfo?.targetColumn) {
      errors.push("Se requiere una columna objetivo para la división estratificada");
    }
    
    if (state.useSeed && isNaN(state.seedValue)) {
      errors.push("El valor de la semilla debe ser un número");
    }
    
    return errors;
  };

  const handleInputChange = (field, value) => {
    setState(prev => ({ ...prev, [field]: value }));
  };

  if (state.isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (state.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {state.error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => navigate(-1)}
        >
          Volver
        </Button>
      </Box>
    );
  }

  if (!state.datasetInfo) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          No hay información disponible del conjunto de datos
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => navigate("/upload")}
        >
          Ir a Subir
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Configuración de División de Datos
      </Typography>

      {!state.isSupervised && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Este conjunto de datos no tiene columna objetivo. La división estratificada y el balanceo de clases 
          están deshabilitados porque requieren una variable objetivo.
        </Alert>
      )}

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>Proporción de Entrenamiento/Prueba</Typography>
        <Slider
          value={state.trainSize}
          onChange={(_, newValue) => handleInputChange('trainSize', newValue)}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}%`}
          min={10}
          max={90}
          step={5}
          sx={{ maxWidth: 400 }}
        />
        <Typography>
          Entrenamiento: {state.trainSize}% | Prueba: {100 - state.trainSize}%
        </Typography>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>Método de División</Typography>
        <Tooltip 
          title={!state.isSupervised ? "No disponible para conjuntos de datos sin columna objetivo" : ""}
          placement="right"
        >
          <div>
            <Select
              value={state.splitMethod}
              onChange={(e) => handleInputChange('splitMethod', e.target.value)}
              fullWidth
              sx={{ maxWidth: 400 }}
              disabled={!state.isSupervised}
            >
              <MenuItem value="random">División Aleatoria</MenuItem>
              <MenuItem 
                value="stratified" 
                disabled={!state.datasetInfo.targetColumn || !state.isSupervised}
              >
                División Estratificada
              </MenuItem>
            </Select>
          </div>
        </Tooltip>
        {state.splitMethod === "stratified" && !state.datasetInfo.targetColumn && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            Por favor, establezca una columna objetivo en la configuración del conjunto de datos para usar la división estratificada
          </Typography>
        )}
      </Box>

      <Box sx={{ mb: 4 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={state.useSeed}
              onChange={(e) => handleInputChange('useSeed', e.target.checked)}
            />
          }
          label="Usar semilla aleatoria para reproducibilidad"
        />
        {state.useSeed && (
          <TextField
            type="number"
            value={state.seedValue}
            onChange={(e) => handleInputChange('seedValue', parseInt(e.target.value) || 0)}
            label="Valor de la semilla"
            fullWidth
            sx={{ maxWidth: 400, mt: 1 }}
          />
        )}
      </Box>

      <Box sx={{ mb: 4 }}>
        <Tooltip 
          title={!state.isSupervised ? "El balanceo de clases requiere una variable objetivo" : ""}
          placement="right"
        >
          <div>
            <FormControlLabel
              control={
                <Checkbox
                  checked={state.balanceClasses}
                  onChange={(e) => handleInputChange('balanceClasses', e.target.checked)}
                  disabled={!state.datasetInfo.targetColumn || !state.isSupervised}
                />
              }
              label="Balancear Clases"
            />
          </div>
        </Tooltip>
        {state.balanceClasses && (
          <Select
            value={state.balanceMethod}
            onChange={(e) => handleInputChange('balanceMethod', e.target.value)}
            fullWidth
            sx={{ maxWidth: 400, mt: 1 }}
            disabled={!state.isSupervised}
          >
            <MenuItem value="oversampling">Sobre-muestreo (Minoría)</MenuItem>
            <MenuItem value="undersampling">Sub-muestreo (Mayoría)</MenuItem>
          </Select>
        )}
        {state.balanceClasses && !state.datasetInfo.targetColumn && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            Se requiere columna objetivo para balancear clases
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSplitData}
          disabled={state.isLoading}
          size="large"
        >
          {state.isLoading ? <CircularProgress size={24} /> : "Dividir Conjunto de Datos"}
        </Button>
        <Button 
          variant="outlined" 
          onClick={() => navigate(-1)}
          size="large"
        >
          Cancelar
        </Button>
      </Box>
    </Box>
  );
}

export default Preprocessing5;