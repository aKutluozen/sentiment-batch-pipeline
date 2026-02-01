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
    text_col: str
    id_col: str | None
    max_rows: int | None
    model_name: str
    batch_size: int
    max_len: int
    metrics_port: int | None


def load_settings() -> Settings:
    input_csv = Path(_get_str("INPUT_CSV", "data/input.csv"))
    output_csv = Path(_get_str("OUTPUT_CSV", "output/predictions.csv"))

    text_col = _get_str("TEXT_COL", "Text")

    # Optional: empty means "no id column"
    id_col_raw = os.getenv("ID_COL", "").strip()
    id_col = id_col_raw if id_col_raw else None

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
        text_col=text_col,
        id_col=id_col,
        max_rows=max_rows,
        model_name=model_name,
        batch_size=batch_size,
        max_len=max_len,
        metrics_port=metrics_port,
    )
