export type LiveSnapshot = {
  status: "running" | "complete" | "idle";
  timestamp: string;
  input_csv: string;
  output_csv: string;
  text_col: string;
  id_col: string | null;
  model_name: string;
  batch_size: number;
  max_len: number;
  max_rows: number | null;
  metrics_port: number | null;
  rows_seen: number;
  processed: number;
  failed: number;
  runtime_s: number;
};

export type RunRecord = LiveSnapshot;

export async function fetchRuns(query: string): Promise<RunRecord[]> {
  const res = await fetch(`/api/runs?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error("Failed to fetch runs");
  }
  const data = await res.json();
  return data.runs ?? [];
}

export function subscribeLive(onMessage: (live: LiveSnapshot | null) => void) {
  const source = new EventSource("/api/live/stream");
  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      onMessage(payload.live ?? null);
    } catch {
      onMessage(null);
    }
  };
  source.onerror = () => {
    source.close();
  };
  return source;
}
