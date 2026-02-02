import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Scatter } from "react-chartjs-2";
import {
  cancelRun,
  fetchModels,
  fetchPredictions,
  fetchRunStatus,
  fetchRuns,
  fetchSummary,
  GroupSummary,
  LiveSnapshot,
  ModelInfo,
  RunStatus,
  startRun,
  subscribeLive,
} from "./api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function App() {
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [runs, setRuns] = useState<LiveSnapshot[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [predictions, setPredictions] = useState<Record<string, string>[]>([]);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [summaryPath, setSummaryPath] = useState<string | null>(null);
  const [summary, setSummary] = useState<GroupSummary | null>(null);
  const [predLimit, setPredLimit] = useState<"all" | number>(25);
  const [summaryLimit, setSummaryLimit] = useState<"all" | number>(25);
  const [recentLimit, setRecentLimit] = useState<"all" | number>(25);
  const [predSort, setPredSort] = useState<"none" | "asc" | "desc">("none");
  const [datasetFilter, setDatasetFilter] = useState("all");
  const [params, setParams] = useState({
    output_csv: "output/predictions.csv",
    text_col: "Text",
    model_name: "distilbert-base-uncased-finetuned-sst-2-english",
    batch_size: 32,
    max_len: 256,
    max_rows: "",
    metrics_port: "",
  });
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelMode, setModelMode] = useState<"list" | "custom">("list");

  useEffect(() => {
    const source = subscribeLive(setLive);
    return () => source.close();
  }, []);

  useEffect(() => {
    fetchModels()
      .then(setModels)
      .catch(() => setModels([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRuns(query)
      .then((data) => {
        if (!cancelled) {
          setRuns(data);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query, refreshKey]);

  useEffect(() => {
    if (live?.status === "complete") {
      setRefreshKey((k) => k + 1);
      fetchPredictions(outputPath ?? undefined, predLimit === "all" ? 0 : predLimit)
        .then(setPredictions)
        .catch(() => undefined);
      fetchSummary(summaryPath ?? undefined)
        .then(setSummary)
        .catch(() => undefined);
    }
  }, [live?.status, outputPath, summaryPath, predLimit]);

  useEffect(() => {
    if (datasetFilter === "all") {
      return;
    }
    const latestMatch = [...runs].reverse().find((run) => run.dataset_type === datasetFilter);
    if (!latestMatch) {
      setOutputPath(null);
      setSummaryPath(null);
      setPredictions([]);
      setSummary(null);
      return;
    }
    setOutputPath(latestMatch.output_csv);
    const summaryCandidate = latestMatch.output_csv.replace(/\.csv$/i, "_group_summary.json");
    setSummaryPath(summaryCandidate);
    fetchPredictions(latestMatch.output_csv, predLimit === "all" ? 0 : predLimit)
      .then(setPredictions)
      .catch(() => undefined);
    fetchSummary(summaryCandidate)
      .then(setSummary)
      .catch(() => undefined);
  }, [datasetFilter, predLimit, runs]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const status = await fetchRunStatus();
        if (active) {
          setRunStatus(status);
        }
      } catch {
        if (active) {
          setRunStatus(null);
        }
      }
    };
    poll();
    const interval = window.setInterval(poll, 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function handleRunSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setFormError("Please select a CSV file to upload.");
      return;
    }
    setFormError(null);
    setFormBusy(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("output_csv", params.output_csv);
    formData.append("text_col", params.text_col);
    formData.append("model_name", params.model_name);
    formData.append("batch_size", String(params.batch_size));
    formData.append("max_len", String(params.max_len));
    if (params.max_rows) {
      formData.append("max_rows", params.max_rows);
    }
    if (params.metrics_port) {
      formData.append("metrics_port", params.metrics_port);
    }

    try {
      const response = await startRun(formData);
      setOutputPath(response.output_csv);
      setSummaryPath(response.summary_path ?? null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setFormBusy(false);
    }
  }

  const datasetOptions = useMemo(() => {
    const values = Array.from(new Set(runs.map((run) => run.dataset_type).filter(Boolean))) as string[];
    return ["all", ...values];
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (datasetFilter === "all") {
      return runs;
    }
    return runs.filter((run) => run.dataset_type === datasetFilter);
  }, [datasetFilter, runs]);

  const runIndex = useMemo(() => filteredRuns.map((_, i) => i + 1), [filteredRuns]);

  const runtimeData = useMemo(
    () => ({
      labels: runIndex,
      datasets: [
        {
          label: "Runtime (s)",
          data: filteredRuns.map((r) => r.runtime_s ?? 0),
          borderColor: "#60a5fa",
          backgroundColor: "rgba(96,165,250,0.3)",
          tension: 0.25,
        },
      ],
    }),
    [runIndex, filteredRuns]
  );

  const processedData = useMemo(
    () => ({
      labels: runIndex,
      datasets: [
        {
          label: "Processed",
          data: filteredRuns.map((r) => r.processed ?? 0),
          borderColor: "#34d399",
          backgroundColor: "rgba(52,211,153,0.3)",
          tension: 0.25,
        },
        {
          label: "Failed",
          data: filteredRuns.map((r) => r.failed ?? 0),
          borderColor: "#f87171",
          backgroundColor: "rgba(248,113,113,0.3)",
          tension: 0.25,
        },
      ],
    }),
    [runIndex, filteredRuns]
  );

  const runChartOptions = useMemo(
    () => ({
      plugins: {
        tooltip: {
          callbacks: {
            afterBody: (items: { dataIndex: number }[]) => {
              const idx = items[0]?.dataIndex;
              const run = typeof idx === "number" ? filteredRuns[idx] : undefined;
              return run ? `Max len: ${run.max_len}` : "";
            },
          },
        },
      },
    }),
    [filteredRuns]
  );

  const scoreDistributionData = useMemo(
    () => ({
      labels: runIndex,
      datasets: [
        {
          label: "Positive",
          data: filteredRuns.map((run) => run.positive ?? 0),
          backgroundColor: "rgba(52, 211, 153, 0.6)",
          borderColor: "#34d399",
        },
        {
          label: "Negative",
          data: filteredRuns.map((run) => run.negative ?? 0),
          backgroundColor: "rgba(248, 113, 113, 0.6)",
          borderColor: "#f87171",
        },
        {
          label: "Neutral",
          data: filteredRuns.map((run) => run.neutral ?? 0),
          backgroundColor: "rgba(148, 163, 184, 0.6)",
          borderColor: "#94a3b8",
        },
      ],
    }),
    [runIndex, filteredRuns]
  );

  const scoreDistributionOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { position: "bottom" as const },
        tooltip: {
          callbacks: {
            afterBody: (items: { dataIndex: number }[]) => {
              const idx = items[0]?.dataIndex;
              const run = typeof idx === "number" ? filteredRuns[idx] : undefined;
              if (!run) {
                return "";
              }
              const avgScore = (run.avg_score ?? 0) * 100;
              return `Avg score: ${avgScore.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, title: { display: true, text: "Rows" } },
      },
    }),
    [filteredRuns]
  );

  const comparisonRuns = useMemo(() => {
    return filteredRuns.filter((run) => run.runtime_s && run.runtime_s > 0);
  }, [filteredRuns]);

  const batchSizes = useMemo(() => {
    const unique = Array.from(new Set(comparisonRuns.map((run) => run.batch_size))).sort(
      (a, b) => a - b
    );
    return unique;
  }, [comparisonRuns]);

  const maxLens = useMemo(() => {
    const unique = Array.from(new Set(comparisonRuns.map((run) => run.max_len))).sort(
      (a, b) => a - b
    );
    return unique;
  }, [comparisonRuns]);

  const scatterData = useMemo(() => {
    const palette = [
      "#60a5fa",
      "#34d399",
      "#f59e0b",
      "#f472b6",
      "#a78bfa",
      "#f87171",
      "#22d3ee",
    ];
    const datasets = batchSizes.map((batchSize, idx) => {
      const points = comparisonRuns
        .filter((run) => run.batch_size === batchSize)
        .map((run) => ({
          x: run.max_len,
          y: run.processed && run.runtime_s ? run.processed / run.runtime_s : 0,
        }));
      return {
        label: `Batch ${batchSize}`,
        data: points,
        pointRadius: 4,
        pointHoverRadius: 6,
        backgroundColor: palette[idx % palette.length],
      };
    });
    return { datasets };
  }, [batchSizes, comparisonRuns]);

  const scatterOptions = useMemo(
    () => ({
      plugins: {
        legend: {
          position: "bottom" as const,
        },
        tooltip: {
          callbacks: {
            label: (ctx: { raw: { x: number; y: number } }) => {
              const value = ctx.raw;
              return `max_len=${value.x}, throughput=${value.y.toFixed(2)} rows/s`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Max length" },
          ticks: { precision: 0 },
        },
        y: {
          title: { display: true, text: "Throughput (rows/s)" },
        },
      },
    }),
    []
  );

  const heatmapMatrix = useMemo(() => {
    const matrix = batchSizes.map((batchSize) =>
      maxLens.map((maxLen) => {
        const matches = comparisonRuns.filter(
          (run) => run.batch_size === batchSize && run.max_len === maxLen
        );
        if (matches.length === 0) {
          return null;
        }
        const avgThroughput =
          matches.reduce((acc, run) => acc + run.processed / run.runtime_s, 0) /
          matches.length;
        return avgThroughput;
      })
    );
    return matrix;
  }, [batchSizes, maxLens, comparisonRuns]);

  const heatmapScale = useMemo(() => {
    const values = heatmapMatrix.flatMap((row) => row.filter((value) => value !== null)) as number[];
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    return { min, max };
  }, [heatmapMatrix]);

  const groupedScoreRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        batch_size: number;
        max_len: number;
        runs: number;
        processed: number;
        positive: number;
        negative: number;
        neutral: number;
        score_sum: number;
      }
    >();

    filteredRuns.forEach((run) => {
      const key = `${run.batch_size}-${run.max_len}`;
      const entry = grouped.get(key) ?? {
        batch_size: run.batch_size,
        max_len: run.max_len,
        runs: 0,
        processed: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        score_sum: 0,
      };
      const processed = run.processed ?? 0;
      entry.runs += 1;
      entry.processed += processed;
      entry.positive += run.positive ?? 0;
      entry.negative += run.negative ?? 0;
      entry.neutral += run.neutral ?? 0;
      entry.score_sum += (run.avg_score ?? 0) * processed;
      grouped.set(key, entry);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.batch_size !== b.batch_size) {
        return a.batch_size - b.batch_size;
      }
      return a.max_len - b.max_len;
    });
  }, [filteredRuns]);

  const summaryTotals = useMemo(() => {
    if (!summary) {
      return { total: 0, avgScore: 0 };
    }
    const total = summary.groups.reduce((acc, group) => acc + group.total, 0);
    const weighted = summary.groups.reduce(
      (acc, group) => acc + group.avg_score * group.total,
      0
    );
    let avgScore = total > 0 ? weighted / total : 0;
    if (avgScore <= 1) {
      avgScore *= 100;
    }
    avgScore = Math.min(100, Math.max(0, avgScore));
    return { total, avgScore };
  }, [summary]);

  const skewLabel = useMemo(() => {
    if (!summary) {
      return "";
    }
    if (summaryTotals.avgScore >= 55) {
      return "Positive Skew";
    }
    if (summaryTotals.avgScore <= 45) {
      return "Negative Skew";
    }
    return "Neutral / Mixed";
  }, [summary, summaryTotals.avgScore]);

  const summaryGroups = useMemo(() => {
    if (!summary) {
      return [];
    }
    if (summaryLimit === "all") {
      return summary.groups;
    }
    return summary.groups.slice(0, summaryLimit);
  }, [summary, summaryLimit]);

  const predictionKeys = useMemo(() => {
    if (predictions.length === 0) {
      return [];
    }
    return Object.keys(predictions[0]);
  }, [predictions]);

  const predictionsToShow = useMemo(() => {
    const data = predSort === "none" ? predictions : [...predictions].sort((a, b) => {
      const aScore = Number(a.score ?? a.Score ?? a.SCORE ?? 0);
      const bScore = Number(b.score ?? b.Score ?? b.SCORE ?? 0);
      const safeA = Number.isFinite(aScore) ? aScore : -Infinity;
      const safeB = Number.isFinite(bScore) ? bScore : -Infinity;
      return predSort === "asc" ? safeA - safeB : safeB - safeA;
    });
    if (predLimit === "all") {
      return data;
    }
    return data.slice(0, predLimit);
  }, [predictions, predLimit, predSort]);

  const sentimentClass = (labelValue: string) => {
    const normalized = labelValue.toLowerCase();
    if (normalized.includes("pos")) {
      return "text-positive";
    }
    if (normalized.includes("neg")) {
      return "text-negative";
    }
    return "text-average";
  };

  const formatShortTimestamp = (timestamp: string) => {
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
      return timestamp;
    }
    const ss = String(parsed.getSeconds()).padStart(2, "0");
    const mm = String(parsed.getMinutes()).padStart(2, "0");
    const hh = String(parsed.getHours()).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    const yy = String(parsed.getFullYear()).slice(-2);
    return `${ss}/${mm}/${hh}-${dd}/${yy}`;
  };

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <img src="/logo.png" alt="IQRush" className="logo" />
          <div>
            <h1>IQRush Dashboard</h1>
            <p>Realtime run telemetry + historical comparisons</p>
          </div>
        </div>
        <div className="status">
          <span className={`pill ${live?.status ?? "idle"}`}>{live?.status ?? "idle"}</span>
          <span className="mono">{live?.timestamp ?? "no live data"}</span>
        </div>
      </header>

      <section className="grid">
        <div className="card">
          <h2>Run a job</h2>
          <form className="form" onSubmit={handleRunSubmit}>
            <label>
              CSV file
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label>
              Output CSV
              <input
                value={params.output_csv}
                onChange={(e) => setParams({ ...params, output_csv: e.target.value })}
              />
            </label>
            <label>
              Text column
              <input
                value={params.text_col}
                onChange={(e) => setParams({ ...params, text_col: e.target.value })}
              />
            </label>
            <label>
              Model
              <select
                value={modelMode === "list" ? params.model_name : "__custom__"}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setModelMode("custom");
                  } else {
                    setModelMode("list");
                    setParams({ ...params, model_name: e.target.value });
                  }
                }}
              >
                {models.length === 0 && (
                  <option value={params.model_name}>{params.model_name}</option>
                )}
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))}
                <option value="__custom__">Custom...</option>
              </select>
            </label>
            {modelMode === "custom" && (
              <label>
                Custom model name
                <input
                  value={params.model_name}
                  onChange={(e) => setParams({ ...params, model_name: e.target.value })}
                />
              </label>
            )}
            <div className="form-row">
              <label>
                Batch size
                <input
                  type="number"
                  value={params.batch_size}
                  onChange={(e) =>
                    setParams({ ...params, batch_size: Number(e.target.value) || 1 })
                  }
                />
              </label>
              <label>
                Max len
                <input
                  type="number"
                  value={params.max_len}
                  onChange={(e) => setParams({ ...params, max_len: Number(e.target.value) || 1 })}
                />
              </label>
              <label>
                Max rows
                <input
                  type="number"
                  value={params.max_rows}
                  onChange={(e) => setParams({ ...params, max_rows: e.target.value })}
                />
              </label>
            </div>
            <label>
              Metrics port (optional)
              <input
                type="number"
                value={params.metrics_port}
                onChange={(e) => setParams({ ...params, metrics_port: e.target.value })}
              />
            </label>
            {formError && <p className="error">{formError}</p>}
            <div className="row">
              <button type="submit" disabled={formBusy || runStatus?.running}>
                {formBusy ? "Starting..." : runStatus?.running ? "Running" : "Run"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => cancelRun().catch(() => undefined)}
                disabled={!runStatus?.running}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
        <div className="card">
          <h2>Run logs</h2>
          <div className="log">
            <div className="row">
              <span className="mono">{runStatus?.log_path ?? "no logs"}</span>
            </div>
            <pre>{runStatus?.log_tail || "No logs yet."}</pre>
          </div>
        </div>

        <div className="card">
          <h2>Live metrics</h2>
          {live ? (
            <div className="metrics">
              <div>
                <span>Processed</span>
                <strong>{live.processed}</strong>
              </div>
              <div>
                <span>Failed</span>
                <strong>{live.failed}</strong>
              </div>
              <div>
                <span>Rows seen</span>
                <strong>{live.rows_seen}</strong>
              </div>
              <div>
                <span>Runtime</span>
                <strong>{live.runtime_s}s</strong>
              </div>
              <div>
                <span>Batch size</span>
                <strong>{live.batch_size}</strong>
              </div>
              <div>
                <span>Max rows</span>
                <strong>{live.max_rows ?? "∞"}</strong>
              </div>
            </div>
          ) : (
            <p className="muted">No live data yet. Start a run.</p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="row">
          <h2>Run history</h2>
          <div className="control-group">
            <div className="search">
              <input
                placeholder="Search by model, param, file..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select value={datasetFilter} onChange={(e) => setDatasetFilter(e.target.value)}>
              {datasetOptions.map((dataset) => (
                <option key={dataset} value={dataset}>
                  {dataset === "all" ? "All datasets" : dataset}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading && <p className="muted">Loading runs...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && filteredRuns.length === 0 && <p className="muted">No run history yet.</p>}
        {filteredRuns.length > 0 && (
          <div className="charts">
            <div className="chart">
              <Line data={runtimeData} options={runChartOptions} />
            </div>
            <div className="chart">
              <Line data={processedData} options={runChartOptions} />
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="row">
          <h2>Run comparisons</h2>
          <span className="mono">
            {datasetFilter === "all" ? "All datasets" : datasetFilter}
          </span>
        </div>
        {comparisonRuns.length === 0 ? (
          <p className="muted">Run a few jobs to compare batch size vs max length.</p>
        ) : (
          <div className="charts">
            <div className="chart">
              <Scatter data={scatterData} options={scatterOptions} />
            </div>
            <div className="chart">
              <div className="heatmap" style={{ "--heatmap-cols": maxLens.length + 1 } as React.CSSProperties}>
                <div className="heatmap-row heatmap-header">
                  <span className="heatmap-label">Batch \ Max len</span>
                  {maxLens.map((maxLen) => (
                    <span key={`maxlen-${maxLen}`} className="heatmap-label">
                      {maxLen}
                    </span>
                  ))}
                </div>
                {batchSizes.map((batchSize, rowIndex) => (
                  <div className="heatmap-row" key={`batch-${batchSize}`}>
                    <span className="heatmap-label">{batchSize}</span>
                    {maxLens.map((maxLen, colIndex) => {
                      const value = heatmapMatrix[rowIndex]?.[colIndex] ?? null;
                      const normalized =
                        value === null || heatmapScale.max === heatmapScale.min
                          ? 0
                          : (value - heatmapScale.min) / (heatmapScale.max - heatmapScale.min);
                      const alpha = 0.15 + normalized * 0.85;
                      return (
                        <span
                          key={`cell-${batchSize}-${maxLen}`}
                          className="heatmap-cell"
                          style={{
                            background: value === null ? "rgba(255,255,255,0.04)" : `rgba(76, 109, 255, ${alpha})`,
                          }}
                          title={
                            value === null
                              ? "No runs"
                              : `Throughput: ${value.toFixed(2)} rows/s`
                          }
                        >
                          {value === null ? "—" : value.toFixed(1)}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="chart">
              <Bar data={scoreDistributionData} options={scoreDistributionOptions} />
            </div>
          </div>
        )}
        {groupedScoreRows.length > 0 && (
          <div className="table comparison-table">
            <div className="row header">
              <span>Batch</span>
              <span>Max len</span>
              <span>Runs</span>
              <span>Avg score</span>
              <span>Positive %</span>
              <span>Negative %</span>
              <span>Neutral %</span>
            </div>
            {groupedScoreRows.map((row) => {
              const avgScore = row.processed ? (row.score_sum / row.processed) * 100 : 0;
              const positiveRate = row.processed ? (row.positive / row.processed) * 100 : 0;
              const negativeRate = row.processed ? (row.negative / row.processed) * 100 : 0;
              const neutralRate = row.processed ? (row.neutral / row.processed) * 100 : 0;
              return (
                <div className="row" key={`${row.batch_size}-${row.max_len}`}>
                  <span>{row.batch_size}</span>
                  <span>{row.max_len}</span>
                  <span>{row.runs}</span>
                  <span className="text-average">{avgScore.toFixed(1)}%</span>
                  <span className="text-positive">{positiveRate.toFixed(1)}%</span>
                  <span className="text-negative">{negativeRate.toFixed(1)}%</span>
                  <span className="muted">{neutralRate.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="row">
          <h2>Recent runs</h2>
          <select
            value={recentLimit}
            onChange={(e) =>
              setRecentLimit(e.target.value === "all" ? "all" : Number(e.target.value))
            }
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value="all">all</option>
          </select>
        </div>
        <div className="table table-scroll">
          <div className="row header">
            <span>Time</span>
            <span>Model</span>
            <span>Batch</span>
            <span>Max len</span>
            <span>Max rows</span>
            <span>Processed</span>
            <span>Failed</span>
            <span>Runtime (s)</span>
          </div>
          {filteredRuns
            .slice()
            .reverse()
            .slice(0, recentLimit === "all" ? undefined : recentLimit)
            .map((run, idx) => (
              <div className="row" key={`${run.timestamp}-${idx}`}>
                <span className="mono">{formatShortTimestamp(run.timestamp)}</span>
                <span className="mono">{run.model_name}</span>
                <span>{run.batch_size}</span>
                <span>{run.max_len}</span>
                <span>{run.max_rows ?? "∞"}</span>
                <span>{run.processed}</span>
                <span>{run.failed}</span>
                <span>{run.runtime_s}</span>
              </div>
            ))}
        </div>
      </section>


      <section className="card">
        <div className="row">
          <h2>Predictions (latest)</h2>
          <span className="mono">
            {datasetFilter === "all" ? "All datasets" : datasetFilter}
          </span>
          <div className="control-group">
            <select
              value={predLimit}
              onChange={(e) =>
                setPredLimit(e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">all</option>
            </select>
            <select value={predSort} onChange={(e) => setPredSort(e.target.value as typeof predSort)}>
              <option value="none">Original order</option>
              <option value="desc">Score: high → low</option>
              <option value="asc">Score: low → high</option>
            </select>
          </div>
        </div>
        {predictions.length === 0 ? (
          <p className="muted">No predictions yet.</p>
        ) : (
          <div className="table table-scroll">
            <div className="row header">
              {predictionKeys.map((key) => (
                <span key={key}>{key}</span>
              ))}
            </div>
            {predictionsToShow.map((row, idx) => (
              <div className="row" key={`pred-${idx}`}>
                {predictionKeys.map((key, i) => {
                  const value = row[key] ?? "";
                  const label = String(row["label"] ?? "");
                  const scoreNum = Number(row["score"] ?? 0);
                  const scorePercent = Number.isFinite(scoreNum)
                    ? Math.round(scoreNum * 100)
                    : 0;
                  const scoreClass = sentimentClass(label);

                  if (key.toLowerCase() === "label") {
                    return (
                      <span key={`${idx}-${i}`} className="mini-sentiment">
                        <span className={scoreClass}>{value}</span>
                        <span className="mini-track">
                          <span
                            className={`mini-fill ${scoreClass}`}
                            style={{ width: `${scorePercent}%` }}
                          />
                        </span>
                      </span>
                    );
                  }
                  if (key.toLowerCase() === "score") {
                    return (
                      <span key={`${idx}-${i}`} className="score-cell">
                        <span className={scoreClass}>{value}</span>
                        <span className="score-bar">
                          <span
                            className={`score-fill ${scoreClass}`}
                            style={{ width: `${scorePercent}%` }}
                          />
                        </span>
                      </span>
                    );
                  }
                  return (
                    <span key={`${idx}-${i}`} className="mono">
                      {value}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
      
      <section className="card">
        <div className="row">
          <h2>Summary</h2>
          <span className="mono">
            {datasetFilter === "all" ? "All datasets" : datasetFilter}
          </span>
          <select
            value={summaryLimit}
            onChange={(e) =>
              setSummaryLimit(e.target.value === "all" ? "all" : Number(e.target.value))
            }
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value="all">all</option>
          </select>
        </div>
        {!summary && <p className="muted">No summary available yet.</p>}
        {summary && (
          <>
            <div className="table summary-table table-scroll">
              <div className="row header">
                <span>Product</span>
                <span>Total</span>
                <span className="text-positive">Positive</span>
                <span className="text-negative">Negative</span>
                <span className="text-average">Avg score</span>
              </div>
              {summaryGroups.map((group) => (
                <div className="row" key={group.group}>
                  <span className="mono">{group.group}</span>
                  <span>{group.total}</span>
                  <span className="text-positive">{group.positive}</span>
                  <span className="text-negative">{group.negative}</span>
                  <span className="mini-sentiment">
                    <span className="text-average">{group.avg_score}</span>
                    <span className="mini-track">
                      <span
                        className="mini-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, group.avg_score * 100))}%`,
                        }}
                      />
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

    </div>
  );
}
