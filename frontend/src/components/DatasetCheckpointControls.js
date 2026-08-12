import React, { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import {
  Save as SaveIcon,
  SaveAs as SaveAsIcon,
  ArrowDropDown as ArrowDropDownIcon,
  RestartAlt as RestartAltIcon,
} from "@mui/icons-material";
import axios from "axios";
import { backendUrl } from "../config";
import SaveDatasetCopyDialog from "./SaveDatasetCopyDialog";

/**
 * Shared Save / Save As / Reset controls for pipeline stages.
 *
 * - Save (menu): overwrite {bd}_reset with current working table (+ metadata)
 * - Save As (menu): clone working + reset + backup (+ numerized) under a new name
 * - Reset: restore working table from {bd}_reset (+ metadata)
 */
function DatasetCheckpointControls({
  bdName,
  copyType = "checkpoint",
  disabled = false,
  showReset = true,
  showSave = true,
  onResetSuccess,
  onSaveSuccess,
  onSaveAsSuccess,
  onError,
  confirmResetMessage,
}) {
  const [busy, setBusy] = useState(false);
  const [saveMenuAnchor, setSaveMenuAnchor] = useState(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);

  const notifyError = (err, fallback) => {
    const detail = err?.response?.data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message || err?.message || fallback;
    onError?.(message);
  };

  const handleSaveCheckpoint = async () => {
    if (!bdName) {
      onError?.("Dataset name is missing.");
      return;
    }
    setSaveMenuAnchor(null);
    setBusy(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/dataset/save-checkpoint`,
        { source_db: bdName },
        { withCredentials: true, headers: { "Content-Type": "application/json" } }
      );
      onSaveSuccess?.(
        res.data?.message || "Saved: reset checkpoint updated to the current dataset state."
      );
    } catch (err) {
      notifyError(err, "Failed to save checkpoint.");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!bdName) {
      onError?.("Dataset name is missing.");
      return;
    }
    const msg =
      confirmResetMessage ||
      `Reset "${bdName}" to the last saved checkpoint (_reset)? Unsaved changes on the working table will be lost.`;
    if (!window.confirm(msg)) return;

    setBusy(true);
    try {
      const res = await axios.post(
        `${backendUrl}/api/dataset/reset-to-checkpoint`,
        { source_db: bdName },
        { withCredentials: true, headers: { "Content-Type": "application/json" } }
      );
      onResetSuccess?.(res.data?.message || "Dataset restored from reset checkpoint.");
    } catch (err) {
      notifyError(err, "Failed to reset dataset.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      {showSave && (
        <>
          <Tooltip title="Save options: update reset checkpoint, or Save As a new dataset">
            <span>
              <Button
                variant="outlined"
                disabled={disabled || busy || !bdName}
                onClick={(e) => setSaveMenuAnchor(e.currentTarget)}
                startIcon={
                  busy ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />
                }
                endIcon={<ArrowDropDownIcon />}
                sx={{
                  height: 40,
                  textTransform: "none",
                  borderColor: "#384850",
                  color: "#384850",
                  fontWeight: 600,
                }}
              >
                Save
              </Button>
            </span>
          </Tooltip>
          <Menu
            anchorEl={saveMenuAnchor}
            open={Boolean(saveMenuAnchor)}
            onClose={() => setSaveMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
          >
            <MenuItem
              onClick={handleSaveCheckpoint}
              disabled={busy}
            >
              <ListItemIcon>
                <SaveIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Save"
                secondary="Update reset checkpoint with current data & metadata"
              />
            </MenuItem>
            <MenuItem
              onClick={() => {
                setSaveMenuAnchor(null);
                setSaveAsOpen(true);
              }}
              disabled={busy}
            >
              <ListItemIcon>
                <SaveAsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Save As…"
                secondary="Create a new dataset copy (working + reset + backup)"
              />
            </MenuItem>
          </Menu>
        </>
      )}

      {showReset && (
        <Tooltip title="Restore the working dataset from the shared reset checkpoint (handles column changes).">
          <span>
            <Button
              variant="contained"
              startIcon={
                busy ? <CircularProgress size={16} color="inherit" /> : <RestartAltIcon />
              }
              onClick={handleReset}
              disabled={disabled || busy || !bdName}
              sx={{
                height: 40,
                textTransform: "none",
                backgroundColor: "#DE6B06",
                fontWeight: 700,
                "&:hover": { backgroundColor: "#c55a05" },
              }}
            >
              Reset
            </Button>
          </span>
        </Tooltip>
      )}

      <SaveDatasetCopyDialog
        open={saveAsOpen}
        onClose={() => setSaveAsOpen(false)}
        dbName={bdName}
        copyType={copyType}
        description="Save As creates a full copy of the current working dataset, its reset checkpoint, and its backup (plus numerized if present), with matching metadata."
        onSuccess={(message) => onSaveAsSuccess?.(message)}
        disabled={disabled || busy}
      />
    </Box>
  );
}

export default DatasetCheckpointControls;
