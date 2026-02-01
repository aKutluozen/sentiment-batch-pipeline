from __future__ import annotations

import csv
import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List

from app.config import load_settings
from app.inference import load_sentiment_pipeline, predict_batch
from app.logging_utils import setup_logging
from app.metrics import maybe_start_metrics_server

logger = logging.getLogger("batch_infer")


def _ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _append_run_history(path: Path, record: Dict[str, Any]) -> None:
    _ensure_parent_dir(path)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def _write_live_metrics(path: Path, record: Dict[str, Any]) -> None:
    _ensure_parent_dir(path)
    with path.open("w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False)


def main() -> int:
    setup_logging()
    s = load_settings()
    metrics = maybe_start_metrics_server(s.metrics_port)

    logger.info(
        "Starting job",
        extra={
            "input_csv": str(s.input_csv),
            "output_csv": str(s.output_csv),
            "run_history_path": str(s.run_history_path),
            "run_live_path": str(s.run_live_path),
            "text_col": s.text_col,
            "id_col": s.id_col,
            "model_name": s.model_name,
            "batch_size": s.batch_size,
            "max_len": s.max_len,
            "metrics_port": s.metrics_port,
        },
    )

    if not s.input_csv.exists():
        logger.error("INPUT_CSV not found", extra={"path": str(s.input_csv)})
        return 2

    _ensure_parent_dir(s.output_csv)

    start = time.time()
    processed = 0
    failed = 0
    rows_seen = 0
    try:
        _write_live_metrics(
            s.run_live_path,
            {
                "status": "running",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "input_csv": str(s.input_csv),
                "output_csv": str(s.output_csv),
                "text_col": s.text_col,
                "id_col": s.id_col,
                "model_name": s.model_name,
                "batch_size": s.batch_size,
                "max_len": s.max_len,
                "max_rows": s.max_rows,
                "metrics_port": s.metrics_port,
                "rows_seen": rows_seen,
                "processed": processed,
                "failed": failed,
                "runtime_s": 0,
            },
        )
    except Exception:
        logger.exception("Failed to write live metrics", extra={"run_live_path": str(s.run_live_path)})

    logger.info("Loading model...", extra={"model_name": s.model_name})
    nlp = load_sentiment_pipeline(s.model_name, s.max_len)
    logger.info("Model loaded")

    # Stream rows instead of reading all into memory
    with s.input_csv.open("r", newline="", encoding="utf-8") as f_in:
        reader = csv.DictReader(f_in)
        if reader.fieldnames is None:
            logger.error("CSV has no header row")
            return 2

        headers = set(reader.fieldnames)
        if s.text_col not in headers:
            logger.error("TEXT_COL not found in CSV headers", extra={"text_col": s.text_col, "headers": list(headers)})
            return 2
        if s.id_col and s.id_col not in headers:
            logger.error("ID_COL not found in CSV headers", extra={"id_col": s.id_col, "headers": list(headers)})
            return 2

        out_headers: List[str] = []
        if s.id_col:
            out_headers.append(s.id_col)
        out_headers += [s.text_col, "label", "score", "error"]

        with s.output_csv.open("w", newline="", encoding="utf-8") as f_out:
            writer = csv.DictWriter(f_out, fieldnames=out_headers)
            writer.writeheader()

            batch: List[Dict[str, str]] = []

            def flush_batch(batch_rows: List[Dict[str, str]]) -> None:
                nonlocal processed, failed

                texts: List[str] = []
                for r in batch_rows:
                    t = (r.get(s.text_col) or "").strip()
                    texts.append(t)

                batch_start = time.time()
                try:
                    preds = predict_batch(nlp, texts)
                    metrics.inc_processed(len(batch_rows))
                    metrics.inc_batches()

                except Exception as e:
                    logger.exception("Batch inference failed", extra={"batch_size": len(batch_rows)})
                    for r in batch_rows:
                        out: Dict[str, Any] = {
                            s.text_col: r.get(s.text_col, ""),
                            "label": "",
                            "score": "",
                            "error": str(e),
                        }
                        if s.id_col:
                            out[s.id_col] = r.get(s.id_col, "")
                        writer.writerow(out)
                    failed += len(batch_rows)
                    metrics.inc_failed(len(batch_rows))
                    metrics.inc_batches()

                    return
                finally:
                    metrics.observe_batch_duration(time.time() - batch_start)
                    try:
                        _write_live_metrics(
                            s.run_live_path,
                            {
                                "status": "running",
                                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                                "input_csv": str(s.input_csv),
                                "output_csv": str(s.output_csv),
                                "text_col": s.text_col,
                                "id_col": s.id_col,
                                "model_name": s.model_name,
                                "batch_size": s.batch_size,
                                "max_len": s.max_len,
                                "max_rows": s.max_rows,
                                "metrics_port": s.metrics_port,
                                "rows_seen": rows_seen,
                                "processed": processed,
                                "failed": failed,
                                "runtime_s": round(time.time() - start, 3),
                            },
                        )
                    except Exception:
                        logger.exception("Failed to write live metrics", extra={"run_live_path": str(s.run_live_path)})

                for r, pred in zip(batch_rows, preds):
                    out = {
                        s.text_col: r.get(s.text_col, ""),
                        "label": pred.get("label", ""),
                        "score": pred.get("score", ""),
                        "error": "",
                    }
                    if s.id_col:
                        out[s.id_col] = r.get(s.id_col, "")
                    writer.writerow(out)

                processed += len(batch_rows)

            for r in reader:
                rows_seen += 1

                if s.max_rows is not None and rows_seen > s.max_rows:
                    logger.info("Row limit reached", extra={"max_rows": s.max_rows})
                    break

                batch.append(r)
                if len(batch) >= s.batch_size:
                    flush_batch(batch)
                    logger.info(
                        "Batch complete",
                        extra={"rows_seen": rows_seen, "processed": processed, "failed": failed},
                    )
                    batch = []

            if batch:
                flush_batch(batch)

    runtime_s = round(time.time() - start, 3)
    metrics.observe_job_duration(runtime_s)
    logger.info(
        "Job complete",
        extra={"processed": processed, "failed": failed, "runtime_s": runtime_s, "output_csv": str(s.output_csv)},
    )

    try:
        _write_live_metrics(
            s.run_live_path,
            {
                "status": "complete",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "input_csv": str(s.input_csv),
                "output_csv": str(s.output_csv),
                "text_col": s.text_col,
                "id_col": s.id_col,
                "model_name": s.model_name,
                "batch_size": s.batch_size,
                "max_len": s.max_len,
                "max_rows": s.max_rows,
                "metrics_port": s.metrics_port,
                "rows_seen": rows_seen,
                "processed": processed,
                "failed": failed,
                "runtime_s": runtime_s,
            },
        )
    except Exception:
        logger.exception("Failed to write live metrics", extra={"run_live_path": str(s.run_live_path)})

    try:
        _append_run_history(
            s.run_history_path,
            {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "input_csv": str(s.input_csv),
                "output_csv": str(s.output_csv),
                "text_col": s.text_col,
                "id_col": s.id_col,
                "model_name": s.model_name,
                "batch_size": s.batch_size,
                "max_len": s.max_len,
                "max_rows": s.max_rows,
                "metrics_port": s.metrics_port,
                "rows_seen": rows_seen,
                "processed": processed,
                "failed": failed,
                "runtime_s": runtime_s,
            },
        )
    except Exception:
        logger.exception("Failed to append run history", extra={"run_history_path": str(s.run_history_path)})

    # Non-zero if anything failed (useful in CI)
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
