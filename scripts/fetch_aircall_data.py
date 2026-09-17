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
    duration TABLE, which converts the same underlying seconds to hours for
    display. Both are correct; they're just two different fields/formats
    applied to the same raw numbers, matching the source report exactly.

## Upgrade brief additions (per JV's shared doc, 2026-09-17)

  - **Executive Summary** (`summary.windows`) — 5 headline KPIs (total calls,
    talk time, avg call duration, IB/OB split, tag coverage) plus an
    auto-generated narrative sentence, all with real period-over-period
    deltas. This only works because `dailyRaw` already carries a 180-day
    trailing window (see RAW_WINDOW_DAYS below) — comfortably enough to look
    one period further back for every preset, so the brief's Priority 5
    ("fast-follow, scope as phase 2 if data isn't available") ships now
    instead of being deferred.
  - **Consolidated duration table** (`consolidatedDuration.windows`) replaces
    the old 3-table (Inbound/Outbound/Total) layout with one per-employee
    table — Inbound/Outbound/Total hours, Total Calls, IB/OB split — sorted
    by Total Duration descending. The decorative per-column heatmap is gone;
    the only color left is a `callsDropFlag` (amber) on any employee whose
    Total Calls fell >20% vs. the prior period of equal length, using the
    same period-over-period machinery as the summary.
  - `trend()` / `prev_period()` below are a direct port of the same-named
    helpers in scripts/fetch_data.py (CEO Dashboard) — this script never
    needed period-over-period before now.

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


def trend(curr: float, prev: float) -> dict | None:
    if prev == 0:
        return None
    pct = round((curr - prev) / prev * 100, 1)
    direction = "up" if pct > 0 else "down" if pct < 0 else "na"
    return {"changePct": pct, "direction": direction}


def prev_period(start: date, end: date) -> tuple[date, date]:
    length = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length - 1)
    return prev_start, prev_end


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


def per_employee_direction_totals(daily: dict, start: date, end: date) -> dict[str, dict]:
    """{employee: {ib, ob, ibCount, obCount}} — durations in raw seconds."""
    per: dict[str, dict] = defaultdict(lambda: {"ib": 0.0, "ob": 0.0, "ibCount": 0, "obCount": 0})
    for (d, user, direction), v in daily.items():
        if not (start <= d <= end):
            continue
        key = "ib" if direction == "inbound" else "ob"
        per[user][key] += v["durTotal"]
        per[user][f"{key}Count"] += v["count"]
    return per


def build_consolidated_table(daily: dict, start: date, end: date, prev_start: date, prev_end: date) -> dict:
    """Priority 2 (brief) — replaces the old 3-table (Inbound/Outbound/Total)
    layout with one per-employee table, sorted by Total Duration descending.
    `callsDropFlag` is the brief's amber conditional-format: True when that
    employee's Total Calls fell >20% vs. the immediately-prior period of
    equal length (None/0 prior => no flag, nothing to compare against)."""
    cur = per_employee_direction_totals(daily, start, end)
    prev = per_employee_direction_totals(daily, prev_start, prev_end)

    rows = []
    for user, v in cur.items():
        total_calls = v["ibCount"] + v["obCount"]
        prev_v = prev.get(user)
        prev_total_calls = (prev_v["ibCount"] + prev_v["obCount"]) if prev_v else 0
        calls_drop_flag = bool(prev_total_calls) and (total_calls - prev_total_calls) / prev_total_calls <= -0.2
        rows.append({
            "employee": user,
            "inboundHours": round(v["ib"] / 3600, 2),
            "outboundHours": round(v["ob"] / 3600, 2),
            "totalHours": round((v["ib"] + v["ob"]) / 3600, 2),
            "totalCalls": total_calls,
            "splitLabel": (
                f"{round(v['ibCount'] / total_calls * 100)}% / {round(v['obCount'] / total_calls * 100)}%"
                if total_calls else "-"
            ),
            "callsDropFlag": calls_drop_flag,
        })
    rows.sort(key=lambda r: -r["totalHours"])

    grand_ib = sum(v["ib"] for v in cur.values())
    grand_ob = sum(v["ob"] for v in cur.values())
    grand_ib_count = sum(v["ibCount"] for v in cur.values())
    grand_ob_count = sum(v["obCount"] for v in cur.values())
    grand_calls = grand_ib_count + grand_ob_count

    return {
        "rows": rows,
        "grandTotal": {
            "employee": "Grand total",
            "inboundHours": round(grand_ib / 3600, 2),
            "outboundHours": round(grand_ob / 3600, 2),
            "totalHours": round((grand_ib + grand_ob) / 3600, 2),
            "totalCalls": grand_calls,
            "splitLabel": (
                f"{round(grand_ib_count / grand_calls * 100)}% / {round(grand_ob_count / grand_calls * 100)}%"
                if grand_calls else "-"
            ),
            "callsDropFlag": False,
        },
    }


def build_consolidated_windows(daily: dict, anchor: date) -> dict:
    out = {}
    for key in PRESET_KEYS:
        start, end = resolve_preset(anchor, key)
        prev_start, prev_end = prev_period(start, end)
        out[key] = build_consolidated_table(daily, start, end, prev_start, prev_end)
    return out


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
# 3. Executive Summary (Priority 1 + 5, brief 2026-09-17)
# ---------------------------------------------------------------------------


