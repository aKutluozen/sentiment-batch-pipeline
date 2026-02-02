import { useEffect, useMemo, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartData,
  ChartOptions,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { cancelRun, startRun } from "./api";
import HeaderBar from "./components/HeaderBar";
import DatasetFilterCard from "./components/DatasetFilterCard";
import PredictionsCard from "./components/PredictionsCard";
import RecentRunsCard from "./components/RecentRunsCard";
import RunComparisonsCard from "./components/RunComparisonsCard";
import RunFormCard from "./components/RunFormCard";
import RunHistoryCard from "./components/RunHistoryCard";
import RunLogsCard from "./components/RunLogsCard";
import SummaryCard from "./components/SummaryCard";
import { useLive } from "./hooks/useLive";
import { useModels } from "./hooks/useModels";
import { usePredictionsSummaries } from "./hooks/usePredictionsSummaries";
import { useRunStatus } from "./hooks/useRunStatus";
import { useRuns } from "./hooks/useRuns";
import { GroupedScoreRow, RunParams } from "./types";
import { formatShortTimestamp, sentimentClass } from "./utils/appUtils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const defaultParams: RunParams = {
  csv_mode: "auto",
  output_csv: "output/predictions.csv",
  text_col: "Text",
  text_col_index: "",
  model_name: "distilbert-base-uncased-finetuned-sst-2-english",
  batch_size: 32,
  max_len: 256,
  max_rows: "",
  metrics_port: "",
};

