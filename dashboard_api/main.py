from __future__ import annotations

import asyncio
import csv
import json
import os
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, IO, List, Optional

from fastapi import FastAPI, File, Form, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

RUN_HISTORY_PATH = Path(os.getenv("RUN_HISTORY_PATH", "output/run_history.jsonl"))
RUN_LIVE_PATH = Path(os.getenv("RUN_LIVE_PATH", "output/live_metrics.json"))
DASHBOARD_DIST = Path(os.getenv("DASHBOARD_DIST", "web/dist"))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "output/uploads"))
RUN_LOG_DIR = Path(os.getenv("RUN_LOG_DIR", "output/run_logs"))
BASE_DIR = Path(__file__).resolve().parents[1]

_current_process: subprocess.Popen[str] | None = None
_current_log_path: Path | None = None
_current_log_file: IO[str] | None = None
_models_cache: List[Dict[str, Any]] = []
_models_cache_ts: float | None = None
_models_cache_ttl_s = 60 * 60 * 6
_default_models = [
    {"id": "distilbert-base-uncased-finetuned-sst-2-english", "likes": 0, "downloads": 0},
    {"id": "cardiffnlp/twitter-roberta-base-sentiment", "likes": 0, "downloads": 0},
    {"id": "nlptown/bert-base-multilingual-uncased-sentiment", "likes": 0, "downloads": 0},
    {"id": "siebert/sentiment-roberta-large-english", "likes": 0, "downloads": 0},
    {"id": "finiteautomata/bertweet-base-sentiment-analysis", "likes": 0, "downloads": 0},
]

