# Sentiment Batch Pipeline

Batch inference pipeline for CSV sentiment analysis with optional dashboard UI, metrics, and group summaries.

## Features
- Batch inference with configurable `BATCH_SIZE`
- CSV header or headerless mode
- Optional group summaries by column index
- Prometheus metrics + live JSON metrics
- Dashboard UI for uploads and runs
- Dockerized + CI/CD to GHCR

## Quick start (local)
### Headless (batch inference)
```bash
make headless INPUT_CSV=data/Reviews.csv
```

### Full Dashboard (UI + API)
```bash
make run-full
```
Open http://localhost:8001

## Docker (GHCR)
Pull the latest build:
```bash
docker pull ghcr.io/akutluozen/sentiment-batch-pipeline:latest
```

## Configuration
Common overrides (env vars):
- `CSV_MODE=header|headerless`
- `TEXT_COL=Text` (header mode)
- `TEXT_COL_INDEX=5` (headerless mode, 0-based)
- `GROUP_COL_INDEX=1` (optional grouping, 0-based)
- `BATCH_SIZE=32`
- `MAX_ROWS=10000`
- `METRICS_PORT=8000`

Examples:
```bash
CSV_MODE=headerless TEXT_COL_INDEX=2 make headless INPUT_CSV=data/input.csv
GROUP_COL_INDEX=1 make headless INPUT_CSV=data/input.csv
METRICS_PORT=8000 make headless INPUT_CSV=data/Reviews.csv
```

## Outputs
- Predictions: `output/predictions.csv`
- Group summary: `output/predictions_group_summary.json|csv`
- Live metrics: `output/live_metrics.json`

## Tests
Run locally:
```bash
make test
```

Run in Docker:
```bash
make test-docker
```

## CI/CD
- CI runs tests in Docker on pushes/PRs.
- CD builds and pushes images to GHCR on `main`.

## Utilities
- Generate plots: `make visualize`
- Clean artifacts: `make clean-artifacts`