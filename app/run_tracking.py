from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
import time
from typing import Any, Dict
from app.config import Settings

logger = logging.getLogger("batch_infer")


@dataclass
class RunStats:
    processed: int = 0
    failed: int = 0
    rows_seen: int = 0
    skipped: int = 0
    invalid: int = 0
    error_samples: list[str] = field(default_factory=list)
    score_sum: float = 0.0
    positive: int = 0
    negative: int = 0
    neutral: int = 0


def append_run_history(path: Path, record: Dict[str, Any]) -> None:
    ensure_parent_dir(path)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def write_live_metrics(path: Path, record: Dict[str, Any]) -> None:
    try:
        ensure_parent_dir(path)
        with path.open("w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False)
    except Exception:
        logger.exception("Failed to write live metrics",
                         extra={"run_live_path": str(path)})


def _base_payload(
    settings: Settings,
    text_col: str,
    stats: RunStats,
    runtime_s: float,
) -> Dict[str, Any]:
    return {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "input_csv": str(settings.input_csv),
        "output_csv": str(settings.output_csv),
        "text_col": text_col,
        "model_name": settings.model_name,
        "batch_size": settings.batch_size,
        "max_len": settings.max_len,
        "max_rows": settings.max_rows,
        "metrics_port": settings.metrics_port,
        "rows_seen": stats.rows_seen,
        "processed": stats.processed,
        "failed": stats.failed,
        "skipped": stats.skipped,
        "invalid": stats.invalid,
        "error_samples": stats.error_samples,
        "avg_score": round(stats.score_sum / stats.processed, 6) if stats.processed else 0,
        "positive": stats.positive,
        "negative": stats.negative,
        "neutral": stats.neutral,
        "runtime_s": runtime_s,
    }


def build_live_metrics_payload(
    settings: Settings,
    status: str,
    text_col: str,
    stats: RunStats,
    runtime_s: float,
    dataset_type: str | None = None,
    group_col: str | None = None,
) -> Dict[str, Any]:
    payload = _base_payload(settings, text_col, stats, runtime_s)
    payload["status"] = status
    if dataset_type is not None:
        payload["dataset_type"] = dataset_type
    if group_col is not None:
        payload["group_col"] = group_col
    return payload


def build_run_history_payload(
    settings: Settings,
    text_col: str,
    stats: RunStats,
    runtime_s: float,
    dataset_type: str | None,
    group_col: str | None,
) -> Dict[str, Any]:
    payload = _base_payload(settings, text_col, stats, runtime_s)
    payload["dataset_type"] = dataset_type
    payload["group_col"] = group_col
    return payload


def ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
