import csv
import importlib
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


def _write_csv(path: Path, rows: list[list[str]], header: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def _import_main(monkeypatch: pytest.MonkeyPatch):
    class _Dummy:
        @classmethod
        def from_pretrained(cls, *_args, **_kwargs):
            return cls()

    dummy_module = SimpleNamespace(
        AutoModelForSequenceClassification=_Dummy,
        AutoTokenizer=_Dummy,
        pipeline=lambda *_args, **_kwargs: None,
    )
    monkeypatch.setitem(sys.modules, "transformers", dummy_module)
    main_mod = importlib.import_module("app.main")
    return importlib.reload(main_mod)


def test_main_smoke_max_rows(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    input_path = tmp_path / "data" / "input.csv"
    rows = [[f"row {i}"] for i in range(8)]
    _write_csv(input_path, rows=rows, header=["Text"])

    monkeypatch.setenv("INPUT_CSV", str(input_path))
    monkeypatch.setenv("MAX_ROWS", "5")
    monkeypatch.setenv("BATCH_SIZE", "3")

    main_mod = _import_main(monkeypatch)
    monkeypatch.setattr(main_mod, "load_sentiment_pipeline", lambda *_args, **_kwargs: object())
    monkeypatch.setattr(
        main_mod,
        "predict_batch",
        lambda _nlp, texts: [{"label": "POSITIVE", "score": 0.9} for _ in texts],
    )

    exit_code = main_mod.main()
    assert exit_code == 0

    output_path = tmp_path / "output" / "predictions.csv"
    assert output_path.exists()

    with output_path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        results = list(reader)

    assert len(results) == 5
