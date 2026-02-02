from __future__ import annotations

import csv
import logging
import time
from pathlib import Path
from typing import Dict, List

from app.batch_runner import flush_batch
from app.config import load_settings
from app.csv_utils import build_output_headers, prepare_reader, resolve_columns
from app.helpers import (
    append_run_history,
    build_live_metrics_payload,
    build_run_history_payload,
    ensure_parent_dir,
)
from app.inference import load_sentiment_pipeline, predict_batch
from app.logging_utils import setup_logging
from app.metrics import start_metrics_server
from app.run_tracking import RunStats, write_live_metrics_safe
from app.summary import dataset_name_from_path, infer_group_col, write_group_summary

logger = logging.getLogger("batch_infer")


def main() -> int:
    setup_logging()
    s = load_settings() # Load config from env vars safely
    metrics = start_metrics_server(s.metrics_port)

    logger.info(
        "Starting job",
        extra={
            "input_csv": str(s.input_csv),
            "output_csv": str(s.output_csv),
            "run_history_path": str(s.run_history_path),
            "run_live_path": str(s.run_live_path),
            "text_col": s.text_col,
            "model_name": s.model_name,
            "batch_size": s.batch_size,
            "max_len": s.max_len,
            "metrics_port": s.metrics_port,
        },
    )

    # File safety first.
    if not s.input_csv.exists():
        logger.error("INPUT_CSV not found", extra={"path": str(s.input_csv)})
        return 2  # Config error - used for CI
    ensure_parent_dir(s.output_csv)

    # Initialize run tracking
    start = time.time()
    stats = RunStats()
    group_stats: Dict[str, Dict[str, float]] = {} # In case of group summaries
    
    write_live_metrics_safe(
        s.run_live_path,
        build_live_metrics_payload(
            s,
            status="running",
            text_col=s.text_col,
            rows_seen=stats.rows_seen,
            processed=stats.processed,
            failed=stats.failed,
            score_sum=stats.score_sum,
            positive=stats.positive,
            negative=stats.negative,
            neutral=stats.neutral,
            runtime_s=0,
        ),
    )

    logger.info("Loading model...", extra={"model_name": s.model_name})
    nlp = load_sentiment_pipeline(s.model_name, s.max_len)
    logger.info("Model loaded")

    # Stream rows instead of reading all into memory
    with s.input_csv.open("r", newline="", encoding="utf-8") as f_in:
        prepared = prepare_reader(f_in, s.csv_mode)
        if prepared is None:
            return 2
        reader, fieldnames, headerless_mode = prepared

        headers = set(fieldnames)
        resolved = resolve_columns(s, fieldnames, headerless_mode)
        if resolved is None:
            return 2
        text_col, id_col = resolved

        dataset_type = dataset_name_from_path(s.input_csv)
        group_col = infer_group_col(headers)

        out_headers = build_output_headers(text_col, id_col)

        with s.output_csv.open("w", newline="", encoding="utf-8") as f_out:
            writer = csv.DictWriter(f_out, fieldnames=out_headers)
            writer.writeheader()

            batch: List[Dict[str, str]] = []

            for r in reader:
                stats.rows_seen += 1

                if s.max_rows is not None and stats.rows_seen > s.max_rows:
                    logger.info("Row limit reached", extra={"max_rows": s.max_rows})
                    break

                batch.append(r)
                if len(batch) >= s.batch_size:
                    flush_batch(
                        batch,
                        nlp=nlp,
                        predict_fn=predict_batch,
                        writer=writer,
                        metrics=metrics,
                        s=s,
                        stats=stats,
                        text_col=text_col,
                        id_col=id_col,
                        headers=headers,
                        group_col=group_col,
                        group_stats=group_stats,
                        dataset_type=dataset_type,
                        start=start,
                    )
                    logger.info(
                        "Batch complete",
                        extra={
                            "rows_seen": stats.rows_seen,
                            "processed": stats.processed,
                            "failed": stats.failed,
                        },
                    )
                    batch = []

            if batch:
                flush_batch(
                    batch,
                    nlp=nlp,
                    predict_fn=predict_batch,
                    writer=writer,
                    metrics=metrics,
                    s=s,
                    stats=stats,
                    text_col=text_col,
                    id_col=id_col,
                    headers=headers,
                    group_col=group_col,
                    group_stats=group_stats,
                    dataset_type=dataset_type,
                    start=start,
                )

    runtime_s = round(time.time() - start, 3)
    metrics.observe_job_duration(runtime_s)
    logger.info(
        "Job complete",
        extra={
            "processed": stats.processed,
            "failed": stats.failed,
            "runtime_s": runtime_s,
            "output_csv": str(s.output_csv),
        },
    )

    write_live_metrics_safe(
        s.run_live_path,
        build_live_metrics_payload(
            s,
            status="complete",
            text_col=text_col,
            rows_seen=stats.rows_seen,
            processed=stats.processed,
            failed=stats.failed,
            score_sum=stats.score_sum,
            positive=stats.positive,
            negative=stats.negative,
            neutral=stats.neutral,
            runtime_s=runtime_s,
            dataset_type=dataset_type,
            group_col=group_col,
        ),
    )

    try:
        append_run_history(
            s.run_history_path,
            build_run_history_payload(
                s,
                text_col=text_col,
                rows_seen=stats.rows_seen,
                processed=stats.processed,
                failed=stats.failed,
                score_sum=stats.score_sum,
                positive=stats.positive,
                negative=stats.negative,
                neutral=stats.neutral,
                runtime_s=runtime_s,
                dataset_type=dataset_type,
                group_col=group_col,
            ),
        )
    except Exception:
        logger.exception("Failed to append run history", extra={"run_history_path": str(s.run_history_path)})

    summary_json = s.output_csv.with_name(f"{s.output_csv.stem}_group_summary.json")
    summary_csv = s.output_csv.with_name(f"{s.output_csv.stem}_group_summary.csv")
    try:
        write_group_summary(summary_json, summary_csv, dataset_type, group_col, group_stats)
    except Exception:
        logger.exception("Failed to write group summary", extra={"path": str(summary_json)})

    # Non-zero if anything failed (useful in CI)
    return 1 if stats.failed > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
