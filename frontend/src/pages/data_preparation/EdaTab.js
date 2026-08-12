import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  Chip,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  InsightsOutlined as InsightsIcon,
  WarningAmber as WarningIcon,
  ZoomOutMap as ZoomIcon,
  HelpOutline as HelpIcon,
  Close as CloseIcon,
  TableChart as TableChartIcon,
} from "@mui/icons-material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import axios from "axios";
import { backendUrl } from "../../config";

/**
 * Onglet "Explore (EDA)".
 *
 * Tous les calculs sont faits côté serveur via POST /api/eda-analysis
 * (PostgreSQL + pandas). Le frontend ne fait qu'afficher.
 *
 * Anti data-leakage : dès qu'un split valide existe (hasValidSplit), l'analyse
 * bascule automatiquement sur le sous-ensemble d'entraînement (useTrainOnly),
 * afin d'éviter d'explorer les corrélations/statistiques sur le test set.
 */

const fmt = (v, digits = 3) => {
  if (v === null || v === undefined) return "N/A";
  if (typeof v !== "number") return String(v);
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toFixed(digits);
};

const corrColor = (v) => {
  if (v === null || v === undefined) return "#f5f5f5";
  const a = Math.min(Math.abs(v), 1);
  // Bleu (positif) vs orange (négatif) cohérent avec l'identité visuelle.
  if (v >= 0) return `rgba(0, 80, 111, ${0.15 + a * 0.75})`;
  return `rgba(222, 107, 6, ${0.15 + a * 0.75})`;
};

function DistributionChart({ column, height = 180, detailed = false }) {
  const dist = column.distribution;
  if (!dist) return null;

  if (dist.kind === "histogram") {
    const data = dist.bins.map((b) => ({
      label: `${fmt(b.start, 1)}`,
      range: `${fmt(b.start, 2)} – ${fmt(b.end, 2)}`,
      count: b.count,
    }));
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: detailed ? 40 : 5 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: detailed ? 12 : 10 }}
            interval={detailed ? 0 : "preserveStartEnd"}
            angle={detailed ? -35 : 0}
            textAnchor={detailed ? "end" : "middle"}
            height={detailed ? 50 : 30}
          />
          <YAxis tick={{ fontSize: detailed ? 12 : 10 }} allowDecimals={false} />
          <RTooltip formatter={(v) => [v, "count"]} labelFormatter={(l, p) => (p && p[0] ? p[0].payload.range : l)} />
          <Bar dataKey="count" fill="rgb(0, 80, 111)" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (dist.kind === "categories") {
    const data = dist.top_values.map((v) => ({
      label: v.value.length > (detailed ? 40 : 16) ? v.value.slice(0, detailed ? 40 : 16) + "…" : v.value,
      count: v.count,
    }));
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: detailed ? 12 : 10 }} allowDecimals={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: detailed ? 12 : 10 }} width={detailed ? 160 : 90} />
          <RTooltip />
          <Bar dataKey="count" fill="#DE6B06" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

// Petite bulle d'aide réutilisable pour expliquer brièvement chaque section.
function InfoHint({ text }) {
  return (
    <Tooltip
      title={text}
      arrow
      slotProps={{
        tooltip: {
          sx: {
            fontSize: "0.95rem",
            lineHeight: 1.45,
            maxWidth: 380,
            p: 1.25,
          },
        },
      }}
    >
      <HelpIcon sx={{ fontSize: 20, ml: 0.75, color: "text.secondary", verticalAlign: "middle" }} />
    </Tooltip>
  );
}

