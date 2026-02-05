from __future__ import annotations

import csv
import time
from typing import Any, Dict, List

from app.run_tracking import (
    RunStats, 
    write_live_metrics,
    build_live_metrics_payload
)
from app.summary import update_group_stats
from app.config import Settings

# What does this method do?
# Use the NLP pipeline created, along with the predict function
# Predict function is decoupled to allow easier testing and flexibility
# The predict function takes the pipeline and list of texts, returns predictions

def process_batch(
    batch_rows: List[Dict[str, str]],
    *,
    nlp,
    predict_fn,
    writer: csv.DictWriter,
    metrics,
    settings: Settings,
    stats: RunStats,
    text_col: str,
    headers: set[str],
    group_col: str | None,
    group_stats: Dict[str, Dict[str, float]],
    dataset_type: str,
    start: float,
) -> None:
    # Prepare texts (rows are already sanitized/validated)
    texts: List[str] = []
    valid_rows: List[Dict[str, str]] = batch_rows

    for r in valid_rows:
        texts.append((r.get(text_col) or "").strip())

    batch_start = time.time()
    try:
        # Get predictions
        predictions = predict_fn(nlp, texts)
        metrics.inc_processed(len(valid_rows))
        metrics.inc_batches()
    except Exception as e:
        # Report failure for all rows in the batch
        for r in valid_rows:
            out: Dict[str, Any] = {
                text_col: r.get(text_col, ""),
                "label": "",
                "score": "",
                "error": str(e),
            }
            writer.writerow(out)
        stats.failed += len(valid_rows)
        metrics.inc_failed(len(valid_rows))
        if len(stats.error_samples) < 5:
            stats.error_samples.append(str(e))
        metrics.inc_batches()
        return
    finally:
        # Always record batch duration
        metrics.observe_batch_duration(time.time() - batch_start)
        write_live_metrics(
            settings.run_live_path,
            build_live_metrics_payload(
                settings,
                status="running",
                text_col=text_col,
                stats=stats,
                runtime_s=round(time.time() - start, 3),
                dataset_type=dataset_type,
                group_col=group_col,
            ),
        )

    # Process predictions
    for r, prediction in zip(valid_rows, predictions):
        label = prediction.get("label", "")
        score = prediction.get("score", "")
        label_norm = (label or "").lower()
        try:
            score_val = float(score)
        except (TypeError, ValueError):
            score_val = 0.0
            
        # Update stats
        stats.score_sum += score_val
        if "pos" in label_norm:
            stats.positive += 1
        elif "neg" in label_norm:
            stats.negative += 1
        else:
            stats.neutral += 1
            
        # Write output row and update group stats too
        out = {
            text_col: r.get(text_col, ""),
            "label": label,
            "score": score,
            "error": "",
        }
        writer.writerow(out)

        if group_col and group_col in headers:
            group_value = (r.get(group_col) or "").strip() or "(unknown)"
            update_group_stats(group_stats, group_value, label, score_val)

    stats.processed += len(valid_rows)
