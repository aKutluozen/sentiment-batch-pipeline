from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

from app.helpers import write_live_metrics

logger = logging.getLogger("batch_infer")


@dataclass
class RunStats:
    processed: int = 0
    failed: int = 0
    rows_seen: int = 0
    score_sum: float = 0.0
    positive: int = 0
    negative: int = 0
    neutral: int = 0


def write_live_metrics_safe(path: Path, payload: Dict[str, Any]) -> None:
    try:
        write_live_metrics(path, payload)
    except Exception:
        logger.exception("Failed to write live metrics", extra={"run_live_path": str(path)})
