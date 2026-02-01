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
import { fetchRuns, LiveSnapshot, subscribeLive } from "./api";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function App() {
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [runs, setRuns] = useState<LiveSnapshot[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const source = subscribeLive(setLive);
    return () => source.close();
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
    }
  }, [live?.status]);

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
        <div>
          <h1>IQRush Dashboard</h1>
          <p>Realtime run telemetry + historical comparisons</p>
        </div>
        <div className="status">
          <span className={`pill ${live?.status ?? "idle"}`}>{live?.status ?? "idle"}</span>
          <span className="mono">{live?.timestamp ?? "no live data"}</span>
        </div>
      </header>

      <section className="grid">
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

        <div className="card">
          <h2>Current parameters</h2>
          {live ? (
            <div className="params">
              <div>
                <span>Input</span>
                <strong className="mono">{live.input_csv}</strong>
              </div>
              <div>
                <span>Output</span>
                <strong className="mono">{live.output_csv}</strong>
              </div>
              <div>
                <span>Model</span>
                <strong className="mono">{live.model_name}</strong>
              </div>
              <div>
                <span>Text column</span>
                <strong>{live.text_col}</strong>
              </div>
              <div>
                <span>ID column</span>
                <strong>{live.id_col ?? "(none)"}</strong>
              </div>
            </div>
          ) : (
            <p className="muted">No run detected yet.</p>
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
    </div>
  );
}
