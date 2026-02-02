type PredictionsCardProps = {
  datasetFilter: string;
  predLimit: "all" | number;
  setPredLimit: (value: "all" | number) => void;
  predSort: "none" | "asc" | "desc";
  setPredSort: (value: "none" | "asc" | "desc") => void;
  sections: Array<{ dataset: string; rows: Record<string, string>[] }>;
  sentimentClass: (labelValue: string) => string;
};

export default function PredictionsCard({
  datasetFilter,
  predLimit,
  setPredLimit,
  predSort,
  setPredSort,
  sections,
  sentimentClass,
}: PredictionsCardProps) {
  const showDatasetHeader = datasetFilter === "all" && sections.length > 1;
  return (
    <section className="card">
      <div className="row">
        <h2>Predictions (latest)</h2>
        <span className="mono">{datasetFilter === "all" ? "All datasets" : datasetFilter}</span>
        <div className="control-group">
          <select
            value={predLimit}
            onChange={(e) => setPredLimit(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value="all">all</option>
          </select>
          <select value={predSort} onChange={(e) => setPredSort(e.target.value as typeof predSort)}>
            <option value="none">Original order</option>
            <option value="desc">Score: high → low</option>
            <option value="asc">Score: low → high</option>
          </select>
        </div>
      </div>
      {sections.length === 0 && <p className="muted">No predictions yet.</p>}
      {sections.map((section) => {
        const predictionKeys = section.rows.length > 0 ? Object.keys(section.rows[0]) : [];
        const sortedRows = [...section.rows];
        if (predSort !== "none") {
          sortedRows.sort((a, b) => {
            const aScore = Number(a.score ?? 0);
            const bScore = Number(b.score ?? 0);
            return predSort === "asc" ? aScore - bScore : bScore - aScore;
          });
        }
        const limitedRows = predLimit === "all" ? sortedRows : sortedRows.slice(0, predLimit);

        return (
          <div key={`predictions-${section.dataset}`}>
            {showDatasetHeader && <p className="mono">{section.dataset}</p>}
            {section.rows.length === 0 ? (
              <p className="muted">No predictions for this dataset.</p>
            ) : (
              <div className="table table-scroll">
                <div className="row header">
                  {predictionKeys.map((key) => (
                    <span key={`${section.dataset}-${key}`}>{key}</span>
                  ))}
                </div>
                {limitedRows.map((row, idx) => (
                  <div className="row" key={`pred-${section.dataset}-${idx}`}>
                    {predictionKeys.map((key, i) => {
                      const value = row[key] ?? "";
                      const label = String(row["label"] ?? "");
                      const scoreNum = Number(row["score"] ?? 0);
                      const scorePercent = Number.isFinite(scoreNum)
                        ? Math.round(scoreNum * 100)
                        : 0;
                      const scoreClass = sentimentClass(label);

                      if (key.toLowerCase() === "label") {
                        return (
                          <span key={`${idx}-${i}`} className="mini-sentiment">
                            <span className={scoreClass}>{value}</span>
                            <span className="mini-track">
                              <span
                                className={`mini-fill ${scoreClass}`}
                                style={{ width: `${scorePercent}%` }}
                              />
                            </span>
                          </span>
                        );
                      }
                      if (key.toLowerCase() === "score") {
                        return (
                          <span key={`${idx}-${i}`} className="score-cell">
                            <span className={scoreClass}>{value}</span>
                            <span className="score-bar">
                              <span
                                className={`score-fill ${scoreClass}`}
                                style={{ width: `${scorePercent}%` }}
                              />
                            </span>
                          </span>
                        );
                      }
                      return (
                        <span key={`${idx}-${i}`} className="mono">
                          {value}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
