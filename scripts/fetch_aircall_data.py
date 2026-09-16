#!/usr/bin/env python3
"""
Pulls the real AirCall Dashboard data from the "AirCall Data" Google Sheet
(spreadsheet 1VRD9Rkk7h4AWfTJlwm9xU3Xc91euZxvh3MYtrNMNetI) and writes
src/data/aircallDashboardData.json in the shape the UI components expect.

Sheet is link-accessible (no auth needed) — but pulled via **XLSX export**,
not CSV: both source tabs are 56,000+ rows, and Google's CSV export silently
truncates very large sheets at a fixed row count (observed ~56,800 rows here)
rather than erroring, which quietly drops the most recent ~1 year of data. The
XLSX export doesn't have that cap. Re-run this any time to refresh:

    python3 scripts/fetch_aircall_data.py

## What's date-driven

  - Inbound/Outbound/Total Calls Duration tables, and their 3 line charts,
    ARE bound to the date-range picker (verified: recomputing the Aug 19 -
    Sep 15, 2026 window from raw rows reproduces the reference screenshot's
    numbers exactly, e.g. Bikus Rodriguez 18.46h / 17.98h / 216 inbound calls).
  - Calls by Tag and Calls by Tag by User are ALSO bound to the date-range
    picker (per JV, 2026-09-17). In the *original* Looker report these were
    all-time totals regardless of the page's date filter — verified against
    the reference screenshot at the time — but that was a deliberate
    divergence from this rebuild's intent, not something to preserve, so
    both tables now use the same picker/anchor as the duration tables.
  - The 3 line charts plot the raw `duration (total)` / `duration (in call)`
    fields UNCONVERTED (seconds, matching the Y-axis scale in the reference
    screenshot, e.g. peaks in the 15-20K range) — a different unit than the
    duration TABLES, which convert the same underlying seconds to hours for
    display. Both are correct; they're just two different fields/formats
    applied to the same raw numbers, matching the source report exactly.

## Date-range picker architecture (mirrors scripts/fetch_data.py)

For the 3 duration tables + their charts, this script computes:
  1. **`windows`** — the 6 preset ranges (Today, Yesterday, Last 7 days,
     Last 30 days, This month, Last month), anchored to the latest date with
     any call activity. See src/lib/aircallDateRange.ts for the client-side
     mirror used for "Custom range".
  2. **`dailyRaw`** — per (date, employee, direction) call aggregates,
     capped to the trailing RAW_WINDOW_DAYS days, for client-computed custom
     ranges (tables AND charts, since a chart's daily series is just a
     sum-across-employees view of the same rows).
"""

from __future__ import annotations

import json
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import openpyxl

SHEET_ID = "1VRD9Rkk7h4AWfTJlwm9xU3Xc91euZxvh3MYtrNMNetI"
OUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "aircallDashboardData.json"

RAW_DATA_TAB = "Raw Data 4-24"
TAGS_DATA_TAB = "Tags_Data"

PRESET_KEYS = ["today", "yesterday", "last7", "last30", "thisMonth", "lastMonth"]
RAW_WINDOW_DAYS = 180
NO_USER_LABEL = "[No associated user]"

# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------


def download_workbook() -> openpyxl.Workbook:
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx"
    with urllib.request.urlopen(url, timeout=120) as resp:
        raw = resp.read()
    tmp_path = Path("/tmp/aircall_sheet.xlsx")
    tmp_path.write_bytes(raw)
    return openpyxl.load_workbook(tmp_path, read_only=True, data_only=True)


def sheet_rows(wb: openpyxl.Workbook, tab: str) -> tuple[dict[str, int], "Iterator"]:
    ws = wb[tab]
    rows_iter = ws.iter_rows(values_only=True)
    header = next(rows_iter)
    idx = {h: i for i, h in enumerate(header) if h}
    return idx, rows_iter


# ---------------------------------------------------------------------------
# Shared date/format helpers (mirrors scripts/fetch_data.py)
# ---------------------------------------------------------------------------


