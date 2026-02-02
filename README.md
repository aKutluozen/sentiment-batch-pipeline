Two ways to run

1) Headless (batch inference, no UI)
```
make headless INPUT_CSV=data/Reviews.csv
```

Common overrides
- Enable metrics: `METRICS_PORT=8000 make headless`
- Limit rows: `MAX_ROWS=10000 make headless`
- Headerless CSV: `CSV_MODE=headerless TEXT_COL_INDEX=5 ID_COL_INDEX=1 make headless`

2) Dashboard (UI + API in one container)
```
make dashboard
```
Open http://localhost:8001

Dashboard features
- Upload a CSV, tune params, run from the UI
- Live progress, history charts, searchable runs
- Predictions table
- Grouped summary by detected dataset type (e.g., ProductId or user)

Extras
- Generate plots: `make visualize`
- Clean artifacts: `make clean-artifacts`