#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<EOF
Usage: ./cleanup.sh [--docker] [--hf-cache] [--artifacts] [--all]

Defaults to --docker when no flags are provided.
EOF
}

remove_docker() {
	echo "Stopping and removing all Docker containers..."
	local containers
	containers=$(docker ps -aq)
	if [[ -n "$containers" ]]; then
		docker rm -f $containers 2>/dev/null || true
	else
		echo "No containers to remove."
	fi
}

remove_cache() {
	echo "Removing hf_cache Docker volume..."
	docker volume rm -f hf_cache 2>/dev/null || true
}

remove_artifacts() {
	echo "Removing output artifacts and caches..."
	mkdir -p output
	rm -rf output/*
	find . -type d -name "__pycache__" -prune -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
}

DO_DOCKER=false
DO_CACHE=false
DO_ARTIFACTS=false

if [[ $# -eq 0 ]]; then
	DO_DOCKER=true
fi

for arg in "$@"; do
	case "$arg" in
		--docker)
			DO_DOCKER=true
			;;
		--hf-cache)
			DO_CACHE=true
			;;
		--artifacts)
			DO_ARTIFACTS=true
			;;
		--all)
			DO_DOCKER=true
			DO_CACHE=true
			DO_ARTIFACTS=true
			;;
		-h|--help|help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $arg"
			usage
			exit 1
			;;
	esac
done

if $DO_DOCKER; then
	remove_docker
fi

if $DO_CACHE; then
	remove_cache
fi

if $DO_ARTIFACTS; then
	remove_artifacts
fi

echo "Done."
