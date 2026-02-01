from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


def _load_runs(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Run history not found: {path}")
    runs: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            runs.append(json.loads(line))
    if not runs:
        raise ValueError(f"No runs found in: {path}")
    return runs


def main() -> int:
    parser = argparse.ArgumentParser(description="Visualize run history from JSONL")
    parser.add_argument("--history", default="output/run_history.jsonl", help="Path to run history JSONL")
    parser.add_argument("--out", default="output/run_history.png", help="Output image path")
    args = parser.parse_args()

    runs = _load_runs(Path(args.history))

    import pandas as pd
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    df = pd.DataFrame(runs)
    df["run_index"] = range(1, len(df) + 1)

    fig, axes = plt.subplots(2, 1, figsize=(10, 7), sharex=True)

    axes[0].plot(df["run_index"], df["runtime_s"], marker="o", label="runtime_s")
    axes[0].set_ylabel("Seconds")
    axes[0].set_title("Runtime per run")
    axes[0].grid(True, alpha=0.3)

    axes[1].plot(df["run_index"], df["processed"], marker="o", label="processed")
    axes[1].plot(df["run_index"], df["failed"], marker="o", label="failed")
    axes[1].set_ylabel("Records")
    axes[1].set_title("Processed vs Failed per run")
    axes[1].set_xlabel("Run index")
    axes[1].grid(True, alpha=0.3)

    fig.tight_layout()
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path)
    print(f"Saved plot: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
