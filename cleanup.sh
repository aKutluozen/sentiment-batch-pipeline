#!/usr/bin/env bash
set -e

echo "Stopping and removing all Docker containers..."
docker rm -f $(docker ps -aq) 2>/dev/null || true

if [[ "${1:-}" == "--hf-cache" || "${1:-}" == "--all" ]]; then
	echo "Removing hf_cache Docker volume..."
	docker volume rm -f hf_cache 2>/dev/null || true
fi

echo "Done."
