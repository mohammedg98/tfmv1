import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  TextField,
  InputAdornment,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup,
  FormControlLabel,
} from "@mui/material";
import {
  Search as SearchIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  HelpOutline as HelpOutlineIcon,
} from "@mui/icons-material";
import axios from "axios";
import { backendUrl } from "../../config";

/**
 * Onglet "Target & Type".
 *
 * Réécriture propre de l'ancienne page Target_selection : AUCUNE détection de
 * type n'est faite côté navigateur. Tout provient du backend :
 *   - GET  /api/analyze-column-types  -> colonnes + types + stats
 *   - POST /api/save-target-column    -> persiste la cible choisie
 *   - GET  /api/detect-problem-type   -> suggestion classification/régression/non-supervisé
 *
 * La détection du type de problème est faite dès la sélection de la target
 * (et non plus seulement à l'étape de modélisation), ce qui permet d'adapter
 * la préparation (ex. split stratifié pour une classification).
 */

const PROBLEM_LABELS = {
  classification: "Classification",
  regression: "Regression",
  unsupervised: "Unsupervised",
};

const typeColor = (t) => {
  switch (t) {
    case "numerical":
      return "primary";
    case "categorical":
      return "secondary";
    case "boolean":
      return "success";
    case "date":
      return "info";
    default:
      return "default";
  }
};

const typeLabel = (t) => {
  switch (t) {
    case "numerical":
      return "Numerical";
    case "categorical":
      return "Categorical";
    case "boolean":
      return "Boolean";
    case "date":
      return "Date";
    default:
      return "Text";
  }
};

