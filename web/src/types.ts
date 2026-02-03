export type RunParams = {
  csv_mode: "header" | "headerless";
  output_csv: string;
  text_col: string;
  text_col_index: number | null;
  group_col_index: number | null;
  model_name: string;
  batch_size: number;
  max_len: number;
  max_rows: number;
  metrics_port: number | null;
};

export type GroupedScoreRow = {
  batch_size: number;
  max_len: number;
  runs: number;
  processed: number;
  positive: number;
  negative: number;
  neutral: number;
  score_sum: number;
};
