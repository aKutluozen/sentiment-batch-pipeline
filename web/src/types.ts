export type RunParams = {
  output_csv: string;
  text_col: string;
  model_name: string;
  batch_size: number;
  max_len: number;
  max_rows: string;
  metrics_port: string;
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
