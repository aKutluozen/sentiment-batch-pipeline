.PHONY: help headless dashboard clean-docker clean-cache clean-artifacts clean-all

VENV_PY := $(wildcard .venv/bin/python)
ifeq ($(VENV_PY),)
PYTHON ?= python3
else
PYTHON ?= .venv/bin/python
endif

help:
	@echo "Targets:"
	@echo "  headless       Run batch inference (no UI)"
	@echo "  dashboard      Run dashboard (single container)"
	@echo "  clean-docker   Stop/remove all Docker containers"
	@echo "  clean-cache    Remove hf_cache Docker volume"
	@echo "  clean-artifacts Remove output artifacts (runs, logs, uploads)"
	@echo "  clean-all      Clean docker + cache + artifacts"

run-headless:
	@./run.sh

run-full:
	@docker build -f Dockerfile.dashboard -t iqrush-dashboard .
	@docker run --rm -p 8001:8001 -v "$(PWD)/output":/app/output iqrush-dashboard

run-example-headless:
	@env \
	INPUT_CSV=data/Reviews.csv \
	BATCH_SIZE=128 MAX_ROWS=500 \
	METRICS_PORT=8000 \
	./run.sh

clean-docker:
	@./cleanup.sh

clean-cache:
	@./cleanup.sh --hf-cache

clean-artifacts:
	@mkdir -p output
	@rm -rf output/*
	@find . -type d -name "__pycache__" -prune -exec rm -rf {} +
	@find . -type f -name "*.pyc" -delete

clean-all: clean-docker clean-cache clean-artifacts
