import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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
  const [predLimit, setPredLimit] = useState(25);
  const [params, setParams] = useState({
    output_csv: "output/predictions.csv",
    text_col: "Text",
    id_col: "",
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
      fetchPredictions(outputPath ?? undefined, predLimit)
        .then(setPredictions)
        .catch(() => undefined);
      fetchSummary(summaryPath ?? undefined)
        .then(setSummary)
        .catch(() => undefined);
    }
  }, [live?.status, outputPath, summaryPath, predLimit]);

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
    if (params.id_col.trim()) {
      formData.append("id_col", params.id_col);
    }
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

  const runIndex = useMemo(() => runs.map((_, i) => i + 1), [runs]);

  const runtimeData = useMemo(
    () => ({
      labels: runIndex,
      datasets: [
        {
          label: "Runtime (s)",
          data: runs.map((r) => r.runtime_s ?? 0),
          borderColor: "#60a5fa",
          backgroundColor: "rgba(96,165,250,0.3)",
          tension: 0.25,
        },
      ],
    }),
    [runIndex, runs]
  );

  const processedData = useMemo(
    () => ({
      labels: runIndex,
      datasets: [
        {
          label: "Processed",
          data: runs.map((r) => r.processed ?? 0),
          borderColor: "#34d399",
          backgroundColor: "rgba(52,211,153,0.3)",
          tension: 0.25,
        },
        {
          label: "Failed",
          data: runs.map((r) => r.failed ?? 0),
          borderColor: "#f87171",
          backgroundColor: "rgba(248,113,113,0.3)",
          tension: 0.25,
        },
      ],
    }),
    [runIndex, runs]
  );

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
              ID column (optional)
              <input
                value={params.id_col}
                onChange={(e) => setParams({ ...params, id_col: e.target.value })}
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
          <div className="search">
            <input
              placeholder="Search by model, param, file..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {loading && <p className="muted">Loading runs...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && runs.length === 0 && <p className="muted">No run history yet.</p>}
        {runs.length > 0 && (
          <div className="charts">
            <div className="chart">
              <Line data={runtimeData} />
            </div>
            <div className="chart">
              <Line data={processedData} />
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Recent runs</h2>
        <div className="table">
          <div className="row header">
            <span>Time</span>
            <span>Model</span>
            <span>Batch</span>
            <span>Max rows</span>
            <span>Processed</span>
            <span>Failed</span>
            <span>Runtime (s)</span>
          </div>
          {runs
            .slice()
            .reverse()
            .slice(0, 10)
            .map((run, idx) => (
              <div className="row" key={`${run.timestamp}-${idx}`}>
                <span className="mono">{run.timestamp}</span>
                <span className="mono">{run.model_name}</span>
                <span>{run.batch_size}</span>
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
          <h2>Grouped summary</h2>
          <button
            onClick={() =>
              fetchSummary(summaryPath ?? undefined)
                .then(setSummary)
                .catch(() => undefined)
            }
          >
            Refresh
          </button>
        </div>
        {!summary && <p className="muted">No summary available yet.</p>}
        {summary && (
          <div className="table">
            <div className="row header">
              <span>Group</span>
              <span>Total</span>
              <span>Positive</span>
              <span>Negative</span>
              <span>Avg score</span>
            </div>
            {summary.groups.slice(0, 25).map((group) => (
              <div className="row" key={group.group}>
                <span className="mono">{group.group}</span>
                <span>{group.total}</span>
                <span>{group.positive}</span>
                <span>{group.negative}</span>
                <span>{group.avg_score}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="row">
          <h2>Predictions (latest)</h2>
          <button
            onClick={() =>
              fetchPredictions(outputPath ?? undefined, predLimit)
                .then(setPredictions)
                .catch(() => undefined)
            }
          >
            Refresh
          </button>
          <select
            value={predLimit}
            onChange={(e) => setPredLimit(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={100}>100</option>
          </select>
        </div>
        {predictions.length === 0 ? (
          <p className="muted">No predictions yet.</p>
        ) : (
          <div className="table">
            <div className="row header">
              {Object.keys(predictions[0]).map((key) => (
                <span key={key}>{key}</span>
              ))}
            </div>
            {predictions.slice(0, 25).map((row, idx) => (
              <div className="row" key={`pred-${idx}`}>
                {Object.values(row).map((value, i) => (
                  <span key={`${idx}-${i}`} className="mono">
                    {value}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
