import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Typography,
} from "@mui/material";
import axios from "axios";
import { backendUrl } from "../config";

/**
 * Auto Transform dialog: profile → decide → apply existing methods → clean empty rows.
 *
 * Date policy (low-risk):
 *  - 1 date: Keep (for optional Time Series MV) or Delete
 *  - N dates: Yes/No keep one for MV → pick which → delete the rest (or delete all)
 *  - Kept dates are NOT used as model features unless Time Series validation is chosen later
 */
export default function AutoTransformDialog({
  open,
  onClose,
  bdName,
  onCompleted,
  showSnackbar,
}) {
  const [phase, setPhase] = useState("intro"); // intro | running | done | error
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [howOpen, setHowOpen] = useState(false);
  const [scalingStrategy, setScalingStrategy] = useState("none");
  /** keep | delete */
  const [dateStrategy, setDateStrategy] = useState("keep");
  /** For N dates: whether user wants to keep one for time-based validation */
  const [keepOneDate, setKeepOneDate] = useState("yes");
  const [keepDateColumn, setKeepDateColumn] = useState("");
  const [hasDateColumns, setHasDateColumns] = useState(false);
  const [dateColumnNames, setDateColumnNames] = useState([]);
  const [checkingDates, setCheckingDates] = useState(false);
  const pollRef = useRef(null);
  const logBoxRef = useRef(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPoll();
    setPhase("intro");
    setLogs([]);
    setResult(null);
    setJobId(null);
    setScalingStrategy("none");
    setDateStrategy("keep");
    setKeepOneDate("yes");
    setKeepDateColumn("");
    setHasDateColumns(false);
    setDateColumnNames([]);
  }, [stopPoll]);

  const handleClose = () => {
    if (phase === "running") return;
    stopPoll();
    onClose?.();
    reset();
  };

  useEffect(() => {
    const el = logBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open || !bdName) return;
    let cancelled = false;
    (async () => {
      setCheckingDates(true);
      try {
        const res = await axios.get(`${backendUrl}/api/analyze-column-types`, {
          params: { bdName },
          withCredentials: true,
          timeout: 60000,
        });
        const types = res.data?.column_types || [];
        const dates = types
          .filter((c) => (c.column_type || "").toLowerCase() === "date")
          .map((c) => c.column_name);
        if (!cancelled) {
          setHasDateColumns(dates.length > 0);
          setDateColumnNames(dates);
          setKeepDateColumn(dates[0] || "");
          setDateStrategy("keep");
          setKeepOneDate("yes");
          if (dates.length === 0) setDateStrategy("keep");
        }
      } catch {
        if (!cancelled) {
          setHasDateColumns(false);
          setDateColumnNames([]);
        }
      } finally {
        if (!cancelled) setCheckingDates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, bdName]);

  const resolveDatePayload = () => {
    if (!hasDateColumns || dateColumnNames.length === 0) {
      return { date_strategy: "keep", keep_date_column: null };
    }
    if (dateColumnNames.length === 1) {
      if (dateStrategy === "delete") {
        return { date_strategy: "delete", keep_date_column: null };
      }
      return {
        date_strategy: "keep",
        keep_date_column: dateColumnNames[0],
      };
    }
    // Multiple dates
    if (keepOneDate === "no") {
      return { date_strategy: "delete", keep_date_column: null };
    }
    const chosen = keepDateColumn || dateColumnNames[0];
    return { date_strategy: "keep", keep_date_column: chosen };
  };

  const canStart = () => {
    if (!bdName) return false;
    if (!hasDateColumns || dateColumnNames.length <= 1) return true;
    if (keepOneDate === "no") return true;
    return Boolean(keepDateColumn);
  };

  const startJob = async () => {
    if (!bdName || !canStart()) return;
    setPhase("running");
    setLogs([]);
    setResult(null);
    try {
      const datePayload = resolveDatePayload();
      const startRes = await axios.post(
        `${backendUrl}/api/auto-transform/start`,
        {
          bdName,
          scaling_strategy: scalingStrategy,
          date_strategy: datePayload.date_strategy,
          keep_date_column: datePayload.keep_date_column,
        },
        { withCredentials: true }
      );
      const id = startRes.data?.job_id;
      if (!id) throw new Error("No job_id returned");
      setJobId(id);

      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const st = await axios.get(
            `${backendUrl}/api/auto-transform/status/${id}`,
            { withCredentials: true }
          );
          setLogs(st.data?.logs || []);
          const status = st.data?.status;
          if (status === "done") {
            stopPoll();
            setResult(st.data?.result || null);
            setPhase("done");
          } else if (status === "error") {
            stopPoll();
            setResult(st.data?.result || { message: "Failed" });
            setPhase("error");
          }
        } catch (err) {
          stopPoll();
          setResult({
            message: err.response?.data?.detail || err.message || "Polling failed",
          });
          setPhase("error");
        }
      }, 800);
    } catch (err) {
      setResult({
        message: err.response?.data?.detail || err.message || "Failed to start",
      });
      setPhase("error");
    }
  };

  const finishAndRefresh = async () => {
    stopPoll();
    onClose?.();
    reset();
    await onCompleted?.();
    showSnackbar?.("Auto Transform completed", "success");
  };

  const report = result?.report;
  const multiDates = dateColumnNames.length > 1;

  return (
    <>
      <Dialog
        open={open}
        onClose={phase === "running" ? undefined : handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ className: "transform-dialog" }}
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
          <span>Auto Transform</span>
          <Button
            size="small"
            onClick={() => setHowOpen(true)}
            sx={{ textTransform: "none", color: "#fff" }}
          >
            How it works
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          {phase === "intro" && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Encodes columns for modeling. If a cell is a sentence and you need a value inside it, use Extract from text first.
              </Typography>

              <FormControl component="fieldset" sx={{ mb: 2, display: "block" }}>
                <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
                  Numeric scaling
                </FormLabel>
                <RadioGroup
                  value={scalingStrategy}
                  onChange={(e) => setScalingStrategy(e.target.value)}
                >
                  <FormControlLabel
                    value="none"
                    control={<Radio size="small" />}
                    label="None (default, best for tree models)"
                  />
                  <FormControlLabel
                    value="auto"
                    control={<Radio size="small" />}
                    label="Auto: Log(1+x) only if strong positive skew"
                  />
                  <FormControlLabel
                    value="standard"
                    control={<Radio size="small" />}
                    label="Standardization (mean 0, std 1)"
                  />
                  <FormControlLabel
                    value="minmax"
                    control={<Radio size="small" />}
                    label="MinMax [0, 1]"
                  />
                </RadioGroup>
              </FormControl>

              {checkingDates && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  Checking for date columns…
                </Typography>
              )}

              {hasDateColumns && !multiDates && (
                <FormControl component="fieldset" sx={{ mb: 2, display: "block" }}>
                  <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
                    Date column: {dateColumnNames[0]}
                  </FormLabel>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Keep it for optional Time Series validation later, or delete it.
                    A kept date is never used as a normal model feature.
                  </Typography>
                  <RadioGroup
                    value={dateStrategy}
                    onChange={(e) => setDateStrategy(e.target.value)}
                  >
                    <FormControlLabel
                      value="keep"
                      control={<Radio size="small" />}
                      label="Keep (for time-based validation in Train Model)"
                    />
                    <FormControlLabel
                      value="delete"
                      control={<Radio size="small" />}
                      label="Delete this date column"
                    />
                  </RadioGroup>
                </FormControl>
              )}

              {hasDateColumns && multiDates && (
                <FormControl component="fieldset" sx={{ mb: 2, display: "block" }}>
                  <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
                    Date columns ({dateColumnNames.length}):{" "}
                    {dateColumnNames.slice(0, 6).join(", ")}
                    {dateColumnNames.length > 6 ? "…" : ""}
                  </FormLabel>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Time-based validation needs at most one date. Keep one and delete
                    the rest, or delete all.
                  </Typography>
                  <RadioGroup
                    value={keepOneDate}
                    onChange={(e) => setKeepOneDate(e.target.value)}
                  >
                    <FormControlLabel
                      value="yes"
                      control={<Radio size="small" />}
                      label="Yes: keep one date for time-based validation"
                    />
                    <FormControlLabel
                      value="no"
                      control={<Radio size="small" />}
                      label="No: delete all date columns"
                    />
                  </RadioGroup>
                  {keepOneDate === "yes" && (
                    <Box sx={{ mt: 1.5, ml: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Which date column to keep?
                      </Typography>
                      <Select
                        size="small"
                        fullWidth
                        value={keepDateColumn || dateColumnNames[0] || ""}
                        onChange={(e) => setKeepDateColumn(e.target.value)}
                        sx={{ maxWidth: 420 }}
                      >
                        {dateColumnNames.map((name) => (
                          <MenuItem key={name} value={name}>
                            {name}
                          </MenuItem>
                        ))}
                      </Select>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        All other date columns will be deleted.
                      </Typography>
                    </Box>
                  )}
                </FormControl>
              )}

              {scalingStrategy === "standard" || scalingStrategy === "minmax" ? (
                <Alert severity="info" icon={false} className="transform-alert">
                  Scaling rewrites the full table once. On large datasets wait a few minutes without closing this window.
                </Alert>
              ) : null}
            </Box>
          )}

          {(phase === "running" || phase === "done" || phase === "error") && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: "#384850" }}>
                  Analysis log
                </Typography>
                {phase === "running" && <CircularProgress size={16} />}
              </Box>
              <Box
                ref={logBoxRef}
                sx={{
                  bgcolor: "#384850",
                  color: "#ffffff",
                  fontFamily: "Consolas, 'Courier New', monospace",
                  fontSize: 12,
                  lineHeight: 1.55,
                  p: 1.5,
                  borderRadius: "2px",
                  maxHeight: 320,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {(logs.length ? logs : ["running..."]).map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </Box>

              {phase === "done" && report && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Summary
                  </Typography>
                  <Typography variant="body2">
                    Deleted columns: {(report.deleted_columns || []).length}
                    {(report.deleted_columns || []).length
                      ? ` (${report.deleted_columns.slice(0, 8).join(", ")}${
                          report.deleted_columns.length > 8 ? "…" : ""
                        })`
                      : ""}
                  </Typography>
                  {report.kept_date_column && (
                    <Typography variant="body2">
                      Kept date for time-based validation:{" "}
                      <strong>{report.kept_date_column}</strong>
                    </Typography>
                  )}
                  <Typography variant="body2">
                    Transforms applied:{" "}
                    {(report.transforms || []).filter((t) => t.ok).length} ok
                    {" · "}
                    {(report.transforms || []).filter((t) => !t.ok).length} failed
                  </Typography>
                  <Typography variant="body2">
                    Left unchanged: {(report.left_unchanged || []).length}
                  </Typography>
                  <Typography variant="body2">
                    Empty rows removed: {report.empty_rows_deleted ?? 0}
                  </Typography>
                  {(report.warnings || []).length > 0 && (
                    <Alert severity="warning" icon={false} className="transform-alert" sx={{ mt: 1 }}>
                      {(report.warnings || []).slice(0, 5).join(" · ")}
                    </Alert>
                  )}
                </Box>
              )}

              {phase === "error" && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {result?.message || "Auto Transform failed"}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {phase === "intro" && (
            <>
              <Button onClick={handleClose} sx={{ textTransform: "none" }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={startJob}
                disabled={!canStart()}
                sx={{
                  textTransform: "none",
                  bgcolor: "#DE6B06",
                  fontWeight: 700,
                  boxShadow: "none",
                  borderRadius: "2px",
                  "&:hover": { bgcolor: "#c55a05" },
                }}
              >
                Start Auto Transform
              </Button>
            </>
          )}
          {phase === "running" && (
            <Button disabled sx={{ textTransform: "none" }}>
              Running…
            </Button>
          )}
          {(phase === "done" || phase === "error") && (
            <>
              <Button onClick={handleClose} sx={{ textTransform: "none" }}>
                Close
              </Button>
              {phase === "done" && (
                <Button
                  variant="contained"
                  onClick={finishAndRefresh}
                  sx={{
                    textTransform: "none",
                    bgcolor: "#384850",
                    fontWeight: 700,
                    boxShadow: "none",
                    borderRadius: "2px",
                    "&:hover": { bgcolor: "#2a3942" },
                  }}
                >
                  Done
                </Button>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={howOpen} onClose={() => setHowOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ className: "transform-dialog" }}>
        <DialogTitle>How it works</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            1. Drop columns that are empty, constant, long free text, or look like IDs.
          </Typography>
          <Typography variant="body2" paragraph>
            2. Boolean: Binary (skip if already 0/1). Categorical: One-Hot if 10 classes or fewer, otherwise Label. Target categorical: Label only.
          </Typography>
          <Typography variant="body2" paragraph>
            3. Repetitive text: Frequency. Unique-ish text: delete. Short repetitive strings are usually already typed as categorical.
          </Typography>
          <Typography variant="body2" paragraph>
            4. Date: keep one for optional Time Series validation, or delete. A kept date is not used as a normal feature.
          </Typography>
          <Typography variant="body2">
            5. Numeric scaling only if you choose it (default: none). Always ends by deleting rows that still have empty values. Fit on train when a split exists.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => setHowOpen(false)}
            sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" }, textTransform: "none", borderRadius: "2px", boxShadow: "none" }}
          >
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
