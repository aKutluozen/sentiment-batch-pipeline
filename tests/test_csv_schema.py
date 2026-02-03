import csv
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


def test_headerless_with_text_col_index_succeeds(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    input_path = tmp_path / "data" / "input.csv"
    write_csv(input_path, rows=[["a", "b", "c"], ["d", "e", "f"]])

    monkeypatch.setenv("INPUT_CSV", str(input_path))
    monkeypatch.setenv("CSV_MODE", "headerless")
    monkeypatch.setenv("TEXT_COL_INDEX", "1")
    monkeypatch.setenv("BATCH_SIZE", "2")

    main_mod = stub_inference(monkeypatch)
    exit_code = main_mod.main()
    assert exit_code == 0

    output_path = tmp_path / "output" / "predictions.csv"
    assert output_path.exists()

    with output_path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        results = list(reader)

    assert reader.fieldnames and reader.fieldnames[0] == "col_1"
    assert len(results) == 2


def test_group_col_index_out_of_range(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    input_csv = tmp_path / "input.csv"
    input_csv.write_text("Text,Category\nhello,a\n")

    monkeypatch.setenv("INPUT_CSV", str(input_csv))
    monkeypatch.setenv("GROUP_COL_INDEX", "2")

    main_mod = stub_inference(monkeypatch)
    exit_code = main_mod.main()

    assert exit_code == 2


def test_headerless_text_col_index_out_of_range(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    input_path = tmp_path / "data" / "input.csv"
    write_csv(input_path, rows=[["a", "b", "c"], ["d", "e", "f"]])

    monkeypatch.setenv("INPUT_CSV", str(input_path))
    monkeypatch.setenv("CSV_MODE", "headerless")
    monkeypatch.setenv("TEXT_COL_INDEX", "5")

    main_mod = stub_inference(monkeypatch)
    exit_code = main_mod.main()

    assert exit_code == 2


def test_empty_csv_returns_2(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    input_path = tmp_path / "data" / "input.csv"
    input_path.parent.mkdir(parents=True, exist_ok=True)
    input_path.write_text("")

    monkeypatch.setenv("INPUT_CSV", str(input_path))

    main_mod = stub_inference(monkeypatch)
    exit_code = main_mod.main()

    assert exit_code == 2
