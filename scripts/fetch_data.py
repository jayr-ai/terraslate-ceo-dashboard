#!/usr/bin/env python3
"""
Pulls the real TerraSlate CEO Dashboard data from the confirmed Google Sheet
("DailyDashRaw_TerraSlate") and writes src/data/ceoDashboardData.json in the
shape the UI components expect (see src/data/ceoDashboardMockData.ts for the
TypeScript types this mirrors).

Sheet is link-accessible (no auth needed) — pulled via CSV export per tab gid.
Re-run this any time to refresh the dashboard with current numbers:

    python3 scripts/fetch_data.py

## Date-range picker architecture (added when wiring the picker to real data)

Only the trend-driven sections respond to the date-range picker: Sales Across
Channels (5.1), Marketing Metrics (5.3), Breadwinnaz (5.4), and Proof/Graphic
Team sales + Graphic Design Value + Graphics Team Hrs (5.7). Everything else
(TerraSlate Tracker, Pre-Press, Production Teams, Shipping by State, Traffic)
is all-time/snapshot data in the original report too — not date-ranged — so
it's computed once and left alone. That's an intentional scope boundary, not
an oversight.

For the trend-driven sections, this script computes two things:

  1. **`windows`** — the 6 preset ranges (Today, Yesterday, Last 7 days,
     Last 30 days, This month, Last month) computed exactly here in Python,
     each anchored to that dataset's own latest *active* (nonzero) date —
     see `latest_active_date()`. The client just switches between these
     precomputed objects instantly; no business logic is duplicated in TS.
  2. **`dailyRaw`** — capped to the trailing `RAW_WINDOW_DAYS` days, for the
     picker's "Custom range" option, which by definition can't be
     precomputed. The client sums/ranks over this raw data itself (see
     src/lib/dateRange.ts). Capped (not full history back to 2022) to keep
     the bundle the whole rebuild exists to make fast — a custom range
     older than ~6 months isn't supported. Extend RAW_WINDOW_DAYS if needed.

Other assumptions made here (documented, not silently baked in — revisit
with JV):
  - Proof Team vs Graphic Team rosters (SalesPerStaff has no team column) are
    hardcoded from the original report's implied team composition. Revisit if
    team membership changes.
  - 5.8 Shipping by State sums Orders across ALL available history (not just
    a trailing window) — it's a "where do we ship" distribution view, not a
    trend metric, and isn't affected by the date-range picker.
  - "Previous period" for any trend % is always the immediately preceding
    span of the *same length* as the current one (e.g. This month compares
    against the same number of trailing days before the 1st) — not a
    calendar-aligned comparison. Simple and consistent across all 6 presets.
"""

from __future__ import annotations

import csv
import io
import json
import re
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

SHEET_ID = "1Xa3lc7x2pFQzoja-b56MDbVFSEa_2YjGHAq6QjV4jDs"
OUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "ceoDashboardData.json"

GIDS = {
    "CombinedSales": "638946072",
    "Shopify": "0",
    "Amazon": "1285467245",
    "Walmart": "173024945",
    "SalesPerStaff": "1960618771",
    "PrePress": "1994889999",
    "ProductionRaw": "1640795782",
    "BlankOrders": "7907402",
    "ADS": "1123383329",
    "GoogleSearch": "136658584",
    "country_city": "1280543235",
    "graphics_clockify": "1857680629",
    "graphic_design": "2057957862",
}

PRESET_KEYS = ["today", "yesterday", "last7", "last30", "thisMonth", "lastMonth"]
RAW_WINDOW_DAYS = 180

# ---------------------------------------------------------------------------
# Fetch + parse helpers
# ---------------------------------------------------------------------------


def fetch_csv_rows(tab: str) -> list[dict[str, str]]:
    gid = GIDS[tab]
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        raw = resp.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(raw))
    return list(reader)


def money(s: str | None) -> float:
    if not s:
        return 0.0
    s = s.strip().replace("$", "").replace(",", "")
    if s in ("", "-", "N/A", "n/a"):
        return 0.0
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    try:
        v = float(s)
    except ValueError:
        return 0.0
    return -v if neg else v


