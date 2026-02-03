#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-iqrush}"
DASHBOARD_IMAGE="${DASHBOARD_IMAGE:-iqrush-dashboard}"
DASHBOARD_PORT="${DASHBOARD_PORT:-8001}"
HF_CACHE_VOLUME="${HF_CACHE_VOLUME:-hf_cache}"

usage() {
  cat <<EOF
Usage: ./run.sh [headless|dashboard]

Commands:
  headless   Build and run the batch pipeline (default)
  dashboard  Build and run the UI + API dashboard

Examples:
  ./run.sh
  INPUT_CSV=data/Reviews.csv BATCH_SIZE=128 MAX_ROWS=500 ./run.sh headless
  ./run.sh dashboard
EOF
}

run_headless() {
  docker build -t "$IMAGE_NAME" .

  ARGS=(
    --rm -it
    -v "$(pwd)":/app
    -v "${HF_CACHE_VOLUME}":/hf_cache
    -e HF_HOME=/hf_cache
  )

  # Only pass these if user set them (so config.py defaults remain the default)
  if [[ -n "${CSV_MODE+x}" ]]; then
    ARGS+=(-e CSV_MODE="${CSV_MODE}")
  fi

  if [[ -n "${TEXT_COL_INDEX+x}" ]]; then
    ARGS+=(-e TEXT_COL_INDEX="${TEXT_COL_INDEX}")
  fi

  if [[ -n "${ID_COL_INDEX+x}" ]]; then
    ARGS+=(-e ID_COL_INDEX="${ID_COL_INDEX}")
  fi

  if [[ -n "${TEXT_COL+x}" ]]; then
    ARGS+=(-e TEXT_COL="${TEXT_COL}")
  fi

  if [[ -n "${ID_COL+x}" ]]; then
    ARGS+=(-e ID_COL="${ID_COL}")
  fi

  if [[ -n "${INPUT_CSV+x}" ]]; then
    ARGS+=(-e INPUT_CSV="${INPUT_CSV}")
  fi

  if [[ -n "${OUTPUT_CSV+x}" ]]; then
    ARGS+=(-e OUTPUT_CSV="${OUTPUT_CSV}")
  fi

  if [[ -n "${BATCH_SIZE+x}" ]]; then
    ARGS+=(-e BATCH_SIZE="${BATCH_SIZE}")
  fi

  if [[ -n "${MAX_LEN+x}" ]]; then
    ARGS+=(-e MAX_LEN="${MAX_LEN}")
  fi

  if [[ -n "${MAX_ROWS+x}" ]]; then
    ARGS+=(-e MAX_ROWS="${MAX_ROWS}")
  fi

  # Metrics: only enable if user set METRICS_PORT (not default it)
  if [[ -n "${METRICS_PORT+x}" ]]; then
    ARGS+=(-p "${METRICS_PORT}:${METRICS_PORT}" -e METRICS_PORT="${METRICS_PORT}")
  fi

  echo "Running: docker run ${ARGS[*]} $IMAGE_NAME"
  docker run "${ARGS[@]}" "$IMAGE_NAME"
}

run_dashboard() {
  mkdir -p output
  docker build -f Dockerfile.dashboard -t "$DASHBOARD_IMAGE" .
  echo "Running: docker run --rm -p ${DASHBOARD_PORT}:8001 -v $(pwd)/output:/app/output $DASHBOARD_IMAGE"
  docker run --rm -p "${DASHBOARD_PORT}:8001" -v "$(pwd)/output:/app/output" "$DASHBOARD_IMAGE"
}

COMMAND="${1:-headless}"
case "$COMMAND" in
  headless)
    run_headless
    ;;
  dashboard|full)
    run_dashboard
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $COMMAND"
    usage
    exit 1
    ;;
esac
