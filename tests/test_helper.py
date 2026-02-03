import csv
import importlib
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


def write_csv(path: Path, rows: list[list[str]], header: list[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        if header:
            writer.writerow(header)
        writer.writerows(rows)


def import_main(monkeypatch: pytest.MonkeyPatch):
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
  

def stub_inference(monkeypatch: pytest.MonkeyPatch):
    main_mod = import_main(monkeypatch)
    monkeypatch.setattr(main_mod, "load_sentiment_pipeline", lambda *_args, **_kwargs: object())
    monkeypatch.setattr(
        main_mod,
        "predict_batch",
        lambda _nlp, texts: [{"label": "POSITIVE", "score": 0.9} for _ in texts],
    )
    return main_mod