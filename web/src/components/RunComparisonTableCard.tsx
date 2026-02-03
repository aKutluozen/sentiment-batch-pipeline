import { useMemo } from "react";
import { LiveSnapshot } from "../api";
import { GroupedScoreRow } from "../types";

type RunComparisonTableCardProps = {
  filteredRuns: LiveSnapshot[];
};

export default function RunComparisonTableCard({ filteredRuns }: RunComparisonTableCardProps) {
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

  if (groupedScoreRows.length === 0) {
    return null;
  }

  return (
    <section className="card">
      <div className="row">
        <h2>Batch & Max Len Summary</h2>
      </div>
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
    </section>
  );
}
