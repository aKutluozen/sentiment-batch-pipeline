from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict

from app.config import Settings


def ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def append_run_history(path: Path, record: Dict[str, Any]) -> None:
    ensure_parent_dir(path)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def write_live_metrics(path: Path, record: Dict[str, Any]) -> None:
    ensure_parent_dir(path)
    with path.open("w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False)


def build_live_metrics_payload(
    s: Settings,
    status: str,
    text_col: str,
    rows_seen: int,
    processed: int,
    failed: int,
    score_sum: float,
    positive: int,
    negative: int,
    neutral: int,
    runtime_s: float,
    dataset_type: str | None = None,
    group_col: str | None = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "status": status,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "input_csv": str(s.input_csv),
        "output_csv": str(s.output_csv),
        "text_col": text_col,
        "model_name": s.model_name,
        "batch_size": s.batch_size,
        "max_len": s.max_len,
        "max_rows": s.max_rows,
        "metrics_port": s.metrics_port,
        "rows_seen": rows_seen,
        "processed": processed,
        "failed": failed,
        "avg_score": round(score_sum / processed, 6) if processed else 0,
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
        "runtime_s": runtime_s,
    }
    if dataset_type is not None:
        payload["dataset_type"] = dataset_type
    if group_col is not None:
        payload["group_col"] = group_col
    return payload


def build_run_history_payload(
    s: Settings,
    text_col: str,
    rows_seen: int,
    processed: int,
    failed: int,
    score_sum: float,
    positive: int,
    negative: int,
    neutral: int,
    runtime_s: float,
    dataset_type: str | None,
    group_col: str | None,
) -> Dict[str, Any]:
    return {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "input_csv": str(s.input_csv),
        "output_csv": str(s.output_csv),
        "text_col": text_col,
        "model_name": s.model_name,
        "batch_size": s.batch_size,
        "max_len": s.max_len,
        "max_rows": s.max_rows,
        "metrics_port": s.metrics_port,
        "dataset_type": dataset_type,
        "group_col": group_col,
        "rows_seen": rows_seen,
        "processed": processed,
        "failed": failed,
        "avg_score": round(score_sum / processed, 6) if processed else 0,
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
        "runtime_s": runtime_s,
    }
