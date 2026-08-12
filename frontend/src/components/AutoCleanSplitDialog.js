import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Typography,
} from "@mui/material";
import {
  AutoFixHigh as AutoFixHighIcon,
  HelpOutline as HelpOutlineIcon,
} from "@mui/icons-material";
import axios from "axios";
import { backendUrl } from "../config";

/**
 * Auto Clean & Split dialog: mirrors Auto Target Detection UX:
 * intro → live logs → optional duplicate confirmation → final report.
 */
export default function AutoCleanSplitDialog({
  open,
  onClose,
  bdName,
  onCompleted,
  showSnackbar,
}) {
  const [phase, setPhase] = useState("intro"); // intro | running | awaiting | done | error
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [howOpen, setHowOpen] = useState(false);
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
    setPendingQuestion(null);
  }, [stopPoll]);

  const handleClose = () => {
    if (phase === "running" || phase === "awaiting") return;
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

  const startJob = async () => {
    if (!bdName) return;
    setPhase("running");
    setLogs([]);
    setResult(null);
    setPendingQuestion(null);
    try {
      const startRes = await axios.post(
        `${backendUrl}/api/auto-clean-split/start`,
        { bdName },
        { withCredentials: true }
      );
      const id = startRes.data?.job_id;
      if (!id) throw new Error("No job_id returned");
      setJobId(id);

      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const st = await axios.get(
            `${backendUrl}/api/auto-clean-split/status/${id}`,
            { withCredentials: true }
          );
          setLogs(st.data?.logs || []);
          const status = st.data?.status;
          if (status === "awaiting_input") {
            setPendingQuestion(st.data?.pending_question || null);
            setPhase("awaiting");
          } else if (status === "running") {
            setPhase("running");
            setPendingQuestion(null);
          } else if (status === "done") {
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

  const answerDuplicates = async (remove) => {
    if (!jobId) return;
    try {
      await axios.post(
        `${backendUrl}/api/auto-clean-split/continue`,
        { job_id: jobId, remove_duplicates: remove },
        { withCredentials: true }
      );
      setPhase("running");
      setPendingQuestion(null);
    } catch (err) {
      showSnackbar?.(
        err.response?.data?.detail || "Could not send decision",
        "error"
      );
    }
  };

  const finishAndRefresh = async () => {
    stopPoll();
    onClose?.();
    reset();
    await onCompleted?.();
    showSnackbar?.("Auto Clean & Split completed", "success");
  };

  const report = result?.report;

  return (
    <>
      <Dialog
        open={open}
        onClose={phase === "running" || phase === "awaiting" ? undefined : handleClose}
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
            Auto Clean &amp; Split
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
                One click: clean → split → impute (train stats only) → optional class balance.
              </Typography>
              <Alert severity="warning" variant="outlined">
                This will modify your current dataset. Confirm to start: you can still use
                the manual tools afterward.
              </Alert>
            </Box>
          )}

          {(phase === "running" || phase === "awaiting" || phase === "done" || phase === "error") && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: "rgb(0, 80, 111)" }}>
                  Pipeline log
                </Typography>
                {(phase === "running" || phase === "awaiting") && (
                  <CircularProgress size={16} />
                )}
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
                {(logs.length ? logs : ["Waiting for logs…"]).map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </Box>

              {phase === "awaiting" && pendingQuestion && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1.5 }}>
                    {pendingQuestion.message}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => answerDuplicates(true)}
                      sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c45f05" } }}
                    >
                      Remove duplicates
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => answerDuplicates(false)}>
                      Keep duplicates
                    </Button>
                  </Box>
                </Alert>
              )}

              {phase === "error" && (
                <Alert severity="error">
                  {result?.message || "Auto Clean & Split failed"}
                </Alert>
              )}

              {phase === "done" && report && (
                <Card variant="outlined" sx={{ borderColor: "#2e7d32", bgcolor: "rgba(46,125,50,0.05)" }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                      Summary report
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Original → Final
                        </Typography>
                        <Typography variant="body2">
                          {report.original?.rows?.toLocaleString?.() ?? report.original?.rows} rows ×{" "}
                          {report.original?.columns} cols
                          {" → "}
                          Train {report.final?.train_rows?.toLocaleString?.() ?? report.final?.train_rows} / Test{" "}
                          {report.final?.test_rows?.toLocaleString?.() ?? report.final?.test_rows}
                          {" · "}
                          {report.final?.columns} cols
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Split
                        </Typography>
                        <Typography variant="body2">
                          {report.split?.method} · Train {(report.split?.train_size || 0) * 100}%
                          {report.split?.problem_type
                            ? ` · ${report.split.problem_type}`
                            : ""}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Removed
                        </Typography>
                        <Typography variant="body2">
                          cols: {(report.removed?.empty_columns?.length || 0)
                            + (report.removed?.constant_columns?.length || 0)
                            + (report.removed?.high_missing_columns?.length || 0)}
                          {" · "}
                          empty rows: {report.removed?.empty_rows || 0}
                          {" · "}
                          sparse rows: {report.removed?.high_missing_rows || 0}
                          {" · "}
                          duplicates: {report.removed?.duplicate_rows || 0}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Imputation / Balance
                        </Typography>
                        <Typography variant="body2">
                          median {report.imputation?.median?.length || 0} · mean{" "}
                          {report.imputation?.mean?.length || 0} · mode{" "}
                          {report.imputation?.mode?.length || 0}
                          {" · "}
                          balance:{" "}
                          {report.balance?.applied
                            ? report.balance.method
                            : "none"}
                        </Typography>
                      </Grid>
                    </Grid>
                    {(report.warnings || []).length > 0 && (
                      <Box sx={{ mt: 1.5 }}>
                        {report.warnings.map((w, i) => (
                          <Alert key={i} severity="warning" variant="outlined" sx={{ mb: 1 }}>
                            {w}
                          </Alert>
                        ))}
                      </Box>
                    )}
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="body2" color="text.secondary">
                      Missing feature cells: Train:{" "}
                      {report.validation?.missing_train_features ?? "?"} · Test:{" "}
                      {report.validation?.missing_test_features ?? "?"}
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap" }}>
          {phase === "intro" && (
            <>
              <Button onClick={handleClose}>Cancel</Button>
              <Button
                variant="contained"
                onClick={startJob}
                startIcon={<AutoFixHighIcon />}
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c45f05" } }}
              >
                Start Auto Clean &amp; Split
              </Button>
            </>
          )}
          {(phase === "running" || phase === "awaiting") && (
            <Button disabled startIcon={<CircularProgress size={16} />}>
              {phase === "awaiting" ? "Waiting for your decision…" : "Running…"}
            </Button>
          )}
          {phase === "error" && (
            <>
              <Button onClick={handleClose}>Close</Button>
              <Button
                variant="outlined"
                onClick={() => {
                  reset();
                  setPhase("intro");
                }}
              >
                Try again
              </Button>
            </>
          )}
          {phase === "done" && (
            <Button
              variant="contained"
              onClick={finishAndRefresh}
              sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c45f05" } }}
            >
              Done: refresh view
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={howOpen} onClose={() => setHowOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ color: "rgb(0, 80, 111)", fontWeight: 700 }}>
          How Auto Clean &amp; Split works
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>1. Profile</Typography>
          <Typography variant="body2" paragraph>
            Counts rows/columns, missing values, duplicates, and column types: without
            loading the full table into memory.
          </Typography>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>2. Safe cleaning (before split)</Typography>
          <Typography variant="body2" paragraph>
            Removes completely empty columns, constant columns, fully empty rows, and rows
            with very high missingness (≥80% by default). Duplicates under 20% are removed
            automatically; higher ratios ask for confirmation (important for cyber event data).
            Missing targets are dropped: the target is never imputed.
          </Typography>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>3. Split</Typography>
          <Typography variant="body2" paragraph>
            Default 80/20 (90/10 for very large datasets). Stratified if the target looks like
            classification; otherwise random. Time-like columns trigger a warning only.
          </Typography>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>4. Imputation (anti-leakage)</Typography>
          <Typography variant="body2" paragraph>
            Mean / median / mode are chosen per column. Statistics are computed on TRAIN only,
            then applied to TRAIN and TEST. Never fitted on the full dataset.
          </Typography>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>5. Balance (train only)</Typography>
          <Typography variant="body2" paragraph>
            If classes are imbalanced, oversampling or undersampling is applied to TRAIN only.
            The test set stays representative of real data.
          </Typography>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>6. Validation report</Typography>
          <Typography variant="body2">
            Final counts, what was removed, imputation choices, and leakage-safe checks.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => setHowOpen(false)}
            sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c45f05" } }}
          >
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
