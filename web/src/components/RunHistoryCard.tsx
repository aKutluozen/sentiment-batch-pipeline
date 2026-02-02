import { ChartData, ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import { LiveSnapshot } from "../api";

type RunHistoryCardProps = {
  query: string;
  setQuery: (value: string) => void;
  loading: boolean;
  error: string | null;
  filteredRuns: LiveSnapshot[];
  runtimeData: ChartData<"line">;
  processedData: ChartData<"line">;
  runChartOptions: ChartOptions<"line">;
};

export default function RunHistoryCard({
  query,
  setQuery,
  loading,
  error,
  filteredRuns,
  runtimeData,
  processedData,
  runChartOptions,
}: RunHistoryCardProps) {
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
