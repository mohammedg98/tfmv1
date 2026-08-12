import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";
import {
  Save as SaveIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";
import axios from "axios";
import { backendUrl } from "../config";
import { normalizeDatasetName, validateDatasetNameInput } from "../utils/datasetName";

/**
 * Save As dialog: clone working + reset + backup (+ numerized) under a new name.
 * When the 10-dataset limit is reached, offers Dashboard in a new tab and
 * polls the limit so the alert clears as soon as the user deletes a dataset.
 */
function SaveDatasetCopyDialog({
  open,
  onClose,
  dbName,
  copyType,
  defaultName,
  description = "Save the current state of your dataset with all transformations applied.",
  onSuccess,
  disabled = false,
  stripNumerized = false,
}) {
  const [copyName, setCopyName] = useState("");
  const [nameConflict, setNameConflict] = useState(false);
  const [existingTables, setExistingTables] = useState([]);
  const [datasetLimitReached, setDatasetLimitReached] = useState(false);
  const [datasetCount, setDatasetCount] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const sourceDb = stripNumerized && dbName
    ? dbName.replace("_numerized", "")
    : dbName;

  const checkDatasetLimit = useCallback(async () => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/check-dataset-limit`,
        { withCredentials: true }
      );
      const reached = Boolean(response.data?.limit_reached);
      setDatasetLimitReached(reached);
      setDatasetCount(response.data?.count ?? null);
      setRemaining(response.data?.remaining ?? null);
      return response.data;
    } catch (err) {
      console.error("Dataset limit check failed:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    setCopyName(defaultName || `${dbName || "dataset"}_copy`);
    setNameConflict(false);
    setExistingTables([]);
    setDatasetLimitReached(false);
    setError("");
    checkDatasetLimit();

    const onFocus = () => checkDatasetLimit();
    const onVis = () => {
      if (document.visibilityState === "visible") checkDatasetLimit();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    // Live refresh while dialog is open (covers delete in another tab)
    pollRef.current = setInterval(() => {
      checkDatasetLimit();
    }, 2500);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, defaultName, dbName, checkDatasetLimit]);

  const handleClose = () => {
    setError("");
    setNameConflict(false);
    setDatasetLimitReached(false);
    onClose?.();
  };

  const handleSaveCopy = async (overwrite = false) => {
    const nameError = validateDatasetNameInput(copyName);
    if (nameError) {
      setError(nameError);
      return;
    }
    const normalizedName = normalizeDatasetName(copyName);

    if (!overwrite) {
      const limit = await checkDatasetLimit();
      if (limit?.limit_reached) {
        setDatasetLimitReached(true);
        return;
      }
    }

    try {
      setSaveLoading(true);
      setError("");
      const response = await axios.post(
        `${backendUrl}/api/save-dataset-copy`,
        {
          source_db: sourceDb,
          copy_name: normalizedName,
          copy_type: copyType,
          overwrite,
        },
        { withCredentials: true, headers: { "Content-Type": "application/json" } }
      );

      setNameConflict(false);
      setExistingTables([]);
      setDatasetLimitReached(false);
      onSuccess?.(response.data?.message || `Copy "${normalizedName}" saved successfully.`);
      handleClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail && typeof detail === "object" && detail.type === "name_exists") {
        setNameConflict(true);
        setExistingTables(detail.existing_tables || []);
      } else if (detail && typeof detail === "object" && detail.type === "limit_reached") {
        setDatasetLimitReached(true);
        setDatasetCount(detail.count ?? 10);
        setRemaining(0);
      } else {
        const message = typeof detail === "string" ? detail : (detail?.message || "Failed to save copy");
        if (String(message).toLowerCase().includes("limit")) {
          setDatasetLimitReached(true);
        } else {
          setError(message);
        }
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const busy = saveLoading || disabled;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ backgroundColor: "rgb(0, 80, 111)", color: "#fff" }}>
        <SaveIcon sx={{ mr: 1, verticalAlign: "middle" }} />
        Save As: New Dataset
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2, color: "#384850" }}>
          {description}
        </Typography>

        <TextField
          autoFocus
          fullWidth
          label="Dataset Name"
          value={copyName}
          onChange={(e) => {
            setCopyName(e.target.value);
            setNameConflict(false);
            setError("");
          }}
          variant="outlined"
          sx={{ mt: 1 }}
          disabled={datasetLimitReached}
          helperText={
            nameConflict
              ? "This name is already used"
              : normalizeDatasetName(copyName)
                ? `Will be saved as: ${normalizeDatasetName(copyName)}`
                : "Spaces become _, capitals become lowercase"
          }
          error={nameConflict}
        />

        {nameConflict && !datasetLimitReached && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
              Dataset Name Already Exists
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              The name "<strong>{copyName}</strong>" is already used. You can:
            </Typography>

            {existingTables.length > 0 && (
              <Box sx={{ mb: 2, p: 1.5, backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 1 }}>
                <Typography variant="body2" fontWeight="600" sx={{ mb: 1 }}>
                  Existing datasets:
                </Typography>
                {existingTables.map((table, index) => (
                  <Typography key={index} variant="body2" sx={{ fontSize: "0.8rem", ml: 1 }}>
                    • {table}
                  </Typography>
                ))}
              </Box>
            )}

            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  const timestamp = new Date().getTime();
                  setCopyName(`${normalizeDatasetName(copyName) || "dataset"}_${timestamp}`);
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
                disabled={busy}
                sx={{ flex: 1 }}
              >
                {saveLoading ? "Overwriting..." : "Overwrite Existing"}
              </Button>
            </Box>
          </Alert>
        )}

        {datasetLimitReached && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
              Maximum Datasets Reached ({datasetCount ?? 10}/10)
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Delete one or more datasets in the Dashboard. This message updates
              automatically when space is available: then you can Save As.
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexDirection: "column" }}>
              <Button
                variant="contained"
                size="small"
                onClick={() => window.open("/dashboard", "_blank", "noopener,noreferrer")}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" } }}
              >
                Open Dashboard to Delete Datasets
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => checkDatasetLimit()}
              >
                Check again now
                {remaining != null && !datasetLimitReached ? ` (${remaining} free)` : ""}
              </Button>
            </Box>
          </Alert>
        )}

        {!datasetLimitReached && remaining != null && remaining <= 2 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Dataset slots remaining: {remaining}/10
          </Alert>
        )}

        {error && !nameConflict && !datasetLimitReached && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} startIcon={<ClearIcon />}>
          Cancel
        </Button>

        {!nameConflict && !datasetLimitReached && (
          <Button
            onClick={() => handleSaveCopy(false)}
            variant="contained"
            startIcon={saveLoading ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            disabled={busy || !copyName.trim()}
            sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" } }}
          >
            {saveLoading ? "Saving..." : "Save As"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default SaveDatasetCopyDialog;
