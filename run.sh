#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-iqrush}"
HF_CACHE_VOLUME="${HF_CACHE_VOLUME:-hf_cache}"

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
