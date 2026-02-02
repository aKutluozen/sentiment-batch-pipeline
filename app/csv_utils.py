from __future__ import annotations

import csv
import itertools
import logging
from typing import Dict, Iterable, List, Tuple

logger = logging.getLogger("batch_infer")


def is_header_row(row: List[str]) -> bool:
    header_markers = {
        "text",
        "summary",
        "productid",
        "userid",
        "score",
        "target",
        "ids",
        "date",
        "flag",
        "user",
    }
    normalized = {cell.strip().lower() for cell in row}
    return len(normalized & header_markers) > 0


def infer_headerless_fieldnames(first_row: List[str]) -> List[str]:
    if len(first_row) == 6:
        return ["target", "ids", "date", "flag", "user", "text"]
    return [f"col_{i}" for i in range(len(first_row))]


def prepare_reader(
    f_in,
    csv_mode: str,
) -> Tuple[Iterable[Dict[str, str]], List[str], bool] | None:
    raw_reader = csv.reader(f_in)
    first_row = next(raw_reader, None)
    if first_row is None:
        logger.error("CSV is empty")
        return None

    headerless_mode = False
    if csv_mode == "header":
        f_in.seek(0)
        reader = csv.DictReader(f_in)
        fieldnames = [cell.strip() for cell in (reader.fieldnames or [])]
    elif csv_mode == "headerless":
        headerless_mode = True
        fieldnames = infer_headerless_fieldnames(first_row)
        data_iter = itertools.chain([first_row], raw_reader)
        reader = ({name: value for name, value in zip(fieldnames, row)} for row in data_iter)
    else:
        if is_header_row(first_row):
            f_in.seek(0)
            reader = csv.DictReader(f_in)
            fieldnames = [cell.strip() for cell in (reader.fieldnames or [])]
        else:
            headerless_mode = True
            fieldnames = infer_headerless_fieldnames(first_row)
            data_iter = itertools.chain([first_row], raw_reader)
            reader = ({name: value for name, value in zip(fieldnames, row)} for row in data_iter)

    return reader, fieldnames, headerless_mode


def resolve_columns(
    s,
    fieldnames: List[str],
    headerless_mode: bool,
) -> tuple[str, str | None] | None:
    headers = set(fieldnames)
    text_col = s.text_col
    if s.text_col_index is not None:
        if not (0 <= s.text_col_index < len(fieldnames)):
            logger.error(
                "TEXT_COL_INDEX out of range",
                extra={"text_col_index": s.text_col_index, "field_count": len(fieldnames)},
            )
            return None
        text_col = fieldnames[s.text_col_index]
    elif headerless_mode:
        if len(fieldnames) == 1:
            logger.warning(
                "Headerless CSV missing TEXT_COL_INDEX; defaulting to column 0",
                extra={"field_count": len(fieldnames)},
            )
            text_col = fieldnames[0]
        else:
            logger.error(
                "Headerless CSV requires TEXT_COL_INDEX (0-based). Example: CSV_MODE=headerless TEXT_COL_INDEX=5",
                extra={"field_count": len(fieldnames)},
            )
            return None

    if not headerless_mode and text_col not in headers:
        for candidate in ["text", "Text", "review_text", "review", "content"]:
            if candidate in headers:
                text_col = candidate
                break

    id_col: str | None = None
    if s.id_col_index is not None:
        if not (0 <= s.id_col_index < len(fieldnames)):
            logger.error(
                "ID_COL_INDEX out of range",
                extra={"id_col_index": s.id_col_index, "field_count": len(fieldnames)},
            )
            return None
        id_col = fieldnames[s.id_col_index]
    elif s.id_col:
        id_col = s.id_col
        if id_col not in headers:
            logger.error("ID_COL not found in CSV headers", extra={"id_col": id_col})
            return None

    if text_col not in headers:
        logger.error("TEXT_COL not found in CSV headers", extra={"text_col": text_col, "headers": list(headers)})
        return None

    return text_col, id_col


def build_output_headers(text_col: str, id_col: str | None) -> List[str]:
    headers: List[str] = []
    if id_col:
        headers.append(id_col)
    headers += [text_col, "label", "score", "error"]
    return headers