def num(s: str | None) -> float:
    if not s:
        return 0.0
    s = s.strip().replace(",", "")
    if s in ("", "-", "N/A", "n/a"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


_DATE_FORMATS = [
    "%m/%d/%Y",
    "%m/%d/%y",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d",
    "%b-%d-%Y",
    "%m-%d-%Y",
]


def parse_date(s: str | None, year: int | None = None) -> date | None:
    if not s:
        return None
    s = s.strip()
    if not s:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    if year is not None:
        # ProductionRaw's "Date & Time Info Received" omits the year and
        # sometimes appends a time-of-day, e.g. "9/8 3:44 PM" — strip the
        # time and assume the given (current) year. Safe here since the
        # 180-day trailing window never crosses a year boundary in practice.
        date_part = s.split(" ")[0]
        try:
            return datetime.strptime(f"{date_part}/{year}", "%m/%d/%Y").date()
        except ValueError:
            return None
    return None


def fmt_money(v: float) -> str:
    return f"${v:,.2f}"


def fmt_money_k(v: float) -> str:
    return f"${v / 1000:,.2f}K"


def trend(curr: float, prev: float) -> dict | None:
    if prev == 0:
        return None
    pct = round((curr - prev) / prev * 100, 1)
    direction = "up" if pct > 0 else "down" if pct < 0 else "na"
    return {"changePct": pct, "direction": direction}


def latest_active_date(daily: dict[date, float], fallback: date) -> date:
    """Latest date with a nonzero value — some tabs scaffold future dates with
    $0 placeholder rows ahead of real data landing (e.g. CombinedSales runs
    ~6 days of $0 Shopify rows past the last real one). Anchoring on the raw
    max row date would silently eat real days out of the trailing window."""
    active = [d for d, v in daily.items() if v != 0]
    return max(active) if active else fallback


def spark(daily: dict[date, float], start: date, end: date) -> list[float] | None:
    if (end - start).days < 1:
        return None  # single-day windows (Today/Yesterday) — no line to draw
    out = []
    d = start
    while d <= end:
        out.append(round(daily.get(d, 0.0), 2))
        d += timedelta(days=1)
    return out


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


def prev_period(start: date, end: date) -> tuple[date, date]:
    length = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length - 1)
    return prev_start, prev_end


def date_key(d: date) -> str:
    return d.isoformat()


# ---------------------------------------------------------------------------
# 5.1 Sales Across Channels
# ---------------------------------------------------------------------------

CHANNELS = ["Shopify", "Amazon", "Walmart"]


def load_sales_daily() -> tuple[dict[str, dict[date, float]], date]:
    rows = fetch_csv_rows("CombinedSales")
    by_channel_daily: dict[str, dict[date, float]] = defaultdict(lambda: defaultdict(float))
    max_date: date | None = None
    for r in rows:
        d = parse_date(r.get("DATE"))
        ch = (r.get("CHANNEL") or "").strip()
        if not d or not ch:
            continue
        by_channel_daily[ch][d] += money(r.get("SALE"))
        if max_date is None or d > max_date:
            max_date = d
    if max_date is None:
        raise RuntimeError("CombinedSales: no parseable dates found")

    # Anchor on Shopify+Amazon's latest ACTIVE day, not the raw max row date —
    # the sheet scaffolds several days of $0 placeholder rows ahead of real
    # data landing. Walmart is excluded from the anchor since it's
    # independently stale for months and would never sensibly drive it.
    core_daily: dict[date, float] = defaultdict(float)
    for ch in ("Shopify", "Amazon"):
        for d, v in by_channel_daily.get(ch, {}).items():
            core_daily[d] += v
    anchor = latest_active_date(core_daily, fallback=max_date)
    return by_channel_daily, anchor


