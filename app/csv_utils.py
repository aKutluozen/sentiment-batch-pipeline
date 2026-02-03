from __future__ import annotations

import csv
import itertools
import logging
from pathlib import Path
from typing import Dict, Iterable, IO, List, Tuple
from app.config import Settings

logger = logging.getLogger("batch_infer")


RowResult = Tuple[Dict[str, str] | None, str | None]


def _sanitize_row(row: Dict[str, str], text_col: str) -> RowResult:
    sanitized: Dict[str, str] = {}
    for key, value in row.items():
        if key is None:
            continue
        if value is None:
            sanitized[key] = ""
        else:
            sanitized[key] = str(value).strip()

    if not sanitized:
        return None, "skipped_row"

    if all(value == "" for value in sanitized.values()):
        return None, "skipped_row"

    text_value = sanitized.get(text_col, "").strip()
    if text_value == "":
        return None, "missing_text"

    return sanitized, None


def _build_reader(
    f_in: IO[str],
    s: Settings,
) -> Tuple[Iterable[RowResult], List[str], str] | None:
    raw_reader = csv.reader(f_in)
    first_row = next(raw_reader, None)
    if first_row is None:
        logger.error("CSV is empty")
        return None

    headerless_mode = False
    if s.csv_mode == "header":
        f_in.seek(0)
        reader = csv.DictReader(f_in)
        fieldnames = [cell.strip() for cell in (reader.fieldnames or [])]
    elif s.csv_mode == "headerless":
        headerless_mode = True
        fieldnames = [f"col_{i}" for i in range(len(first_row))]
        data_iter = itertools.chain([first_row], raw_reader)
        width = len(fieldnames)

        def _pad_row(row: List[str]) -> List[str]:
            if len(row) < width:
                return row + [""] * (width - len(row))
            return row[:width]

        reader = (
            {name: value for name, value in zip(fieldnames, _pad_row(row))}
            for row in data_iter
        )
    else:
        logger.error("CSV_MODE must be header or headerless", extra={"csv_mode": s.csv_mode})
        return None

    headers = set(fieldnames)
    if s.group_col_index is not None:
        if not (0 <= s.group_col_index < len(fieldnames)):
            logger.error(
                "GROUP_COL_INDEX out of range",
                extra={"group_col_index": s.group_col_index, "field_count": len(fieldnames)},
            )
            return None
    if headerless_mode:
        if s.text_col_index is None:
            logger.error("Headerless CSV requires TEXT_COL_INDEX (0-based).")
            return None
        if not (0 <= s.text_col_index < len(fieldnames)):
            logger.error(
                "TEXT_COL_INDEX out of range",
                extra={"text_col_index": s.text_col_index, "field_count": len(fieldnames)},
            )
            return None
        text_col = fieldnames[s.text_col_index]
    else:
        text_col = s.text_col
        if text_col not in headers:
            logger.error("TEXT_COL not found in CSV headers", extra={"text_col": text_col, "headers": list(headers)})
            return None

    def sanitized_reader() -> Iterable[RowResult]:
        for row in reader:
            yield _sanitize_row(row, text_col)

    return sanitized_reader(), fieldnames, text_col


def process_csv(
    input_path: Path,
    s: Settings,
) -> Tuple[Iterable[RowResult], List[str], str, IO[str]] | None:
    # Encoding fallback: try utf-8, then latin-1 - some CSVs may have non-utf8 chars
    for encoding in ("utf-8", "latin-1"):
        f_in: IO[str] | None = None
        try:
            f_in = input_path.open("r", newline="", encoding=encoding)
            processed = _build_reader(f_in, s)
            if processed is None:
                f_in.close()
                return None
            reader, fieldnames, text_col = processed
            return reader, fieldnames, text_col, f_in
        except UnicodeDecodeError:
            if f_in:
                f_in.close()
            logger.warning(
                "UTF-8 decode failed; retrying with latin-1",
                extra={"input_csv": str(input_path), "encoding": encoding},
            )
            continue
        except Exception:
            if f_in:
                f_in.close()
            raise

    logger.error("Failed to decode CSV with supported encodings", extra={"input_csv": str(input_path)})
    return None

