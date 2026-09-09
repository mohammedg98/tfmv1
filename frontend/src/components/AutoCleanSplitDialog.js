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
    showSnackbar?.("Auto Clean & Split finished", "success");
  };

  const report = result?.report;

  return (
    <>
      <Dialog
        open={open}
        onClose={phase === "running" || phase === "awaiting" ? undefined : handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ className: "clean-dialog" }}
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
          <span>Auto Clean &amp; Split</span>
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
              <Typography variant="body1">
                Cleans the dataset (empty values, duplicates, unused columns) and splits it automatically.
              </Typography>
            </Box>
          )}

          {(phase === "running" || phase === "awaiting" || phase === "done" || phase === "error") && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: "#384850" }}>
                  Analysis log
                </Typography>
                {(phase === "running" || phase === "awaiting") && (
                  <CircularProgress size={16} />
                )}
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
                  maxHeight: 280,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  mb: 2,
                }}
              >
                {(logs.length ? logs : ["running..."]).map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </Box>

              {phase === "awaiting" && pendingQuestion && (
                <Alert severity="warning" icon={false} className="clean-alert" sx={{ mb: 2 }}>
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
                <Alert severity="error" icon={false}>
                  {result?.message || "Auto Clean & Split failed"}
                </Alert>
              )}

              {phase === "done" && report && (
                <Card variant="outlined" sx={{ borderColor: "#c8c9ca", boxShadow: "none", borderRadius: "2px" }}>
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
                      <Alert key={i} severity="warning" icon={false} className="clean-alert" sx={{ mb: 1 }}>
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
                sx={{ backgroundColor: "#DE6B06", "&:hover": { backgroundColor: "#c55a05" }, textTransform: "none", borderRadius: "2px", boxShadow: "none" }}
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
              Done
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={howOpen} onClose={() => setHowOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ className: "clean-dialog" }}>
        <DialogTitle>
          How it works
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            1. Count rows, missing values, and duplicates.
          </Typography>
          <Typography variant="body2" paragraph>
            2. Drop empty or constant columns, empty rows, and almost-empty rows.
            Few duplicates are removed. Many duplicates: you choose. Empty targets are dropped, never filled.
          </Typography>
          <Typography variant="body2" paragraph>
            3. Split about 80% train / 20% test (90/10 if the table is very large).
            Stratified split if the target is a class, otherwise random.
          </Typography>
          <Typography variant="body2" paragraph>
            4. Fill missing values (mean, median, or most frequent). Values come from train, then are applied to train and test.
          </Typography>
          <Typography variant="body2">
            5. If classes are very uneven, only train is rebalanced. Test stays as it is.
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
