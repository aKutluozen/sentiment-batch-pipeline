import csv
import importlib
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


def _write_csv(path: Path, rows: list[list[str]], header: list[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        if header:
            writer.writerow(header)
        writer.writerows(rows)


def _stub_inference(monkeypatch: pytest.MonkeyPatch):
    main_mod = _import_main(monkeypatch)
    monkeypatch.setattr(main_mod, "load_sentiment_pipeline", lambda *_args, **_kwargs: object())
    monkeypatch.setattr(
        main_mod,
        "predict_batch",
        lambda _nlp, texts: [{"label": "POSITIVE", "score": 0.9} for _ in texts],
    )
    return main_mod


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


def test_header_missing_text_col_returns_2(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    input_path = tmp_path / "data" / "input.csv"
    _write_csv(input_path, rows=[["hello", "world"]], header=["Other", "Value"])

    monkeypatch.setenv("INPUT_CSV", str(input_path))
    monkeypatch.setenv("CSV_MODE", "header")

    main_mod = _stub_inference(monkeypatch)
    exit_code = main_mod.main()
    assert exit_code == 2


def test_headerless_without_text_col_index_returns_2(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    input_path = tmp_path / "data" / "input.csv"
    _write_csv(input_path, rows=[["a", "b", "c"], ["d", "e", "f"]])

    monkeypatch.setenv("INPUT_CSV", str(input_path))
    monkeypatch.setenv("CSV_MODE", "headerless")

    main_mod = _stub_inference(monkeypatch)
    exit_code = main_mod.main()
    assert exit_code == 2
