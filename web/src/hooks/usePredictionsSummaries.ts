import { useEffect, useState } from "react";

import { fetchPredictions, fetchSummary, GroupSummary } from "../api";
import { buildSummaryPath } from "../utils/appUtils";

export const usePredictionsSummaries = (
  datasetOutputs: Array<{ dataset: string; output_csv: string }>
) => {
  const [predictionsByDataset, setPredictionsByDataset] = useState<
    Array<{ dataset: string; rows: Record<string, string>[] }>
  >([]);
  const [summariesByDataset, setSummariesByDataset] = useState<
    Array<{ dataset: string; summary: GroupSummary | null }>
  >([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (datasetOutputs.length === 0) {
        if (active) {
          setPredictionsByDataset([]);
          setSummariesByDataset([]);
        }
        return;
      }

      const results = await Promise.all(
        datasetOutputs.map(async ({ dataset, output_csv }) => {
          const summaryTarget = buildSummaryPath(output_csv);
          const [rows, summaryData] = await Promise.all([
            fetchPredictions(output_csv).catch(() => []),
            fetchSummary(summaryTarget).catch(() => null),
          ]);
          return { dataset, rows, summary: summaryData };
        })
      );

      if (!active) {
        return;
      }
      setPredictionsByDataset(results.map(({ dataset, rows }) => ({ dataset, rows })));
      setSummariesByDataset(results.map(({ dataset, summary }) => ({ dataset, summary })));
    };

    load().catch(() => {
      if (!active) {
        return;
      }
      setPredictionsByDataset([]);
      setSummariesByDataset([]);
    });

    return () => {
      active = false;
    };
  }, [datasetOutputs]);

  return { predictionsByDataset, summariesByDataset };
};
