import { useMemo } from "react";
import { ChartData, ChartOptions } from "chart.js";
import { Bar, Scatter } from "react-chartjs-2";
import { LiveSnapshot } from "../api";

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
            <h3>Batch Size vs Max Len</h3>
            <Scatter data={scatterData} options={scatterOptions} />
          </div>
          <div className="chart">
            <h3>Sentiment Share</h3>
            <Bar data={scoreDistributionData} options={scoreDistributionOptions} />
          </div>
        </div>
      )}
    </section>
  );
}