def sales_window(by_channel_daily: dict[str, dict[date, float]], start: date, end: date) -> dict:
    prev_start, prev_end = prev_period(start, end)

    def window_sum(daily: dict[date, float], s: date, e: date) -> float:
        return sum(v for d, v in daily.items() if s <= d <= e)

    channel_cur = {ch: window_sum(by_channel_daily.get(ch, {}), start, end) for ch in CHANNELS}
    channel_prev = {ch: window_sum(by_channel_daily.get(ch, {}), prev_start, prev_end) for ch in CHANNELS}
    overall_cur = sum(channel_cur.values())
    overall_prev = sum(channel_prev.values())

    overall_daily: dict[date, float] = defaultdict(float)
    for ch in CHANNELS:
        for d, v in by_channel_daily.get(ch, {}).items():
            overall_daily[d] += v

    def kpi(id_, label, cur, prev, daily, hero=False) -> dict:
        if cur == 0:
            return {"id": id_, "label": label, "value": "No data", "empty": True}
        return {
            "id": id_,
            "label": label,
            "value": fmt_money(cur),
            "hero": hero,
            "trend": trend(cur, prev),
            "sparkline": spark(daily, start, end),
        }

    kpis = [
        kpi("overall-sales", "Overall Sales", overall_cur, overall_prev, overall_daily, hero=True),
        kpi("shopify-sales", "Shopify Sales", channel_cur["Shopify"], channel_prev["Shopify"], by_channel_daily["Shopify"]),
        kpi("amazon-sales", "Amazon Sales", channel_cur["Amazon"], channel_prev["Amazon"], by_channel_daily["Amazon"]),
        kpi("walmart-sales", "Walmart Sales", channel_cur["Walmart"], channel_prev["Walmart"], by_channel_daily["Walmart"]),
    ]

    if overall_cur > 0:
        mix = [{"id": ch.lower(), "label": ch, "pct": round(channel_cur[ch] / overall_cur * 100, 1)} for ch in CHANNELS]
    else:
        mix = [{"id": ch.lower(), "label": ch, "pct": 0} for ch in CHANNELS]

    return {
        "kpis": kpis,
        "channelMix": mix,
        "windowStart": start.isoformat(),
        "windowEnd": end.isoformat(),
    }


def build_sales_windows(by_channel_daily, anchor) -> dict:
    return {key: sales_window(by_channel_daily, *resolve_preset(anchor, key)) for key in PRESET_KEYS}


def build_sales_daily_raw(by_channel_daily: dict[str, dict[date, float]], anchor: date) -> list[dict]:
    start = anchor - timedelta(days=RAW_WINDOW_DAYS - 1)
    out = []
    d = start
    while d <= anchor:
        out.append({
            "date": date_key(d),
            "shopify": round(by_channel_daily.get("Shopify", {}).get(d, 0.0), 2),
            "amazon": round(by_channel_daily.get("Amazon", {}).get(d, 0.0), 2),
            "walmart": round(by_channel_daily.get("Walmart", {}).get(d, 0.0), 2),
        })
        d += timedelta(days=1)
    return out


# ---------------------------------------------------------------------------
# 5.2 TerraSlate Tracker (date-ranged)
# ---------------------------------------------------------------------------

_EMPTY_TRACKER_DAY = {"prodValue": 0.0, "printedOrders": 0, "blankValue": 0.0, "blankOrders": 0}


def load_terraslate_tracker_daily() -> tuple[dict[date, dict], date]:
    prod_rows = fetch_csv_rows("ProductionRaw")
    blank_rows = fetch_csv_rows("BlankOrders")
    this_year = date.today().year

    daily: dict[date, dict] = defaultdict(lambda: dict(_EMPTY_TRACKER_DAY))

    for r in prod_rows:
        if not (r.get("Order Number") or "").strip():
            continue
        d = parse_date(r.get("SHIP DATE FINAL"), year=this_year)
        if not d:
            continue
        daily[d]["prodValue"] += money(r.get("Order Value"))
        if (r.get("Printed By") or "").strip():
            daily[d]["printedOrders"] += 1

    for r in blank_rows:
        order_num = (r.get("ORDER NUMBER") or "").strip()
        if not order_num or order_num.lower() == "total":
            continue
        d = parse_date(r.get("DATE"))
        if not d:
            continue
        daily[d]["blankValue"] += money(r.get("ORDER VALUE"))
        daily[d]["blankOrders"] += 1

    if not daily:
        raise RuntimeError("TerraSlate Tracker: no parseable dates found")

    activity = {d: v["prodValue"] + v["printedOrders"] + v["blankValue"] + v["blankOrders"] for d, v in daily.items()}
    anchor = latest_active_date(activity, fallback=max(daily.keys()))
    return daily, anchor


