from __future__ import annotations

import csv
import itertools
import logging
from typing import Dict, Iterable, List, Tuple
from app.config import Settings

logger = logging.getLogger("batch_infer")


def process_csv(
    f_in,
    s: Settings,
) -> Tuple[Iterable[Dict[str, str]], List[str], bool, str] | None:
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
        reader = ({name: value for name, value in zip(fieldnames, row)} for row in data_iter)
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

    return reader, fieldnames, text_col