app = FastAPI(title="IQRush Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_jsonl(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    runs: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                runs.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return runs


def _read_live(path: Path) -> Dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _write_live_snapshot(record: Dict[str, Any]) -> None:
    RUN_LIVE_PATH.parent.mkdir(parents=True, exist_ok=True)
    RUN_LIVE_PATH.write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")


def _read_predictions(path: Path, limit: int) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
            if limit > 0 and len(rows) >= limit:
                break
    return rows


def _read_summary(path: Path) -> Dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _fetch_models_from_hf(limit: int = 50) -> List[Dict[str, Any]]:
    params = urllib.parse.urlencode(
        {
            "pipeline_tag": "sentiment-analysis",
            "sort": "trending",
            "limit": str(limit),
        }
    )
    url = f"https://huggingface.co/api/models?{params}"
    with urllib.request.urlopen(url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    models: List[Dict[str, Any]] = []
    for item in payload:
        model_id = item.get("modelId") or item.get("id")
        if not model_id:
            continue
        models.append(
            {
                "id": model_id,
                "likes": item.get("likes", 0),
                "downloads": item.get("downloads", 0),
            }
        )
    return models


def _summary_path_for_output(output_csv: str) -> Path:
    output_path = Path(output_csv)
    return output_path.with_name(f"{output_path.stem}_group_summary.json")


def _is_running() -> bool:
    global _current_process
    if _current_process is None:
        return False
    return _current_process.poll() is None


def _tail_file(path: Path, max_lines: int = 200) -> str:
    if not path.exists():
        return ""
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    return "\n".join(lines[-max_lines:])


def _stream_process_output(proc: subprocess.Popen[str], log_file: IO[str]) -> None:
    if proc.stdout is None:
        return
    for line in proc.stdout:
        log_file.write(line)
        log_file.flush()
        sys.stdout.write(line)
        sys.stdout.flush()


def _watch_process(proc: subprocess.Popen[str]) -> None:
    exit_code = proc.wait()
    live = _read_live(RUN_LIVE_PATH) or {}
    status = live.get("status")
    if status not in {"complete", "cancelled"}:
        final_status = "complete" if exit_code == 0 else "failed"
        _write_live_snapshot(
            {
                **live,
                "status": final_status,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "exit_code": exit_code,
            }
        )
    try:
        global _current_process, _current_log_file
        _current_process = None
        if _current_log_file:
            _current_log_file.close()
            _current_log_file = None
    except Exception:
        return


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/models")
def list_models(limit: int = Query(default=50, ge=1, le=200)) -> JSONResponse:
    global _models_cache, _models_cache_ts
    now = time.time()
    if _models_cache_ts is None or (now - _models_cache_ts) > _models_cache_ttl_s:
        try:
            _models_cache = _fetch_models_from_hf(limit)
            _models_cache_ts = now
        except Exception:
            if not _models_cache:
                _models_cache = _default_models
                _models_cache_ts = now
    return JSONResponse({"models": _models_cache[:limit]})


@app.get("/api/runs")
def list_runs(
    q: Optional[str] = Query(default=None, description="Search substring in JSON"),
    limit: int = Query(default=200, ge=1, le=2000),
) -> JSONResponse:
    runs = _read_jsonl(RUN_HISTORY_PATH)
    if q:
        q_lower = q.lower()
        runs = [r for r in runs if q_lower in json.dumps(r).lower()]
    runs = runs[-limit:]
    return JSONResponse({"count": len(runs), "runs": runs})


@app.get("/api/live")
def live_snapshot() -> JSONResponse:
    snapshot = _read_live(RUN_LIVE_PATH)
    return JSONResponse({"live": snapshot})


@app.get("/api/live/stream")
async def live_stream() -> StreamingResponse:
    async def event_stream():
        last_payload = ""
        while True:
            snapshot = _read_live(RUN_LIVE_PATH)
            payload = json.dumps({"live": snapshot})
            if payload != last_payload:
                last_payload = payload
                yield f"data: {payload}\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/run")
async def run_job(
    file: UploadFile = File(...),
    output_csv: Optional[str] = Form(default=None),
    text_col: Optional[str] = Form(default=None),
    model_name: Optional[str] = Form(default=None),
    batch_size: Optional[int] = Form(default=None),
    max_len: Optional[int] = Form(default=None),
    max_rows: Optional[int] = Form(default=None),
    metrics_port: Optional[int] = Form(default=None),
) -> JSONResponse:
    if _is_running():
        return JSONResponse({"error": "Run already in progress"}, status_code=409)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    safe_name = Path(file.filename or "input.csv").name
    upload_path = UPLOAD_DIR / f"{timestamp}-{safe_name}"

    content = await file.read()
    upload_path.write_bytes(content)

    resolved_output = output_csv or f"output/predictions_{timestamp}.csv"

    env = os.environ.copy()
    env["INPUT_CSV"] = str(upload_path)
    env["RUN_HISTORY_PATH"] = str(RUN_HISTORY_PATH)
    env["RUN_LIVE_PATH"] = str(RUN_LIVE_PATH)
    env["OUTPUT_CSV"] = resolved_output
    if text_col:
        env["TEXT_COL"] = text_col
    if model_name:
        env["MODEL_NAME"] = model_name
    if batch_size is not None:
        env["BATCH_SIZE"] = str(batch_size)
    if max_len is not None:
        env["MAX_LEN"] = str(max_len)
    if max_rows is not None:
        env["MAX_ROWS"] = str(max_rows)
    if metrics_port is not None:
        env["METRICS_PORT"] = str(metrics_port)

    summary_path = _summary_path_for_output(resolved_output)
    _write_live_snapshot(
        {
            "status": "starting",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "input_csv": str(upload_path),
            "output_csv": resolved_output,
            "text_col": text_col or os.getenv("TEXT_COL", "Text"),
            "model_name": model_name or os.getenv("MODEL_NAME", ""),
            "batch_size": batch_size or int(os.getenv("BATCH_SIZE", "32")),
            "max_len": max_len or int(os.getenv("MAX_LEN", "256")),
            "max_rows": max_rows,
            "metrics_port": metrics_port,
            "rows_seen": 0,
            "processed": 0,
            "failed": 0,
            "avg_score": 0,
            "positive": 0,
            "negative": 0,
            "neutral": 0,
            "runtime_s": 0,
        }
    )

    RUN_LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = RUN_LOG_DIR / f"{timestamp}.log"
    log_file = log_path.open("a", encoding="utf-8")

    global _current_process, _current_log_path, _current_log_file
    _current_process = subprocess.Popen(
        [sys.executable, "-m", "app.main"],
        cwd=str(BASE_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    _current_log_path = log_path
    _current_log_file = log_file

    threading.Thread(target=_stream_process_output, args=(_current_process, log_file), daemon=True).start()
    threading.Thread(target=_watch_process, args=(_current_process,), daemon=True).start()

    return JSONResponse(
        {
            "status": "started",
            "input_csv": str(upload_path),
            "output_csv": resolved_output,
            "pid": _current_process.pid,
            "summary_path": str(summary_path),
            "log_path": str(log_path),
        }
    )


@app.get("/api/predictions")
def get_predictions(
    path: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=0, le=10000),
) -> JSONResponse:
    target = Path(path) if path else Path(os.getenv("OUTPUT_CSV", "output/predictions.csv"))
    rows = _read_predictions(target, limit)
    return JSONResponse({"count": len(rows), "rows": rows, "path": str(target)})


@app.get("/api/summary")
def get_summary(
    path: Optional[str] = Query(default=None),
) -> JSONResponse:
    target = Path(path) if path else _summary_path_for_output(os.getenv("OUTPUT_CSV", "output/predictions.csv"))
    summary = _read_summary(target)
    return JSONResponse({"summary": summary, "path": str(target)})


@app.get("/api/run/status")
def run_status() -> JSONResponse:
    running = _is_running()
    log_tail = _tail_file(_current_log_path) if _current_log_path else ""
    return JSONResponse(
        {
            "running": running,
            "pid": _current_process.pid if _current_process else None,
            "log_tail": log_tail,
            "log_path": str(_current_log_path) if _current_log_path else None,
        }
    )


@app.post("/api/run/cancel")
def cancel_run() -> JSONResponse:
    if not _is_running():
        return JSONResponse({"status": "idle"})
    assert _current_process is not None
    _current_process.terminate()
    try:
        _current_process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        _current_process.kill()
    _write_live_snapshot(
        {
            "status": "cancelled",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "rows_seen": 0,
            "processed": 0,
            "failed": 0,
            "runtime_s": 0,
        }
    )
    return JSONResponse({"status": "cancelled"})


if DASHBOARD_DIST.exists():
    app.mount("/", StaticFiles(directory=DASHBOARD_DIST, html=True), name="dashboard")
