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

export type RunStartResponse = {
  status: string;
  input_csv: string;
  output_csv: string;
  pid: number;
};

export type PredictionRow = Record<string, string>;

export type RunStatus = {
  running: boolean;
  pid: number | null;
  log_tail: string;
  log_path: string | null;
};

export async function fetchRuns(query: string): Promise<RunRecord[]> {
  const res = await fetch(`/api/runs?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error("Failed to fetch runs");
  }
  const data = await res.json();
  return data.runs ?? [];
}

export async function startRun(formData: FormData): Promise<RunStartResponse> {
  const res = await fetch("/api/run", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to start run");
  }
  return res.json();
}

export async function fetchPredictions(path?: string): Promise<PredictionRow[]> {
  const url = path ? `/api/predictions?path=${encodeURIComponent(path)}` : "/api/predictions";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch predictions");
  }
  const data = await res.json();
  return data.rows ?? [];
}

export async function fetchRunStatus(): Promise<RunStatus> {
  const res = await fetch("/api/run/status");
  if (!res.ok) {
    throw new Error("Failed to fetch run status");
  }
  return res.json();
}

export async function cancelRun(): Promise<void> {
  const res = await fetch("/api/run/cancel", { method: "POST" });
  if (!res.ok) {
    throw new Error("Failed to cancel run");
  }
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
