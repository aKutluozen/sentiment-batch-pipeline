import csv
from pathlib import Path

import pytest

from tests.test_helper import import_main, write_csv


def test_batch_failure_marks_errors_and_continues(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    input_path = tmp_path / "data" / "input.csv"
    rows = [[f"text {i}"] for i in range(5)]
    write_csv(input_path, rows=rows, header=["Text"])

    monkeypatch.setenv("INPUT_CSV", str(input_path))
    monkeypatch.setenv("BATCH_SIZE", "2")

    main_mod = import_main(monkeypatch)
    monkeypatch.setattr(main_mod, "load_sentiment_pipeline", lambda *_args, **_kwargs: object())

    calls = {"count": 0}

    # Let's have a problem on the first batch
    def flaky_predict(_nlp, texts):
        calls["count"] += 1
        if calls["count"] == 1:
            raise RuntimeError("boom")
        return [{"label": "POSITIVE", "score": 0.9} for _ in texts]

    monkeypatch.setattr(main_mod, "predict_batch", flaky_predict)

    exit_code = main_mod.main()
    assert exit_code == 1

    output_path = tmp_path / "output" / "predictions.csv"
    assert output_path.exists()

    with output_path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        results = list(reader)

    # Since a batch failed, all rows in that batch should have errors
    assert len(results) == 5
    errors = [row["error"] for row in results]
    assert sum(1 for value in errors if value) == 2
    assert all(errors[:2])
    assert not any(errors[2:])