def terraslate_tracker_window(daily: dict[date, dict], start: date, end: date) -> dict:
    prev_start, prev_end = prev_period(start, end)

    def window_sum(key: str, s: date, e: date) -> float:
        return sum(v[key] for d, v in daily.items() if s <= d <= e)

    prod_cur, prod_prev = window_sum("prodValue", start, end), window_sum("prodValue", prev_start, prev_end)
    printed_cur, printed_prev = window_sum("printedOrders", start, end), window_sum("printedOrders", prev_start, prev_end)
    blank_val_cur, blank_val_prev = window_sum("blankValue", start, end), window_sum("blankValue", prev_start, prev_end)
    blank_ord_cur, blank_ord_prev = window_sum("blankOrders", start, end), window_sum("blankOrders", prev_start, prev_end)

    def money_tile(id_: str, label: str, cur: float, prev: float) -> dict:
        if cur == 0:
            return {"id": id_, "label": label, "value": "No data", "empty": True}
        return {"id": id_, "label": label, "value": fmt_money(cur), "trend": trend(cur, prev)}

    def count_tile(id_: str, label: str, cur: float, prev: float) -> dict:
        return {"id": id_, "label": label, "value": str(int(cur)), "trend": trend(cur, prev)}

    return {
        "tiles": [
            money_tile("production-order-value", "Production Order Value", prod_cur, prod_prev),
            count_tile("printed-orders", "Printed Orders", printed_cur, printed_prev),
            money_tile("blank-order-value", "Blank Order Value", blank_val_cur, blank_val_prev),
            count_tile("blank-orders", "Blank Orders", blank_ord_cur, blank_ord_prev),
        ]
    }


def build_terraslate_tracker_windows(daily: dict[date, dict], anchor: date) -> dict:
    return {key: terraslate_tracker_window(daily, *resolve_preset(anchor, key)) for key in PRESET_KEYS}


def build_terraslate_tracker_daily_raw(daily: dict[date, dict], anchor: date) -> list[dict]:
    start = anchor - timedelta(days=RAW_WINDOW_DAYS - 1)
    out = []
    d = start
    while d <= anchor:
        v = daily.get(d, _EMPTY_TRACKER_DAY)
        out.append({
            "date": date_key(d),
            "prodValue": round(v["prodValue"], 2),
            "printedOrders": v["printedOrders"],
            "blankValue": round(v["blankValue"], 2),
            "blankOrders": v["blankOrders"],
        })
        d += timedelta(days=1)
    return out


# ---------------------------------------------------------------------------
# 5.3 Marketing Metrics
# ---------------------------------------------------------------------------


def load_marketing_daily() -> tuple[list[tuple[date, dict]], dict[date, float], date]:
    rows = fetch_csv_rows("ADS")
    dated: list[tuple[date, dict]] = []
    spend_daily: dict[date, float] = defaultdict(float)
    max_date: date | None = None
    for r in rows:
        d = parse_date(r.get("DATE"))
        if not d:
            continue
        dated.append((d, r))
        spend_daily[d] += money(r.get("AD SPEND"))
        if max_date is None or d > max_date:
            max_date = d
    if max_date is None:
        raise RuntimeError("ADS: no parseable dates found")
    anchor = latest_active_date(spend_daily, fallback=max_date)
    return dated, spend_daily, anchor


def marketing_window(dated: list[tuple[date, dict]], start: date, end: date) -> dict:
    prev_start, prev_end = prev_period(start, end)

    def window_totals(s: date, e: date) -> dict:
        spend = purchase_value = conv = 0.0
        for d, r in dated:
            if s <= d <= e:
                spend += money(r.get("AD SPEND"))
                purchase_value += money(r.get("PURCHASE VALUE"))
                conv += num(r.get("CONV. By Time"))
        roas = purchase_value / spend if spend else 0
        cpa = spend / conv if conv else 0
        return {"spend": spend, "purchase_value": purchase_value, "roas": roas, "cpa": cpa}

    cur = window_totals(start, end)
    prev = window_totals(prev_start, prev_end)

    def tile(id_, label, cur_v, prev_v, fmt):
        return {"id": id_, "label": label, "value": fmt(cur_v), "trend": trend(cur_v, prev_v)}

    return {
        "tiles": [
            tile("roas", "ROAS [FB/GA]", cur["roas"], prev["roas"], lambda v: f"{v:.2f}"),
            tile("ad-spend", "Ad Spend", cur["spend"], prev["spend"], fmt_money_k),
            tile("cpa-combined", "CPA Combined", cur["cpa"], prev["cpa"], lambda v: f"${v:,.2f}"),
            tile("purchase-value", "Purchase Value", cur["purchase_value"], prev["purchase_value"], fmt_money_k),
        ],
        "windowStart": start.isoformat(),
        "windowEnd": end.isoformat(),
    }


