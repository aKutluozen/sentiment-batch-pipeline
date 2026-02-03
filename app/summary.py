from __future__ import annotations

import csv
from dataclasses import dataclass
import json
from pathlib import Path
from typing import Dict

from app.run_tracking import ensure_parent_dir


@dataclass
class GroupStatsEntry:
    total: float = 0.0
    positive: float = 0.0
    negative: float = 0.0
    score_sum: float = 0.0


GroupStatsMap = Dict[str, GroupStatsEntry]


def dataset_name_from_path(path: Path) -> str:
    stem = path.stem
    if len(stem) >= 16 and stem[8:9] == "-" and stem[15:16] == "-":
        stem = stem[16:]
    return stem or "dataset"


def update_group_stats(
    stats: GroupStatsMap,
    group_value: str,
    label: str,
    score: float,
) -> None:
    entry = stats.setdefault(
        group_value,
        GroupStatsEntry(),
    )
    entry.total += 1
    label_norm = (label or "").lower()
    if "pos" in label_norm:
        entry.positive += 1
    elif "neg" in label_norm:
        entry.negative += 1
    entry.score_sum += score


def write_group_summary(
    json_path: Path,
    csv_path: Path,
    dataset_type: str,
    group_col: str | None,
    stats: GroupStatsMap,
) -> None:
    if not stats:
        return

    groups = sorted((
        {
            "group": group,
            "total": int(v.total),
            "positive": int(v.positive),
            "negative": int(v.negative),
            "avg_score": round((v.score_sum / v.total) if v.total else 0.0, 6),
        }
        for group, v in stats.items()
    ),
        key=lambda item: item["total"],
        reverse=True,
    )

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
            f_csv, fieldnames=["group", "total", "positive", "negative", "avg_score"])
        writer.writeheader()
        writer.writerows(groups)
