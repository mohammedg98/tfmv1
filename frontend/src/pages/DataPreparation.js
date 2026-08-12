import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Chip,
  Snackbar,
  Alert,
  Paper,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  LockOutlined as LockIcon,
  ArrowForwardIos as ArrowIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import axios from "axios";
import { backendUrl } from "../config";
import DatasetCheckpointControls from "../components/DatasetCheckpointControls";
import TargetTypeTab from "./data_preparation/TargetTypeTab";
import EdaTab from "./data_preparation/EdaTab";
import Group_optimizer from "./Group_optimizer";
import Data_cleaning from "./Data_cleaning";
import Data_transformation from "./Data_transformation";
import Creat_Model from "./Creat_Model";
import "./data_preparation/DataPreparation.css";

/**
 * Page fusionnée de préparation des données.
 *
 * Ordre anti data-leakage :
 *   1. Target & Type (obligatoire)
 *   2. Groups (optionnel)
 *   3. Clean · Split · Impute (obligatoire)
 *   4. Transform (obligatoire: Train Model s'active quand le bouton
 *      Outlier Manager Multivariate est activable : colonnes numériques
 *      compatibles, avec split + target déjà OK)
 *   5. Train Model (obligatoire: verrouillé tant que Target + Split + Transform
 *      ne sont pas prêts)
 */

const TABS = [
  { key: "target", label: "Target & Type", required: true },
  { key: "groups", label: "Groups", required: false },
  { key: "prepare", label: "Clean · Split · Impute", required: true },
  { key: "transform", label: "Transform", required: true },
  { key: "train", label: "Train Model", required: true },
];

