# Sentiment Batch Pipeline

Batch inference pipeline for CSV sentiment analysis with optional dashboard UI, metrics, and group summaries.

## Features
- Batch inference with configurable `BATCH_SIZE`, `MAX_LEN`, `MAX_ROWS`
- CSV header or headerless mode
- Optional group summaries by column index
- Prometheus metrics + live JSON metrics
- Dashboard UI for uploads, runs, and analysis
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

## Full experience (both images)
Run the batch pipeline and dashboard together using Docker:
```bash
docker pull ghcr.io/akutluozen/sentiment-batch-pipeline:latest
docker pull ghcr.io/akutluozen/sentiment-batch-pipeline-dashboard:latest
```

Create a minimal `docker-compose.yml`:
```yaml
services:
  pipeline:
    image: ghcr.io/akutluozen/sentiment-batch-pipeline:latest
    volumes:
      - ./data:/data
      - ./output:/output
    environment:
      INPUT_CSV: /data/Reviews.csv
      OUTPUT_CSV: /output/predictions.csv
      MAX_ROWS: 500
      BATCH_SIZE: 128
  dashboard:
    image: ghcr.io/akutluozen/sentiment-batch-pipeline-dashboard:latest
    ports:
      - "8001:8001"
    volumes:
      - ./output:/app/output
```

Then run:
```bash
docker compose up
```
Open http://localhost:8001

## Docker (GHCR)
Pull the latest build:
```bash
docker pull ghcr.io/akutluozen/sentiment-batch-pipeline:latest
```
Then you can run a quick test like
```bash
docker run --rm \
  -v "$PWD/data:/data" \
  -v "$PWD/output:/output" \
  -e INPUT_CSV=/data/Reviews.csv \
  -e OUTPUT_CSV=/output/predictions.csv \
	-e MAX_ROWS=500 \
	-e BATCH_SIZE=128 \
  ghcr.io/akutluozen/sentiment-batch-pipeline:latest
```

Pull the dashboard (UI + API) image:
```bash
docker pull ghcr.io/akutluozen/sentiment-batch-pipeline-dashboard:latest
```
Run the dashboard locally:
```bash
docker run --rm -p 8001:8001 \
  -v "$PWD/output:/app/output" \
  ghcr.io/akutluozen/sentiment-batch-pipeline-dashboard:latest
```
Open http://localhost:8001

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
- `make clean-docker`   Stop/remove all Docker containers
- `make clean-cache`    Remove hf_cache Docker volume
- `make clean-artifacts` Remove output artifacts (runs, logs, uploads)
- `make clean-all`      Clean docker + cache + artifacts