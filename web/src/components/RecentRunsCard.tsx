import { LiveSnapshot } from "../api";

type RecentRunsCardProps = {
  recentLimit: "all" | number;
  setRecentLimit: (value: "all" | number) => void;
  filteredRuns: LiveSnapshot[];
  formatShortTimestamp: (value: string) => string;
};

export default function RecentRunsCard({
  recentLimit,
  setRecentLimit,
  filteredRuns,
  formatShortTimestamp,
}: RecentRunsCardProps) {
  return (
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
  );
}
