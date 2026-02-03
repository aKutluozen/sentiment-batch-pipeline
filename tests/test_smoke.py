import csv
from pathlib import Path

import pytest

from tests.test_helper import import_main, write_csv


# End-to-end smoke test for the main application
def test_main_smoke_max_rows(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # Create a fake input CSV
    monkeypatch.chdir(tmp_path)
    input_path = tmp_path / "data" / "input.csv"
    rows = [[f"row {i}"] for i in range(8)]
    write_csv(input_path, rows=rows, header=["Text"])

    # Set environment variables
    monkeypatch.setenv("INPUT_CSV", str(input_path))
    monkeypatch.setenv("MAX_ROWS", "5")
    monkeypatch.setenv("BATCH_SIZE", "3")

    # Stub the inference function
    main_mod = import_main(monkeypatch)
    monkeypatch.setattr(main_mod, "load_sentiment_pipeline", lambda *_args, **_kwargs: object())
    monkeypatch.setattr(
        main_mod,
        "predict_batch",
        lambda _nlp, texts: [{"label": "POSITIVE", "score": 0.9} for _ in texts],
    )

    # Run main and check output
    exit_code = main_mod.main()
    assert exit_code == 0

    output_path = tmp_path / "output" / "predictions.csv"
    assert output_path.exists()

    with output_path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        results = list(reader)

    assert len(results) == 5