def build_marketing_windows(dated, anchor) -> dict:
    return {key: marketing_window(dated, *resolve_preset(anchor, key)) for key in PRESET_KEYS}


def build_marketing_daily_raw(dated: list[tuple[date, dict]], anchor: date) -> list[dict]:
    start = anchor - timedelta(days=RAW_WINDOW_DAYS - 1)
    by_date: dict[date, dict] = defaultdict(lambda: {"spend": 0.0, "purchaseValue": 0.0, "conversions": 0.0})
    for d, r in dated:
        if start <= d <= anchor:
            by_date[d]["spend"] += money(r.get("AD SPEND"))
            by_date[d]["purchaseValue"] += money(r.get("PURCHASE VALUE"))
            by_date[d]["conversions"] += num(r.get("CONV. By Time"))
    out = []
    d = start
    while d <= anchor:
        v = by_date.get(d, {"spend": 0.0, "purchaseValue": 0.0, "conversions": 0.0})
        out.append({
            "date": date_key(d),
            "spend": round(v["spend"], 2),
            "purchaseValue": round(v["purchaseValue"], 2),
            "conversions": round(v["conversions"], 2),
        })
        d += timedelta(days=1)
    return out


# ---------------------------------------------------------------------------
# 5.4 Breadwinnaz + 5.7 Proof/Graphic team sales (all from SalesPerStaff)
# ---------------------------------------------------------------------------

PROOF_TEAM = {"Jose Soto", "Dakota George"}
GRAPHIC_TEAM = {"Steven Peralta Cornejo", "Bailey Pixton", "Luke Bosick", "Steven Cornejo"}


def load_staff_daily() -> tuple[list[tuple[date, str, float]], date]:
    rows = fetch_csv_rows("SalesPerStaff")
    dated: list[tuple[date, str, float]] = []
    daily_total: dict[date, float] = defaultdict(float)
    max_date: date | None = None
    for r in rows:
        name = (r.get("staff_name") or "").strip()
        d = parse_date(r.get("DATE"))
        if not name or not d:
            continue
        v = money(r.get("total_sales"))
        dated.append((d, name, v))
        daily_total[d] += v
        if max_date is None or d > max_date:
            max_date = d
    if max_date is None:
        raise RuntimeError("SalesPerStaff: no parseable dates found")
    anchor = latest_active_date(daily_total, fallback=max_date)
    return dated, anchor


def staff_window(dated: list[tuple[date, str, float]], start: date, end: date) -> tuple[dict, dict, dict]:
    by_staff: dict[str, float] = defaultdict(float)
    for d, name, v in dated:
        if start <= d <= end:
            by_staff[name] += v
    ranked = sorted(by_staff.items(), key=lambda kv: kv[1], reverse=True)

    def rows_for(names_filter=None, top_n=None):
        items = ranked
        if names_filter is not None:
            items = [(n, v) for n, v in ranked if n in names_filter]
        if top_n:
            items = items[:top_n]
        return [{"name": n, "sales": round(v, 2)} for n, v in items]

    breadwinnaz_rows = rows_for(top_n=15)
    return (
        {"rows": [{"rank": i + 1, **row} for i, row in enumerate(breadwinnaz_rows)]},
        {"rows": rows_for(names_filter=PROOF_TEAM)},
        {"rows": rows_for(names_filter=GRAPHIC_TEAM)},
    )


def build_staff_windows(dated, anchor) -> tuple[dict, dict, dict]:
    breadwinnaz_w, proof_w, graphic_w = {}, {}, {}
    for key in PRESET_KEYS:
        start, end = resolve_preset(anchor, key)
        bw, proof, graphic = staff_window(dated, start, end)
        breadwinnaz_w[key] = bw
        proof_w[key] = proof
        graphic_w[key] = graphic
    return breadwinnaz_w, proof_w, graphic_w


