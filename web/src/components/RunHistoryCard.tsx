import { useMemo } from "react";
import { ChartData, ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import { LiveSnapshot } from "../api";

type RunHistoryCardProps = {
  query: string;
  setQuery: (value: string) => void;
  loading: boolean;
  error: string | null;
  filteredRuns: LiveSnapshot[];
};

const chartTextColor = "#9aa1d8";
const chartGridColor = "rgba(60, 66, 130, 0.25)";

export default function RunHistoryCard({
  query,
  setQuery,
  loading,
  error,
  filteredRuns,
}: RunHistoryCardProps) {
  const runtimeData: ChartData<"line"> = useMemo(() => {
    const labels = filteredRuns.map((run) => run.timestamp);
    return {
      labels,
      datasets: [
        {
          label: "Runtime (s)",
          data: filteredRuns.map((run) => run.runtime_s),
          borderColor: "#4c6dff",
          backgroundColor: "rgba(76, 109, 255, 0.35)",
          tension: 0.3,
          fill: true,
        },
      ],
    };
  }, [filteredRuns]);

  const processedData: ChartData<"line"> = useMemo(() => {
    const labels = filteredRuns.map((run) => run.timestamp);
    return {
      labels,
      datasets: [
        {
          label: "Processed rows",
          data: filteredRuns.map((run) => run.processed),
          borderColor: "#48d07a",
          backgroundColor: "rgba(72, 208, 122, 0.25)",
          tension: 0.3,
          fill: true,
        },
        {
          label: "Failed rows",
          data: filteredRuns.map((run) => run.failed),
          borderColor: "#ff6b6b",
          backgroundColor: "rgba(255, 107, 107, 0.2)",
          tension: 0.3,
          fill: false,
        },
      ],
    };
  }, [filteredRuns]);

  const runChartOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
      },
      scales: {
        x: {
          ticks: { color: chartTextColor },
          grid: { color: chartGridColor },
        },
        y: {
          ticks: { color: chartTextColor },
          grid: { color: chartGridColor },
        },
      },
    }),
    []
  );
  return (
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
  );
}
