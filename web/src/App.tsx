import { useEffect, useMemo, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
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
import RunComparisonTableCard from "./components/RunComparisonTableCard";
import RunFormCard from "./components/RunFormCard";
import RunHistoryCard from "./components/RunHistoryCard";
import RunLogsCard from "./components/RunLogsCard";
import SummaryCard from "./components/SummaryCard";
import { useLive } from "./hooks/useLive";
import { useModels } from "./hooks/useModels";
import { usePredictionsSummaries } from "./hooks/usePredictionsSummaries";
import { useRunStatus } from "./hooks/useRunStatus";
import { useRuns } from "./hooks/useRuns";
import { RunParams } from "./types";
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
  csv_mode: "header",
  output_csv: "output/predictions.csv",
  text_col: "Text",
  text_col_index: null,
  group_col_index: null,
  model_name: "distilbert-base-uncased-finetuned-sst-2-english",
  batch_size: 128,
  max_len: 256,
  max_rows: 500,
  metrics_port: null,
};

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
        if (typeof params.text_col_index === "number" && Number.isFinite(params.text_col_index)) {
          formData.append("text_col_index", String(params.text_col_index));
        }
      } else if (params.text_col.trim()) {
        formData.append("text_col", params.text_col.trim());
      }
      if (typeof params.group_col_index === "number" && Number.isFinite(params.group_col_index)) {
        formData.append("group_col_index", String(params.group_col_index));
      }
      if (params.model_name.trim()) {
        formData.append("model_name", params.model_name.trim());
      }
      formData.append("batch_size", String(params.batch_size));
      formData.append("max_len", String(params.max_len));
      if (params.max_rows > 0) {
        formData.append("max_rows", String(params.max_rows));
      }
      if (typeof params.metrics_port === "number" && Number.isFinite(params.metrics_port)) {
        formData.append("metrics_port", String(params.metrics_port));
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
      />

      <RunComparisonsCard
        datasetFilter={datasetFilter}
        filteredRuns={filteredRuns}
      />

      <RunComparisonTableCard filteredRuns={filteredRuns} />

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