def calls_totals(daily: dict, start: date, end: date, directions: set[str]) -> tuple[float, int]:
    """(total duration in seconds, call count) across all employees."""
    dur_total = 0.0
    count = 0
    for (d, _user, direction), v in daily.items():
        if direction not in directions or not (start <= d <= end):
            continue
        dur_total += v["durTotal"]
        count += v["count"]
    return dur_total, count


def tag_totals(daily: dict[tuple[date, str, str], int], start: date, end: date) -> tuple[int, int]:
    """(tagged count, grand count) — 'tagged' excludes the blank/'-' Main Tag."""
    grand = 0
    untagged = 0
    for (d, tag, _initial), c in daily.items():
        if not (start <= d <= end):
            continue
        grand += c
        if tag == "-":
            untagged += c
    return grand - untagged, grand


def build_summary_narrative(total_calls: int, calls_trend: dict | None, talk_hours: float, ib_pct: float, ob_pct: float, tag_pct: float) -> str:
    if calls_trend:
        verb = "up" if calls_trend["direction"] == "up" else "down" if calls_trend["direction"] == "down" else "flat"
        delta_clause = f", {verb} {abs(calls_trend['changePct'])}% vs. the prior period"
    else:
        delta_clause = ""
    lead = f"Team handled {total_calls:,} calls totaling {talk_hours} hours this period{delta_clause}."

    if ob_pct > ib_pct:
        split = f"Outbound activity ({ob_pct}% of calls) continues to outpace inbound."
    elif ib_pct > ob_pct:
        split = f"Inbound activity ({ib_pct}% of calls) continues to outpace outbound."
    else:
        split = "Inbound and outbound activity are evenly split this period."

    if tag_pct < 60:
        tag_line = f"Tag coverage remains a gap at {tag_pct}% of calls categorized."
    elif tag_pct >= 85:
        tag_line = f"Tag coverage is strong at {tag_pct}% of calls categorized."
    else:
        tag_line = f"Tag coverage stands at {tag_pct}% of calls categorized."

    return f"{lead} {split} {tag_line}"


def build_summary_window(calls_daily: dict, tags_daily: dict, start: date, end: date, prev_start: date, prev_end: date) -> dict:
    dur_total_s, count = calls_totals(calls_daily, start, end, {"inbound", "outbound"})
    dur_total_s_prev, count_prev = calls_totals(calls_daily, prev_start, prev_end, {"inbound", "outbound"})
    _, ib_count = calls_totals(calls_daily, start, end, {"inbound"})
    _, ob_count = calls_totals(calls_daily, start, end, {"outbound"})
    tagged, tag_grand = tag_totals(tags_daily, start, end)
    tagged_prev, tag_grand_prev = tag_totals(tags_daily, prev_start, prev_end)

    talk_hours = round(dur_total_s / 3600, 1)
    talk_hours_prev = round(dur_total_s_prev / 3600, 1)
    avg_seconds = round(dur_total_s / count, 1) if count else None
    avg_seconds_prev = round(dur_total_s_prev / count_prev, 1) if count_prev else None
    ib_pct = round(ib_count / count * 100, 1) if count else 0
    ob_pct = round(ob_count / count * 100, 1) if count else 0
    tag_coverage_pct = round(tagged / tag_grand * 100, 1) if tag_grand else 0
    tag_coverage_pct_prev = round(tagged_prev / tag_grand_prev * 100, 1) if tag_grand_prev else 0

    calls_trend = trend(count, count_prev)

    return {
        "totalCalls": {"value": count, "trend": calls_trend},
        "totalTalkTimeHours": {"value": talk_hours, "trend": trend(talk_hours, talk_hours_prev)},
        "avgCallDurationSeconds": {
            "value": avg_seconds,
            "trend": trend(avg_seconds, avg_seconds_prev) if avg_seconds is not None and avg_seconds_prev is not None else None,
        },
        "inboundPct": ib_pct,
        "outboundPct": ob_pct,
        "tagCoveragePct": {"value": tag_coverage_pct, "trend": trend(tag_coverage_pct, tag_coverage_pct_prev)},
        "narrative": build_summary_narrative(count, calls_trend, talk_hours, ib_pct, ob_pct, tag_coverage_pct),
    }


def build_summary_windows(calls_daily: dict, tags_daily: dict, anchor: date) -> dict:
    out = {}
    for key in PRESET_KEYS:
        start, end = resolve_preset(anchor, key)
        prev_start, prev_end = prev_period(start, end)
        out[key] = build_summary_window(calls_daily, tags_daily, start, end, prev_start, prev_end)
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    print("Downloading AirCall Data workbook (Raw Data 4-24 + Tags_Data) ...")
    wb = download_workbook()

    print("Building consolidated Calls Duration table + charts ...")
    calls_daily, anchor = load_calls_daily(wb)
    consolidated_windows = build_consolidated_windows(calls_daily, anchor)
    chart_windows = build_chart_windows(calls_daily, anchor)
    calls_raw = build_calls_daily_raw(calls_daily, anchor)

    print("Building Calls by Tag / Calls by Tag by User (date-driven) ...")
    tags_daily = load_tags_daily(wb)
    tag_windows = build_calls_by_tag_windows(tags_daily, anchor)
    tag_by_user_windows = build_calls_by_tag_by_user_windows(tags_daily, anchor)
    tags_raw = build_tags_daily_raw(tags_daily, anchor)

    print("Building Executive Summary (period-over-period) ...")
    summary_windows = build_summary_windows(calls_daily, tags_daily, anchor)

    data = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "anchor": anchor.isoformat(),
        "summary": {"windows": summary_windows},
        "consolidatedDuration": {"windows": consolidated_windows},
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
