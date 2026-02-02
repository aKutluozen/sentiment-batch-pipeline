import { GroupSummary } from "../api";

type SummaryCardProps = {
  datasetFilter: string;
  summaryLimit: "all" | number;
  setSummaryLimit: (value: "all" | number) => void;
  sections: Array<{ dataset: string; summary: GroupSummary | null }>;
};

export default function SummaryCard({
  datasetFilter,
  summaryLimit,
  setSummaryLimit,
  sections,
}: SummaryCardProps) {
  const showDatasetHeader = datasetFilter === "all" && sections.length > 1;
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
      {sections.length === 0 && <p className="muted">No summary available yet.</p>}
      {sections.map((section) => {
        const summary = section.summary;
        if (!summary) {
          return (
            <div key={`summary-${section.dataset}`}>
              {showDatasetHeader && <p className="mono">{section.dataset}</p>}
              <p className="muted">No summary for this dataset.</p>
            </div>
          );
        }
        const summaryGroups =
          summaryLimit === "all" ? summary.groups : summary.groups.slice(0, summaryLimit);

        return (
          <div key={`summary-${section.dataset}`}>
            {showDatasetHeader && <p className="mono">{section.dataset}</p>}
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
          </div>
        );
      })}
    </section>
  );
}