function DataPreparation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { bdName } = location.state || {};

  const [activeTab, setActiveTab] = useState(
    Number.isInteger(location.state?.initialTab) ? location.state.initialTab : 0
  );
  const [targetColumn, setTargetColumn] = useState(location.state?.targetColumn || "");
  const [problemType, setProblemType] = useState("");
  const [hasValidSplit, setHasValidSplit] = useState(false);
  const [emptyRowsCount, setEmptyRowsCount] = useState(null); // null = unknown, 0 = clean
  const [transformReady, setTransformReady] = useState(false); // = OM2 button can be enabled
  const [transformHint, setTransformHint] = useState("");
  const [om2ReadyFromChild, setOm2ReadyFromChild] = useState(null); // live signal from Transform tab
  const [edaDialogOpen, setEdaDialogOpen] = useState(false);
  const [adminNotesOpen, setAdminNotesOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [hasAdminNotes, setHasAdminNotes] = useState(false);
  const [loadingAdminNotes, setLoadingAdminNotes] = useState(false);
  const [downloadingDataset, setDownloadingDataset] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  const showSnackbar = useCallback((message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const fetchAdminNotes = useCallback(async () => {
    if (!bdName) return;
    setLoadingAdminNotes(true);
    try {
      const res = await axios.get(`${backendUrl}/api/get-database-metadata`, {
        params: { dbName: bdName },
        withCredentials: true,
      });
      const info = res.data?.dataset_info;
      let text = "";
      if (typeof info === "string") {
        text = info.trim();
      } else if (info && typeof info === "object") {
        text =
          String(info.text || info.description || info.info || "").trim() ||
          JSON.stringify(info, null, 2);
      }
      const has = !!res.data?.has_dataset_info || text.length > 0;
      setHasAdminNotes(has);
      setAdminNotes(has ? text : "");
    } catch (err) {
      setHasAdminNotes(false);
      setAdminNotes("");
    } finally {
      setLoadingAdminNotes(false);
    }
  }, [bdName]);

  const fetchSplitStatus = useCallback(async () => {
    if (!bdName) return;
    try {
      // quick=true: EXISTS only: avoids full COUNT on million-row tables
      const res = await axios.get(`${backendUrl}/api/get-split-stats2`, {
        params: { bdName, quick: true },
        withCredentials: true,
      });
      const trainOk =
        !!res.data?.has_train ||
        (!!res.data?.exists && (res.data?.train_count || 0) > 0);
      setHasValidSplit(trainOk);
    } catch (err) {
      setHasValidSplit(false);
    }
  }, [bdName]);

  const fetchEmptyRowsCount = useCallback(async () => {
    if (!bdName) return;
    try {
      const emptyRes = await axios.get(`${backendUrl}/api/count-empty-rows`, {
        params: { bdName },
        withCredentials: true,
      });
      const emptyCount = emptyRes.data?.count;
      setEmptyRowsCount(typeof emptyCount === "number" ? emptyCount : null);
    } catch (err) {
      // keep previous value: do not reset to null on transient errors
    }
  }, [bdName]);

  const fetchTarget = useCallback(async () => {
    if (!bdName) return;
    try {
      const res = await axios.get(`${backendUrl}/api/get-target-column2`, {
        params: { dbName: bdName },
        withCredentials: true,
      });
      const tc = res.data?.target_column;
      // Distinguish:
      // - not chosen yet → null / empty (Clean locked)
      // - explicit "No target" → sentinel "no-target-column" (Clean unlocked)
      // - real column name → unlocked
      if (tc) {
        setTargetColumn(tc);
        if (tc === "no-target-column" || res.data?.is_unsupervised) {
          setProblemType("unsupervised");
        } else if (res.data?.model_type === "unsupervised") {
          setProblemType("unsupervised");
        } else if (res.data?.model_type) {
          setProblemType(res.data.model_type);
        }
      } else if (res.data?.is_unsupervised || res.data?.model_type === "unsupervised") {
        setTargetColumn("no-target-column");
        setProblemType("unsupervised");
      } else {
        setTargetColumn("");
        setProblemType("");
      }
    } catch (err) {
      // silent
    }
  }, [bdName]);

  const fetchTransformStatus = useCallback(async () => {
    if (!bdName) return;
    try {
      const [typesRes, emptyRes] = await Promise.all([
        axios.get(`${backendUrl}/api/analyze-column-types`, {
          params: { bdName },
          withCredentials: true,
        }),
        axios
          .get(`${backendUrl}/api/count-empty-rows`, {
            params: { bdName },
            withCredentials: true,
          })
          .catch(() => ({ data: { count: null } })),
      ]);

      const cols = (typesRes.data?.column_types || []).filter(
        (c) => c.column_name !== "split_type" && c.column_name !== "id"
      );

      const isNumericCompatible = (c) => {
        if (c.column_type === "numerical" || c.column_type === "boolean") return true;
        if (c.column_type === "date") return true; // at most one date: checked below
        if (c.column_type === "categorical") {
          const s = c.stats || {};
          return !!(
            s.is_numeric_content ||
            s.min != null ||
            s.max != null ||
            s.mean != null
          );
        }
        return false;
      };

      const dateCols = cols.filter((c) => c.column_type === "date");
      const incompatible = cols.filter((c) => !isNumericCompatible(c));
      const emptyCount = emptyRes.data?.count;
      const hasEmpty = typeof emptyCount === "number" ? emptyCount > 0 : false;
      setEmptyRowsCount(typeof emptyCount === "number" ? emptyCount : null);

      const tooManyDates = dateCols.length > 1;
      const om2ColumnsOk =
        incompatible.length === 0 && cols.length > 0 && !tooManyDates;
      setTransformReady(om2ColumnsOk);

      if (tooManyDates) {
        setTransformHint(
          `Train Model locked: only one date column allowed (${dateCols.length} found: ${dateCols
            .slice(0, 4)
            .map((c) => c.column_name)
            .join(", ")}${dateCols.length > 4 ? "…" : ""}). Keep one in Auto Transform or delete the extras.`
        );
      } else if (incompatible.length > 0) {
        setTransformHint(
          `Train Model locked: non-numeric columns: ${incompatible
            .slice(0, 4)
            .map((c) => c.column_name)
            .join(", ")}${incompatible.length > 4 ? "…" : ""}`
        );
      } else if (om2ColumnsOk && hasEmpty) {
        setTransformHint(
          `Transform ready (≤1 date allowed) · ${emptyCount} empty row(s) still present (clean before OM2 if needed)`
        );
      } else if (om2ColumnsOk) {
        setTransformHint(
          dateCols.length === 1
            ? `Transform ready · 1 date kept for optional Time Series validation`
            : `Transform ready · all columns OK for Train Model`
        );
      } else {
        setTransformHint("");
      }
    } catch (err) {
      setTransformReady(false);
      setTransformHint("");
    }
  }, [bdName]);

  useEffect(() => {
    if (!bdName) {
      navigate("/upload");
      return;
    }
    fetchSplitStatus();
    fetchTarget();
    fetchEmptyRowsCount();
    fetchTransformStatus();
    fetchAdminNotes();
  }, [bdName, navigate, fetchSplitStatus, fetchTarget, fetchEmptyRowsCount, fetchTransformStatus, fetchAdminNotes]);

  // Heavy transform analysis only when opening Transform; light refresh on Clean tab
  useEffect(() => {
    const key = TABS[activeTab]?.key;
    if (key === "transform") {
      fetchTransformStatus();
      fetchSplitStatus();
    } else if (key === "prepare") {
      fetchSplitStatus();
      fetchEmptyRowsCount();
    }
  }, [activeTab, fetchTransformStatus, fetchSplitStatus, fetchEmptyRowsCount]);

  // Called by Clean · Split after delete empty / impute / save / split
  // Optional patch = instant UI update; then light background refresh (no analyze-column-types)
  const handlePrepareDataChange = useCallback(
    (patch) => {
      if (patch && typeof patch === "object") {
        if (typeof patch.hasValidSplit === "boolean") {
          setHasValidSplit(patch.hasValidSplit);
        }
        if (typeof patch.emptyRowsCount === "number") {
          setEmptyRowsCount(patch.emptyRowsCount);
        }
      }
      fetchSplitStatus();
      fetchEmptyRowsCount();
    },
    [fetchSplitStatus, fetchEmptyRowsCount]
  );

  const stepStatus = useMemo(() => {
    // Target done when a real column OR explicit "no-target-column" was saved
    const targetDone = !!targetColumn;
    // Clean · Split is Done only with a valid split AND no empty values
    const prepareDone = hasValidSplit && emptyRowsCount === 0;
    // Prefer live signal from Transform tab when available
    const transformDone =
      om2ReadyFromChild === null ? transformReady : !!om2ReadyFromChild;
    const trainUnlocked = targetDone && prepareDone && transformDone;
    return {
      target: targetDone,
      groups: false,
      prepare: prepareDone,
      transform: transformDone,
      train: trainUnlocked,
    };
  }, [targetColumn, hasValidSplit, emptyRowsCount, transformReady, om2ReadyFromChild]);

  // Same gate that used to unlock the Train Model button
  const requiredComplete = useMemo(() => {
    return stepStatus.target && stepStatus.prepare && stepStatus.transform;
  }, [stepStatus]);

  // Clean · Split · Impute stays locked until target OR "No target" is confirmed
  const prepareUnlocked = !!targetColumn;

  const handleTabChange = (index) => {
    const tab = TABS[index];
    if (tab?.key === "prepare" && !prepareUnlocked) {
      showSnackbar(
        'Choose a target column, or "No target column (unsupervised)", in Target & Type before opening Clean · Split · Impute.',
        "warning"
      );
      return;
    }
    if (tab?.key === "train" && !requiredComplete) {
      showSnackbar(
        "Finish Target & Type, Clean · Split · Impute (no empty values), and Transform before opening Train Model.",
        "warning"
      );
      return;
    }
    setActiveTab(index);
  };

  // If target was cleared (e.g. Start from scratch) while on Clean, bounce back
  useEffect(() => {
    if (TABS[activeTab]?.key === "prepare" && !prepareUnlocked) {
      setActiveTab(0);
    }
  }, [activeTab, prepareUnlocked]);

  const handleTargetChange = useCallback(({ targetColumn: tc, problemType: pt }) => {
    setTargetColumn(tc || "");
    if (pt !== undefined && pt !== null) setProblemType(pt);
  }, []);

  const handleTargetConfirmed = ({ targetColumn: tc, problemType: pt }) => {
    setTargetColumn(tc);
    setProblemType(pt);
    setActiveTab(1); // Groups (optional next)
  };

  const handleOm2ReadyChange = useCallback((ready) => {
    setOm2ReadyFromChild(!!ready);
    setTransformReady(!!ready);
  }, []);

  const handleDownloadDataset = async () => {
    if (!bdName || downloadingDataset) return;
    setDownloadingDataset(true);
    try {
      const res = await axios.get(`${backendUrl}/api/download-dataset-csv`, {
        params: { dbName: bdName },
        withCredentials: true,
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bdName}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showSnackbar("Dataset downloaded as CSV", "success");
    } catch (err) {
      let msg = "Failed to download dataset";
      try {
        if (err.response?.data instanceof Blob) {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          msg = parsed.detail || msg;
        } else if (err.response?.data?.detail) {
          msg = err.response.data.detail;
        }
      } catch (_) {
        /* ignore */
      }
      showSnackbar(msg, "error");
    } finally {
      setDownloadingDataset(false);
    }
  };

  if (!bdName) return null;

  return (
    <Box className="data-prep-container">
      {/* En-tête */}
      <Paper elevation={0} className="data-prep-header">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Typography variant="h5" className="data-prep-title">
            Data Preparation
          </Typography>
          <Chip label={bdName} size="small" sx={{ backgroundColor: "rgba(0,80,111,0.1)" }} />
          {targetColumn && (
            <Chip
              label={`Target: ${targetColumn === "no-target-column" ? "None (unsupervised)" : targetColumn}`}
              size="small"
              color="warning"
              variant="outlined"
            />
          )}
          {problemType && (
            <Chip label={problemType} size="small" color="info" variant="outlined" />
          )}
          <Tooltip
            title={
              !hasValidSplit
                ? "No valid split yet"
                : emptyRowsCount > 0
                ? `Split exists but ${emptyRowsCount} empty row(s) remain: Clean · Split is not Done`
                : emptyRowsCount === 0
                ? "Valid split and no empty values"
                : "Checking empty values…"
            }
          >
            <Chip
              size="small"
              color={hasValidSplit && emptyRowsCount === 0 ? "success" : hasValidSplit ? "warning" : "default"}
              label={
                !hasValidSplit
                  ? "Not split"
                  : emptyRowsCount > 0
                  ? `Split · ${emptyRowsCount} empty`
                  : emptyRowsCount === 0
                  ? "Split ✓ · Clean ✓"
                  : "Split ✓"
              }
            />
          </Tooltip>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Tooltip
            title={
              hasAdminNotes
                ? "View dataset / model description"
                : "No description available for this dataset"
            }
          >
            <span>
              <Button
                variant="outlined"
                onClick={() => setAdminNotesOpen(true)}
                disabled={!hasAdminNotes || loadingAdminNotes}
                sx={{
                  borderColor: hasAdminNotes ? "#384850" : "#cfd8dc",
                  color: hasAdminNotes ? "#384850" : "#90a4ae",
                }}
              >
                {loadingAdminNotes ? "…" : "Admin notes"}
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="outlined"
            onClick={() => setEdaDialogOpen(true)}
            sx={{ borderColor: "#384850", color: "#384850" }}
          >
            EDA
          </Button>
          <DatasetCheckpointControls
            bdName={bdName}
            copyType="data_preparation"
            showReset={false}
            showSave={true}
            onSaveSuccess={(msg) => showSnackbar(msg, "success")}
            onSaveAsSuccess={(msg) => showSnackbar(msg, "success")}
            onError={(msg) => showSnackbar(msg, "error")}
          />
          <Button
            variant="outlined"
            onClick={handleDownloadDataset}
            disabled={downloadingDataset}
            sx={{ borderColor: "#384850", color: "#384850" }}
          >
            {downloadingDataset ? "Downloading…" : "Download CSV"}
          </Button>
        </Box>
      </Paper>

      {/* Workflow stepper */}
      <Paper elevation={0} className="dp-workflow">
        <Box className="dp-steps dp-steps--full">
          {TABS.map((t, i) => {
            const done = stepStatus[t.key];
            const isActive = activeTab === i;
            const locked =
              (t.key === "train" && !requiredComplete) ||
              (t.key === "prepare" && !prepareUnlocked);
            const statusClass = locked
              ? "dp-step--locked"
              : done
              ? "dp-step--done"
              : isActive
              ? "dp-step--active"
              : "dp-step--pending";

            return (
              <React.Fragment key={t.key}>
                <Tooltip
                  title={
                    t.key === "prepare" && !prepareUnlocked
                      ? 'Locked: choose a target column or "No target column" in Target & Type first'
                      : locked
                      ? "Locked: finish Target, Split (no empty values), and Transform first"
                      : t.key === "prepare" && hasValidSplit && emptyRowsCount > 0
                      ? `Not done: ${emptyRowsCount} empty row(s). Remove or impute them first.`
                      : t.key === "prepare" && !hasValidSplit
                      ? "Not done: create a train/test split"
                      : t.key === "transform" && transformHint
                      ? transformHint
                      : t.key === "train" && requiredComplete
                      ? "Train and save your model"
                      : t.required
                      ? "Required step"
                      : "Optional step"
                  }
                >
                  <button
                    type="button"
                    className={`dp-step ${statusClass}`}
                    onClick={() => handleTabChange(i)}
                    aria-disabled={locked}
                  >
                    <span className="dp-step-icon">
                      {locked ? (
                        <LockIcon fontSize="small" />
                      ) : done && t.key !== "train" ? (
                        <CheckCircleIcon fontSize="small" />
                      ) : (
                        <span className="dp-step-num">{i + 1}</span>
                      )}
                    </span>
                    <span className="dp-step-body">
                      <span className="dp-step-label">{t.label}</span>
                      <span className={`dp-step-badge ${t.required ? "required" : "optional"}`}>
                        {locked
                          ? "Locked"
                          : t.required
                          ? "Required"
                          : "Optional"}
                        {!locked && done && t.key !== "train" ? " · Done" : ""}
                        {!locked && t.key === "train" && requiredComplete ? " · Ready" : ""}
                      </span>
                    </span>
                  </button>
                </Tooltip>
                {i < TABS.length - 1 && (
                  <span className="dp-step-arrow" aria-hidden>
                    <ArrowIcon fontSize="small" />
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </Box>
      </Paper>

      {/* Contenu des onglets */}
      <Box className="data-prep-content">
        {activeTab === 0 && (
          <TargetTypeTab
            bdName={bdName}
            targetColumn={targetColumn}
            problemType={problemType}
            onConfirm={handleTargetConfirmed}
            onTargetChange={handleTargetChange}
            showSnackbar={showSnackbar}
          />
        )}

        {activeTab === 1 && (
          <Box className="embedded-page">
            <Group_optimizer
              embedded
              onCheckpointReset={() => {
                fetchTarget();
              }}
            />
          </Box>
        )}

        {activeTab === 2 && prepareUnlocked && (
          <Box className="embedded-page">
            <Data_cleaning
              embedded
              onSplitChange={handlePrepareDataChange}
              onGoToGroups={() => setActiveTab(1)}
              onCheckpointReset={() => fetchTarget()}
            />
          </Box>
        )}

        {activeTab === 2 && !prepareUnlocked && (
          <Paper elevation={0} sx={{ p: 4, textAlign: "center", border: "1px dashed #cfd8dc" }}>
            <LockIcon sx={{ fontSize: 40, color: "#90a4ae", mb: 1 }} />
            <Typography variant="h6" sx={{ color: "#384850", mb: 1 }}>
              Clean · Split · Impute is locked
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose a target column, or select &quot;No target column (unsupervised)&quot;,
              then confirm in Target &amp; Type.
            </Typography>
            <Button
              variant="contained"
              onClick={() => setActiveTab(0)}
              sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" }, textTransform: "none" }}
            >
              Go to Target &amp; Type
            </Button>
          </Paper>
        )}

        {activeTab === 3 && (
          <Box className="embedded-page">
            <Data_transformation
              embedded
              bdName={bdName}
              onDataChanged={() => {
                fetchTransformStatus();
                fetchSplitStatus();
                fetchEmptyRowsCount();
              }}
              onOm2ReadyChange={handleOm2ReadyChange}
            />
          </Box>
        )}

        {activeTab === 4 && requiredComplete && (
          <Box className="embedded-page embedded-page--train">
            <Creat_Model embedded bdName={bdName} />
          </Box>
        )}

        {activeTab === 4 && !requiredComplete && (
          <Paper elevation={0} sx={{ p: 4, textAlign: "center", border: "1px dashed #cfd8dc" }}>
            <LockIcon sx={{ fontSize: 40, color: "#90a4ae", mb: 1 }} />
            <Typography variant="h6" sx={{ color: "#384850", mb: 1 }}>
              Train Model is locked
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Complete Target & Type, Clean · Split · Impute (empty values must be 0), and Transform first.
            </Typography>
          </Paper>
        )}
      </Box>

      <Dialog
        open={edaDialogOpen}
        onClose={() => setEdaDialogOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { maxHeight: "92vh" } }}
      >
        <DialogTitle
          sx={{
            backgroundColor: "#384850",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 1.5,
          }}
        >
          <Typography variant="h6" sx={{ color: "white", fontWeight: 700 }}>
            Exploratory Data Analysis
          </Typography>
          <IconButton onClick={() => setEdaDialogOpen(false)} sx={{ color: "white" }} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2, overflowX: "auto", overflowY: "auto" }}>
          {edaDialogOpen && (
            <EdaTab bdName={bdName} hasValidSplit={hasValidSplit} targetColumn={targetColumn} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={adminNotesOpen}
        onClose={() => setAdminNotesOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            backgroundColor: "#384850",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 1.5,
          }}
        >
          <Typography variant="h6" sx={{ color: "white", fontWeight: 700 }}>
            Admin notes: recommended models
          </Typography>
          <IconButton onClick={() => setAdminNotesOpen(false)} sx={{ color: "white" }} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography
            variant="body1"
            sx={{ whiteSpace: "pre-wrap", color: "#384850", lineHeight: 1.7 }}
          >
            {adminNotes}
          </Typography>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default DataPreparation;
