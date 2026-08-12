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
import {
  AutoFixHigh as AutoFixHighIcon,
  HelpOutline as HelpOutlineIcon,
} from "@mui/icons-material";
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AutoFixHighIcon sx={{ color: "#DE6B06" }} />
            Auto Transform
          </Box>
          <Button
            size="small"
            startIcon={<HelpOutlineIcon />}
            onClick={() => setHowOpen(true)}
            sx={{ textTransform: "none", color: "rgb(0, 80, 111)" }}
          >
            How it works
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          {phase === "intro" && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Profile each column → choose a safe transform from the{" "}
                <strong>existing manual methods</strong> → apply (fit on train when
                split exists) → always finish by removing rows with empty values.
              </Typography>

              <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
                If you need fields from free text (URLs, logs, etc.), use{" "}
                <strong>Extract from text</strong> first. Pure text columns may be
                deleted by Auto Transform (this is not an NLP tool).
              </Alert>

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

              <Alert severity="info" variant="outlined">
                This modifies your current dataset. You can still use manual tools
                afterward, or Reset to roll back this stage.
                {scalingStrategy === "standard" || scalingStrategy === "minmax" ? (
                  <>
                    {" "}
                    Scaling rewrites the full table once: on large datasets wait a few
                    minutes without closing the dialog.
                  </>
                ) : null}
              </Alert>
            </Box>
          )}

          {(phase === "running" || phase === "done" || phase === "error") && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: "rgb(0, 80, 111)" }}>
                  Pipeline log
                </Typography>
                {phase === "running" && <CircularProgress size={16} />}
                {jobId && (
                  <Typography variant="caption" color="text.secondary">
                    job {jobId.slice(0, 8)}…
                  </Typography>
                )}
              </Box>
              <Box
                ref={logBoxRef}
                sx={{
                  bgcolor: "#1e1e1e",
                  color: "#d4d4d4",
                  fontFamily: "Consolas, Monaco, monospace",
                  fontSize: 12,
                  p: 1.5,
                  borderRadius: 1,
                  maxHeight: 320,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {(logs || []).join("\n") || "Waiting…"}
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
                    <Alert severity="warning" sx={{ mt: 1 }}>
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
                startIcon={<AutoFixHighIcon />}
                sx={{
                  textTransform: "none",
                  bgcolor: "#DE6B06",
                  fontWeight: 700,
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
                    bgcolor: "rgb(0, 80, 111)",
                    fontWeight: 700,
                  }}
                >
                  Done, refresh table
                </Button>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={howOpen} onClose={() => setHowOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>How Auto Transform works</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            Decisions stay inside the same methods as the manual Transform UI.
          </Typography>
          <Typography variant="body2" component="div">
            <ul style={{ marginTop: 0, paddingLeft: 18 }}>
              <li>Constant / mostly-missing / free-text / ID-like → delete</li>
              <li>Boolean → Binary (skip if already 0/1)</li>
              <li>Categorical ≤10 classes → One-Hot; else Label</li>
              <li>Repetitive text → Frequency; unique-ish text → delete</li>
              <li>Target categorical → Label only</li>
              <li>
                Date → Keep one for optional Time Series validation, or delete
                (never treated as a normal feature)
              </li>
              <li>Numeric scaling only if you choose it (default: none)</li>
              <li>Always ends with delete rows that still have empty values</li>
            </ul>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Short repetitive strings are usually already typed as categorical by
            the platform: Auto does not re-invent that step.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHowOpen(false)} sx={{ textTransform: "none" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
