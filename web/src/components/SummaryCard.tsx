import { GroupSummary } from "../api";

type SummaryCardProps = {
  datasetFilter: string;
  summary: GroupSummary | null;
  summaryLimit: "all" | number;
  setSummaryLimit: (value: "all" | number) => void;
  summaryGroups: GroupSummary["groups"];
};

export default function SummaryCard({
  datasetFilter,
  summary,
  summaryLimit,
  setSummaryLimit,
  summaryGroups,
}: SummaryCardProps) {
  return (
    <section className="card">
      <div className="row">
        <h2>Summary</h2>
        <span className="mono">{datasetFilter === "all" ? "All datasets" : datasetFilter}</span>
        <select
          value={summaryLimit}
          onChange={(e) => setSummaryLimit(e.target.value === "all" ? "all" : Number(e.target.value))}
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
      )}
    </section>
  );
}