function ClassDistributionBars({ distribution }) {
  if (!distribution || distribution.length === 0) return null;

  const maxPct = Math.max(...distribution.map((d) => d.percentage), 1);
  const sorted = [...distribution].sort((a, b) => b.percentage - a.percentage);
  const majority = sorted[0];
  const minority = sorted[sorted.length - 1];
  const imbalanceRatio = minority.count > 0 ? majority.count / minority.count : Infinity;
  const isImbalanced = imbalanceRatio >= 3 || majority.percentage >= 70;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, color: "rgb(0, 80, 111)" }}>
        Class distribution
      </Typography>
      {sorted.slice(0, 12).map((d) => (
        <Box key={d.label} sx={{ mb: 0.75 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
            <Typography variant="caption" noWrap title={d.label} sx={{ maxWidth: "55%" }}>
              {d.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {d.count} ({d.percentage}%)
            </Typography>
          </Box>
          <Box sx={{ height: 8, borderRadius: 4, backgroundColor: "#e8ecef", overflow: "hidden" }}>
            <Box
              sx={{
                height: "100%",
                width: `${(d.percentage / maxPct) * 100}%`,
                backgroundColor: "#DE6B06",
                borderRadius: 4,
                transition: "width 0.3s ease",
              }}
            />
          </Box>
        </Box>
      ))}
      {sorted.length > 12 && (
        <Typography variant="caption" color="text.secondary">
          …and {sorted.length - 12} more classes
        </Typography>
      )}
      {isImbalanced && (
        <Alert severity="warning" sx={{ mt: 1.5 }} variant="outlined">
          Strong class imbalance detected
          {Number.isFinite(imbalanceRatio) ? ` (≈ ${imbalanceRatio.toFixed(1)}:1)` : ""}.
          Prefer a <strong>stratified split</strong> and consider balancing the training set.
        </Alert>
      )}
    </Box>
  );
}

function TargetTypeTab({
  bdName,
  targetColumn,
  problemType,
  onConfirm,
  onTargetChange,
  showSnackbar,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [columnTypes, setColumnTypes] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(targetColumn || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState(null);
  const [chosenProblemType, setChosenProblemType] = useState(problemType || "");
  const [saving, setSaving] = useState(false);

  // Keep local selection in sync when parent restores / clears target from API
  useEffect(() => {
    if (targetColumn) {
      setSelectedTarget(targetColumn);
    } else {
      setSelectedTarget("");
      setDetection(null);
      setChosenProblemType("");
    }
    if (problemType) {
      setChosenProblemType(problemType);
    } else if (!targetColumn) {
      setChosenProblemType("");
    }
  }, [targetColumn, problemType]);

  const [previewRows, setPreviewRows] = useState([]);
  const [previewColumns, setPreviewColumns] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(true);

  // Auto Select Target dialog
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoPhase, setAutoPhase] = useState("intro"); // intro | running | done | error
  const [autoLogs, setAutoLogs] = useState([]);
  const [autoResult, setAutoResult] = useState(null);
  const [autoJobId, setAutoJobId] = useState(null);
  const [ambiguousChoice, setAmbiguousChoice] = useState("");
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const autoPollRef = useRef(null);
  const autoLogBoxRef = useRef(null);

  const loadPreview = useCallback(async () => {
    if (!bdName) return;
    setPreviewLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/get-data-paginated`, {
        params: { bdName, page: 1, page_size: 10 },
        withCredentials: true,
      });
      const cols = (res.data?.columns || []).filter(
        (c) => c !== "id" && c !== "split_type"
      );
      setPreviewColumns(cols);
      setPreviewRows(res.data?.rows || []);
    } catch (err) {
      setPreviewColumns([]);
      setPreviewRows([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [bdName]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const loadColumnTypes = useCallback(async () => {
    if (!bdName) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${backendUrl}/api/analyze-column-types`, {
        params: { bdName },
        withCredentials: true,
      });
      setColumnTypes(res.data?.column_types || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to analyze column types");
    } finally {
      setLoading(false);
    }
  }, [bdName]);

  useEffect(() => {
    loadColumnTypes();
  }, [loadColumnTypes]);

  const filteredColumns = useMemo(() => {
    return columnTypes.filter((c) => {
      const matchesSearch = c.column_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || c.column_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [columnTypes, searchTerm, filterType]);

  const runDetection = useCallback(async (target) => {
    if (!bdName) return;
    setDetecting(true);
    setDetection(null);
    try {
      // Persist immediately so Groups/Reset/Clean keep the choice even without Confirm
      await axios.post(
        `${backendUrl}/api/save-target-column`,
        { dataset_name: bdName, target_column: target },
        { withCredentials: true }
      );

      const preliminaryType =
        target === "no-target-column" ? "unsupervised" : "";
      // Sync parent right away (unlock Clean, survive tab remount / Reset)
      onTargetChange?.({
        targetColumn: target,
        problemType: preliminaryType,
      });

      const res = await axios.get(`${backendUrl}/api/detect-problem-type`, {
        params: { bdName },
        withCredentials: true,
      });
      setDetection(res.data);
      const detected = res.data?.problem_type || preliminaryType || "";
      setChosenProblemType(detected);
      if (detected) {
        onTargetChange?.({
          targetColumn: target,
          problemType: detected,
        });
      }
    } catch (err) {
      showSnackbar?.(
        err.response?.data?.detail || "Failed to detect problem type",
        "error"
      );
    } finally {
      setDetecting(false);
    }
  }, [bdName, showSnackbar, onTargetChange]);

  // Re-run detection when a saved target is restored (so the right panel is not empty)
  useEffect(() => {
    if (!bdName || !targetColumn || loading) return;
    if (detection || detecting) return;
    runDetection(targetColumn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bdName, targetColumn, loading, runDetection]);

  const handleSelectTarget = (name) => {
    setSelectedTarget(name);
    runDetection(name);
  };

  const stopAutoPoll = useCallback(() => {
    if (autoPollRef.current) {
      clearInterval(autoPollRef.current);
      autoPollRef.current = null;
    }
  }, []);

  const resetAutoDialog = useCallback(() => {
    stopAutoPoll();
    setAutoPhase("intro");
    setAutoLogs([]);
    setAutoResult(null);
    setAutoJobId(null);
    setAmbiguousChoice("");
  }, [stopAutoPoll]);

  const handleCloseAutoDialog = () => {
    stopAutoPoll();
    setAutoOpen(false);
    resetAutoDialog();
  };

  const handleOpenAutoDialog = () => {
    resetAutoDialog();
    setAutoOpen(true);
  };

  // Keep terminal scrolled to bottom as logs grow
  useEffect(() => {
    const el = autoLogBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [autoLogs]);

  useEffect(() => () => stopAutoPoll(), [stopAutoPoll]);

  const startAutoDetect = async () => {
    if (!bdName) return;
    setAutoPhase("running");
    setAutoLogs([]);
    setAutoResult(null);
    setAmbiguousChoice("");
    try {
      const startRes = await axios.post(
        `${backendUrl}/api/auto-detect-target/start`,
        { bdName },
        { withCredentials: true }
      );
      const jobId = startRes.data?.job_id;
      if (!jobId) throw new Error("No job_id returned");
      setAutoJobId(jobId);

      stopAutoPoll();
      autoPollRef.current = setInterval(async () => {
        try {
          const st = await axios.get(
            `${backendUrl}/api/auto-detect-target/status/${jobId}`,
            { withCredentials: true }
          );
          setAutoLogs(st.data?.logs || []);
          const status = st.data?.status;
          if (status === "done") {
            stopAutoPoll();
            setAutoResult(st.data?.result || null);
            const rec =
              st.data?.result?.recommended ||
              st.data?.result?.target ||
              st.data?.result?.candidates?.[0]?.column_name ||
              "";
            setAmbiguousChoice(rec);
            setAutoPhase("done");
          } else if (status === "error") {
            stopAutoPoll();
            setAutoResult(st.data?.result || { message: "Analysis failed" });
            setAutoPhase("error");
          }
        } catch (pollErr) {
          stopAutoPoll();
          setAutoResult({
            message:
              pollErr.response?.data?.detail || pollErr.message || "Polling failed",
          });
          setAutoPhase("error");
        }
      }, 800);
    } catch (err) {
      setAutoResult({
        message: err.response?.data?.detail || err.message || "Failed to start analysis",
      });
      setAutoPhase("error");
    }
  };

  const applyAutoSelection = (columnName) => {
    handleCloseAutoDialog();
    if (columnName) {
      handleSelectTarget(columnName);
    }
  };

  const handleConfirm = async () => {
    if (!selectedTarget) {
      showSnackbar?.("Please select a target column first", "warning");
      return;
    }
    setSaving(true);
    try {
      // On resauvegarde par sécurité (idempotent) puis on remonte l'état.
      await axios.post(
        `${backendUrl}/api/save-target-column`,
        { dataset_name: bdName, target_column: selectedTarget },
        { withCredentials: true }
      );
      const confirmedType =
        selectedTarget === "no-target-column"
          ? "unsupervised"
          : chosenProblemType || detection?.problem_type || "";
      onConfirm?.({
        targetColumn: selectedTarget,
        problemType: confirmedType,
      });
      showSnackbar?.(
        selectedTarget === "no-target-column"
          ? "Unsupervised mode confirmed (no target)"
          : "Target and problem type confirmed",
        "success"
      );
    } catch (err) {
      showSnackbar?.(
        err.response?.data?.detail || "Failed to save target column",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedInfo = useMemo(
    () => columnTypes.find((c) => c.column_name === selectedTarget),
    [columnTypes, selectedTarget]
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">Analyzing columns on the server…</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={loadColumnTypes}>Retry</Button>
        }>
          {error}
        </Alert>
      )}

      <Box className="dp-tab-toolbar">
        <Typography variant="h6" className="dp-tab-toolbar-title" sx={{ color: "#384850", fontWeight: 700 }}>
          Target &amp; Type
        </Typography>
        <Box className="dp-tab-toolbar-actions">
          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={handleOpenAutoDialog}
            sx={{
              height: 40,
              backgroundColor: "#DE6B06",
              "&:hover": { backgroundColor: "#c55a05" },
              textTransform: "none",
              fontWeight: 700,
            }}
          >
            Auto Select Target
          </Button>
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose the variable you want to predict, or pick &quot;No target&quot; for
        unsupervised learning.
      </Typography>

      <Grid container spacing={2}>
        {/* Colonne gauche : sélection de la target */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search columns…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
                <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {["all", "numerical", "categorical", "boolean", "date", "text"].map((t) => (
                    <Chip
                      key={t}
                      label={t === "all" ? "All" : typeLabel(t)}
                      size="small"
                      variant={filterType === t ? "filled" : "outlined"}
                      onClick={() => setFilterType(t)}
                    />
                  ))}
                </Box>
              </Box>

              <Paper variant="outlined" sx={{ maxHeight: 420, overflow: "auto" }}>
                <List dense>
                  <ListItemButton
                    selected={selectedTarget === "no-target-column"}
                    onClick={() => handleSelectTarget("no-target-column")}
                  >
                    <ListItemText
                      primary="No target column (unsupervised learning)"
                      secondary="Clustering, dimensionality reduction, pattern discovery"
                    />
                  </ListItemButton>
                  <Divider />
                  {filteredColumns.map((col) => (
                    <ListItemButton
                      key={col.column_name}
                      selected={selectedTarget === col.column_name}
                      onClick={() => handleSelectTarget(col.column_name)}
                    >
                      <ListItemText
                        primary={col.column_name}
                        secondary={
                          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5, flexWrap: "wrap" }}>
                            <Chip
                              label={typeLabel(col.column_type)}
                              size="small"
                              color={typeColor(col.column_type)}
                            />
                            {col.stats?.distinct != null && (
                              <Typography variant="caption" color="text.secondary">
                                {col.stats.distinct} unique
                              </Typography>
                            )}
                            {col.stats && col.stats.total > col.stats.non_null && (
                              <Chip label="Has nulls" size="small" color="warning" variant="outlined" />
                            )}
                          </Box>
                        }
                      />
                    </ListItemButton>
                  ))}
                  {filteredColumns.length === 0 && (
                    <Box sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        No columns match your filters.
                      </Typography>
                    </Box>
                  )}
                </List>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Colonne droite : type de problème détecté */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <PsychologyIcon sx={{ color: "#DE6B06" }} />
                <Typography variant="h6" sx={{ color: "rgb(0, 80, 111)" }}>
                  Problem type
                </Typography>
              </Box>

              {!selectedTarget && (
                <Typography variant="body2" color="text.secondary">
                  Select a target column to detect the problem type.
                </Typography>
              )}

              {selectedTarget && detecting && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Detecting on the server…
                  </Typography>
                </Box>
              )}

              {selectedTarget && !detecting && detection && (
                <>
                  <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
                    Suggested:{" "}
                    <strong>{PROBLEM_LABELS[detection.problem_type] || detection.problem_type}</strong>
                    {detection.reason ? `: ${detection.reason}` : ""}
                  </Alert>

                  {selectedTarget === "no-target-column" ? (
                    <Alert severity="success" variant="outlined" sx={{ mb: 2 }}>
                      No target selected: unsupervised mode
                    </Alert>
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        You can keep the suggestion or change it manually:
                      </Typography>
                      <ToggleButtonGroup
                        exclusive
                        fullWidth
                        size="small"
                        value={chosenProblemType}
                        onChange={(_, v) => v && setChosenProblemType(v)}
                        sx={{ mb: 2 }}
                      >
                        <ToggleButton value="classification">Classification</ToggleButton>
                        <ToggleButton value="regression">Regression</ToggleButton>
                        <ToggleButton value="unsupervised">Unsupervised</ToggleButton>
                      </ToggleButtonGroup>
                    </>
                  )}

                  {selectedInfo && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Target column type
                      </Typography>
                      <Box>
                        <Chip
                          size="small"
                          label={typeLabel(selectedInfo.column_type)}
                          color={typeColor(selectedInfo.column_type)}
                        />
                      </Box>
                    </Box>
                  )}

                  {detection.problem_type === "classification" && (
                    <ClassDistributionBars distribution={detection.class_distribution} />
                  )}
                  {/* High-cardinality target only: never for "No target column" */}
                  {selectedTarget !== "no-target-column" &&
                    detection.problem_type === "unsupervised" &&
                    detection.reason && (
                    <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
                      {/unique|cardinal|too many/i.test(detection.reason)
                        ? "This target has too many unique values relative to the dataset size for a reliable classification suggestion. Prefer another target, or confirm unsupervised / encode the column first."
                        : detection.reason}
                    </Alert>
                  )}
                  {chosenProblemType === "classification" && detection.problem_type !== "classification" && (
                    <ClassDistributionBars distribution={detection.class_distribution} />
                  )}
                </>
              )}

              <Divider sx={{ my: 2 }} />
              <Button
                fullWidth
                variant="contained"
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
                onClick={handleConfirm}
                disabled={!selectedTarget || detecting || saving}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" } }}
              >
                {saving ? "Saving…" : "Confirm & continue to Groups"}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "center" }}>
                Your choice is already saved when you select a column (or No target). Confirm continues to the next step.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Aperçu des 10 premières lignes avec colonne cible mise en évidence */}
        <Grid item xs={12}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, flexWrap: "wrap", gap: 1 }}>
                <Typography variant="h6" sx={{ color: "rgb(0, 80, 111)" }}>
                  Data preview
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    first 10 rows · {previewColumns.length} columns
                  </Typography>
                </Typography>
                {selectedTarget && selectedTarget !== "no-target-column" && (
                  <Chip
                    size="small"
                    color="warning"
                    label={selectedTarget}
                  />
                )}
              </Box>

              {previewLoading ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 3 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">Loading preview…</Typography>
                </Box>
              ) : previewColumns.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No preview available.</Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {previewColumns.map((col) => {
                          const isTarget = col === selectedTarget;
                          return (
                            <TableCell
                              key={col}
                              onClick={() => handleSelectTarget(col)}
                              sx={{
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                fontWeight: 700,
                                backgroundColor: isTarget ? "#DE6B06" : "rgb(0, 80, 111)",
                                color: "#fff",
                                "&:hover": { backgroundColor: isTarget ? "#c55a05" : "#00506f" },
                              }}
                            >
                              {col}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewRows.map((row, rIdx) => (
                        <TableRow key={rIdx} hover>
                          {previewColumns.map((col) => {
                            const isTarget = col === selectedTarget;
                            const val = row[col];
                            return (
                              <TableCell
                                key={col}
                                sx={{
                                  whiteSpace: "nowrap",
                                  maxWidth: 220,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  backgroundColor: isTarget ? "rgba(222,107,6,0.12)" : "inherit",
                                  fontWeight: isTarget ? 600 : 400,
                                }}
                                title={val == null ? "" : String(val)}
                              >
                                {val == null || val === "" ? (
                                  <Typography variant="caption" color="text.secondary">NULL</Typography>
                                ) : (
                                  String(val)
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Tip: click a column header to select it as the target. Scroll horizontally to see all columns.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog
        open={autoOpen}
        onClose={autoPhase === "running" ? undefined : handleCloseAutoDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle
          sx={{
            color: "rgb(0, 80, 111)",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            pr: 2,
          }}
        >
          <span>Auto Target Detection</span>
          <Button
            size="small"
            startIcon={<HelpOutlineIcon />}
            onClick={() => setHowItWorksOpen(true)}
            sx={{ textTransform: "none", color: "rgb(0, 80, 111)" }}
          >
            How it works
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          {autoPhase === "intro" && (
            <Box>
              <Typography variant="body1">
                This analysis reviews each column to find a likely prediction target.
                You must confirm the result before it is applied.
              </Typography>
            </Box>
          )}

          {(autoPhase === "running" || autoPhase === "done" || autoPhase === "error") && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: "rgb(0, 80, 111)" }}>
                  Analysis log
                </Typography>
                {autoPhase === "running" && <CircularProgress size={16} />}
                {autoJobId && (
                  <Typography variant="caption" color="text.secondary">
                    job {autoJobId.slice(0, 8)}…
                  </Typography>
                )}
              </Box>
              <Box
                ref={autoLogBoxRef}
                sx={{
                  bgcolor: "#1e1e1e",
                  color: "#d4d4d4",
                  fontFamily: "Consolas, 'Courier New', monospace",
                  fontSize: 12,
                  lineHeight: 1.55,
                  p: 1.5,
                  borderRadius: 1,
                  maxHeight: 280,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  mb: 2,
                }}
              >
                {(autoLogs.length ? autoLogs : ["Waiting for logs…"]).map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </Box>

              {autoPhase === "error" && (
                <Alert severity="error">
                  {autoResult?.message || "Analysis failed"}
                </Alert>
              )}

              {autoPhase === "done" && autoResult?.decision === "single_target" && (
                <Card variant="outlined" sx={{ borderColor: "#2e7d32", bgcolor: "rgba(46,125,50,0.06)" }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                      Supervised learning: Detected target: {autoResult.target}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Confidence: {Math.round((autoResult.score || 0) * 100)}%
                    </Typography>
                    {(autoResult.reasons || []).length > 0 && (
                      <Box component="ul" sx={{ m: 0, pl: 2, mb: 1 }}>
                        {(autoResult.reasons || []).slice(0, 4).map((r, i) => (
                          <li key={i}>
                            <Typography variant="body2">{r}</Typography>
                          </li>
                        ))}
                      </Box>
                    )}
                    {autoResult.potential_leakage_column && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Possible leakage: column{" "}
                        <strong>{autoResult.potential_leakage_column}</strong> looks almost
                        identical to the target on a sample.
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {autoPhase === "done" && autoResult?.decision === "ambiguous" && (
                <Card variant="outlined" sx={{ borderColor: "#ed6c02", bgcolor: "rgba(237,108,2,0.06)" }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                      Several candidate columns with similar scores
                    </Typography>
                    <RadioGroup
                      value={ambiguousChoice}
                      onChange={(e) => setAmbiguousChoice(e.target.value)}
                    >
                      {(autoResult.candidates || []).map((c) => (
                        <FormControlLabel
                          key={c.column_name}
                          value={c.column_name}
                          control={<Radio size="small" />}
                          label={`${c.column_name}: ${(c.score * 100).toFixed(0)}% (${c.column_type || "?"})`}
                        />
                      ))}
                    </RadioGroup>
                    {autoResult.potential_leakage_column && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Possible leakage with column{" "}
                        <strong>{autoResult.potential_leakage_column}</strong>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {autoPhase === "done" && autoResult?.decision === "no_target" && (
                <Card variant="outlined" sx={{ borderColor: "#90a4ae", bgcolor: "rgba(144,164,174,0.08)" }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                      No reliable target detected
                    </Typography>
                    <Typography variant="body2">
                      This dataset may be a better fit for unsupervised learning.
                    </Typography>
                  </CardContent>
                </Card>
              )}
              {autoPhase === "done" && autoResult && !["single_target", "ambiguous", "no_target"].includes(autoResult.decision) && (
                <Alert severity="warning">
                  Unexpected result. You can close and select a target manually.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap" }}>
          {autoPhase === "intro" && (
            <>
              <Button onClick={handleCloseAutoDialog}>Cancel</Button>
              <Button
                variant="contained"
                onClick={startAutoDetect}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c45f05" } }}
              >
                Start analysis
              </Button>
            </>
          )}
          {autoPhase === "running" && (
            <Button disabled startIcon={<CircularProgress size={16} />}>
              Analysis in progress…
            </Button>
          )}
          {autoPhase === "error" && (
            <>
              <Button onClick={handleCloseAutoDialog}>Close</Button>
              <Button variant="outlined" onClick={() => { resetAutoDialog(); setAutoOpen(true); setAutoPhase("intro"); }}>
                Try again
              </Button>
            </>
          )}
          {autoPhase === "done" && autoResult?.decision === "single_target" && (
            <>
              <Button onClick={handleCloseAutoDialog}>Choose manually</Button>
              <Button
                variant="contained"
                onClick={() => applyAutoSelection(autoResult.target)}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c45f05" } }}
              >
                Confirm this target
              </Button>
            </>
          )}
          {autoPhase === "done" && autoResult?.decision === "ambiguous" && (
            <>
              <Button onClick={handleCloseAutoDialog}>Choose manually</Button>
              <Button
                variant="contained"
                disabled={!ambiguousChoice}
                onClick={() => applyAutoSelection(ambiguousChoice)}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c45f05" } }}
              >
                Confirm selection
              </Button>
            </>
          )}
          {autoPhase === "done" && autoResult?.decision === "no_target" && (
            <>
              <Button onClick={handleCloseAutoDialog}>Choose manually anyway</Button>
              <Button
                variant="contained"
                onClick={() => applyAutoSelection("no-target-column")}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c45f05" } }}
              >
                Continue without target (unsupervised)
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: "rgb(0, 80, 111)", fontWeight: 700 }}>
          How Auto Target Detection works
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            Guesses which column is the <strong>target</strong> (the value a supervised model
            should predict). Nothing is saved until you confirm.
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>1. Profile every column</Typography>
          <Typography variant="body2" paragraph>
            For each column (except internal ones like id / split_type), we estimate type
            (numerical, categorical, text…), unique value count, missing ratio, and whether
            values look like identifiers (UUID, hash, email, IP…).
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>2. Detect dataset context</Typography>
          <Typography variant="body2" paragraph>
            If several column names look network/cyber related (src_ip, protocol, bytes…),
            we apply cybersecurity-oriented name hints (attack_type, malware, threat…).
            Otherwise we stay in a general ML context.
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>3. Score candidates (structure first)</Typography>
          <Typography variant="body2" paragraph>
            The score is driven mainly by structure: class count (e.g. 2–50 categories is
            good for classification), data type, position (first/last often holds the label),
            and penalties (IDs, constants, heavy missingness, free text).
            A name like label / class / target is only a <strong>bonus</strong> when present
            not matching a predefined name does <strong>not</strong> mean the column is not a target.
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>4. Extra check for classic datasets</Typography>
          <Typography variant="body2" paragraph>
            If there is only one low-cardinality class-like column among mostly numeric
            features, that column receives a structural bonus (typical supervised tabular layout).
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>5. Leakage warning &amp; decision</Typography>
          <Typography variant="body2" paragraph>
            We warn if another column nearly duplicates the top candidate. Then we either
            recommend one clear target, show a short list to choose from, or suggest
            unsupervised learning if nothing looks reliable.
          </Typography>
          <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
            Confirming only pre-fills the existing target selector and runs the same save /
            problem-type detection flow you already use.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHowItWorksOpen(false)} variant="contained"
            sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c45f05" } }}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TargetTypeTab;
