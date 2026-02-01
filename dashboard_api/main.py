from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

RUN_HISTORY_PATH = Path(os.getenv("RUN_HISTORY_PATH", "output/run_history.jsonl"))
RUN_LIVE_PATH = Path(os.getenv("RUN_LIVE_PATH", "output/live_metrics.json"))
DASHBOARD_DIST = Path(os.getenv("DASHBOARD_DIST", "web/dist"))

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


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


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


if DASHBOARD_DIST.exists():
    app.mount("/", StaticFiles(directory=DASHBOARD_DIST, html=True), name="dashboard")
