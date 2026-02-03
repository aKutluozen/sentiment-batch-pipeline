import pytest

from app.config import load_settings


def test_batch_size_validation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BATCH_SIZE", "0")
    with pytest.raises(ValueError, match="BATCH_SIZE"):
        load_settings()


def test_invalid_csv_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CSV_MODE", "nope")
    with pytest.raises(ValueError, match="CSV_MODE"):
        load_settings()


def test_max_rows_validation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MAX_ROWS", "0")
    with pytest.raises(ValueError, match="MAX_ROWS"):
        load_settings()


def test_headerless_requires_text_col_index(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CSV_MODE", "headerless")
    with pytest.raises(ValueError, match="TEXT_COL_INDEX"):
        load_settings()


def test_text_col_index_non_negative(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TEXT_COL_INDEX", "-1")
    with pytest.raises(ValueError, match="TEXT_COL_INDEX"):
        load_settings()


def test_group_col_index_non_negative(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GROUP_COL_INDEX", "-1")
    with pytest.raises(ValueError, match="GROUP_COL_INDEX"):
        load_settings()