function EdaTab({ bdName, hasValidSplit, targetColumn }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [zoomColumn, setZoomColumn] = useState(null);
  const [showAllDistributions, setShowAllDistributions] = useState(false);

  const loadEda = useCallback(async () => {
    if (!bdName) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(
        `${backendUrl}/api/eda-analysis`,
        { bdName, useTrainOnly: !!hasValidSplit },
        { withCredentials: true }
      );
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to run EDA analysis");
    } finally {
      setLoading(false);
    }
  }, [bdName, hasValidSplit]);

  useEffect(() => {
    loadEda();
  }, [loadEda]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">Computing statistics on the server…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={loadEda}>Retry</Button>}>
        {error}
      </Alert>
    );
  }

  if (!data) return null;

  const corr = data.correlations;

  return (
    <Box>
      {/* Bandeau portée + actions */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <InsightsIcon sx={{ color: "#DE6B06" }} />
          <Typography variant="h6" sx={{ color: "rgb(0, 80, 111)", fontWeight: 700 }}>
            Exploratory Data Analysis
          </Typography>
          <Tooltip title={data.scope === "train" ? "Analysis restricted to the training subset to prevent data leakage" : "Analysis on the full dataset"}>
            <Chip
              size="small"
              color={data.scope === "train" ? "success" : "default"}
              label={data.scope === "train" ? "Scope: Train only" : "Scope: Full dataset"}
            />
          </Tooltip>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto", flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadEda}
            sx={{
              height: 40,
              textTransform: "none",
              borderColor: "rgb(0, 80, 111)",
              color: "rgb(0, 80, 111)",
              fontWeight: 600,
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* View Dataset: accordion (collapsed by default), same pattern as Descriptive statistics */}
      <Accordion sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <TableChartIcon sx={{ mr: 1, color: "#384850" }} fontSize="small" />
          <Typography>View Dataset</Typography>
          <InfoHint text="Paginated preview of the raw table rows. Expand to browse columns and values without leaving EDA." />
        </AccordionSummary>
        <AccordionDetails>
          <EdaDatasetPreview bdName={bdName} />
        </AccordionDetails>
      </Accordion>

      {/* Vue d'ensemble */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: "Rows", value: data.row_count },
          { label: "Columns", value: data.column_count },
          { label: "Numeric columns", value: data.numeric_columns?.length || 0 },
          { label: "Missing cells", value: `${data.missing_summary?.missing_pct ?? 0}%` },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card variant="outlined" sx={{ borderRadius: 3, borderLeft: "4px solid #DE6B06" }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                <Typography variant="h6">{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Valeurs manquantes */}
      {data.missing_summary?.columns_with_missing?.length > 0 && (
        <Accordion defaultExpanded sx={{ mb: 1, borderRadius: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <WarningIcon sx={{ color: "#ffc107", mr: 1 }} />
            <Typography>Missing values ({data.missing_summary.columns_with_missing.length} columns)</Typography>
            <InfoHint text="Share of empty cells per column. High percentages may require imputation (after the train/test split) or dropping the column." />
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {data.missing_summary.columns_with_missing.map((c) => (
                <Box key={c.name} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: 160 }}>{c.name}</Typography>
                  <Box sx={{ flex: 1, backgroundColor: "#eee", borderRadius: 1, height: 10, overflow: "hidden" }}>
                    <Box sx={{ width: `${c.missing_pct}%`, backgroundColor: "#ffc107", height: "100%" }} />
                  </Box>
                  <Typography variant="caption" sx={{ minWidth: 90, textAlign: "right" }}>
                    {c.missing} ({c.missing_pct}%)
                  </Typography>
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Statistiques descriptives */}
      <Accordion defaultExpanded sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Descriptive statistics</Typography>
          <InfoHint text="Per-column summary: count, missing, unique values, and (for numeric columns) mean, standard deviation, min, median and max. 'Top' shows the most frequent value for categorical columns." />
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Column</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Count</TableCell>
                  <TableCell align="right">Missing</TableCell>
                  <TableCell align="right">Unique</TableCell>
                  <TableCell align="right">Mean</TableCell>
                  <TableCell align="right">Std</TableCell>
                  <TableCell align="right">Min</TableCell>
                  <TableCell align="right">Median</TableCell>
                  <TableCell align="right">Max</TableCell>
                  <TableCell>Top</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.columns.map((c) => (
                  <TableRow
                    key={c.name}
                    sx={targetColumn && c.name === targetColumn ? { backgroundColor: "rgba(222,107,6,0.08)" } : undefined}
                  >
                    <TableCell>
                      {c.name}
                      {targetColumn && c.name === targetColumn && (
                        <Chip label="target" size="small" color="warning" sx={{ ml: 0.5 }} />
                      )}
                    </TableCell>
                    <TableCell><Chip size="small" label={c.type} variant="outlined" /></TableCell>
                    <TableCell align="right">{fmt(c.count)}</TableCell>
                    <TableCell align="right">{c.missing} ({c.missing_pct}%)</TableCell>
                    <TableCell align="right">{fmt(c.unique)}</TableCell>
                    <TableCell align="right">{fmt(c.numeric?.mean)}</TableCell>
                    <TableCell align="right">{fmt(c.numeric?.std)}</TableCell>
                    <TableCell align="right">{fmt(c.numeric?.min)}</TableCell>
                    <TableCell align="right">{fmt(c.numeric?.median)}</TableCell>
                    <TableCell align="right">{fmt(c.numeric?.max)}</TableCell>
                    <TableCell>{c.categorical?.top ?? "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* Distributions */}
      <Accordion sx={{ mb: 1 }} defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Distributions</Typography>
          <InfoHint text="How values spread out. Numeric columns show a histogram (counts per value range); categorical columns show the most frequent categories. Click the expand icon to enlarge any chart." />
        </AccordionSummary>
        <AccordionDetails>
          {(() => {
            const withDist = data.columns.filter((c) => c.distribution);
            const visible = showAllDistributions ? withDist : withDist.slice(0, 10);
            const hidden = Math.max(0, withDist.length - 10);
            return (
              <>
                <Grid container spacing={2}>
                  {visible.map((c) => (
                    <Grid item xs={12} md={6} lg={4} key={c.name}>
                      <Card variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ py: 1.5 }}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle2" noWrap title={c.name}>{c.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {c.distribution.kind === "histogram" ? "Numeric · value ranges" : "Categorical · top values"}
                              </Typography>
                            </Box>
                            <Tooltip title="Enlarge">
                              <IconButton size="small" onClick={() => setZoomColumn(c)}>
                                <ZoomIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <DistributionChart column={c} />
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                            {c.distribution.kind === "histogram"
                              ? "X: value ranges · Y: number of rows"
                              : "X: number of rows · Y: category"}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                {hidden > 0 && (
                  <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => setShowAllDistributions((v) => !v)}
                      sx={{
                        textTransform: "none",
                        borderColor: "#384850",
                        color: "#384850",
                        fontWeight: 600,
                      }}
                    >
                      {showAllDistributions ? "Show less" : `Show more (${hidden} more columns)`}
                    </Button>
                  </Box>
                )}
              </>
            );
          })()}
        </AccordionDetails>
      </Accordion>

      {/* Corrélations */}
      {corr && corr.columns?.length >= 2 && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Correlations (Pearson)</Typography>
            <InfoHint text="Linear relationship between numeric columns, from -1 to +1. Blue = positive (rise together), orange = negative (one rises as the other falls), near 0 = little linear relation. Strong correlations can indicate redundant features." />
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Scroll horizontally if there are many columns.
            </Typography>
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{
                maxWidth: "100%",
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: 420,
                WebkitOverflowScrolling: "touch",
              }}
            >
              <Table
                size="small"
                stickyHeader
                sx={{
                  minWidth: Math.max(480, (corr.columns?.length || 0) * 76),
                  width: "max-content",
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        position: "sticky",
                        left: 0,
                        zIndex: 3,
                        backgroundColor: "background.paper",
                        minWidth: 120,
                      }}
                    />
                    {corr.columns.map((c) => (
                      <TableCell
                        key={c}
                        align="center"
                        sx={{ fontSize: "0.7rem", whiteSpace: "nowrap", minWidth: 72 }}
                      >
                        {c}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {corr.matrix.map((row, i) => (
                    <TableRow key={corr.columns[i]}>
                      <TableCell
                        sx={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          backgroundColor: "background.paper",
                          minWidth: 120,
                        }}
                      >
                        {corr.columns[i]}
                      </TableCell>
                      {row.map((val, j) => (
                        <TableCell
                          key={j}
                          align="center"
                          sx={{
                            backgroundColor: corrColor(val),
                            color: Math.abs(val ?? 0) > 0.5 ? "#fff" : "inherit",
                            fontSize: "0.7rem",
                            minWidth: 72,
                          }}
                        >
                          {val === null || val === undefined ? "N/A" : val.toFixed(2)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Dialogue d'agrandissement d'une distribution */}
      <Dialog open={!!zoomColumn} onClose={() => setZoomColumn(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ backgroundColor: "rgb(0, 80, 111)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Distribution · {zoomColumn?.name}</span>
          <IconButton onClick={() => setZoomColumn(null)} sx={{ color: "#fff" }} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {zoomColumn && (
            <>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                <Chip size="small" label={zoomColumn.type} />
                <Chip size="small" variant="outlined" label={`${zoomColumn.count} values`} />
                <Chip size="small" variant="outlined" label={`${zoomColumn.unique} unique`} />
                {zoomColumn.missing > 0 && (
                  <Chip size="small" color="warning" variant="outlined" label={`${zoomColumn.missing} missing (${zoomColumn.missing_pct}%)`} />
                )}
              </Box>
              <DistributionChart column={zoomColumn} height={380} detailed />
              {zoomColumn.numeric && (
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 2 }}>
                  {[
                    ["Mean", zoomColumn.numeric.mean],
                    ["Std", zoomColumn.numeric.std],
                    ["Min", zoomColumn.numeric.min],
                    ["Q1", zoomColumn.numeric.q1],
                    ["Median", zoomColumn.numeric.median],
                    ["Q3", zoomColumn.numeric.q3],
                    ["Max", zoomColumn.numeric.max],
                  ].map(([label, v]) => (
                    <Box key={label} sx={{ minWidth: 80 }}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" fontWeight={600}>{fmt(v)}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                {zoomColumn.distribution?.kind === "histogram"
                  ? "Each bar counts how many rows fall within a value range. Hover a bar to see its exact range and count."
                  : "Each bar shows how many rows have that category (top values only)."}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setZoomColumn(null)}>Close</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

function EdaDatasetPreview({ bdName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 0,
    pageSize: 50,
    totalRows: 0,
  });

  useEffect(() => {
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bdName]);

  const loadPage = async (page) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${backendUrl}/api/get-data_with-id?bdName=${encodeURIComponent(bdName)}&page=${page}&page_size=${pagination.pageSize}`,
        { withCredentials: true }
      );
      setData(response.data);
      setPagination((prev) => ({
        ...prev,
        page: response.data.page,
        totalRows: response.data.total_rows,
      }));
    } catch (err) {
      console.error("Error loading dataset preview:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: "60vh" }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              {data?.columns?.map((col) => (
                <TableCell key={col}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.rows?.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                {data.columns.map((col, idx) => (
                  <TableCell key={col}>
                    {row[`col${idx}`] === null || row[`col${idx}`] === undefined ? (
                      <Chip label="NULL" size="small" variant="outlined" />
                    ) : (
                      String(row[`col${idx}`])
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Page {pagination.page + 1} of {Math.max(1, Math.ceil(pagination.totalRows / pagination.pageSize))} •
          Total: {pagination.totalRows.toLocaleString()} rows
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" onClick={() => loadPage(pagination.page - 1)} disabled={pagination.page === 0}>
            Previous
          </Button>
          <Button
            size="small"
            onClick={() => loadPage(pagination.page + 1)}
            disabled={(pagination.page + 1) * pagination.pageSize >= pagination.totalRows}
          >
            Next
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default EdaTab;
