from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Dict, List

from app.helpers import ensure_parent_dir


def dataset_name_from_path(path: Path) -> str:
    stem = path.stem
    if len(stem) >= 16 and stem[8:9] == "-" and stem[15:16] == "-":
        stem = stem[16:]
    return stem or "dataset"


def infer_group_col(headers: set[str]) -> str | None:
    if "ProductId" in headers:
        return "ProductId"
    if {"target", "text"}.issubset(headers):
        if "user" in headers:
            return "user"
        if "date" in headers:
            return "date"
    return None


def update_group_stats(
    stats: Dict[str, Dict[str, float]],
    group_value: str,
    label: str,
    score: float,
) -> None:
    entry = stats.setdefault(
        group_value,
        {"total": 0.0, "positive": 0.0, "negative": 0.0, "score_sum": 0.0},
    )
    entry["total"] += 1
    label_norm = (label or "").lower()
    if "pos" in label_norm:
        entry["positive"] += 1
    elif "neg" in label_norm:
        entry["negative"] += 1
    entry["score_sum"] += score


def write_group_summary(
    json_path: Path,
    csv_path: Path,
    dataset_type: str,
    group_col: str | None,
    stats: Dict[str, Dict[str, float]],
) -> None:
    if not stats:
        return
    groups: List[Dict[str, Any]] = []
    for group, values in stats.items():
        total = int(values["total"])
        avg_score = (values["score_sum"] / values["total"]) if values["total"] else 0.0
        groups.append(
            {
                "group": group,
                "total": total,
                "positive": int(values["positive"]),
                "negative": int(values["negative"]),
                "avg_score": round(avg_score, 6),
            }
        )
    groups.sort(key=lambda item: item["total"], reverse=True)
    ensure_parent_dir(json_path)
    with json_path.open("w", encoding="utf-8") as f_json:
        json.dump(
            {"dataset_type": dataset_type, "group_col": group_col, "groups": groups},
            f_json,
            ensure_ascii=False,
            indent=2,
        )
    with csv_path.open("w", encoding="utf-8", newline="") as f_csv:
        writer = csv.DictWriter(
            f_csv, fieldnames=["group", "total", "positive", "negative", "avg_score"]
        )
        writer.writeheader()
        writer.writerows(groups)
