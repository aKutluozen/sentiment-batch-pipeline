from __future__ import annotations

import csv
import itertools
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


def _is_header_row(row: List[str]) -> bool:
    header_markers = {
        "text",
        "summary",
        "productid",
        "userid",
        "score",
        "target",
        "ids",
        "date",
        "flag",
        "user",
    }
    normalized = {cell.strip().lower() for cell in row}
    return len(normalized & header_markers) > 0


def _infer_headerless_fieldnames(first_row: List[str]) -> List[str]:
    if len(first_row) == 6:
        return ["target", "ids", "date", "flag", "user", "text"]
    return [f"col_{i}" for i in range(len(first_row))]


def _dataset_name_from_path(path: Path) -> str:
    stem = path.stem
    if len(stem) >= 16 and stem[8:9] == "-" and stem[15:16] == "-":
        stem = stem[16:]
    return stem or "dataset"


def _infer_group_col(headers: set[str]) -> str | None:
    if "ProductId" in headers:
        return "ProductId"
    if {"target", "text"}.issubset(headers):
        if "user" in headers:
            return "user"
        if "date" in headers:
            return "date"
    return None


def _update_group_stats(
    stats: Dict[str, Dict[str, float]],
    group_value: str,
    label: str,
    score: float,
) -> None:
    entry = stats.setdefault(
        group_value,
        {"total": 0.0, "positive": 0.0, "negative": 0.0, "score_sum": 0.0},
    )
    entry["total"] += 1
    label_norm = (label or "").lower()
    if "pos" in label_norm:
        entry["positive"] += 1
    elif "neg" in label_norm:
        entry["negative"] += 1
    entry["score_sum"] += score


def _write_group_summary(
    json_path: Path,
    csv_path: Path,
    dataset_type: str,
    group_col: str | None,
    stats: Dict[str, Dict[str, float]],
) -> None:
    if not stats:
        return
    groups: List[Dict[str, Any]] = []
    for group, values in stats.items():
        total = int(values["total"])
        avg_score = (values["score_sum"] / values["total"]) if values["total"] else 0.0
        groups.append(
            {
                "group": group,
                "total": total,
                "positive": int(values["positive"]),
                "negative": int(values["negative"]),
                "avg_score": round(avg_score, 6),
            }
        )
    groups.sort(key=lambda item: item["total"], reverse=True)
    _ensure_parent_dir(json_path)
    with json_path.open("w", encoding="utf-8") as f_json:
        json.dump(
            {"dataset_type": dataset_type, "group_col": group_col, "groups": groups},
            f_json,
            ensure_ascii=False,
            indent=2,
        )
    with csv_path.open("w", encoding="utf-8", newline="") as f_csv:
        writer = csv.DictWriter(
            f_csv, fieldnames=["group", "total", "positive", "negative", "avg_score"]
        )
        writer.writeheader()
        writer.writerows(groups)


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
    score_sum = 0.0
    positive = 0
    negative = 0
    neutral = 0
    group_stats: Dict[str, Dict[str, float]] = {}
    try:
        _write_live_metrics(
            s.run_live_path,
            {
                "status": "running",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "input_csv": str(s.input_csv),
                "output_csv": str(s.output_csv),
                "text_col": s.text_col,
                "model_name": s.model_name,
                "batch_size": s.batch_size,
                "max_len": s.max_len,
                "max_rows": s.max_rows,
                "metrics_port": s.metrics_port,
                "rows_seen": rows_seen,
                "processed": processed,
                "failed": failed,
                "avg_score": 0,
                "positive": positive,
                "negative": negative,
                "neutral": neutral,
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
        raw_reader = csv.reader(f_in)
        first_row = next(raw_reader, None)
        if first_row is None:
            logger.error("CSV is empty")
            return 2

        if _is_header_row(first_row):
            f_in.seek(0)
            reader: Any = csv.DictReader(f_in)
            fieldnames = [cell.strip() for cell in (reader.fieldnames or [])]
        else:
            fieldnames = _infer_headerless_fieldnames(first_row)
            data_iter = itertools.chain([first_row], raw_reader)
            reader = ({name: value for name, value in zip(fieldnames, row)} for row in data_iter)

        headers = set(fieldnames)
        text_col = s.text_col
        if text_col not in headers:
            for candidate in ["text", "Text", "review_text", "review", "content"]:
                if candidate in headers:
                    text_col = candidate
                    break

        dataset_type = _dataset_name_from_path(s.input_csv)
        group_col = _infer_group_col(headers)

        if text_col not in headers:
            logger.error("TEXT_COL not found in CSV headers", extra={"text_col": text_col, "headers": list(headers)})
            return 2

        out_headers: List[str] = []
        out_headers += [text_col, "label", "score", "error"]

        with s.output_csv.open("w", newline="", encoding="utf-8") as f_out:
            writer = csv.DictWriter(f_out, fieldnames=out_headers)
            writer.writeheader()

            batch: List[Dict[str, str]] = []

            def flush_batch(batch_rows: List[Dict[str, str]]) -> None:
                nonlocal processed, failed, score_sum, positive, negative, neutral

                texts: List[str] = []
                for r in batch_rows:
                    t = (r.get(text_col) or "").strip()
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
                            text_col: r.get(text_col, ""),
                            "label": "",
                            "score": "",
                            "error": str(e),
                        }
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
                                "runtime_s": round(time.time() - start, 3),
                            },
                        )
                    except Exception:
                        logger.exception("Failed to write live metrics", extra={"run_live_path": str(s.run_live_path)})

                for r, pred in zip(batch_rows, preds):
                    label = pred.get("label", "")
                    score = pred.get("score", "")
                    label_norm = (label or "").lower()
                    try:
                        score_val = float(score)
                    except (TypeError, ValueError):
                        score_val = 0.0
                    score_sum += score_val
                    if "pos" in label_norm:
                        positive += 1
                    elif "neg" in label_norm:
                        negative += 1
                    else:
                        neutral += 1
                    out = {
                        text_col: r.get(text_col, ""),
                        "label": label,
                        "score": score,
                        "error": "",
                    }
                    writer.writerow(out)

                    if group_col and group_col in headers:
                        group_value = (r.get(group_col) or "").strip() or "(unknown)"
                        _update_group_stats(group_stats, group_value, label, score_val)

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
            },
        )
    except Exception:
        logger.exception("Failed to append run history", extra={"run_history_path": str(s.run_history_path)})

    summary_json = s.output_csv.with_name(f"{s.output_csv.stem}_group_summary.json")
    summary_csv = s.output_csv.with_name(f"{s.output_csv.stem}_group_summary.csv")
    try:
        _write_group_summary(summary_json, summary_csv, dataset_type, group_col, group_stats)
    except Exception:
        logger.exception("Failed to write group summary", extra={"path": str(summary_json)})

    # Non-zero if anything failed (useful in CI)
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