def build_staff_daily_raw(dated: list[tuple[date, str, float]], anchor: date) -> list[dict]:
    start = anchor - timedelta(days=RAW_WINDOW_DAYS - 1)
    return [
        {"date": date_key(d), "name": name, "sales": round(v, 2)}
        for d, name, v in dated
        if start <= d <= anchor and v != 0
    ]


# ---------------------------------------------------------------------------
# 5.5 Pre-Press (live snapshot from the sheet, not date-ranged)
# ---------------------------------------------------------------------------


def build_prepress() -> dict:
    rows = fetch_csv_rows("PrePress")
    all_time = []
    ty = []
    for r in rows:
        assignee = (r.get("ASSIGNEE") or "").strip()
        if not assignee:
            continue
        all_time_v = int(num(r.get("ALL TIME")))
        all_time.append({
            "assignee": assignee,
            "allTime": all_time_v,
            "allTimePct": num((r.get("ALLTIME%") or "0").replace("%", "")),
        })
        ty.append({
            "assignee": assignee,
            "t": int(num(r.get("TODAY"))),
            "tPct": num((r.get("TODAY%") or "0").replace("%", "")),
            "y": int(num(r.get("YEST"))),
            "yPct": num((r.get("YEST%") or "0").replace("%", "")),
        })
    all_time.sort(key=lambda r: r["allTime"], reverse=True)
    ty.sort(key=lambda r: r["y"], reverse=True)
    return {"allTime": all_time, "todayYesterday": ty}


# ---------------------------------------------------------------------------
# 5.6 Production team tables (all-time, not date-ranged)
# ---------------------------------------------------------------------------

ROLE_COLUMNS = [
    ("proof-team-ov", "Proof Team", "Proof Owner", "Proof Owner"),
    ("print-team", "Print Team", "Printed By", "Printed By"),
    ("quality-team", "Quality Team", "Quality By", "Quality By"),
    ("coating-team", "Coating Team", "Coated By", "Coated By"),
    ("cutting-team", "Cutting Team", "Cutting Team", "Cut By"),
    ("shipping-team", "Shipping Team", "Shipped By", "Shipped By"),
]


def build_production_teams() -> list[dict]:
    rows = fetch_csv_rows("ProductionRaw")
    tables = []
    for id_, title, person_label, column in ROLE_COLUMNS:
        totals: dict[str, float] = defaultdict(float)
        for r in rows:
            person = (r.get(column) or "").strip()
            if not person or not (r.get("Order Number") or "").strip():
                continue
            totals[person] += money(r.get("Order Value"))
        ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
        tables.append({
            "id": id_,
            "title": title,
            "personLabel": person_label,
            "rows": [{"person": p, "value": round(v, 2)} for p, v in ranked],
        })
    return tables


# ---------------------------------------------------------------------------
# 5.7 Graphic Design Value + Graphics Team Hrs
# ---------------------------------------------------------------------------


def load_graphic_design_daily() -> tuple[dict[date, float], date]:
    rows = fetch_csv_rows("graphic_design")
    daily: dict[date, float] = defaultdict(float)
    max_date: date | None = None
    for r in rows:
        d = parse_date(r.get("DATE"))
        if not d:
            continue
        daily[d] += money(r.get("total_sales"))
        if max_date is None or d > max_date:
            max_date = d
    if max_date is None:
        raise RuntimeError("graphic_design: no parseable dates found")
    anchor = latest_active_date(daily, fallback=max_date)
    return daily, anchor


def graphic_design_window(daily: dict[date, float], start: date, end: date) -> dict:
    prev_start, prev_end = prev_period(start, end)
    cur = sum(v for d, v in daily.items() if start <= d <= end)
    prev = sum(v for d, v in daily.items() if prev_start <= d <= prev_end)
    return {"value": round(cur, 2), "trend": trend(cur, prev)}


def build_graphic_design_windows(daily, anchor) -> dict:
    return {key: graphic_design_window(daily, *resolve_preset(anchor, key)) for key in PRESET_KEYS}


