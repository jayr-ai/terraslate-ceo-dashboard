#!/usr/bin/env python3
"""
Pulls the real Paper Catalog Usage data from the "dashboard" tab of its own
Google Sheet and writes src/data/paperCatalogData.json in the shape the UI
component expects.

Sheet: https://docs.google.com/spreadsheets/d/1kpaup0kGlutbFaBCp2ELYE6pgYoDyzfT-Ze1mO7ZnTs
Tab: dashboard (gid 1132103857). Pulled via CSV export.

## Layout (verified against the reference report's exact numbers before
## writing any UI — every week's total count reconciles exactly)

The sheet is a hand-built pivot, not a per-row dataset:
  - Columns A-C hold a small, entirely unrelated leftover table (its own
    header row appears partway down instead of at the top, its values
    don't line up with the pivot's rows at all) — ignored.
  - The real pivot starts at column D: "Paper Catalogue Name", then
    "Week No. Goal (Last 7-weeks average)", then a rolling window of
    weeks (currently 7, but detected dynamically from the header row
    rather than hardcoded — see `find_week_columns`), each a 3-column
    block: [count, %, spacer].
  - Row 5 (0-indexed) is a junk leftover row — name literally "Name",
    every value zero. Dropped, same as any other template-row artifact
    in these sheets. A row named "_" (row 25) is NOT junk, though — it
    has real nonzero counts across multiple weeks, just an odd literal
    SKU label from the source data. Kept as-is.
  - "Week No. Goal (Last 7-weeks average)" is recomputed here rather
    than trusted from the sheet: verified it's the plain average of a
    row's own weekly % share, over only the weeks that have a nonzero
    total (the newest and oldest week in the current window are often
    still zero — the newest because it's in progress, verified against
    "today" being inside that week's date range). Reproduces the
    sheet's own values exactly (e.g. TSP 12x18 14 Mil: (21.8+19.5+30.0+
    33.4+45.6)/5 = 30.06% ≈ the sheet's 30.1%).
  - Rows are ranked by that Goal % descending, matching the reference.
"""

from __future__ import annotations

import csv
import io
import json
import re
import urllib.request
from datetime import datetime
from pathlib import Path

SHEET_ID = "1kpaup0kGlutbFaBCp2ELYE6pgYoDyzfT-Ze1mO7ZnTs"
DASHBOARD_GID = "1132103857"

OUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "paperCatalogData.json"

NAME_COL = 3
GOAL_COL = 4
WEEK_LABEL_ROW = 2
DATE_RANGE_ROW = 3
TOTAL_ROW = 4
FIRST_DATA_ROW = 5
JUNK_NAMES = {"", "name"}


def fetch_rows() -> list[list[str]]:
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={DASHBOARD_GID}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        raw = resp.read().decode("utf-8")
    return list(csv.reader(io.StringIO(raw)))


def parse_int(s: str | None) -> int:
    s = (s or "").replace(",", "").strip()
    return int(s) if re.fullmatch(r"-?\d+", s) else 0


def find_week_columns(header_row: list[str]) -> list[int]:
    """Week blocks start wherever the header row reads "<year> | Week <n>" —
    detected dynamically so this keeps working as the sheet's rolling
    window shifts forward, without needing a hardcoded column count."""
    cols = []
    for i, cell in enumerate(header_row):
        if re.match(r"^\d{4} \| Week \d+$", cell.strip()):
            cols.append(i)
    return cols


def main():
    print("Fetching dashboard tab ...")
    rows = fetch_rows()

    week_cols = find_week_columns(rows[WEEK_LABEL_ROW])
    weeks = [
        {
            "label": rows[WEEK_LABEL_ROW][c].strip(),
            "dateRange": rows[DATE_RANGE_ROW][c].strip() if c < len(rows[DATE_RANGE_ROW]) else "",
        }
        for c in week_cols
    ]
    print(f"  {len(weeks)} weeks detected: {[w['label'] for w in weeks]}")

    data_rows = rows[FIRST_DATA_ROW:]
    out_rows = []
    for r in data_rows:
        if len(r) <= NAME_COL:
            continue
        name = r[NAME_COL].strip()
        if name.lower() in JUNK_NAMES:
            continue
        weekly_counts = [parse_int(r[c]) if c < len(r) else 0 for c in week_cols]
        out_rows.append({"name": name, "weeklyCounts": weekly_counts})

    # weeklyPcts and Goal % are both computed here from raw counts, not
    # parsed from the sheet's own pre-rounded "%" text — averaging
    # already-rounded percentages compounds rounding error (verified:
    # e.g. TSP 12x18 10 Mil comes out 5.9% that way vs the sheet's actual
    # 5.8%, which only reproduces when averaging the unrounded ratios).
    week_totals = [sum(r["weeklyCounts"][i] for r in out_rows) for i in range(len(weeks))]
    for r in out_rows:
        raw_ratios = [
            r["weeklyCounts"][i] / week_totals[i] * 100 if week_totals[i] else None
            for i in range(len(weeks))
        ]
        r["weeklyPcts"] = [round(v, 2) if v is not None else None for v in raw_ratios]
        contributing = [v for v in raw_ratios if v is not None]
        r["goalPct"] = round(sum(contributing) / len(contributing), 1) if contributing else 0.0

    out_rows.sort(key=lambda r: -r["goalPct"])

    totals = {
        "weeklyCounts": week_totals,
        "weeklyPcts": [round(t / week_totals[i] * 100, 2) if week_totals[i] else 0.0 for i, t in enumerate(week_totals)],
    }

    data = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "weeks": weeks,
        "rows": out_rows,
        "totals": totals,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2))
    print(f"\nWrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
