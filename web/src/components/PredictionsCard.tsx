type PredictionsCardProps = {
  datasetFilter: string;
  predLimit: "all" | number;
  setPredLimit: (value: "all" | number) => void;
  predSort: "none" | "asc" | "desc";
  setPredSort: (value: "none" | "asc" | "desc") => void;
  predictions: Record<string, string>[];
  predictionKeys: string[];
  predictionsToShow: Record<string, string>[];
  sentimentClass: (labelValue: string) => string;
};

export default function PredictionsCard({
  datasetFilter,
  predLimit,
  setPredLimit,
  predSort,
  setPredSort,
  predictions,
  predictionKeys,
  predictionsToShow,
  sentimentClass,
}: PredictionsCardProps) {
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
      {predictions.length === 0 ? (
        <p className="muted">No predictions yet.</p>
      ) : (
        <div className="table table-scroll">
          <div className="row header">
            {predictionKeys.map((key) => (
              <span key={key}>{key}</span>
            ))}
          </div>
          {predictionsToShow.map((row, idx) => (
            <div className="row" key={`pred-${idx}`}>
              {predictionKeys.map((key, i) => {
                const value = row[key] ?? "";
                const label = String(row["label"] ?? "");
                const scoreNum = Number(row["score"] ?? 0);
                const scorePercent = Number.isFinite(scoreNum) ? Math.round(scoreNum * 100) : 0;
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
    </section>
  );
}