def build_graphic_design_daily_raw(daily: dict[date, float], anchor: date) -> list[dict]:
    start = anchor - timedelta(days=RAW_WINDOW_DAYS - 1)
    out = []
    d = start
    while d <= anchor:
        out.append({"date": date_key(d), "value": round(daily.get(d, 0.0), 2)})
        d += timedelta(days=1)
    return out


def load_graphics_hours_daily() -> tuple[list[tuple[date, str, float]], date]:
    rows = fetch_csv_rows("graphics_clockify")
    dated: list[tuple[date, str, float]] = []
    daily_total: dict[date, float] = defaultdict(float)
    max_date: date | None = None
    for r in rows:
        email = (r.get("Email") or "").strip()
        user = (r.get("User") or "").strip()
        if "@" not in email or not user:
            continue
        d = parse_date(r.get("DATE"))
        if not d:
            continue
        hrs = num(r.get("Duration (decimal)"))
        dated.append((d, user, hrs))
        daily_total[d] += hrs
        if max_date is None or d > max_date:
            max_date = d
    if max_date is None:
        return [], date.today()
    anchor = latest_active_date(daily_total, fallback=max_date)
    return dated, anchor


def graphics_hours_window(dated: list[tuple[date, str, float]], start: date, end: date) -> dict:
    by_user: dict[str, float] = defaultdict(float)
    for d, user, hrs in dated:
        if start <= d <= end:
            by_user[user] += hrs
    ranked = sorted(by_user.items(), key=lambda kv: kv[1], reverse=True)
    return {"rows": [{"name": n, "hours": round(h, 2)} for n, h in ranked if h > 0]}


def build_graphics_hours_windows(dated, anchor) -> dict:
    return {key: graphics_hours_window(dated, *resolve_preset(anchor, key)) for key in PRESET_KEYS}


def build_graphics_hours_daily_raw(dated: list[tuple[date, str, float]], anchor: date) -> list[dict]:
    start = anchor - timedelta(days=RAW_WINDOW_DAYS - 1)
    return [
        {"date": date_key(d), "name": name, "hours": round(h, 2)}
        for d, name, h in dated
        if start <= d <= anchor and h != 0
    ]


# ---------------------------------------------------------------------------
# 5.8 Shipping by State (all-time, not date-ranged)
# ---------------------------------------------------------------------------

US_STATES = {
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "District of Columbia", "Florida", "Georgia", "Guam", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana",
    "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York",
    "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
    "Puerto Rico", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas",
    "Utah", "Vermont", "Virginia", "Virgin Islands", "Washington", "West Virginia",
    "Wisconsin", "Wyoming",
}

STATE_ABBREV = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois",
    "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana",
    "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan",
    "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana",
    "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota",
    "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island",
    "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas",
    "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}


def normalize_region(raw: str) -> str | None:
    s = raw.strip().strip('"').strip()
    if s in US_STATES:
        return s
    m = re.match(r"^([A-Za-z]{2})\b", s)
    if m and m.group(1).upper() in STATE_ABBREV:
        return STATE_ABBREV[m.group(1).upper()]
    return None


def build_shipping_by_state() -> dict:
    rows = fetch_csv_rows("country_city")
    totals: dict[str, int] = defaultdict(int)
    unmapped = 0
    for r in rows:
        if (r.get("Shipping country") or "").strip() != "United States":
            continue
        region_raw = r.get("Shipping region") or ""
        orders = int(num(r.get("Orders")))
        region = normalize_region(region_raw)
        if region:
            totals[region] += orders
        else:
            unmapped += orders
    ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
    grand_total = sum(totals.values()) + unmapped
    return {
        "rows": [{"region": r, "orders": v} for r, v in ranked],
        "grandTotal": grand_total,
        "unmappedOrders": unmapped,
    }


# ---------------------------------------------------------------------------
# 5.9 Traffic table (all rows, not date-ranged — only a handful exist)
# ---------------------------------------------------------------------------


