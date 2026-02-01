.PHONY: help run cleanup cleanup-cache cleanup-all build

help:
	@echo "Targets:"
	@echo "  run      Build image and run container (wraps ./run.sh)"
	@echo "  cleanup       Stop/remove all Docker containers (wraps ./cleanup.sh)"
	@echo "  cleanup-cache Remove hf_cache Docker volume"
	@echo "  cleanup-all   Containers + hf_cache volume"
	@echo "  build    Build the Docker image only"
	@echo ""
	@echo "Examples:"
	@echo "  make run INPUT_CSV=data/Reviews.csv"
	@echo "  make run INPUT_CSV=data/Reviews.csv OUTPUT_CSV=output/predictions.csv"
	@echo "  make run INPUT_CSV=data/Reviews.csv BATCH_SIZE=128 MAX_ROWS=1000"
	@echo "  make run CSV_MODE=indices TEXT_COL_INDEX=1 ID_COL_INDEX=0"
	@echo "  make cleanup"
	@echo "  make cleanup-cache"
	@echo "  make cleanup-all"

run:
	@./run.sh

run-example:
	@env \
	INPUT_CSV=data/Reviews.csv \
	BATCH_SIZE=128 MAX_ROWS=1000 \
	METRICS_PORT=8000 \
	./run.sh

clean:
	@./cleanup.sh

clean-cache:
	@./cleanup.sh --hf-cache

clean-all:
	@./cleanup.sh --all

build:
	@docker build -t "${IMAGE_NAME:-iqrush}" .
