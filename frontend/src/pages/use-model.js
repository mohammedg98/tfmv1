import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { backendUrl } from "../config";
import "./use-model.css";

/**
 * Use Model: prediction UI.
 * ML transforms run ONLY on the backend via applied_actions pipeline.
 * Frontend sends raw values and displays results.
 */

function isAttackishLabel(label) {
  if (label == null) return false;
  const s = String(label).trim().toLowerCase();
  if (["normal", "benign", "legitimate", "0", "false", "no"].includes(s)) return false;
  return (
    ["attack", "intrusion", "anomaly", "malicious", "dos", "probe", "r2l", "u2r", "1", "true", "yes"].some(
      (k) => s.includes(k)
    ) || !["normal", "benign"].includes(s)
  );
}

const BATCH_MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const BATCH_CSV_TYPES = [
  "text/csv",
  "text/plain",
  "text/comma-separated-values",
  "application/csv",
  "application/vnd.ms-excel",
  "application/octet-stream",
];

function sniffNotSpreadsheet(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arr = new Uint8Array(e.target.result || []);
      const isZip =
        arr.length >= 4 && arr[0] === 0x50 && arr[1] === 0x4b && arr[2] === 0x03 && arr[3] === 0x04;
      resolve(!isZip);
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 4));
  });
}

async function validateBatchCsvFile(file) {
  if (!file) return "Please choose a CSV file.";
  if (file.size > BATCH_MAX_UPLOAD_BYTES) {
    return "File is too large. Maximum allowed size is 100 MB.";
  }
  const nameOk = /\.csv$/i.test(String(file.name || ""));
  if (!nameOk) {
    return "Invalid file. Only CSV (.csv) files are allowed.";
  }
  const mime = String(file.type || "").toLowerCase();
  if (mime && !BATCH_CSV_TYPES.includes(mime)) {
    return "Invalid file. Only CSV (.csv) files are allowed.";
  }
  const looksCsv = await sniffNotSpreadsheet(file);
  if (!looksCsv) {
    return "Invalid file. Excel/ZIP files are not allowed. Please upload a CSV.";
  }
  return null;
}

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function fmtNum(v, digits = 3) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toFixed(digits);
}

