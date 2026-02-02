import { RunStatus } from "../api";

type RunLogsCardProps = {
  runStatus: RunStatus | null;
};

export default function RunLogsCard({ runStatus }: RunLogsCardProps) {
  return (
    <div className="card">
      <h2>Run logs</h2>
      <div className="log">
        <div className="row">
          <span className="mono">{runStatus?.log_path ?? "no logs"}</span>
        </div>
        <pre>{runStatus?.log_tail || "No logs yet."}</pre>
      </div>
    </div>
  );
}
