import { CSSProperties, useMemo } from "react";
import { ChartData, ChartOptions } from "chart.js";
import { Bar, Scatter } from "react-chartjs-2";
import { LiveSnapshot } from "../api";
import { GroupedScoreRow } from "../types";

type RunComparisonsCardProps = {
  datasetFilter: string;
  filteredRuns: LiveSnapshot[];
};

const chartTextColor = "#9aa1d8";
const chartGridColor = "rgba(60, 66, 130, 0.25)";

export default function RunComparisonsCard({
  datasetFilter,
  filteredRuns,
}: RunComparisonsCardProps) {
  const comparisonRuns = useMemo(() => {
    return filteredRuns.filter((run) => run.runtime_s && run.runtime_s > 0);
  }, [filteredRuns]);

  const scatterData: ChartData<"scatter"> = useMemo(() => {
    return {
      datasets: [
        {
          label: "Runs",
          data: comparisonRuns.map((run) => ({
            x: run.max_len,
            y: run.batch_size,
            throughput: run.runtime_s ? run.processed / run.runtime_s : 0,
          })),
          backgroundColor: "rgba(76, 109, 255, 0.7)",
        },
      ],
    };
  }, [comparisonRuns]);

  const scatterOptions: ChartOptions<"scatter"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const raw = ctx.raw as { x: number; y: number; throughput: number };
              return `batch ${raw.y}, max len ${raw.x}, throughput ${raw.throughput.toFixed(1)} rows/s`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Max len", color: chartTextColor },
          ticks: { color: chartTextColor },
          grid: { color: chartGridColor },
        },
        y: {
          title: { display: true, text: "Batch size", color: chartTextColor },
          ticks: { color: chartTextColor },
          grid: { color: chartGridColor },
        },
      },
    }),
    []
  );

  const maxLens = useMemo(() => {
    const values = new Set<number>();
    comparisonRuns.forEach((run) => values.add(run.max_len));
    return Array.from(values).sort((a, b) => a - b);
  }, [comparisonRuns]);

  const batchSizes = useMemo(() => {
    const values = new Set<number>();
    comparisonRuns.forEach((run) => values.add(run.batch_size));
    return Array.from(values).sort((a, b) => a - b);
  }, [comparisonRuns]);

  const heatmapMatrix = useMemo(() => {
    return batchSizes.map((batchSize) =>
      maxLens.map((maxLen) => {
        const candidates = comparisonRuns.filter(
          (run) => run.batch_size === batchSize && run.max_len === maxLen && run.runtime_s
        );
        if (candidates.length === 0) {
          return null;
        }
        const throughput =
          candidates.reduce(
            (sum, run) => sum + run.processed / (run.runtime_s || 1),
            0
          ) / candidates.length;
        return throughput;
      })
    );
  }, [batchSizes, maxLens, comparisonRuns]);

  const heatmapScale = useMemo(() => {
    const flat = heatmapMatrix.flat().filter((value): value is number => value !== null);
    if (flat.length === 0) {
      return { min: 0, max: 0 };
    }
    return {
      min: Math.min(...flat),
      max: Math.max(...flat),
    };
  }, [heatmapMatrix]);

  const groupedScoreRows = useMemo(() => {
    const grouped = new Map<string, GroupedScoreRow>();
    filteredRuns.forEach((run) => {
      const key = `${run.batch_size}-${run.max_len}`;
      const processed = run.processed ?? 0;
      const positive = run.positive ?? 0;
      const negative = run.negative ?? 0;
      const neutral = run.neutral ?? 0;
      const scoreSum = (run.avg_score ?? 0) * processed;
      const current = grouped.get(key) ?? {
        batch_size: run.batch_size,
        max_len: run.max_len,
        runs: 0,
        processed: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        score_sum: 0,
      };
      current.runs += 1;
      current.processed += processed;
      current.positive += positive;
      current.negative += negative;
      current.neutral += neutral;
      current.score_sum += scoreSum;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort(
      (a, b) => a.batch_size - b.batch_size || a.max_len - b.max_len
    );
  }, [filteredRuns]);

  const scoreTotals = useMemo(() => {
    return filteredRuns.reduce(
      (acc, run) => {
        acc.processed += run.processed ?? 0;
        acc.positive += run.positive ?? 0;
        acc.negative += run.negative ?? 0;
        acc.neutral += run.neutral ?? 0;
        return acc;
      },
      { processed: 0, positive: 0, negative: 0, neutral: 0 }
    );
  }, [filteredRuns]);

  const scoreDistributionData: ChartData<"bar"> = useMemo(() => {
    const total = scoreTotals.processed || 1;
    return {
      labels: ["Positive", "Negative", "Neutral"],
      datasets: [
        {
          label: "Share (%)",
          data: [
            (scoreTotals.positive / total) * 100,
            (scoreTotals.negative / total) * 100,
            (scoreTotals.neutral / total) * 100,
          ],
          backgroundColor: [
            "rgba(72, 208, 122, 0.7)",
            "rgba(255, 107, 107, 0.7)",
            "rgba(140, 148, 255, 0.7)",
          ],
        },
      ],
    };
  }, [scoreTotals]);

  const scoreDistributionOptions: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: chartTextColor },
          grid: { color: chartGridColor },
        },
        y: {
          ticks: { color: chartTextColor },
          grid: { color: chartGridColor },
          suggestedMax: 100,
        },
      },
    }),
    []
  );
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
