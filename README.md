# Sentiment Batch Pipeline

Batch inference pipeline for CSV sentiment analysis with optional dashboard UI, metrics, and group summaries.

## Features
- Batch inference with tunable `BATCH_SIZE`, `MAX_LEN`, and optional `MAX_ROWS`
- CSV header or headerless parsing with robust sanitization and validation
- Optional group summaries by column index
- Prometheus metrics and live JSON metrics
- Dashboard UI for uploads, runs, and analysis
- Dockerized build with CI/CD to GHCR

## How does it work?
The full application has three layers:
1. Batch pipeline (headless): reads a CSV and parameters and writes predictions, summaries, and metrics.
2. API layer: exposes the pipeline over HTTP so runs can be started, monitored, and queried.
3. UI layer (React/TypeScript): provides uploads, run controls, and visual analysis.

Data flow: input CSV to predictions, group summary, and live metrics.

Full picture (end-to-end):
- Input and parameters: CSV upload or file path with settings (mode, columns, batch size, max length, max rows).
- Processing: tokenization and model inference across batches.
- Outputs (files): `output/predictions.csv`, `output/predictions_group_summary.{json|csv}`, `output/live_metrics.json`, `output/run_history.jsonl`, `output/run_logs/`.
- Serving: the API exposes run status, logs, predictions, and summaries.
- UI: dashboard starts runs, monitors progress, and visualizes results.

## Tested with datasets
- [Sentiment140 (Kaggle)](https://www.kaggle.com/datasets/kazanova/sentiment140)
- [Amazon Fine Food Reviews (Kaggle)](https://www.kaggle.com/datasets/snap/amazon-fine-food-reviews?resource=download)
- [Rotten Tomatoes Movies and Reviews (Kaggle)](https://www.kaggle.com/datasets/andrezaza/clapper-massive-rotten-tomatoes-movies-and-reviews/data)
- [Twitter Airline Sentiment (Kaggle)](https://www.kaggle.com/datasets/crowdflower/twitter-airline-sentiment)
- [Sentiment Analysis Dataset (Kaggle)](https://www.kaggle.com/datasets/abhi8923shriv/sentiment-analysis-dataset)
- [Flipkart Laptop Reviews (Kaggle)](https://www.kaggle.com/datasets/gitadityamaddali/flipkart-laptop-reviews)

## Prerequisites
- Docker (required)
- Make (optional; bash scripts work without it)

## Quick start
Pull, test, and run locally:
```bash
git clone https://github.com/akutluozen/sentiment-batch-pipeline.git
cd sentiment-batch-pipeline
make test-docker
make run-full
```
Open http://localhost:8001 to analyze runs and metrics.

## Run from source
### Headless (batch inference)
```bash
make run-headless INPUT_CSV=data/test-set.csv
```
Run the full headless example with all fields populated (uses `data/test-set.csv`):
```bash
make run-example-headless
```

### Full Dashboard (UI and API)
```bash
make run-full
```
Open http://localhost:8001

### Without Makefile (bash scripts)
```bash
./run.sh
```
Run with common overrides:
```bash
INPUT_CSV=data/test-set.csv BATCH_SIZE=128 MAX_ROWS=500 ./run.sh headless
```
Run the dashboard:
```bash
./run.sh dashboard
```
Cleanup (Docker containers, cache, artifacts):
```bash
./cleanup.sh --all
```

## Use prebuilt containers
Pull the latest images from GHCR:
```bash
docker pull ghcr.io/akutluozen/sentiment-batch-pipeline:latest
docker pull ghcr.io/akutluozen/sentiment-batch-pipeline-dashboard:latest
```
Choose one of the options below depending on what you want to run.

### Full experience (both images)
Run the batch pipeline and dashboard together using Docker:
```yaml
services:
  pipeline:
    image: ghcr.io/akutluozen/sentiment-batch-pipeline:latest
    volumes:
      - ./data:/data
      - ./output:/output
    environment:
      INPUT_CSV: /data/test-set.csv
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

### Batch-only quick test
```bash
docker run --rm \
  -v "$PWD/data:/data" \
  -v "$PWD/output:/output" \
  -e INPUT_CSV=/data/test-set.csv \
  -e OUTPUT_CSV=/output/predictions.csv \
	-e MAX_ROWS=500 \
	-e BATCH_SIZE=128 \
  ghcr.io/akutluozen/sentiment-batch-pipeline:latest
```

### Dashboard only
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
CSV_MODE=headerless TEXT_COL_INDEX=2 INPUT_CSV=data/input.csv make run-headless

GROUP_COL_INDEX=1 INPUT_CSV=data/input.csv make run-headless

METRICS_PORT=8000 INPUT_CSV=data/test-set.csv make run-headless
```

Bash script equivalents:
```bash
CSV_MODE=headerless TEXT_COL_INDEX=2 INPUT_CSV=data/input.csv ./run.sh headless

GROUP_COL_INDEX=1 INPUT_CSV=data/input.csv ./run.sh headless

METRICS_PORT=8000 INPUT_CSV=data/test-set.csv ./run.sh headless
```

## Outputs
- Predictions: `output/predictions.csv`
- Group summary: `output/predictions_group_summary.json|csv`
- Live metrics: `output/live_metrics.json`

## Tests
Run locally. Install Python dependencies first:
```bash
pip install -r requirements.txt
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
- `make clean-all`      Clean docker, cache, and artifacts