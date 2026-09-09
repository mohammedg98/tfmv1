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
import { Search as SearchIcon } from "@mui/icons-material";
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
      <Typography variant="subtitle2" sx={{ mb: 1, color: "#384850" }}>
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
          <Box sx={{ height: 8, borderRadius: 0, backgroundColor: "#e8e9ea", overflow: "hidden" }}>
            <Box
              sx={{
                height: "100%",
                width: `${(d.percentage / maxPct) * 100}%`,
                backgroundColor: "#DE6B06",
                borderRadius: 0,
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
        <Alert severity="warning" icon={false} sx={{ mt: 1.5 }} className="target-alert">
          Strong class imbalance
          {Number.isFinite(imbalanceRatio) ? ` (about ${imbalanceRatio.toFixed(1)} to 1)` : ""}.
          A stratified split is safer.
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
        <Typography color="text.secondary">Analyzing columns…</Typography>
      </Box>
    );
  }

  return (
    <Box className="target-tab">
      {error && (
        <Alert severity="error" icon={false} sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={loadColumnTypes}>Retry</Button>
        }>
          {error}
        </Alert>
      )}

      <Box className="dp-tab-toolbar">
        <Typography variant="h6" className="dp-tab-toolbar-title">
          Target column
        </Typography>
        <Box className="dp-tab-toolbar-actions">
          <Button
            variant="contained"
            className="target-btn"
            onClick={handleOpenAutoDialog}
            sx={{
              height: 40,
              backgroundColor: "#DE6B06",
              "&:hover": { backgroundColor: "#c55a05" },
            }}
          >
            Auto Select Target
          </Button>
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose the column you want to predict, or &quot;No target&quot; for unsupervised learning.
      </Typography>

      <Grid container spacing={2}>
        {/* Colonne gauche : sélection de la target */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" className="target-card">
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
                      sx={
                        filterType === t
                          ? { backgroundColor: "#384850", color: "#fff", borderRadius: "2px" }
                          : { borderColor: "#c8c9ca", color: "#384850", borderRadius: "2px" }
                      }
                    />
                  ))}
                </Box>
              </Box>

              <Paper variant="outlined" className="target-list-paper" sx={{ maxHeight: 420, overflow: "auto" }}>
                <List dense>
                  <ListItemButton
                    selected={selectedTarget === "no-target-column"}
                    onClick={() => handleSelectTarget("no-target-column")}
                  >
                    <ListItemText
                      primary="No target column (unsupervised learning)"
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
                              variant="outlined"
                              sx={{ borderColor: "#384850", color: "#384850", borderRadius: "2px" }}
                            />
                            {col.stats?.distinct != null && (
                              <Typography variant="caption" color="text.secondary">
                                {col.stats.distinct} unique
                              </Typography>
                            )}
                            {col.stats && col.stats.total > col.stats.non_null && (
                              <Chip label="Has nulls" size="small" variant="outlined" sx={{ borderColor: "#b42318", color: "#b42318", borderRadius: "2px" }} />
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
          <Card variant="outlined" className="target-card">
            <CardContent>
              <Box sx={{ mb: 1 }}>
                <Typography variant="h6" sx={{ color: "#384850" }}>
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
                    Detecting problem type…
                  </Typography>
                </Box>
              )}

              {selectedTarget && !detecting && detection && (
                <>
                  <Alert severity="info" icon={false} className="target-alert" sx={{ mb: 2 }}>
                    Suggested:{" "}
                    <strong>{PROBLEM_LABELS[detection.problem_type] || detection.problem_type}</strong>
                    {detection.reason ? `: ${detection.reason}` : ""}
                  </Alert>

                  {selectedTarget === "no-target-column" ? (
                    <Alert severity="info" icon={false} className="target-alert" sx={{ mb: 2 }}>
                      No target selected: unsupervised mode
                    </Alert>
                  ) : (
                    <ToggleButtonGroup
                      exclusive
                      fullWidth
                      size="small"
                      value={chosenProblemType}
                      onChange={(_, v) => v && setChosenProblemType(v)}
                      sx={{ mb: 2, "& .MuiToggleButton-root": { borderRadius: "2px", textTransform: "none" } }}
                    >
                      <ToggleButton value="classification">Classification</ToggleButton>
                      <ToggleButton value="regression">Regression</ToggleButton>
                      <ToggleButton value="unsupervised">Unsupervised</ToggleButton>
                    </ToggleButtonGroup>
                  )}

                  {selectedInfo && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Target column type
                      </Typography>
                      <Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={typeLabel(selectedInfo.column_type)}
                          sx={{ borderColor: "#384850", color: "#384850", borderRadius: "2px" }}
                        />
                      </Box>
                    </Box>
                  )}

                  {detection.problem_type === "classification" && (
                    <ClassDistributionBars distribution={detection.class_distribution} />
                  )}
                  {selectedTarget !== "no-target-column" &&
                    detection.problem_type === "unsupervised" &&
                    detection.reason && (
                    <Alert severity="warning" icon={false} className="target-alert" sx={{ mt: 1 }}>
                      {/unique|cardinal|too many/i.test(detection.reason)
                        ? "This target has too many unique values for a reliable classification suggestion. Pick another column, or keep unsupervised."
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
                className="target-btn"
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : undefined}
                onClick={handleConfirm}
                disabled={!selectedTarget || detecting || saving}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" } }}
              >
                {saving ? "Saving…" : "Confirm"}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Aperçu des 10 premières lignes avec colonne cible mise en évidence */}
        <Grid item xs={12}>
          <Card variant="outlined" className="target-card">
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, flexWrap: "wrap", gap: 1 }}>
                <Typography variant="h6" sx={{ color: "#384850" }}>
                  Data preview
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    first 10 rows · {previewColumns.length} columns
                  </Typography>
                </Typography>
                {selectedTarget && selectedTarget !== "no-target-column" && (
                  <Chip
                    size="small"
                    label={selectedTarget}
                    sx={{ backgroundColor: "#DE6B06", color: "#fff", borderRadius: "2px" }}
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
                                backgroundColor: isTarget ? "#DE6B06" : "#384850",
                                color: "#fff",
                                "&:hover": { backgroundColor: isTarget ? "#c55a05" : "#2a3942" },
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
                Click a column header to select it as the target.
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
        PaperProps={{ className: "target-dialog" }}
      >
        <DialogTitle
          sx={{
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
            onClick={() => setHowItWorksOpen(true)}
            sx={{ textTransform: "none" }}
          >
            How it works
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          {autoPhase === "intro" && (
            <Box>
              <Typography variant="body1">
                Each column is scored to find a likely target. Nothing is applied until you confirm.
              </Typography>
            </Box>
          )}

          {(autoPhase === "running" || autoPhase === "done" || autoPhase === "error") && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: "#384850" }}>
                  Analysis log
                </Typography>
                {autoPhase === "running" && <CircularProgress size={16} />}
              </Box>
              <Box
                ref={autoLogBoxRef}
                sx={{
                  bgcolor: "#384850",
                  color: "#ffffff",
                  fontFamily: "Consolas, 'Courier New', monospace",
                  fontSize: 12,
                  lineHeight: 1.55,
                  p: 1.5,
                  borderRadius: "2px",
                  maxHeight: 280,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  mb: 2,
                }}
              >
                {(autoLogs.length ? autoLogs : ["running..."]).map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </Box>

              {autoPhase === "error" && (
                <Alert severity="error" icon={false}>
                  {autoResult?.message || "Analysis failed"}
                </Alert>
              )}

              {autoPhase === "done" && autoResult?.decision === "single_target" && (
                <Card variant="outlined" className="target-card">
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "#384850" }}>
                      Suggested target: {autoResult.target}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Score: {Math.round((autoResult.score || 0) * 100)}%
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
                      <Alert severity="warning" icon={false} className="target-alert" sx={{ mt: 1 }}>
                        Another column looks almost identical:{" "}
                        <strong>{autoResult.potential_leakage_column}</strong>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {autoPhase === "done" && autoResult?.decision === "ambiguous" && (
                <Card variant="outlined" className="target-card">
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "#384850" }}>
                      Several columns have similar scores
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
                      <Alert severity="warning" icon={false} className="target-alert" sx={{ mt: 1 }}>
                        Another column looks almost identical:{" "}
                        <strong>{autoResult.potential_leakage_column}</strong>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {autoPhase === "done" && autoResult?.decision === "no_target" && (
                <Card variant="outlined" className="target-card">
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "#384850" }}>
                      No reliable target detected
                    </Typography>
                    <Typography variant="body2">
                      You can continue without a target (unsupervised), or pick a column yourself.
                    </Typography>
                  </CardContent>
                </Card>
              )}
              {autoPhase === "done" && autoResult && !["single_target", "ambiguous", "no_target"].includes(autoResult.decision) && (
                <Alert severity="warning" icon={false} className="target-alert">
                  Unexpected result. Close and select a target manually.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap" }}>
          {autoPhase === "intro" && (
            <>
              <Button onClick={handleCloseAutoDialog} sx={{ textTransform: "none" }}>Cancel</Button>
              <Button
                variant="contained"
                className="target-btn"
                onClick={startAutoDetect}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" } }}
              >
                Start analysis
              </Button>
            </>
          )}
          {autoPhase === "running" && (
            <Button disabled startIcon={<CircularProgress size={16} />} sx={{ textTransform: "none" }}>
              Analysis in progress…
            </Button>
          )}
          {autoPhase === "error" && (
            <>
              <Button onClick={handleCloseAutoDialog} sx={{ textTransform: "none" }}>Close</Button>
              <Button variant="outlined" onClick={() => { resetAutoDialog(); setAutoOpen(true); setAutoPhase("intro"); }} sx={{ textTransform: "none", borderRadius: "2px" }}>
                Try again
              </Button>
            </>
          )}
          {autoPhase === "done" && autoResult?.decision === "single_target" && (
            <>
              <Button onClick={handleCloseAutoDialog} sx={{ textTransform: "none" }}>Choose manually</Button>
              <Button
                variant="contained"
                className="target-btn"
                onClick={() => applyAutoSelection(autoResult.target)}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" } }}
              >
                Confirm this target
              </Button>
            </>
          )}
          {autoPhase === "done" && autoResult?.decision === "ambiguous" && (
            <>
              <Button onClick={handleCloseAutoDialog} sx={{ textTransform: "none" }}>Choose manually</Button>
              <Button
                variant="contained"
                className="target-btn"
                disabled={!ambiguousChoice}
                onClick={() => applyAutoSelection(ambiguousChoice)}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" } }}
              >
                Confirm selection
              </Button>
            </>
          )}
          {autoPhase === "done" && autoResult?.decision === "no_target" && (
            <>
              <Button onClick={handleCloseAutoDialog} sx={{ textTransform: "none" }}>Choose manually anyway</Button>
              <Button
                variant="contained"
                className="target-btn"
                onClick={() => applyAutoSelection("no-target-column")}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" } }}
              >
                Continue without target
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
        PaperProps={{ className: "target-dialog" }}
      >
        <DialogTitle>How Auto Target Detection works</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            We look at each column and give it a score from 0 to 100%. The higher the score, the more it looks like something a model should predict. Nothing is saved until you confirm.
          </Typography>
          <Typography variant="body2" paragraph>
            The score is built from the data itself. A name like <strong>target</strong>, <strong>label</strong> or <strong>class</strong> only adds extra points. A column without that kind of name can still win.
          </Typography>

          <Typography variant="subtitle2" sx={{ mt: 1, mb: 1, color: "#384850" }}>
            Main score
          </Typography>
          <table className="target-score-table">
            <thead>
              <tr>
                <th>What we look at</th>
                <th>Weight</th>
                <th>How points are given</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>How many different values</td>
                <td>40%</td>
                <td>
                  2–50 classes (category / yes-no): 90<br />
                  Many different numbers, not an ID: 70<br />
                  Anything else: 20
                </td>
              </tr>
              <tr>
                <td>Column type</td>
                <td>25%</td>
                <td>
                  Number, category or yes-no: 80<br />
                  Date: 20<br />
                  Text: 10
                </td>
              </tr>
              <tr>
                <td>Column name</td>
                <td>up to 25%</td>
                <td>
                  Bonus only if the name looks like a target.<br />
                  target / label / class: 100 of this bonus<br />
                  y / output / outcome: 85<br />
                  result / category / status / type: 60<br />
                  value / score / grade / group: 35<br />
                  price / amount / count: 25
                </td>
              </tr>
            </tbody>
          </table>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, color: "#384850" }}>
            Extra points or penalties
          </Typography>
          <table className="target-score-table">
            <thead>
              <tr>
                <th>Situation</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>First or last column</td>
                <td>+2 (+5 if it looks like a class column)</td>
              </tr>
              <tr>
                <td>Network / security dataset and a matching name (attack, malware…)</td>
                <td>+15</td>
              </tr>
              <tr>
                <td>Only one class-like column in the table</td>
                <td>+35</td>
              </tr>
              <tr>
                <td>Same value in every row</td>
                <td>−100</td>
              </tr>
              <tr>
                <td>Looks like an ID, email, IP or UUID</td>
                <td>−60</td>
              </tr>
              <tr>
                <td>Numbers in sequence (1, 2, 3…)</td>
                <td>−15 (−40 if the name also looks like an ID)</td>
              </tr>
              <tr>
                <td>More than half of the values missing</td>
                <td>up to −50</td>
              </tr>
              <tr>
                <td>Long free text</td>
                <td>−40</td>
              </tr>
              <tr>
                <td>Date column</td>
                <td>−30</td>
              </tr>
            </tbody>
          </table>

          <Typography variant="body2" sx={{ mt: 2 }}>
            If one column is clearly ahead, we suggest it. If several are close, you choose. If none look reliable, we suggest working without a target. We also warn you if another column is almost a copy of the suggested target.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setHowItWorksOpen(false)}
            variant="contained"
            className="target-btn"
            sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" } }}
          >
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TargetTypeTab;
