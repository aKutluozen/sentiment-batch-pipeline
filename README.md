Quickstart
```
chmod +x run.sh
./run.sh
```


Optional alternative:

```
bash run.sh
```

Common overrides
## Enable metrics
METRICS_PORT=8000 ./run.sh

## Limit rows for fast testing
MAX_ROWS=10000 ./run.sh

## Headerless CSV (Sentiment140)
CSV_MODE=headerless TEXT_COL_INDEX=5 ID_COL_INDEX=1 ./run.sh


Or use Makefile!

Run history and visualization
## Each run appends a JSONL record to output/run_history.jsonl (override with RUN_HISTORY_PATH)
## Generate a simple plot:
python visualize_runs.py --history output/run_history.jsonl --out output/run_history.png

Dashboard (React + FastAPI)
## Backend API (live + history):
make dashboard-api

## Frontend (Vite dev server):
make dashboard-web

## Then open:
http://localhost:5173

Dockerized dashboard
## Bring up API + web (Docker Compose):
make dashboard-up

## Tear down:
make dashboard-down

Single-container dashboard
## Build + run UI + API in one container (serves UI from FastAPI):
make dashboard-one

## Then open:
http://localhost:8001

Dashboard features
## Upload a CSV, tune params, and run from the UI
## Watch live progress and view predictions in the table