import { LiveSnapshot, RunStatus } from "../api";

type RunLogsCardProps = {
  runStatus: RunStatus | null;
  live: LiveSnapshot | null;
  className?: string;
};

export default function RunLogsCard({ runStatus, live, className }: RunLogsCardProps) {
  return (
    <div className={className ? `card ${className}` : "card"}>
      <div className="row">
        <h2>Live feed</h2>
        <span className="mono">{live?.status ?? "idle"}</span>
      </div>
      <div className="metrics">
        <div>
          <span>Processed</span>
          <strong>{live?.processed ?? 0}</strong>
        </div>
        <div>
          <span>Failed</span>
          <strong>{live?.failed ?? 0}</strong>
        </div>
        <div>
          <span>Skipped</span>
          <strong>{live?.skipped ?? 0}</strong>
        </div>
        <div>
          <span>Invalid</span>
          <strong>{live?.invalid ?? 0}</strong>
        </div>
        <div>
          <span>Rows seen</span>
          <strong>{live?.rows_seen ?? 0}</strong>
        </div>
        <div>
          <span>Runtime</span>
          <strong>{live?.runtime_s ?? 0}s</strong>
        </div>
      </div>
      <div className="log">
        <div className="row">
          <span className="mono">{runStatus?.log_path ?? "no logs"}</span>
        </div>
        <pre>{runStatus?.log_tail || "No logs yet."}</pre>
      </div>
    </div>
  );
}
