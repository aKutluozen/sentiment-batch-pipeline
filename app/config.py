# A default config that can be overridden with env vars

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

# Below are helper functions to read env vars with type conversion and defaults.
# We had many crashes before due to invalid env vars, so we do strict checking here.
def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if raw == "":
        return default
    try:
        return int(raw)
    except ValueError as e:
        raise ValueError(f"{name} must be an int, got: {raw!r}") from e


def _get_optional_int(name: str) -> int | None:
    raw = os.getenv(name, "").strip()
    if raw == "":
        return None
    try:
        return int(raw)
    except ValueError as e:
        raise ValueError(f"{name} must be an int, got: {raw!r}") from e


def _get_str(name: str, default: str) -> str:
    raw = os.getenv(name, "").strip()
    return raw if raw else default


# Freeze so that settings are immutable; helps avoid accidental changes.
@dataclass(frozen=True)
class Settings:
    input_csv: Path
    output_csv: Path
    run_history_path: Path
    run_live_path: Path
    csv_mode: str
    text_col: str
    text_col_index: int | None
    group_col_index: int | None
    max_rows: int | None
    model_name: str
    batch_size: int
    max_len: int
    metrics_port: int | None


def load_settings() -> Settings:
    input_csv = Path(_get_str("INPUT_CSV", "data/input.csv"))
    output_csv = Path(_get_str("OUTPUT_CSV", "output/predictions.csv"))
    run_history_path = Path(_get_str("RUN_HISTORY_PATH", "output/run_history.jsonl"))
    run_live_path = Path(_get_str("RUN_LIVE_PATH", "output/live_metrics.json"))

    csv_mode = _get_str("CSV_MODE", "header").lower()
    if csv_mode not in {"header", "headerless"}:
        raise ValueError("CSV_MODE must be one of: header, headerless")

    text_col = _get_str("TEXT_COL", "Text")
    text_col_index = _get_optional_int("TEXT_COL_INDEX")

    if csv_mode == "headerless" and text_col_index is None:
        raise ValueError("CSV_MODE=headerless requires TEXT_COL_INDEX")

    if text_col_index is not None and text_col_index < 0:
        raise ValueError("TEXT_COL_INDEX must be >= 0")

    group_col_index = _get_optional_int("GROUP_COL_INDEX")
    if group_col_index is not None and group_col_index < 0:
        raise ValueError("GROUP_COL_INDEX must be >= 0")
    model_name = _get_str(
        "MODEL_NAME",
        "distilbert-base-uncased-finetuned-sst-2-english",
    )

    batch_size = _get_int("BATCH_SIZE", 32)
    if batch_size <= 0:
        raise ValueError("BATCH_SIZE must be > 0")

    max_len = _get_int("MAX_LEN", 256)
    if max_len <= 0:
        raise ValueError("MAX_LEN must be > 0")
    
    max_rows = _get_optional_int("MAX_ROWS")
    if max_rows is not None and max_rows <= 0:
        raise ValueError("MAX_ROWS must be > 0")

    metrics_port = _get_optional_int("METRICS_PORT")
    if metrics_port is not None and not (1 <= metrics_port <= 65535):
        raise ValueError("METRICS_PORT must be in 1..65535")

    return Settings(
        input_csv=input_csv,
        output_csv=output_csv,
        run_history_path=run_history_path,
        run_live_path=run_live_path,
        csv_mode=csv_mode,
        text_col=text_col,
        text_col_index=text_col_index,
        group_col_index=group_col_index,
        max_rows=max_rows,
        model_name=model_name,
        batch_size=batch_size,
        max_len=max_len,
        metrics_port=metrics_port,
    )
