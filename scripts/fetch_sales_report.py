#!/usr/bin/env python3
"""
Pulls the real Sales Report Dashboard data from the "SALES" tab of its own
Google Sheet (~260 rows, one row per week, 2022-2026) and writes
src/data/salesReportData.json in the shape the UI components expect.

Sheet: https://docs.google.com/spreadsheets/d/1Kj64HeUnO7CX7yU9bEh20mwCk58Hqm_RByVrCvk1mcU
Tab: SALES (gid 1762618519). Pulled via CSV export.

## Row grain

Unlike every other dashboard page here, this sheet is already weekly
aggregates, not per-transaction rows — so there's no daily/custom-range
picker architecture (dailyRaw + preset windows) like the other pages.
Instead the whole ~260-row sheet is small enough to ship as-is; every KPI,
quarter table, and the contribution-% page is computed client-side from
this one array (src/lib/salesReportData.ts), filtered by the Year picker.

## Data cleaning (verified against the reference report's exact numbers
## before writing any UI — YTD Actual $9,110,481 / YTD Forecast $10,111,954
## for 2026, and Q3's totals $2,730,837 / $2,960,550, both reconcile to the
## dollar)

  - Rows where `View` = "NO" are dropped — this is the sheet's own flag
    for "not yet in the reporting window" (verified: it's just the
    trailing 13 weeks of 2026, W40-52, all with blank Actuals). This is
    why Q4 2026 always shows "No data" in the reference report — not a
    date-range coincidence, an explicit flag.
  - The sheet's own "Quarter" column (values like "Q41", "Q55") is NOT
    calendar quarters — it's an unrelated running week-counter left over
    from something else in the sheet, unused here. Q1-Q4 in this report
    are computed directly from the week number: W01-13 -> Q1, W14-26 ->
    Q2, W27-39 -> Q3, W40-52 -> Q4 (verified: reproduces the reference's
    own Q1/Q2/Q3/Q4 table contents exactly).

## "Current QTD" — a deliberate deviation from the reference screenshots

The reference screenshots' QTD cards show Q2 numbers even though the
sheet's actual latest data (as of this write-up, W38) is already well
into Q3. That's the live Looker report's QTD control being stale/pinned,
not a design to replicate — confirmed with JV. This build computes QTD
live: whichever quarter (within the selected year) contains the most
recent row with a non-blank Actual value.
"""

from __future__ import annotations

import csv
import io
import json
import urllib.request
from datetime import datetime
from pathlib import Path

SHEET_ID = "1Kj64HeUnO7CX7yU9bEh20mwCk58Hqm_RByVrCvk1mcU"
SALES_GID = "1762618519"

OUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "salesReportData.json"


def fetch_rows() -> list[dict[str, str]]:
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={SALES_GID}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        raw = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(raw)))


def money(s: str | None) -> float | None:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return float(s.replace("$", "").replace(",", ""))
    except ValueError:
        return None


def quarter_of(week_num: int) -> str:
    if week_num <= 13:
        return "Q1"
    if week_num <= 26:
        return "Q2"
    if week_num <= 39:
        return "Q3"
    return "Q4"


def main():
    print("Fetching SALES tab ...")
    raw_rows = fetch_rows()

    rows = []
    for r in raw_rows:
        if (r.get("View") or "").strip() != "YES":
            continue
        week_label = (r.get("Week") or "").strip()
        if not week_label.startswith("W"):
            continue
        week_num = int(week_label[1:])
        year = (r.get("Year") or "").strip()
        if not year:
            continue
        rows.append({
            "year": int(year),
            "week": week_label,
            "weekNum": week_num,
            "quarter": quarter_of(week_num),
            "weekStart": (r.get("Week Start") or "").strip(),
            "forecast": money(r.get("Forecast")),
            "actual": money(r.get("Actual")),
            "forecastDraft": money(r.get("Forecast Draft")),
            "actualDraft": money(r.get("Actual Draft")),
            "fcstAmzn": money(r.get("Fcst AMZN")),
            "actualAmzn": money(r.get("Actual AMZN")),
            "fcstGd": money(r.get("Fcst GD")),
            "paidGdWork": money(r.get("Paid GD Work")),
            "fcstWeb": money(r.get("Fcst Web")),
            "actualWeb": money(r.get("Actual Web")),
            "forecastWmt": money(r.get("Forecast WMT")),
            "actualWmt": money(r.get("Actual WMT")),
        })

    rows.sort(key=lambda r: (r["year"], r["weekNum"]))
    years = sorted({r["year"] for r in rows}, reverse=True)
    print(f"  {len(rows):,} weekly rows (View=YES), years {years[-1]}-{years[0]}")

    data = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "years": years,
        "rows": rows,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2))
    print(f"\nWrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
