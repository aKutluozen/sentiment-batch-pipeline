from __future__ import annotations

import csv
import logging
import time
from pathlib import Path
from typing import Dict, List

from app.batch_runner import process_batch
from app.config import load_settings
from app.csv_utils import process_csv
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
from app.summary import dataset_name_from_path, write_group_summary

logger = logging.getLogger("batch_infer")


def main() -> int:
    setup_logging()
    settings = load_settings()  # Load config from env vars safely
    metrics = start_metrics_server(settings.metrics_port)

    logger.info(
        "Starting job",
        extra={
            "input_csv": str(settings.input_csv),
            "output_csv": str(settings.output_csv),
            "run_history_path": str(settings.run_history_path),
            "run_live_path": str(settings.run_live_path),
            "text_col": settings.text_col,
            "model_name": settings.model_name,
            "batch_size": settings.batch_size,
            "max_len": settings.max_len,
            "metrics_port": settings.metrics_port,
        },
    )

    # File safety first.
    if not settings.input_csv.exists():
        logger.error("INPUT_CSV not found", extra={
                     "path": str(settings.input_csv)})
        return 2  # Config error - used for CI
    ensure_parent_dir(settings.output_csv)

    # Initialize run tracking
    start = time.time()
    stats = RunStats()
    group_stats: Dict[str, Dict[str, float]] = {}  # In case of group summaries

    write_live_metrics_safe(
        settings.run_live_path,
        build_live_metrics_payload(
            settings,
            status="running",
            text_col=settings.text_col,
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

    try:
        logger.info("Loading model...", extra={
                    "model_name": settings.model_name})
        nlp = load_sentiment_pipeline(settings.model_name, settings.max_len)
        logger.info("Model loaded")
    except Exception:
        logger.exception("Failed to load model", extra={
                         "model_name": settings.model_name})
        return 1

    try:
        # Stream rows instead of reading all into memory
        with settings.input_csv.open("r", newline="", encoding="utf-8") as f_in:
            # Process CSV
            processed = process_csv(f_in, settings)
            if processed is None:
                return 2
            reader, fieldnames, text_col = processed

            # Prepare the output CSV
            headers_list = list(fieldnames)
            headers_set = set(fieldnames)
            dataset_type = dataset_name_from_path(settings.input_csv)
            group_col = None if settings.group_col_index is None else headers_list[
                settings.group_col_index]
            out_headers = [text_col, "label", "score", "error"]

            with settings.output_csv.open("w", newline="", encoding="utf-8") as f_out:
                writer = csv.DictWriter(f_out, fieldnames=out_headers)
                writer.writeheader()

                batch: List[Dict[str, str]] = []

                # Process rows in batches
                for r in reader:
                    stats.rows_seen += 1
                    if settings.max_rows is not None and stats.rows_seen > settings.max_rows:
                        logger.info("Row limit reached", extra={
                                    "max_rows": settings.max_rows})
                        break
                    batch.append(r)
                    # Once we have enough for a batch, process it
                    if len(batch) >= settings.batch_size:
                        process_batch(
                            batch,
                            nlp=nlp,
                            predict_fn=predict_batch,
                            writer=writer,
                            metrics=metrics,
                            settings=settings,
                            stats=stats,
                            text_col=text_col,
                            headers=headers_set,
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

                # Process any remaining rows in the last batch
                if batch:
                    process_batch(
                        batch,
                        nlp=nlp,
                        predict_fn=predict_batch,
                        writer=writer,
                        metrics=metrics,
                        settings=settings,
                        stats=stats,
                        text_col=text_col,
                        headers=headers_set,
                        group_col=group_col,
                        group_stats=group_stats,
                        dataset_type=dataset_type,
                        start=start,
                    )
    except Exception:
        logger.exception("Unhandled error during processing")
        return 1

    # Finalize run
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
        settings.run_live_path,
        build_live_metrics_payload(
            settings,
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
            settings.run_history_path,
            build_run_history_payload(
                settings,
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
        logger.exception("Failed to append run history", extra={
                         "run_history_path": str(settings.run_history_path)})

    summary_json = settings.output_csv.with_name(
        f"{settings.output_csv.stem}_group_summary.json")
    summary_csv = settings.output_csv.with_name(
        f"{settings.output_csv.stem}_group_summary.csv")
    try:
        write_group_summary(summary_json, summary_csv,
                            dataset_type, group_col, group_stats)
    except Exception:
        logger.exception("Failed to write group summary",
                         extra={"path": str(summary_json)})

    # Non-zero if anything failed (useful in CI)
    return 1 if stats.failed > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
