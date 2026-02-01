.PHONY: help run cleanup cleanup-cache cleanup-all build visualize visualize-docker dashboard-api dashboard-web dashboard-up dashboard-down

VENV_PY := $(wildcard .venv/bin/python)
ifeq ($(VENV_PY),)
PYTHON ?= python3
else
PYTHON ?= .venv/bin/python
endif
IMAGE_NAME ?= iqrush

help:
	@echo "Targets:"
	@echo "  run      Build image and run container (wraps ./run.sh)"
	@echo "  cleanup       Stop/remove all Docker containers (wraps ./cleanup.sh)"
	@echo "  cleanup-cache Remove hf_cache Docker volume"
	@echo "  cleanup-all   Containers + hf_cache volume"
	@echo "  build    Build the Docker image only"
	@echo "  visualize Generate run history plot"
	@echo "  visualize-docker Generate plot inside Docker image"
	@echo "  dashboard-api Run FastAPI dashboard backend"
	@echo "  dashboard-web Run React dashboard frontend"
	@echo "  dashboard-up Run dashboard via docker compose"
	@echo "  dashboard-down Stop dashboard containers"
	@echo ""
	@echo "Examples:"
	@echo "  make run INPUT_CSV=data/Reviews.csv"
	@echo "  make run INPUT_CSV=data/Reviews.csv OUTPUT_CSV=output/predictions.csv"
	@echo "  make run INPUT_CSV=data/Reviews.csv BATCH_SIZE=128 MAX_ROWS=1000"
	@echo "  make run CSV_MODE=indices TEXT_COL_INDEX=1 ID_COL_INDEX=0"
	@echo "  make cleanup"
	@echo "  make cleanup-cache"
	@echo "  make cleanup-all"
	@echo "  make visualize"
	@echo "  make visualize-docker"
	@echo "  make dashboard-api"
	@echo "  make dashboard-web"
	@echo "  make dashboard-up"
	@echo "  make dashboard-down"

run:
	@./run.sh

run-example:
	@env \
	INPUT_CSV=data/Reviews.csv \
	BATCH_SIZE=128 MAX_ROWS=500 \
	METRICS_PORT=8000 \
	./run.sh

clean:
	@./cleanup.sh

clean-cache:
	@./cleanup.sh --hf-cache

clean-all:
	@./cleanup.sh --all

build:
	@docker build -t "$(IMAGE_NAME)" .

visualize:
	@$(PYTHON) visualize_runs.py --history output/run_history.jsonl --out output/run_history.png

visualize-docker:
	@docker build -t "$(IMAGE_NAME)" .
	@docker run --rm -v "$(PWD)":/app -w /app "$(IMAGE_NAME)" \
		python visualize_runs.py --history output/run_history.jsonl --out output/run_history.png

dashboard-api:
	@$(PYTHON) -m uvicorn dashboard_api.main:app --host 0.0.0.0 --port 8001 --reload

dashboard-web:
	@cd web && npm install && npm run dev

dashboard-up:
	@docker compose up --build

dashboard-down:
	@docker compose down
