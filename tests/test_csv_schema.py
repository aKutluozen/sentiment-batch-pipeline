import importlib
from pathlib import Path

import pytest

from tests.test_helper import stub_inference, write_csv


def test_header_missing_text_col_returns_2(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    input_path = tmp_path / "data" / "input.csv"
    write_csv(input_path, rows=[["hello", "world"]], header=["Other", "Value"])

    monkeypatch.setenv("INPUT_CSV", str(input_path))
    monkeypatch.setenv("CSV_MODE", "header")

    main_mod = stub_inference(monkeypatch)
    exit_code = main_mod.main()
    assert exit_code == 2


def test_headerless_without_text_col_index_returns_2(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    input_path = tmp_path / "data" / "input.csv"
    write_csv(input_path, rows=[["a", "b", "c"], ["d", "e", "f"]])

    monkeypatch.setenv("INPUT_CSV", str(input_path))
    monkeypatch.setenv("CSV_MODE", "headerless")

    stub_inference(monkeypatch)
    with pytest.raises(ValueError, match="TEXT_COL_INDEX"):
        importlib.import_module("app.config").load_settings()

def test_group_col_index_out_of_range(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    input_csv = tmp_path / "input.csv"
    input_csv.write_text("Text,Category\nhello,a\n")

    monkeypatch.setenv("INPUT_CSV", str(input_csv))
    monkeypatch.setenv("GROUP_COL_INDEX", "2")

    main_mod = stub_inference(monkeypatch)
    exit_code = main_mod.main()

    assert exit_code == 2
