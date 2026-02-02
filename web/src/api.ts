export type LiveSnapshot = {
  status: "running" | "complete" | "idle" | "starting" | "cancelled" | "failed";
  timestamp: string;
  input_csv: string;
  output_csv: string;
  text_col: string;
  model_name: string;
  batch_size: number;
  max_len: number;
  max_rows: number | null;
  metrics_port: number | null;
  dataset_type?: string;
  rows_seen: number;
  processed: number;
  failed: number;
  avg_score?: number;
  positive?: number;
  negative?: number;
  neutral?: number;
  runtime_s: number;
};

export type RunRecord = LiveSnapshot;

export type RunStartResponse = {
  status: string;
  input_csv: string;
  output_csv: string;
  summary_path?: string;
  pid: number;
};

export type PredictionRow = Record<string, string>;

export type GroupSummary = {
  dataset_type: string;
  group_col: string | null;
  groups: Array<{
    group: string;
    total: number;
    positive: number;
    negative: number;
    avg_score: number;
  }>;
};

export type ModelInfo = {
  id: string;
  likes: number;
  downloads: number;
};

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

export async function fetchPredictions(path?: string, limit?: number): Promise<PredictionRow[]> {
  const params = new URLSearchParams();
  if (path) {
    params.set("path", path);
  }
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }
  const url = params.toString() ? `/api/predictions?${params.toString()}` : "/api/predictions";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch predictions");
  }
  const data = await res.json();
  return data.rows ?? [];
}

export async function fetchSummary(path?: string): Promise<GroupSummary | null> {
  const url = path ? `/api/summary?path=${encodeURIComponent(path)}` : "/api/summary";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch summary");
  }
  const data = await res.json();
  return data.summary ?? null;
}

export async function fetchRunStatus(): Promise<RunStatus> {
  const res = await fetch("/api/run/status");
  if (!res.ok) {
    throw new Error("Failed to fetch run status");
  }
  return res.json();
}

export async function fetchModels(): Promise<ModelInfo[]> {
  const res = await fetch("/api/models");
  if (!res.ok) {
    throw new Error("Failed to fetch models");
  }
  const data = await res.json();
  return data.models ?? [];
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
