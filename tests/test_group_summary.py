import json
from pathlib import Path

import pytest

from tests.test_helper import stub_inference, write_csv


def test_group_summary_written(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    input_path = tmp_path / "data" / "input.csv"
    write_csv(
        input_path,
        rows=[
            ["hello", "A"],
            ["world", "B"],
            ["empty", ""],
        ],
        header=["Text", "Group"],
    )

    monkeypatch.setenv("INPUT_CSV", str(input_path))
    monkeypatch.setenv("GROUP_COL_INDEX", "1")
    monkeypatch.setenv("BATCH_SIZE", "2")

    main_mod = stub_inference(monkeypatch)
    exit_code = main_mod.main()
    assert exit_code == 0

    summary_json = tmp_path / "output" / "predictions_group_summary.json"
    assert summary_json.exists()

    payload = json.loads(summary_json.read_text(encoding="utf-8"))
    assert payload["group_col"] == "Group"

    groups = {item["group"] for item in payload["groups"]}
    assert {"A", "B", "(unknown)"}.issubset(groups)