function BatchStat({ label, value }) {
  return (
    <div className="um-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function BatchScores({ metrics, isAnomalyModel }) {
  if (!metrics || !metrics.kind) return null;
  const kind = isAnomalyModel ? "anomaly" : metrics.kind;
  const title =
    kind === "regression"
      ? "Batch scores (regression)"
      : kind === "anomaly"
      ? "Batch scores (anomaly)"
      : kind === "clustering"
      ? "Batch scores (clustering)"
      : "Batch scores (classification)";

  const items = [];
  if (kind === "classification") {
    if (metrics.has_ground_truth) {
      items.push(["Accuracy", fmtPct(metrics.accuracy)]);
      items.push(["Precision", fmtPct(metrics.precision)]);
      items.push(["Recall", fmtPct(metrics.recall)]);
      items.push(["F1", fmtPct(metrics.f1)]);
      if (metrics.n_correct != null) {
        items.push(["Correct", `${Number(metrics.n_correct).toLocaleString()} / ${Number(metrics.n_evaluated).toLocaleString()}`]);
      }
      if (metrics.mean_confidence != null) {
        items.push(["Mean confidence", fmtPct(metrics.mean_confidence)]);
      }
    } else {
      if (metrics.n_classes != null) items.push(["Classes in model", String(metrics.n_classes)]);
      if (metrics.mean_confidence != null) items.push(["Mean confidence", fmtPct(metrics.mean_confidence)]);
    }
  } else if (kind === "regression") {
    if (metrics.has_ground_truth) {
      items.push(["R²", fmtNum(metrics.r2, 3)]);
      items.push(["MAE", fmtNum(metrics.mae, 3)]);
      items.push(["RMSE", fmtNum(metrics.rmse, 3)]);
      if (metrics.mape != null) items.push(["MAPE", fmtPct(metrics.mape)]);
    }
    if (metrics.pred_mean != null) items.push(["Pred. mean", fmtNum(metrics.pred_mean, 3)]);
    if (metrics.pred_std != null) items.push(["Pred. std", fmtNum(metrics.pred_std, 3)]);
    if (metrics.pred_min != null) items.push(["Pred. min", fmtNum(metrics.pred_min, 3)]);
    if (metrics.pred_max != null) items.push(["Pred. max", fmtNum(metrics.pred_max, 3)]);
  } else if (kind === "anomaly") {
    items.push(["Anomalies", Number(metrics.n_anomaly || 0).toLocaleString()]);
    items.push(["Normal", Number(metrics.n_normal || 0).toLocaleString()]);
    items.push(["Anomaly rate", fmtPct(metrics.anomaly_rate)]);
    if (metrics.score_mean != null) items.push(["Score mean", fmtNum(metrics.score_mean, 4)]);
    if (metrics.score_min != null) items.push(["Score min", fmtNum(metrics.score_min, 4)]);
    if (metrics.score_max != null) items.push(["Score max", fmtNum(metrics.score_max, 4)]);
  } else if (kind === "clustering") {
    items.push(["Clusters", String(metrics.n_clusters ?? "—")]);
    items.push(["Largest cluster", fmtPct(metrics.largest_cluster_share)]);
    items.push(["Rows", Number(metrics.n_rows || 0).toLocaleString()]);
  }

  const dist = metrics.class_distribution || metrics.cluster_sizes || null;
  const confusion = metrics.confusion;

  return (
    <div className="um-batch-stats">
      <h3>{title}</h3>
      {kind !== "anomaly" && metrics.has_ground_truth && metrics.target_column && (
        <p className="um-hint">
          Compared with the true column “{metrics.target_column}” on{" "}
          {Number(metrics.n_evaluated).toLocaleString()} rows
          {metrics.positive_class ? ` · positive class: ${metrics.positive_class}` : ""}
          {metrics.average === "macro" ? " · precision / recall / F1 are macro-averaged" : ""}.
        </p>
      )}
      {metrics.hint && <p className="um-hint">{metrics.hint}</p>}
      {items.length > 0 && (
        <dl className="um-stat-grid">
          {items.map(([label, value]) => (
            <BatchStat key={label} label={label} value={value} />
          ))}
        </dl>
      )}
      {dist && Object.keys(dist).length > 0 && (
        <div className="um-stat-dist">
          <p className="um-stat-dist-title">
            {kind === "clustering" ? "Cluster sizes" : "Predicted classes"}
          </p>
          <ul>
            {Object.entries(dist).map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                <span>{Number(v).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {confusion?.labels?.length > 0 && confusion?.matrix && (
        <div className="um-stat-dist">
          <p className="um-stat-dist-title">Confusion matrix (true \ predicted)</p>
          <table className="um-stat-matrix">
            <thead>
              <tr>
                <th />
                {confusion.labels.map((lab) => (
                  <th key={lab}>{lab}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {confusion.matrix.map((row, i) => (
                <tr key={confusion.labels[i]}>
                  <th>{confusion.labels[i]}</th>
                  {row.map((cell, j) => (
                    <td key={`${i}-${j}`}>{Number(cell).toLocaleString()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UseModel() {
  const location = useLocation();
  const navigate = useNavigate();

  const [modelInfo, setModelInfo] = useState(null);
  const [inferenceInfo, setInferenceInfo] = useState(null);
  const [inputValues, setInputValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("input");
  const [sampleMeta, setSampleMeta] = useState(null);
  const [samplePickerOpen, setSamplePickerOpen] = useState(false);
  const [sampleCandidates, setSampleCandidates] = useState([]);
  const [decisionThreshold, setDecisionThreshold] = useState(0.5);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  // Batch
  const [batchFile, setBatchFile] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [batchPage, setBatchPage] = useState(1);

  const formatApiError = (detail) => {
    if (!detail) return "Request failed";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => d.msg || JSON.stringify(d)).join(" · ");
    }
    if (typeof detail === "object") return detail.message || JSON.stringify(detail);
    return String(detail);
  };

  const decodeLabelLocal = (encoded) => {
    const rev = inferenceInfo?.reverse_label_mapping || prediction?.reverse_label_mapping || {};
    if (encoded == null) return null;
    const keys = [String(encoded)];
    const n = Number(encoded);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
      keys.push(String(n), String(parseInt(n, 10)));
    }
    for (const k of keys) {
      if (rev[k] != null) return rev[k];
    }
    return null;
  };

  const rawColumns = inferenceInfo?.raw_input_columns || [];
  const targetColumn = inferenceInfo?.target_column || null;

  const isClassification = useMemo(() => {
    const t = (modelInfo?.modelType || inferenceInfo?.model_type || "").toLowerCase();
    const algo = String(modelInfo?.algorithm || inferenceInfo?.algorithm || "").toLowerCase();
    if (
      t.includes("anomaly") ||
      algo.includes("isolation") ||
      algo.includes("one_class") ||
      inferenceInfo?.is_anomaly_model
    ) {
      return false;
    }
    if (t.includes("kmeans") || t.includes("cluster") || t.includes("regress") || t.includes("ridge")) {
      return false;
    }
    const n = Number(inferenceInfo?.n_classes);
    if (Number.isFinite(n) && n >= 2) return true;
    return (
      t.includes("classif") ||
      t.includes("logistic") ||
      (!!inferenceInfo?.accuracy_score && !inferenceInfo?.r2_score)
    );
  }, [modelInfo, inferenceInfo]);

  const nClasses = useMemo(() => {
    if (inferenceInfo?.n_classes != null && Number.isFinite(Number(inferenceInfo.n_classes))) {
      return Number(inferenceInfo.n_classes);
    }
    if (prediction?.n_classes != null) return Number(prediction.n_classes);
    if (prediction?.probabilities && typeof prediction.probabilities === "object") {
      return Object.keys(prediction.probabilities).length;
    }
    return null;
  }, [inferenceInfo, prediction]);

  const isBinaryClass =
    inferenceInfo?.is_binary_classification === true || Number(inferenceInfo?.n_classes) === 2;

  const isBinaryProba = useMemo(() => {
    const probs = prediction?.probabilities;
    return probs && typeof probs === "object" && Object.keys(probs).length === 2;
  }, [prediction]);

  useEffect(() => {
    if (!location.state) {
      navigate("/dashboard");
      return;
    }
    const { dbColumns, dbName, id, modelId, modelType, r2Score, accuracyScore, modelName } =
      location.state;
    if (!dbColumns || !Array.isArray(dbColumns)) {
      navigate("/dashboard");
      return;
    }
    const currentModelId = id || modelId;
    setModelInfo({
      ...location.state,
      id: currentModelId,
      modelType,
      r2Score,
      accuracyScore,
      modelName,
      dbName,
    });

    const load = async () => {
      try {
        const res = await fetch(
          `${backendUrl}/api/model-inference-info?modelId=${currentModelId}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Could not load model inference schema");
        const info = await res.json();
        setInferenceInfo(info);
        const cols = info.raw_input_columns || [];
        const initial = {};
        cols.forEach((c) => {
          initial[c] = "";
        });
        setInputValues(initial);
      } catch (err) {
        console.error(err);
        // Fallback: use dbColumns from navigation state (never include target / id / split)
        const tgt = inferenceInfo?.target_column; // may be unset in catch
        const cols = (dbColumns || []).filter(
          (c) => c !== "split_type" && c !== "id" && c !== tgt
        );
        const looksAnomaly =
          String(modelType || "").toLowerCase().includes("anomaly") ||
          String(location.state?.algorithm || "").toLowerCase().includes("isolation") ||
          String(location.state?.algorithm || "").toLowerCase().includes("one_class");
        setInferenceInfo({
          raw_input_columns: cols,
          feature_columns: cols,
          applied_actions: [],
          pipeline_summary: [],
          target_column: looksAnomaly ? null : tgt,
          dataset_target_column: tgt || null,
          is_anomaly_model: looksAnomaly,
          db_name: dbName,
          model_type: modelType,
          algorithm: location.state?.algorithm,
        });
        const initial = {};
        cols.forEach((c) => {
          initial[c] = "";
        });
        setInputValues(initial);
        setError(
          "Loaded basic column list. Pipeline metadata missing for this model: re-save the model after training to freeze applied_actions."
        );
      }
    };
    load();
    setTimeout(() => setHelpDialogOpen(true), 600);
  }, [location.state, navigate]);

  const handleInputChange = (column, value) => {
    setInputValues((prev) => ({ ...prev, [column]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
  };

  const validateInputs = () => {
    const errors = {};
   
    rawColumns.forEach((col) => {
      const v = inputValues[col];
      if (v === "" || v === null || v === undefined) {
        errors[col] = "Required";
      }
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLoadSample = async () => {
    if (!modelInfo?.id) return;
    setLoadingSample(true);
    setError(null);
    try {
      const bd = String(inferenceInfo?.db_name || modelInfo.dbName || "");
      const res = await fetch(
        `${backendUrl}/api/sample-row?bdName=${encodeURIComponent(bd || "dataset")}&split=test&random=true&modelId=${modelInfo.id}&limit=10`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(formatApiError(err.detail) || "Could not load sample rows");
      }
      const data = await res.json();
      const rows = data.rows || (data.row ? [{ id: null, values: data.row }] : []);
      if (!rows.length) throw new Error("No test examples available");
      setSampleCandidates(rows);
      setSampleMeta(data);
      setSamplePickerOpen(true);
      setActiveTab("input");
    } catch (e) {
      setError(e.message || "Sample load failed");
    } finally {
      setLoadingSample(false);
    }
  };

  const applySampleRow = (values) => {
    const next = { ...inputValues };
    rawColumns.forEach((c) => {
      next[c] = values?.[c] !== undefined && values?.[c] !== null ? String(values[c]) : "";
    });
    setInputValues(next);
    setSamplePickerOpen(false);
    setSampleMeta((prev) => ({
      ...(prev || {}),
      message: "Example selected from the test set",
    }));
  };

  const handlePredict = async () => {
    if (!modelInfo?.id || !rawColumns.length) return;
    if (!validateInputs()) {
      setError("Please fix the highlighted input fields.");
      setActiveTab("input");
      return;
    }

    setLoading(true);
    setError(null);
    setPrediction(null);
    setActiveTab("results");

    try {
      const rawData = {};
      rawColumns.forEach((col) => {
        rawData[col] = inputValues[col];
      });

      const response = await fetch(`${backendUrl}/api/predict`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: modelInfo.id,
          inputData: rawData,
          targetColumn: targetColumn,
          datasetTargetColumn: inferenceInfo?.dataset_target_column || null,
          expectedFeatures: inferenceInfo?.feature_columns || modelInfo.dbColumns,
          applyPipeline: true,
          decisionThreshold,
        }),
      });

      if (!response.ok) {
        let detail = "Prediction failed";
        try {
          const err = await response.json();
          detail = err.detail || detail;
        } catch (_) {
          detail = `HTTP ${response.status}`;
        }
        throw new Error(detail);
      }

      const result = await response.json();
      setPrediction(result);
    } catch (err) {
      setError(err.message || "Error during prediction");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    const reset = {};
    rawColumns.forEach((c) => {
      reset[c] = "";
    });
    setInputValues(reset);
    setPrediction(null);
    setError(null);
    setSampleMeta(null);
    setFieldErrors({});
    setActiveTab("input");
  };

  const handleBatchFileChange = async (e) => {
    const selected = e.target.files?.[0] || null;
    if (!selected) {
      setBatchFile(null);
      return;
    }
    const problem = await validateBatchCsvFile(selected);
    if (problem) {
      setError(problem);
      setBatchFile(null);
      e.target.value = "";
      return;
    }
    setError(null);
    setBatchFile(selected);
  };

  const handleBatchPredict = async () => {
    if (!batchFile || !modelInfo?.id) return;
    const problem = await validateBatchCsvFile(batchFile);
    if (problem) {
      setError(problem);
      setBatchFile(null);
      return;
    }
    setBatchLoading(true);
    setError(null);
    setBatchPage(1);
    try {
      const fd = new FormData();
      fd.append("file", batchFile);
      // First page only: further pages load via /predict-batch-preview (no re-upload)
      const res = await fetch(
        `${backendUrl}/api/predict-batch?modelId=${modelInfo.id}&decisionThreshold=${decisionThreshold}&page=1&pageSize=25`,
        { method: "POST", credentials: "include", body: fd }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(formatApiError(err.detail) || "Batch prediction failed");
      }
      const data = await res.json();
      setBatchResult(data);
      setBatchPage(1);
      setActiveTab("batch");
    } catch (e) {
      setError(e.message || "Batch prediction failed");
    } finally {
      setBatchLoading(false);
    }
  };

  const loadBatchPage = async (page) => {
    const token = batchResult?.download_token;
    if (!token) return;
    const next = Math.max(1, Math.min(page, batchResult.total_pages || page));
    setBatchLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${backendUrl}/api/predict-batch-preview?batchId=${encodeURIComponent(token)}&page=${next}&pageSize=25`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(formatApiError(err.detail) || "Could not load page");
      }
      const data = await res.json();
      setBatchPage(data.page);
      setBatchResult((prev) =>
        prev
          ? {
              ...prev,
              preview: data.preview,
              page: data.page,
              page_size: data.page_size,
              total_pages: data.total_pages,
            }
          : prev
      );
    } catch (e) {
      setError(e.message || "Could not load page");
    } finally {
      setBatchLoading(false);
    }
  };

  const downloadBatch = async () => {
    if (!batchResult?.download_token) return;
    try {
      const res = await fetch(
        `${backendUrl}/api/predict-batch-download?batchId=${batchResult.download_token}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `predictions_${batchResult.download_token}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || "Download failed");
    }
  };

  const isUnsupervised = useMemo(() => {
    const t = String(modelInfo?.modelType || inferenceInfo?.model_type || "").toLowerCase();
    return t.includes("kmeans") || t.includes("cluster") || prediction?.cluster != null;
  }, [modelInfo, inferenceInfo, prediction]);

  const isAnomaly = useMemo(() => {
    const t = String(modelInfo?.modelType || inferenceInfo?.model_type || "").toLowerCase();
    const algo = String(modelInfo?.algorithm || inferenceInfo?.algorithm || "").toLowerCase();
    return (
      t.includes("anomaly") ||
      algo.includes("isolation") ||
      algo.includes("one_class") ||
      prediction?.is_anomaly != null ||
      prediction?.anomaly_label != null
    );
  }, [modelInfo, inferenceInfo, prediction]);

  const encodedClass =
    prediction?.encoded_class ?? prediction?.encoded_value ?? prediction?.prediction ?? null;

  const mainLabel = (() => {
    if (prediction?.predicted_label && !String(prediction.predicted_label).replace(".", "", 1).match(/^\d+$/)) {
      return prediction.predicted_label;
    }
    if (prediction?.predicted_class && !String(prediction.predicted_class).replace(".", "", 1).match(/^\d+$/)) {
      return prediction.predicted_class;
    }
    const decoded = decodeLabelLocal(encodedClass);
    if (decoded) return decoded;
    return prediction?.predicted_label || prediction?.predicted_class || (encodedClass != null ? String(encodedClass) : null);
  })();

  const confidence =
    prediction?.confidence != null ? Number(prediction.confidence) : null;

  const resultTone = (() => {
    if (isAnomaly) {
      return prediction?.is_anomaly || prediction?.anomaly_label === "anomaly"
        ? "attack"
        : "normal";
    }
    if (isUnsupervised) return "neutral";
    if (!mainLabel) return "neutral";
    if (!isClassification) return "neutral";
    if (confidence != null && confidence < 0.6) return "uncertain";
    return isAttackishLabel(mainLabel) ? "attack" : "normal";
  })();

  if (!modelInfo) {
    return <div className="loading-container">Loading model information...</div>;
  }

  const scoreText =
    modelInfo.r2Score != null
      ? `R² ${(Number(modelInfo.r2Score) * 1).toFixed(3)}`
      : modelInfo.accuracyScore != null
      ? `Accuracy ${(Number(modelInfo.accuracyScore) * 100).toFixed(1)}%`
      : inferenceInfo?.r2_score != null
      ? `R² ${Number(inferenceInfo.r2_score).toFixed(3)}`
      : inferenceInfo?.accuracy_score != null
      ? `Accuracy ${(Number(inferenceInfo.accuracy_score) * 100).toFixed(1)}%`
      : "N/A";

  return (
    <div className="use-model-container um-v2">
      {helpDialogOpen && (
        <div className="help-dialog-overlay" onClick={() => setHelpDialogOpen(false)}>
          <div className="help-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="help-dialog-header">
              <h2>How to use predictions</h2>
              <button className="help-dialog-close" onClick={() => setHelpDialogOpen(false)}>
                ×
              </button>
            </div>
            <div className="help-dialog-content">
              <p>
                Fill in the fields with values like those in your dataset, then run a prediction.
                You can also load a ready-made example to try the model quickly.
              </p>
              <ol>
                <li>Load an example or enter your own values</li>
                <li>Click Predict</li>
                <li>Read the result. For a whole file, use the batch tab.</li>
              </ol>
              <button className="help-got-it-btn" onClick={() => setHelpDialogOpen(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {samplePickerOpen && (
        <div className="help-dialog-overlay" onClick={() => setSamplePickerOpen(false)}>
          <div className="help-dialog um-sample-picker" onClick={(e) => e.stopPropagation()}>
            <div className="help-dialog-header">
              <h2>Choose a test example</h2>
              <button className="help-dialog-close" onClick={() => setSamplePickerOpen(false)}>
                ×
              </button>
            </div>
            <div className="help-dialog-content">
              <p className="um-hint">
                {sampleMeta?.message || "Click a row to fill the form with that test example."}
              </p>
              <div className="um-sample-table-wrap">
                <table className="um-sample-table">
                  <thead>
                    <tr>
                      <th className="um-sample-sticky">#</th>
                      {rawColumns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                      <th className="um-sample-sticky-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleCandidates.map((item, idx) => {
                      const vals = item.values || {};
                      return (
                        <tr
                          key={item.id ?? idx}
                          onClick={() => applySampleRow(vals)}
                          title="Click to use this row"
                        >
                          <td className="um-sample-sticky">{idx + 1}</td>
                          {rawColumns.map((c) => (
                            <td key={c}>{vals[c] === undefined || vals[c] === null ? "N/A" : String(vals[c])}</td>
                          ))}
                          <td className="um-sample-sticky-right">
                            <button
                              type="button"
                              className="um-sample-use-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                applySampleRow(vals);
                              }}
                            >
                              Use
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="um-header">
        <div>
          <p className="um-kicker">Predictions</p>
          <h1>{modelInfo.modelName || "Use Model"}</h1>
          <div className="um-meta-row">
            <span>
              {isAnomaly
                ? "Anomaly detection"
                : isUnsupervised
                ? "Clustering"
                : isClassification
                ? "Classification"
                : modelInfo.modelType || "Model"}
            </span>
            <span>·</span>
            <span>{modelInfo.dbName}</span>
            <span>·</span>
            <span>{scoreText}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="help-button" onClick={() => setHelpDialogOpen(true)}>
            Help
          </button>
          <button className="back-button" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </header>

      <div className="content-tabs">
        <button
          className={activeTab === "input" ? "tab-active" : "tab"}
          onClick={() => setActiveTab("input")}
        >
          Input
        </button>
        <button
          className={activeTab === "results" ? "tab-active" : "tab"}
          onClick={() => setActiveTab("results")}
        >
          Results
        </button>
        <button
          className={activeTab === "batch" ? "tab-active" : "tab"}
          onClick={() => setActiveTab("batch")}
        >
          Batch
        </button>
      </div>

      {error && (
        <div className="um-alert um-alert-error" role="alert">
          {error}
        </div>
      )}

      {activeTab === "input" && (
        <section className="content-section um-card">
          <div className="um-actions-bar">
            <button
              type="button"
              className="um-btn-secondary"
              onClick={handleLoadSample}
              disabled={loadingSample}
            >
              {loadingSample ? "Loading…" : "Load test example"}
            </button>
            <label className="um-btn-secondary um-file-label">
              Upload CSV (batch tab)
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={(e) => {
                  setBatchFile(e.target.files?.[0] || null);
                  setActiveTab("batch");
                }}
              />
            </label>
          </div>
          {sampleMeta && (
            <p className="um-sample-note">
              {sampleMeta.message || "Example loaded from the test set"}
            </p>
          )}

          {isAnomaly && inferenceInfo?.ignored_target_column && (
            <p className="um-hint">
              “{inferenceInfo.ignored_target_column}” was ignored at training (evaluation label
              only). It is not a required field.
            </p>
          )}
          {isAnomaly && !inferenceInfo?.ignored_target_column && (
            <p className="um-hint">
              No target was used at training. Enter every field below (all columns are features).
            </p>
          )}

          <div className="input-fields-grid">
            {rawColumns.map((column) => (
              <div key={column} className={`input-group ${fieldErrors[column] ? "has-error" : ""}`}>
                <label htmlFor={column}>{column}</label>
                <input
                  id={column}
                  type="text"
                  value={inputValues[column] ?? ""}
                  onChange={(e) => handleInputChange(column, e.target.value)}
                  placeholder={`Raw value for ${column}`}
                />
                {fieldErrors[column] && (
                  <div className="field-error">{fieldErrors[column]}</div>
                )}
              </div>
            ))}
          </div>

          {isClassification && isBinaryClass && (
            <div className="um-threshold">
              <label>
                Detection threshold: <strong>{decisionThreshold.toFixed(2)}</strong>
              </label>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.01"
                value={decisionThreshold}
                onChange={(e) => setDecisionThreshold(Number(e.target.value))}
              />
              <p className="um-hint">
                Binary classification: predict the positive class when its probability ≥ this
                cutoff (default 0.50). Lower → more positives (higher recall); higher → fewer
                positives (higher precision). Not used for multiclass / regression / clustering.
              </p>
            </div>
          )}

          <div className="button-group">
            <button
              className="predict-button"
              onClick={handlePredict}
              disabled={loading || !rawColumns.length}
            >
              {loading ? "Predicting…" : "Predict"}
            </button>
            <button className="reset-button" onClick={handleReset}>
              Reset
            </button>
          </div>
        </section>
      )}

      {activeTab === "results" && (
        <section className="content-section um-card">
          {!prediction && !loading && (
            <p className="um-empty">Run a prediction to see results here.</p>
          )}
          {loading && <div className="loading-container">Running prediction…</div>}
          {prediction && (
            <>
              {isAnomaly || prediction.is_anomaly != null || prediction.anomaly_label ? (
                <div className={`um-result-hero tone-${resultTone}`}>
                  <p className="um-result-kicker">Anomaly screening</p>
                  <h2 className="um-result-label">
                    {prediction.is_anomaly || prediction.anomaly_label === "anomaly"
                      ? "ANOMALY"
                      : "NORMAL"}
                  </h2>
                  <p className="um-hint" style={{ marginTop: 8 }}>
                    {prediction.score_interpretation ||
                      "Lower anomaly score ⇒ more suspicious (cyber intrusion screening)."}
                  </p>
                  {prediction.anomaly_score != null && (
                    <div className="um-cluster-info" style={{ marginTop: 12 }}>
                      <span>
                        Anomaly score:{" "}
                        <strong>{Number(prediction.anomaly_score).toFixed(4)}</strong>
                      </span>
                    </div>
                  )}
                </div>
              ) : isUnsupervised || prediction.cluster != null ? (
                <div className="um-result-hero tone-neutral um-cluster-hero">
                  <p className="um-result-kicker">Cluster assignment</p>
                  <h2 className="um-result-label">Cluster {prediction.cluster}</h2>
                  <p className="um-hint" style={{ marginTop: 8 }}>
                    This row was assigned to the closest group found by the clustering model.
                  </p>
                  {prediction.cluster_info && Object.keys(prediction.cluster_info || {}).length > 0 && (
                    <div className="um-cluster-info">
                      {prediction.cluster_info.size != null && (
                        <span>Group size: {prediction.cluster_info.size}</span>
                      )}
                      {prediction.cluster_info.percentage != null && (
                        <span> · Share: {Number(prediction.cluster_info.percentage).toFixed(1)}%</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className={`um-result-hero tone-${resultTone}`}>
                  <p className="um-result-kicker">
                    {isClassification ? "Predicted class" : "Predicted value"}
                  </p>
                  <h2 className="um-result-label">
                    {isClassification
                      ? String(mainLabel || "N/A").toUpperCase()
                      : Number(prediction.prediction).toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}
                  </h2>
                  {isClassification && encodedClass != null && (
                    <div className="um-label-pair">
                      <div>
                        <span className="um-pair-k">Original label</span>
                        <strong>{String(mainLabel)}</strong>
                      </div>
                      <div>
                        <span className="um-pair-k">After numerization</span>
                        <strong>{String(encodedClass)}</strong>
                      </div>
                    </div>
                  )}
                  {confidence != null && (
                    <p className="um-result-conf">
                      Confidence: {(confidence * 100).toFixed(1)}%
                    </p>
                  )}
                  {confidence != null && confidence < 0.6 && (
                    <p className="um-result-warn">
                      Low confidence: manual verification recommended
                    </p>
                  )}
                </div>
              )}

              {prediction.probabilities && (
                <div className="um-proba-block">
                  <h3>Class probabilities</h3>
                  <div className="um-proba-list">
                    {Object.entries(prediction.probabilities).map(([lab, p]) => {
                      const nice = decodeLabelLocal(lab) || lab;
                      return (
                        <div key={lab} className="um-proba-row">
                          <span>
                            {nice}
                            {String(nice) !== String(lab) ? (
                              <small className="um-enc-tag"> ({lab})</small>
                            ) : null}
                          </span>
                          <div className="um-proba-bar-wrap">
                            <div
                              className="um-proba-bar"
                              style={{ width: `${Math.round(Number(p) * 100)}%` }}
                            />
                          </div>
                          <span>{(Number(p) * 100).toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {prediction.threshold_applied && prediction.positive_class_prob != null && (
                <p className="um-sample-note" style={{ marginTop: 12 }}>
                  Threshold applied: P({prediction.positive_class_name || "positive"}) ={" "}
                  <strong>{(Number(prediction.positive_class_prob) * 100).toFixed(1)}%</strong>
                  {" "}
                  {Number(prediction.positive_class_prob) >= Number(prediction.decision_threshold ?? decisionThreshold)
                    ? `≥ ${Number(prediction.decision_threshold ?? decisionThreshold).toFixed(2)} → positive class`
                    : `< ${Number(prediction.decision_threshold ?? decisionThreshold).toFixed(2)} → negative class`}
                </p>
              )}
              {isClassification && nClasses > 2 && prediction.probabilities && (
                <p className="um-hint" style={{ marginTop: 8 }}>
                  Multiclass model ({nClasses} classes). The predicted class is the one with the
                  highest probability. A detection threshold is only used for binary models.
                </p>
              )}
              {isClassification && isBinaryClass && prediction.decision_threshold == null && prediction.probabilities && (
                <p className="um-hint" style={{ marginTop: 8 }}>
                  The detection threshold was not used. It only applies when the model
                  is binary and returns a probability for each class.
                </p>
              )}

              {isBinaryProba && (
                <div className="um-threshold">
                  <label>
                    Adjust threshold & re-predict:{" "}
                    <strong>{decisionThreshold.toFixed(2)}</strong>
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.95"
                    step="0.01"
                    value={decisionThreshold}
                    onChange={(e) => setDecisionThreshold(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    className="um-btn-secondary"
                    style={{ marginTop: 8 }}
                    onClick={handlePredict}
                  >
                    Re-predict with this threshold
                  </button>
                </div>
              )}

              <details className="debug-details">
                <summary>Technical details</summary>
                <pre>{JSON.stringify(prediction, null, 2)}</pre>
              </details>
            </>
          )}
        </section>
      )}

      {activeTab === "batch" && (
        <section className="content-section um-card">
          <h2>Batch prediction</h2>
          <p className="um-hint">
            Upload a CSV of <strong>raw</strong> rows (CSV only, max 100 MB).
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleBatchFileChange}
          />
          {batchFile && (
            <p className="um-hint" style={{ marginTop: 8 }}>
              Selected: {batchFile.name} (
              {batchFile.size >= 1024 * 1024
                ? `${(batchFile.size / (1024 * 1024)).toFixed(2)} MB`
                : `${(batchFile.size / 1024).toFixed(1)} KB`}
              )
            </p>
          )}

          {isClassification && isBinaryClass ? (
            <div className="um-threshold">
              <label>
                Detection threshold: <strong>{decisionThreshold.toFixed(2)}</strong>
              </label>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.01"
                value={decisionThreshold}
                onChange={(e) => setDecisionThreshold(Number(e.target.value))}
              />
              <p className="um-hint">
                Applied row-by-row on binary classifiers with probabilities (same rule as single
                prediction). Change the slider, then click Run batch again.
              </p>
            </div>
          ) : (
            !(isClassification && nClasses > 2) && (
              <p className="um-hint" style={{ marginTop: 12 }}>
                Detection threshold does not apply to this model type (regression / clustering / anomaly). Predictions use the model output directly.
                {isAnomaly || batchResult?.is_anomaly_model
                  ? " For anomaly models, any target column in the CSV is display-only and never used as a feature."
                  : ""}
              </p>
            )
          )}

          <div className="button-group" style={{ marginTop: 16 }}>
            <button
              className="predict-button"
              disabled={!batchFile || batchLoading}
              onClick={handleBatchPredict}
            >
              {batchLoading ? "Processing…" : "Run batch"}
            </button>
            {batchResult?.download_token && (
              <button className="um-btn-secondary" onClick={downloadBatch}>
                Download full CSV
              </button>
            )}
          </div>

          {batchResult && (() => {
            const PRED_COLS = [
              "predicted_label",
              "encoded_class",
              "prediction",
              "confidence",
              "positive_class_prob",
              "decision_threshold",
              "is_anomaly",
              "anomaly_score",
              "row_status",
            ];
            const allKeys = Object.keys(batchResult.preview?.[0] || {});
            const targetKey =
              (batchResult.target_column && allKeys.includes(batchResult.target_column)
                ? batchResult.target_column
                : null) ||
              allKeys.find((k) => k.startsWith("actual_")) ||
              null;
            // Data columns first, then actual target (if any), then model output columns
            const previewCols = [
              ...allKeys.filter((k) => !PRED_COLS.includes(k) && k !== targetKey),
              ...(targetKey ? [targetKey] : []),
              ...PRED_COLS.filter((k) => allKeys.includes(k)),
            ];
            const isPredCol = (h) => PRED_COLS.includes(h) || h === targetKey;

            const extraCols = (Array.isArray(batchResult.unexpected_columns_ignored)
              ? batchResult.unexpected_columns_ignored
              : []
            ).filter(Boolean);

            return (
            <div className="um-batch-summary">
              {batchResult.message && <p className="um-sample-note">{batchResult.message}</p>}
              <p>
                <strong>{batchResult.rows_processed?.toLocaleString()}</strong> /{" "}
                {batchResult.rows_in_file?.toLocaleString() ?? "N/A"} rows processed
                {batchResult.rows_skipped > 0 && (
                  <> · <strong>{batchResult.rows_skipped}</strong> skipped</>
                )}
                {" · "}
                <strong>{previewCols.length}</strong> columns shown
                {isClassification && batchResult.threshold_applied && (
                  <>
                    {" · "}threshold{" "}
                    <strong>
                      {(batchResult.decision_threshold ?? decisionThreshold).toFixed(2)}
                    </strong>
                    {` (applied on ${batchResult.threshold_applied_rows ?? "all"} rows)`}
                  </>
                )}
              </p>
              {isClassification && !batchResult.threshold_applied && nClasses > 2 && (
                <p className="um-hint">
                  {nClasses}-class model: no detection threshold was applied. The predicted class
                  is the one with the highest probability.
                </p>
              )}
              {isClassification && isBinaryClass && !batchResult.threshold_applied && (
                <p className="um-hint">
                  The detection threshold was not used. It only applies when the model
                  is binary and returns a probability for each class. Predictions here
                  come directly from the model.
                </p>
              )}
              {extraCols.length > 0 && (
                <p className="um-hint">
                  {extraCols.length === 1
                    ? `The column “${extraCols[0]}” is not a model feature, so it was ignored and did not affect predictions.`
                    : `These CSV columns are not model features, so they were ignored and did not affect predictions: ${extraCols.join(", ")}.`}
                </p>
              )}
              {batchResult.has_target_column && (
                <p className="um-hint">
                  Target column “{batchResult.target_column}” was kept; prediction columns were added.
                </p>
              )}

              <BatchScores
                metrics={batchResult.metrics}
                isAnomalyModel={
                  Boolean(isAnomaly || batchResult.is_anomaly_model)
                }
              />

              <h4>
                Preview: input data + model output
                <span className="um-hint">
                  {" "}
                  (scroll sideways for more columns · {batchResult.rows_processed?.toLocaleString() || 0} rows total)
                </span>
              </h4>
              <div className="um-batch-preview-wrap">
                <table className="um-batch-preview-table">
                  <thead>
                    <tr>
                      {previewCols.map((h) => (
                        <th
                          key={h}
                          className={isPredCol(h) ? "um-pred-col" : undefined}
                          title={h}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(batchResult.preview || []).map((r, idx) => (
                      <tr key={`${batchResult.page}-${idx}`}>
                        {previewCols.map((h) => (
                          <td
                            key={h}
                            className={PRED_COLS.includes(h) ? "um-pred-col" : undefined}
                            title={String(r[h] ?? "")}
                          >
                            {r[h] == null || r[h] === "" ? "N/A" : String(r[h])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(!batchResult.preview || batchResult.preview.length === 0) && (
                <p className="um-hint">No preview rows on this page.</p>
              )}

              {(batchResult.total_pages || 1) > 1 && (
                <div className="um-batch-pager">
                  <button
                    type="button"
                    className="um-batch-pager-btn"
                    disabled={batchLoading || (batchResult.page || batchPage) <= 1}
                    onClick={() => loadBatchPage((batchResult.page || batchPage) - 1)}
                  >
                    ← Previous
                  </button>
                  <span className="um-batch-pager-status">
                    Page <strong>{batchResult.page || batchPage}</strong> of{" "}
                    <strong>{batchResult.total_pages}</strong>
                    <span className="um-hint">
                      {" "}
                      · rows {(
                        ((batchResult.page || 1) - 1) * (batchResult.page_size || 25) + 1
                      ).toLocaleString()}
                      –
                      {Math.min(
                        (batchResult.page || 1) * (batchResult.page_size || 25),
                        batchResult.rows_processed || 0
                      ).toLocaleString()}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="um-batch-pager-btn"
                    disabled={
                      batchLoading ||
                      (batchResult.page || batchPage) >= (batchResult.total_pages || 1)
                    }
                    onClick={() => loadBatchPage((batchResult.page || batchPage) + 1)}
                  >
                    Next →
                  </button>
                </div>
              )}

              <details className="debug-details" style={{ marginTop: 16 }}>
                <summary>Skipped rows</summary>
                {batchResult.skipped?.length > 0 ? (
                  <>
                    <h4>Skipped rows ({batchResult.rows_skipped})</h4>
                    <ul className="um-skip-list">
                      {batchResult.skipped.slice(0, 30).map((s) => (
                        <li key={`${s.row}-${s.reason}`}>
                          Row {s.row}: {s.reason}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="um-hint">No rows were skipped.</p>
                )}
              </details>
            </div>
            );
          })()}
        </section>
      )}
    </div>
  );
}

export default UseModel;