def latest_active_date(daily: dict[date, float], fallback: date) -> date:
    active = [d for d, v in daily.items() if v != 0]
    return max(active) if active else fallback


def resolve_preset(anchor: date, key: str) -> tuple[date, date]:
    if key == "today":
        return anchor, anchor
    if key == "yesterday":
        d = anchor - timedelta(days=1)
        return d, d
    if key == "last7":
        return anchor - timedelta(days=6), anchor
    if key == "last30":
        return anchor - timedelta(days=29), anchor
    if key == "thisMonth":
        return anchor.replace(day=1), anchor
    if key == "lastMonth":
        first_this = anchor.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        first_prev = last_prev.replace(day=1)
        return first_prev, last_prev
    raise ValueError(f"unknown preset {key}")


def date_key(d: date) -> str:
    return d.isoformat()


def as_date(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    return None


# ---------------------------------------------------------------------------
# 1. Raw Data 4-24 — Inbound / Outbound / Total Calls Duration tables + charts
# ---------------------------------------------------------------------------


def load_calls_daily(wb: openpyxl.Workbook) -> tuple[dict, date]:
    """Returns {(date, employee, direction): {durTotal, durCall, count}}."""
    idx, rows_iter = sheet_rows(wb, RAW_DATA_TAB)
    daily: dict[tuple[date, str, str], dict] = defaultdict(lambda: {"durTotal": 0.0, "durCall": 0.0, "count": 0})
    activity: dict[date, float] = defaultdict(float)
    max_date: date | None = None

    for row in rows_iter:
        d = as_date(row[idx["Date"]])
        if d is None:
            continue
        direction = (row[idx["direction"]] or "").strip().lower()
        if direction not in ("inbound", "outbound"):
            continue
        user = (row[idx["user"]] or "").strip() or NO_USER_LABEL
        dur_total = row[idx["duration (total)"]] or 0
        dur_call = row[idx["duration (in call)"]] or 0
        try:
            dur_total = float(dur_total)
        except (TypeError, ValueError):
            dur_total = 0.0
        try:
            dur_call = float(dur_call)
        except (TypeError, ValueError):
            dur_call = 0.0

        key = (d, user, direction)
        daily[key]["durTotal"] += dur_total
        daily[key]["durCall"] += dur_call
        daily[key]["count"] += 1

        activity[d] += 1
        if max_date is None or d > max_date:
            max_date = d

    if max_date is None:
        raise RuntimeError(f"{RAW_DATA_TAB}: no parseable dates found")

    anchor = latest_active_date(activity, fallback=max_date)
    return daily, anchor


def calls_window(daily: dict, start: date, end: date) -> dict:
    """Builds the Inbound/Outbound/Total table rows for one window. No trend
    column here — verified against the reference report, which shows just
    Duration (total), Duration (in call), count, and % of total per table."""

    def totals_for(direction_filter: set[str], s: date, e: date) -> dict[str, dict]:
        per_emp: dict[str, dict] = defaultdict(lambda: {"durTotal": 0.0, "durCall": 0.0, "count": 0})
        for (d, user, direction), v in daily.items():
            if direction not in direction_filter or not (s <= d <= e):
                continue
            per_emp[user]["durTotal"] += v["durTotal"]
            per_emp[user]["durCall"] += v["durCall"]
            per_emp[user]["count"] += v["count"]
        return per_emp

    def build_table(direction_filter: set[str], count_label: str, count_pct_label: str) -> dict:
        cur = totals_for(direction_filter, start, end)
        grand_count = sum(v["count"] for v in cur.values())
        grand_dur_total = sum(v["durTotal"] for v in cur.values())
        grand_dur_call = sum(v["durCall"] for v in cur.values())

        rows = []
        for user, v in cur.items():
            rows.append({
                "employee": user,
                "durationTotal": round(v["durTotal"] / 3600, 2),
                "durationInCall": round(v["durCall"] / 3600, 2) if v["count"] else None,
                "count": v["count"],
                "countPct": round(v["count"] / grand_count * 100, 1) if grand_count else 0,
            })
        rows.sort(key=lambda r: -r["count"])

        return {
            "rows": rows,
            "grandTotal": {
                "durationTotal": round(grand_dur_total / 3600, 2),
                "durationInCall": round(grand_dur_call / 3600, 2),
                "count": grand_count,
                "countPct": 100.0 if grand_count else 0,
            },
            "countLabel": count_label,
            "countPctLabel": count_pct_label,
        }

    return {
        "inbound": build_table({"inbound"}, "IB (total)", "IB %"),
        "outbound": build_table({"outbound"}, "OB (total)", "OB %"),
        "total": build_table({"inbound", "outbound"}, "Total Calls", "IB/OB %"),
    }


def build_calls_windows(daily: dict, anchor: date) -> dict:
    return {key: calls_window(daily, *resolve_preset(anchor, key)) for key in PRESET_KEYS}


def build_calls_daily_raw(daily: dict, anchor: date) -> list[dict]:
    start = anchor - timedelta(days=RAW_WINDOW_DAYS - 1)
    out = []
    for (d, user, direction), v in daily.items():
        if not (start <= d <= anchor):
            continue
        out.append({
            "date": date_key(d),
            "employee": user,
            "direction": direction,
            "durationTotal": round(v["durTotal"], 2),
            "durationInCall": round(v["durCall"], 2),
            "count": v["count"],
        })
    return out


def chart_series(daily: dict, start: date, end: date) -> dict:
    """Daily (summed across employees) duration series in raw seconds, per
    direction — matches the reference report's line-chart Y-axis scale."""
    ib_total: dict[date, float] = defaultdict(float)
    ib_call: dict[date, float] = defaultdict(float)
    ob_total: dict[date, float] = defaultdict(float)
    ob_call: dict[date, float] = defaultdict(float)

    for (d, _user, direction), v in daily.items():
        if not (start <= d <= end):
            continue
        if direction == "inbound":
            ib_total[d] += v["durTotal"]
            ib_call[d] += v["durCall"]
        elif direction == "outbound":
            ob_total[d] += v["durTotal"]
            ob_call[d] += v["durCall"]

    out = []
    d = start
    while d <= end:
        it, ic, ot, oc = ib_total.get(d, 0), ib_call.get(d, 0), ob_total.get(d, 0), ob_call.get(d, 0)
        out.append({
            "date": date_key(d),
            "inboundDurationTotal": round(it, 2),
            "inboundDurationInCall": round(ic, 2),
            "outboundDurationTotal": round(ot, 2),
            "outboundDurationInCall": round(oc, 2),
            "totalDurationTotal": round(it + ot, 2),
            "totalDurationInCall": round(ic + oc, 2),
        })
        d += timedelta(days=1)
    return {"points": out}


def build_chart_windows(daily: dict, anchor: date) -> dict:
    return {key: chart_series(daily, *resolve_preset(anchor, key)) for key in PRESET_KEYS}


# ---------------------------------------------------------------------------
# 2. Tags_Data — Calls by Tag / Calls by Tag by User (date-driven)
# ---------------------------------------------------------------------------

HEADER_ARTIFACT_TAGS = {"MAIN TAG"}
BLANK_INITIALS = {"", "-NA-", "Initial"}


def load_tags_daily(wb: openpyxl.Workbook) -> dict[tuple[date, str, str], int]:
    """Returns {(date, tag, initial): count}. `tag` is "-" for a blank Main
    Tag (Calls by Tag counts that as its own category); `initial` is "" when
    blank/invalid — kept (not dropped) so it still counts toward Calls by
    Tag's totals, and only excluded when building the by-user pivot, which
    needs a real employee to attribute the call to."""
    idx, rows_iter = sheet_rows(wb, TAGS_DATA_TAB)
    daily: dict[tuple[date, str, str], int] = defaultdict(int)
    for row in rows_iter:
        d = as_date(row[idx["Date"]])
        if d is None:
            continue
        main_tag = row[idx["Main Tag"]]
        if main_tag in HEADER_ARTIFACT_TAGS:
            continue
        tag = (main_tag or "").strip() or "-"
        initial = (row[idx["initial"]] or "").strip()
        if initial in BLANK_INITIALS:
            initial = ""
        daily[(d, tag, initial)] += 1
    return daily


def calls_by_tag_window(daily: dict[tuple[date, str, str], int], start: date, end: date) -> dict:
    totals: dict[str, int] = defaultdict(int)
    grand = 0
    for (d, tag, _initial), c in daily.items():
        if not (start <= d <= end):
            continue
        totals[tag] += c
        grand += c

    rows = [
        {"tag": t, "total": c, "pctOfTotal": round(c / grand * 100, 2) if grand else 0}
        for t, c in sorted(totals.items(), key=lambda kv: -kv[1])
    ]
    return {"rows": rows, "grandTotal": grand}


def calls_by_tag_by_user_window(daily: dict[tuple[date, str, str], int], start: date, end: date) -> dict:
    matrix: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    row_totals: dict[str, int] = defaultdict(int)
    col_totals: dict[str, int] = defaultdict(int)
    grand = 0

    for (d, tag, initial), c in daily.items():
        if not (start <= d <= end) or tag == "-" or not initial:
            continue
        matrix[tag][initial] += c
        row_totals[tag] += c
        col_totals[initial] += c
        grand += c

    row_order = sorted(row_totals.keys(), key=lambda t: -row_totals[t])
    col_order = sorted(col_totals.keys(), key=lambda c: -col_totals[c])
    max_cell = max((v for row in matrix.values() for v in row.values()), default=0)

    return {
        "rowOrder": row_order,
        "colOrder": col_order,
        "matrix": {t: {c: matrix[t].get(c, 0) for c in col_order} for t in row_order},
        "colTotals": {c: col_totals[c] for c in col_order},
        "grandTotal": grand,
        "maxCell": max_cell,
    }


def build_calls_by_tag_windows(daily: dict, anchor: date) -> dict:
    return {key: calls_by_tag_window(daily, *resolve_preset(anchor, key)) for key in PRESET_KEYS}


def build_calls_by_tag_by_user_windows(daily: dict, anchor: date) -> dict:
    return {key: calls_by_tag_by_user_window(daily, *resolve_preset(anchor, key)) for key in PRESET_KEYS}


def build_tags_daily_raw(daily: dict[tuple[date, str, str], int], anchor: date) -> list[dict]:
    start = anchor - timedelta(days=RAW_WINDOW_DAYS - 1)
    out = []
    for (d, tag, initial), c in daily.items():
        if not (start <= d <= anchor):
            continue
        out.append({"date": date_key(d), "tag": tag, "initial": initial, "count": c})
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    print("Downloading AirCall Data workbook (Raw Data 4-24 + Tags_Data) ...")
    wb = download_workbook()

    print("Building Inbound/Outbound/Total Calls Duration tables + charts ...")
    calls_daily, anchor = load_calls_daily(wb)
    calls_windows = build_calls_windows(calls_daily, anchor)
    chart_windows = build_chart_windows(calls_daily, anchor)
    calls_raw = build_calls_daily_raw(calls_daily, anchor)

    print("Building Calls by Tag / Calls by Tag by User (date-driven) ...")
    tags_daily = load_tags_daily(wb)
    tag_windows = build_calls_by_tag_windows(tags_daily, anchor)
    tag_by_user_windows = build_calls_by_tag_by_user_windows(tags_daily, anchor)
    tags_raw = build_tags_daily_raw(tags_daily, anchor)

    data = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "anchor": anchor.isoformat(),
        "callsDuration": {"windows": calls_windows},
        "callsCharts": {"windows": chart_windows},
        "callsByTag": {"windows": tag_windows},
        "callsByTagByUser": {"windows": tag_by_user_windows},
        "dailyRaw": {"calls": calls_raw, "tags": tags_raw},
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2))
    print(f"\nWrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
