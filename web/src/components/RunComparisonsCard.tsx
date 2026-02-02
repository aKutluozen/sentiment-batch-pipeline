import { CSSProperties } from "react";
import { ChartData, ChartOptions } from "chart.js";
import { Bar, Scatter } from "react-chartjs-2";
import { GroupedScoreRow } from "../types";

type RunComparisonsCardProps = {
  datasetFilter: string;
  comparisonRuns: unknown[];
  scatterData: ChartData<"scatter">;
  scatterOptions: ChartOptions<"scatter">;
  maxLens: number[];
  batchSizes: number[];
  heatmapMatrix: Array<Array<number | null>>;
  heatmapScale: { min: number; max: number };
  scoreDistributionData: ChartData<"bar">;
  scoreDistributionOptions: ChartOptions<"bar">;
  groupedScoreRows: GroupedScoreRow[];
};

export default function RunComparisonsCard({
  datasetFilter,
  comparisonRuns,
  scatterData,
  scatterOptions,
  maxLens,
  batchSizes,
  heatmapMatrix,
  heatmapScale,
  scoreDistributionData,
  scoreDistributionOptions,
  groupedScoreRows,
}: RunComparisonsCardProps) {
  return (
    <section className="card">
      <div className="row">
        <h2>Run comparisons</h2>
        <span className="mono">{datasetFilter === "all" ? "All datasets" : datasetFilter}</span>
      </div>
      {comparisonRuns.length === 0 ? (
        <p className="muted">Run a few jobs to compare batch size vs max length.</p>
      ) : (
        <div className="charts">
          <div className="chart">
            <Scatter data={scatterData} options={scatterOptions} />
          </div>
          <div className="chart">
            <div
              className="heatmap"
              style={{ "--heatmap-cols": maxLens.length + 1 } as CSSProperties}
            >
              <div className="heatmap-row heatmap-header">
                <span className="heatmap-label">Batch \ Max len</span>
                {maxLens.map((maxLen) => (
                  <span key={`maxlen-${maxLen}`} className="heatmap-label">
                    {maxLen}
                  </span>
                ))}
              </div>
              {batchSizes.map((batchSize, rowIndex) => (
                <div className="heatmap-row" key={`batch-${batchSize}`}>
                  <span className="heatmap-label">{batchSize}</span>
                  {maxLens.map((maxLen, colIndex) => {
                    const value = heatmapMatrix[rowIndex]?.[colIndex] ?? null;
                    const normalized =
                      value === null || heatmapScale.max === heatmapScale.min
                        ? 0
                        : (value - heatmapScale.min) / (heatmapScale.max - heatmapScale.min);
                    const alpha = 0.15 + normalized * 0.85;
                    return (
                      <span
                        key={`cell-${batchSize}-${maxLen}`}
                        className="heatmap-cell"
                        style={{
                          background: value === null
                            ? "rgba(255,255,255,0.04)"
                            : `rgba(76, 109, 255, ${alpha})`,
                        }}
                        title={
                          value === null ? "No runs" : `Throughput: ${value.toFixed(2)} rows/s`
                        }
                      >
                        {value === null ? "—" : value.toFixed(1)}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="chart">
            <Bar data={scoreDistributionData} options={scoreDistributionOptions} />
          </div>
        </div>
      )}
      {groupedScoreRows.length > 0 && (
        <div className="table comparison-table">
          <div className="row header">
            <span>Batch</span>
            <span>Max len</span>
            <span>Runs</span>
            <span>Avg score</span>
            <span>Positive %</span>
            <span>Negative %</span>
            <span>Neutral %</span>
          </div>
          {groupedScoreRows.map((row) => {
            const avgScore = row.processed ? (row.score_sum / row.processed) * 100 : 0;
            const positiveRate = row.processed ? (row.positive / row.processed) * 100 : 0;
            const negativeRate = row.processed ? (row.negative / row.processed) * 100 : 0;
            const neutralRate = row.processed ? (row.neutral / row.processed) * 100 : 0;
            return (
              <div className="row" key={`${row.batch_size}-${row.max_len}`}>
                <span>{row.batch_size}</span>
                <span>{row.max_len}</span>
                <span>{row.runs}</span>
                <span className="text-average">{avgScore.toFixed(1)}%</span>
                <span className="text-positive">{positiveRate.toFixed(1)}%</span>
                <span className="text-negative">{negativeRate.toFixed(1)}%</span>
                <span className="muted">{neutralRate.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
