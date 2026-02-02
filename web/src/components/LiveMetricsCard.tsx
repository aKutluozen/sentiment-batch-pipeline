import { LiveSnapshot } from "../api";

type LiveMetricsCardProps = {
  live: LiveSnapshot | null;
};

export default function LiveMetricsCard({ live }: LiveMetricsCardProps) {
  return (
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
        </div>
      ) : (
        <p className="muted">No live data yet. Start a run.</p>
      )}
    </div>
  );
}
