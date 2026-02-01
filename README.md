Quickstart
```
chmod +x run.sh
./run.sh
```


Optional alternative:

```
bash run.sh
```

Common overrides
## Enable metrics
METRICS_PORT=8000 ./run.sh

## Limit rows for fast testing
MAX_ROWS=10000 ./run.sh

## Headerless CSV (Sentiment140)
CSV_MODE=headerless TEXT_COL_INDEX=5 ID_COL_INDEX=1 ./run.sh


Or use Makefile!