const chartTextColor = "#9aa1d8";
const chartGridColor = "rgba(60, 66, 130, 0.25)";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [params, setParams] = useState<RunParams>(defaultParams);
  const [modelMode, setModelMode] = useState<"list" | "custom">("list");
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [outputCsvPath, setOutputCsvPath] = useState(defaultParams.output_csv);
  const [recentLimit, setRecentLimit] = useState<"all" | number>(25);
  const [predLimit, setPredLimit] = useState<"all" | number>(25);
  const [predSort, setPredSort] = useState<"none" | "asc" | "desc">("none");
  const [summaryLimit, setSummaryLimit] = useState<"all" | number>(10);
  const [datasetFilter, setDatasetFilter] = useState("all");

  const models = useModels();
  const live = useLive();
  const { runStatus, refresh: refreshRunStatus } = useRunStatus();
  const { runs, loading, error, refresh } = useRuns(query);

  useEffect(() => {
    if (live?.output_csv) {
      setOutputCsvPath(live.output_csv);
    }
  }, [live?.output_csv]);

  const latestRunsByDataset = useMemo(() => {
    const byDataset = new Map<string, LiveSnapshot>();
    runs.forEach((run) => {
      const dataset = run.dataset_type ?? "unknown";
      const existing = byDataset.get(dataset);
      if (!existing) {
        byDataset.set(dataset, run);
        return;
      }
      const existingTs = new Date(existing.timestamp).getTime();
      const currentTs = new Date(run.timestamp).getTime();
      if (Number.isNaN(existingTs) || currentTs > existingTs) {
        byDataset.set(dataset, run);
      }
    });
    return Array.from(byDataset.entries()).map(([dataset, run]) => ({ dataset, run }));
  }, [runs]);

  const datasetOutputs = useMemo(() => {
    if (datasetFilter === "all") {
      return latestRunsByDataset
        .filter(({ run }) => Boolean(run.output_csv))
        .map(({ dataset, run }) => ({ dataset, output_csv: run.output_csv }));
    }
    const match = latestRunsByDataset.find(({ dataset }) => dataset === datasetFilter);
    if (match?.run.output_csv) {
      return [{ dataset: datasetFilter, output_csv: match.run.output_csv }];
    }
    return [] as Array<{ dataset: string; output_csv: string }>;
  }, [datasetFilter, latestRunsByDataset]);

  const { predictionsByDataset, summariesByDataset } = usePredictionsSummaries(datasetOutputs);

  useEffect(() => {
    if (!live) {
      return;
    }
    if (live.status === "complete" || live.status === "failed" || live.status === "cancelled") {
      refresh();
    }
  }, [live, query]);

  const datasetOptions = useMemo(() => {
    const options = new Set<string>();
    runs.forEach((run) => {
      if (run.dataset_type) {
        options.add(run.dataset_type);
      }
    });
    return ["all", ...Array.from(options).sort()];
  }, [runs]);

  useEffect(() => {
    if (datasetFilter !== "all" && !datasetOptions.includes(datasetFilter)) {
      setDatasetFilter("all");
    }
  }, [datasetFilter, datasetOptions]);

  const filteredRuns = useMemo(() => {
    if (datasetFilter === "all") {
      return runs;
    }
    return runs.filter((run) => run.dataset_type === datasetFilter);
  }, [runs, datasetFilter]);


  const runtimeData: ChartData<"line"> = useMemo(() => {
    const labels = filteredRuns.map((run) => run.timestamp);
    return {
      labels,
      datasets: [
        {
          label: "Runtime (s)",
          data: filteredRuns.map((run) => run.runtime_s),
          borderColor: "#4c6dff",
          backgroundColor: "rgba(76, 109, 255, 0.35)",
          tension: 0.3,
          fill: true,
        },
      ],
    };
  }, [filteredRuns]);

  const processedData: ChartData<"line"> = useMemo(() => {
    const labels = filteredRuns.map((run) => run.timestamp);
    return {
      labels,
      datasets: [
        {
          label: "Processed rows",
          data: filteredRuns.map((run) => run.processed),
          borderColor: "#48d07a",
          backgroundColor: "rgba(72, 208, 122, 0.25)",
          tension: 0.3,
          fill: true,
        },
      ],
    };
  }, [filteredRuns]);

  const runChartOptions: ChartOptions<"line"> = useMemo(
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
        },
      },
    }),
    []
  );

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
              return `batch ${raw.y}, max len ${raw.x}, ${raw.throughput.toFixed(1)} rows/s`;
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
          backgroundColor: ["rgba(72, 208, 122, 0.7)", "rgba(255, 107, 107, 0.7)", "rgba(140, 148, 255, 0.7)"],
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


  const handleRunSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!file) {
      setFormError("Please select a CSV file.");
      return;
    }
    setFormBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const outputOverride = params.output_csv.trim();
      if (outputOverride && outputOverride !== defaultParams.output_csv) {
        formData.append("output_csv", outputOverride);
      }
      formData.append("csv_mode", params.csv_mode);
      if (params.csv_mode === "headerless") {
        if (params.text_col_index.trim()) {
          formData.append("text_col_index", params.text_col_index.trim());
        }
      } else if (params.text_col.trim()) {
        formData.append("text_col", params.text_col.trim());
      }
      if (params.model_name.trim()) {
        formData.append("model_name", params.model_name.trim());
      }
      formData.append("batch_size", String(params.batch_size));
      formData.append("max_len", String(params.max_len));
      if (params.max_rows.trim()) {
        formData.append("max_rows", params.max_rows.trim());
      }
      if (params.metrics_port.trim()) {
        formData.append("metrics_port", params.metrics_port.trim());
      }

      const response = await startRun(formData);
      setOutputCsvPath(response.output_csv);
      await refreshRunStatus();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setFormBusy(false);
    }
  };


  return (
    <div className="page">
      <HeaderBar live={live} />

      <section className="grid">
        <RunFormCard
          file={file}
          setFile={setFile}
          params={params}
          setParams={setParams}
          formError={formError}
          formBusy={formBusy}
          runStatus={runStatus}
          models={models}
          modelMode={modelMode}
          setModelMode={setModelMode}
          onSubmit={handleRunSubmit}
          onCancel={() => cancelRun().catch(() => undefined)}
        />
        <RunLogsCard runStatus={runStatus} live={live} className="card--wide" />
      </section>

      <DatasetFilterCard
        datasetFilter={datasetFilter}
        setDatasetFilter={setDatasetFilter}
        datasetOptions={datasetOptions}
      />

      <RunHistoryCard
        query={query}
        setQuery={setQuery}
        loading={loading}
        error={error}
        filteredRuns={filteredRuns}
        runtimeData={runtimeData}
        processedData={processedData}
        runChartOptions={runChartOptions}
      />

      <RunComparisonsCard
        datasetFilter={datasetFilter}
        comparisonRuns={comparisonRuns}
        scatterData={scatterData}
        scatterOptions={scatterOptions}
        maxLens={maxLens}
        batchSizes={batchSizes}
        heatmapMatrix={heatmapMatrix}
        heatmapScale={heatmapScale}
        scoreDistributionData={scoreDistributionData}
        scoreDistributionOptions={scoreDistributionOptions}
        groupedScoreRows={groupedScoreRows}
      />

      <RecentRunsCard
        recentLimit={recentLimit}
        setRecentLimit={setRecentLimit}
        filteredRuns={filteredRuns}
        formatShortTimestamp={formatShortTimestamp}
      />

      <PredictionsCard
        datasetFilter={datasetFilter}
        predLimit={predLimit}
        setPredLimit={setPredLimit}
        predSort={predSort}
        setPredSort={setPredSort}
        sections={predictionsByDataset}
        sentimentClass={sentimentClass}
      />

      <SummaryCard
        datasetFilter={datasetFilter}
        summaryLimit={summaryLimit}
        setSummaryLimit={setSummaryLimit}
        sections={summariesByDataset}
      />
    </div>
  );
}