def build_traffic_table() -> dict:
    rows = fetch_csv_rows("GoogleSearch")
    out = []
    for r in rows:
        d = parse_date(r.get("DATE"))
        if not d:
            continue
        out.append({
            "date": d.strftime("%b %-d, %Y") if hasattr(d, "strftime") else str(d),
            "impressions": int(num(r.get("Impressions"))),
            "clicks": int(num(r.get("Clicks"))),
            "pagesFirstImpression": int(num(r.get("Pages with 1st impression"))),
            "clicksDesktop": int(num(r.get("Clicks (Desktop)"))),
            "clicksMobile": int(num(r.get("Clicks (Mobile)"))),
            "clicksTablet": int(num(r.get("Clicks (Tablet)"))),
        })
    return {"rows": out}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    print("Fetching CombinedSales / Shopify / Amazon / Walmart ...")
    sales_daily, sales_anchor = load_sales_daily()
    sales_windows = build_sales_windows(sales_daily, sales_anchor)
    sales_raw = build_sales_daily_raw(sales_daily, sales_anchor)

    print("Fetching ProductionRaw / BlankOrders (tracker) ...")
    tracker_daily, tracker_anchor = load_terraslate_tracker_daily()
    tracker_windows = build_terraslate_tracker_windows(tracker_daily, tracker_anchor)
    tracker_raw = build_terraslate_tracker_daily_raw(tracker_daily, tracker_anchor)

    print("Fetching ADS ...")
    marketing_dated, _, marketing_anchor = load_marketing_daily()
    marketing_windows = build_marketing_windows(marketing_dated, marketing_anchor)
    marketing_raw = build_marketing_daily_raw(marketing_dated, marketing_anchor)

    print("Fetching SalesPerStaff (Breadwinnaz + Proof/Graphic team sales) ...")
    staff_dated, staff_anchor = load_staff_daily()
    breadwinnaz_windows, proof_windows, graphic_sales_windows = build_staff_windows(staff_dated, staff_anchor)
    staff_raw = build_staff_daily_raw(staff_dated, staff_anchor)

    print("Fetching PrePress ...")
    prepress = build_prepress()

    print("Fetching ProductionRaw (6 production team tables) ...")
    production_teams = build_production_teams()

    print("Fetching graphic_design ...")
    graphic_design_daily, gd_anchor = load_graphic_design_daily()
    graphic_design_windows = build_graphic_design_windows(graphic_design_daily, gd_anchor)
    graphic_design_raw = build_graphic_design_daily_raw(graphic_design_daily, gd_anchor)

    print("Fetching graphics_clockify ...")
    hours_dated, hours_anchor = load_graphics_hours_daily()
    graphics_hours_windows = build_graphics_hours_windows(hours_dated, hours_anchor)
    graphics_hours_raw = build_graphics_hours_daily_raw(hours_dated, hours_anchor)

    print("Fetching country_city (shipping by state) ...")
    shipping = build_shipping_by_state()

    print("Fetching GoogleSearch (traffic table) ...")
    traffic = build_traffic_table()

    data = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "anchors": {
            "sales": sales_anchor.isoformat(),
            "marketing": marketing_anchor.isoformat(),
            "staffSales": staff_anchor.isoformat(),
            "graphicDesign": gd_anchor.isoformat(),
            "graphicsHours": hours_anchor.isoformat(),
            "terraSlateTracker": tracker_anchor.isoformat(),
        },
        # Date-range-driven sections: one object per preset key, plus capped
        # raw daily data for client-computed custom ranges.
        "salesAcrossChannels": {"windows": sales_windows},
        "marketingMetrics": {"windows": marketing_windows},
        "breadwinnaz": {"windows": breadwinnaz_windows},
        "proofTeamSales": {"windows": proof_windows},
        "graphicTeamSales": {"windows": graphic_sales_windows},
        "graphicDesignValue": {"windows": graphic_design_windows},
        "graphicsTeamHours": {"windows": graphics_hours_windows},
        "terraSlateTracker": {"windows": tracker_windows},
        "dailyRaw": {
            "sales": sales_raw,
            "marketing": marketing_raw,
            "staffSales": staff_raw,
            "graphicDesign": graphic_design_raw,
            "graphicsHours": graphics_hours_raw,
            "terraSlateTracker": tracker_raw,
        },
        # All-time / snapshot sections — not affected by the date-range picker.
        "prePress": prepress,
        "productionTeams": production_teams,
        "shippingByState": shipping,
        "trafficTable": traffic,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2))
    print(f"\nWrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
