from __future__ import annotations

import csv
import time
from typing import Any, Dict, List

from app.helpers import build_live_metrics_payload
from app.run_tracking import RunStats, write_live_metrics_safe
from app.summary import update_group_stats


def flush_batch(
    batch_rows: List[Dict[str, str]],
    *,
    nlp,
    predict_fn,
    writer: csv.DictWriter,
    metrics,
    s,
    stats: RunStats,
    text_col: str,
    id_col: str | None,
    headers: set[str],
    group_col: str | None,
    group_stats: Dict[str, Dict[str, float]],
    dataset_type: str,
    start: float,
) -> None:
    texts: List[str] = []
    for r in batch_rows:
        t = (r.get(text_col) or "").strip()
        texts.append(t)

    batch_start = time.time()
    try:
        preds = predict_fn(nlp, texts)
        metrics.inc_processed(len(batch_rows))
        metrics.inc_batches()

    except Exception as e:
        for r in batch_rows:
            out: Dict[str, Any] = {
                text_col: r.get(text_col, ""),
                "label": "",
                "score": "",
                "error": str(e),
            }
            if id_col:
                out[id_col] = r.get(id_col, "")
            writer.writerow(out)
        stats.failed += len(batch_rows)
        metrics.inc_failed(len(batch_rows))
        metrics.inc_batches()
        return
    finally:
        metrics.observe_batch_duration(time.time() - batch_start)
        write_live_metrics_safe(
            s.run_live_path,
            build_live_metrics_payload(
                s,
                status="running",
                text_col=text_col,
                rows_seen=stats.rows_seen,
                processed=stats.processed,
                failed=stats.failed,
                score_sum=stats.score_sum,
                positive=stats.positive,
                negative=stats.negative,
                neutral=stats.neutral,
                runtime_s=round(time.time() - start, 3),
                dataset_type=dataset_type,
                group_col=group_col,
            ),
        )

    for r, pred in zip(batch_rows, preds):
        label = pred.get("label", "")
        score = pred.get("score", "")
        label_norm = (label or "").lower()
        try:
            score_val = float(score)
        except (TypeError, ValueError):
            score_val = 0.0
        stats.score_sum += score_val
        if "pos" in label_norm:
            stats.positive += 1
        elif "neg" in label_norm:
            stats.negative += 1
        else:
            stats.neutral += 1
        out = {
            text_col: r.get(text_col, ""),
            "label": label,
            "score": score,
            "error": "",
        }
        if id_col:
            out[id_col] = r.get(id_col, "")
        writer.writerow(out)

        if group_col and group_col in headers:
            group_value = (r.get(group_col) or "").strip() or "(unknown)"
            update_group_stats(group_stats, group_value, label, score_val)

    stats.processed += len(batch_rows)
