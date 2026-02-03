import { ModelInfo, RunStatus } from "../api";
import { RunParams } from "../types";

type RunFormCardProps = {
  file: File | null;
  setFile: (file: File | null) => void;
  params: RunParams;
  setParams: (params: RunParams) => void;
  formError: string | null;
  formBusy: boolean;
  runStatus: RunStatus | null;
  models: ModelInfo[];
  modelMode: "list" | "custom";
  setModelMode: (mode: "list" | "custom") => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
};

export default function RunFormCard({
  file,
  setFile,
  params,
  setParams,
  formError,
  formBusy,
  runStatus,
  models,
  modelMode,
  setModelMode,
  onSubmit,
  onCancel,
}: RunFormCardProps) {
  return (
    <div className="card">
      <h2>Run a job</h2>
      <form className="form" onSubmit={onSubmit}>
        <label>
          CSV file
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label>
          Output CSV
          <input
            value={params.output_csv}
            onChange={(e) => setParams({ ...params, output_csv: e.target.value })}
          />
        </label>
        <div className="form-row">
          <label>
            CSV mode
            <select
              value={params.csv_mode}
              onChange={(e) =>
                setParams({
                  ...params,
                  csv_mode: e.target.value as "header" | "headerless",
                })
              }
            >
              <option value="header">Header</option>
              <option value="headerless">Headerless</option>
            </select>
          </label>
          {params.csv_mode === "headerless" ? (
            <label>
              Column index (0-based)
              <input
                type="number"
                value={params.text_col_index ?? ""}
                onChange={(e) =>
                  setParams({
                    ...params,
                    text_col_index:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          ) : (
            <label>
              Text column
              <input
                value={params.text_col}
                onChange={(e) => setParams({ ...params, text_col: e.target.value })}
              />
            </label>
          )}
        </div>
        <label>
          Group column index (optional)
          <input
            type="number"
            value={params.group_col_index ?? ""}
            onChange={(e) =>
              setParams({
                ...params,
                group_col_index:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="e.g., 0"
          />
        </label>
        <label>
          Model
          <select
            value={modelMode === "list" ? params.model_name : "__custom__"}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setModelMode("custom");
              } else {
                setModelMode("list");
                setParams({ ...params, model_name: e.target.value });
              }
            }}
          >
            {models.length === 0 && (
              <option value={params.model_name}>{params.model_name}</option>
            )}
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.id}
              </option>
            ))}
            <option value="__custom__">Custom...</option>
          </select>
        </label>
        {modelMode === "custom" && (
          <label>
            Custom model name
            <input
              value={params.model_name}
              onChange={(e) => setParams({ ...params, model_name: e.target.value })}
            />
          </label>
        )}
        <div className="form-row">
          <label>
            Batch size
            <input
              type="number"
              value={params.batch_size}
              onChange={(e) =>
                setParams({ ...params, batch_size: Number(e.target.value) || 1 })
              }
            />
          </label>
          <label>
            Max len
            <input
              type="number"
              value={params.max_len}
              onChange={(e) => setParams({ ...params, max_len: Number(e.target.value) || 1 })}
            />
          </label>
          <label>
            Max rows
            <input
              type="number"
              value={params.max_rows}
              onChange={(e) =>
                setParams({ ...params, max_rows: Number(e.target.value) || 0 })
              }
            />
          </label>
        </div>
        <label>
          Metrics port (optional)
          <input
            type="number"
            value={params.metrics_port ?? ""}
            onChange={(e) =>
              setParams({
                ...params,
                metrics_port:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </label>
        {formError && <p className="error">{formError}</p>}
        <div className="row">
          <button type="submit" disabled={formBusy || runStatus?.running}>
            {formBusy ? "Starting..." : runStatus?.running ? "Running" : "Run"}
          </button>
          <button type="button" className="secondary" onClick={onCancel} disabled={!runStatus?.running}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
