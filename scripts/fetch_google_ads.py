#!/usr/bin/env python3
"""
Pulls real Google Ads data from the "Google Ads" extract tab (Adveronix daily
export) in the same spreadsheet fetch_facebook_ads.py already reads from
(different tab) and writes src/data/googleAdsData.json in the shape the UI
expects.

Sheet: https://docs.google.com/spreadsheets/d/1tW7g3c8zyUeOPpYQTyviADueGwl9nhbSnd8vTAaX17A
Tab gid 1899848633. Columns: EXCLUDE, Day, Campaign Name, Cost (Spend),
Conversions, Total conv. value, Clicks, Impressions, Conversions By
Conversion Date, Conversions Value By Conversion Date. One row per
campaign-per-day, back to 2024-10-01.

Rows with EXCLUDE == "TRUE" (3 Pixelme affiliate-tracking campaigns, not
real ad campaigns) are dropped entirely — same convention the sheet's own
column name implies.

No Device dimension exists in this extract (confirmed with the client —
Adveronix can't pull it), so the reference report's Device Breakdown donuts
are deliberately NOT rebuilt here. Everything else from the reference
(3 KPI trios with daily trend, Top Campaigns table) is covered by this feed.

## Formulas
  - Cost, Clicks, Impressions, Conversions, Conv. value: plain SUM.
  - CTR = Clicks / Impressions * 100
  - Avg. CPC = Cost / Clicks
  - Avg. CPM = Cost / Impressions * 1000
  - Conv. rate = Conversions / Clicks * 100
  - Cost / Conv. = Cost / Conversions

## Date-range picker architecture (mirrors fetch_facebook_ads.py exactly)
  1. `summary.windows` / `dailyChart.windows` / `topCampaigns.windows` — the
     6 standard presets, anchored to the latest date with any activity.
  2. `dailyRaw` — per (date, campaign) rows, capped to the trailing
     RAW_WINDOW_DAYS days, for client-computed "Custom range".
"""

from __future__ import annotations

import csv
import io
import json
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

SHEET_ID = "1tW7g3c8zyUeOPpYQTyviADueGwl9nhbSnd8vTAaX17A"
GOOGLE_ADS_GID = "1899848633"

OUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "googleAdsData.json"

PRESET_KEYS = ["today", "yesterday", "last7", "last30", "thisMonth", "lastMonth"]
RAW_WINDOW_DAYS = 180

# ---------------------------------------------------------------------------
# Fetch + parse helpers
# ---------------------------------------------------------------------------


def fetch_rows() -> list[dict[str, str]]:
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GOOGLE_ADS_GID}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        raw = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(raw)))


def num(s: str | None) -> float:
    if not s:
        return 0.0
    s = s.strip().replace("$", "").replace(",", "")
    if s in ("", "-", "N/A", "n/a"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_date(s: str | None) -> date | None:
    if not s:
        return None
    s = s.strip()
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


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


# ---------------------------------------------------------------------------
# Value formatters — matches the reference report's own display conventions
# (verified against its screenshots: "3.1K" clicks, "367.4" conversions
# with no K below 1000, "$21.27K" cost, "$6.77" Avg. CPC).
# ---------------------------------------------------------------------------


def fmt_count(v: float) -> str:
    if v >= 1000:
        return f"{v / 1000:.1f}K"
    return f"{round(v):,}"


def fmt_conversions(v: float) -> str:
    if v >= 1000:
        return f"{v / 1000:.1f}K"
    return f"{v:.1f}"


def fmt_money(v: float) -> str:
    if abs(v) >= 1000:
        return f"${v / 1000:.2f}K"
    return f"${v:.2f}"


def fmt_pct(v: float) -> str:
    return f"{v:.1f}%"


# ---------------------------------------------------------------------------
# Load + clean raw rows
# ---------------------------------------------------------------------------


class Row:
    __slots__ = ("d", "campaign", "cost", "clicks", "impressions", "conversions", "value")


def load_rows(raw_rows: list[dict[str, str]]) -> list[Row]:
    out: list[Row] = []
    for r in raw_rows:
        if (r.get("EXCLUDE") or "").strip().upper() == "TRUE":
            continue
        d = parse_date(r.get("Day"))
        if not d:
            continue
        row = Row()
        row.d = d
        row.campaign = (r.get("Campaign Name") or "").strip() or "(unnamed campaign)"
        row.cost = num(r.get("Cost (Spend)"))
        row.clicks = num(r.get("Clicks"))
        row.impressions = num(r.get("Impressions"))
        row.conversions = num(r.get("Conversions"))
        row.value = num(r.get("Total conv. value"))
        out.append(row)
    return out


def latest_active_date(rows: list[Row]) -> date:
    active = {r.d for r in rows if r.cost != 0 or r.impressions != 0}
    return max(active) if active else max(r.d for r in rows)


# ---------------------------------------------------------------------------
# Rollup aggregation
# ---------------------------------------------------------------------------


class Agg:
    __slots__ = ("cost", "clicks", "impressions", "conversions", "value")

    def __init__(self) -> None:
        self.cost = 0.0
        self.clicks = 0.0
        self.impressions = 0.0
        self.conversions = 0.0
        self.value = 0.0

    def add(self, r: Row) -> None:
        self.cost += r.cost
        self.clicks += r.clicks
        self.impressions += r.impressions
        self.conversions += r.conversions
        self.value += r.value

    def ctr(self) -> float:
        return round(self.clicks / self.impressions * 100, 2) if self.impressions else 0.0

    def avg_cpc(self) -> float:
        return round(self.cost / self.clicks, 2) if self.clicks else 0.0

    def avg_cpm(self) -> float:
        return round(self.cost / self.impressions * 1000, 2) if self.impressions else 0.0

    def conv_rate(self) -> float:
        return round(self.conversions / self.clicks * 100, 2) if self.clicks else 0.0

    def cost_per_conv(self) -> float | None:
        return round(self.cost / self.conversions, 2) if self.conversions else None


# ---------------------------------------------------------------------------
# Executive Summary — 3 KPI trios (picker-driven)
# ---------------------------------------------------------------------------


def build_summary(cur: Agg, prev: Agg) -> dict:
    cur_cpconv, prev_cpconv = cur.cost_per_conv(), prev.cost_per_conv()
    return {
        "trios": [
            {
                "id": "ctr-impressions",
                "title": "Click Through Rate & Impressions",
                "subtitle": "by Clicks, CTR, and Impressions",
                "stats": [
                    {"label": "Clicks", "value": fmt_count(cur.clicks), "trend": trend(cur.clicks, prev.clicks)},
                    {"label": "CTR", "value": fmt_pct(cur.ctr()), "trend": trend(cur.ctr(), prev.ctr())},
                    {"label": "Impressions", "value": fmt_count(cur.impressions), "trend": trend(cur.impressions, prev.impressions)},
                ],
            },
            {
                "id": "conversion-cost",
                "title": "Conversion Rate & Cost",
                "subtitle": "by Conversions Rate and Cost / Conv.",
                "stats": [
                    {"label": "Conversions", "value": fmt_conversions(cur.conversions), "trend": trend(cur.conversions, prev.conversions)},
                    {"label": "Conv. rate", "value": fmt_pct(cur.conv_rate()), "trend": trend(cur.conv_rate(), prev.conv_rate())},
                    {
                        "label": "Cost / conv.",
                        "value": fmt_money(cur_cpconv) if cur_cpconv is not None else "No data",
                        "trend": trend(cur_cpconv, prev_cpconv) if cur_cpconv is not None and prev_cpconv is not None else None,
                    },
                ],
            },
            {
                "id": "cost-per-click",
                "title": "Cost Per Click",
                "subtitle": "by Cost, CPC, and CPM",
                "stats": [
                    {"label": "Cost", "value": fmt_money(cur.cost), "trend": trend(cur.cost, prev.cost)},
                    {"label": "Avg. CPC", "value": fmt_money(cur.avg_cpc()), "trend": trend(cur.avg_cpc(), prev.avg_cpc())},
                    {"label": "Avg. CPM", "value": fmt_money(cur.avg_cpm()), "trend": trend(cur.avg_cpm(), prev.avg_cpm())},
                ],
            },
        ]
    }


# ---------------------------------------------------------------------------
# Daily chart rows (picker-driven) — one row per active day in the window,
# ascending date order. TrioSection picks the 2 fields each chart plots.
# ---------------------------------------------------------------------------


def build_daily_chart(rows: list[Row], start: date, end: date) -> list[dict]:
    per_day: dict[date, Agg] = defaultdict(Agg)
    for r in rows:
        if start <= r.d <= end:
            per_day[r.d].add(r)

    out = []
    for d in sorted(per_day.keys()):
        agg = per_day[d]
        out.append({
            "date": date_key(d),
            "clicks": round(agg.clicks),
            "ctr": agg.ctr(),
            "impressions": round(agg.impressions),
            "conversions": round(agg.conversions, 1),
            "convRate": agg.conv_rate(),
            "cost": round(agg.cost, 2),
            "avgCpc": agg.avg_cpc(),
            "avgCpm": agg.avg_cpm(),
        })
    return out


# ---------------------------------------------------------------------------
# Top Campaigns (picker-driven) — all active campaigns, sorted by CTR desc
# (matches the reference report's own default sort)
# ---------------------------------------------------------------------------


def build_top_campaigns(rows: list[Row], start: date, end: date) -> dict:
    per_campaign: dict[str, Agg] = defaultdict(Agg)
    for r in rows:
        if start <= r.d <= end:
            per_campaign[r.campaign].add(r)

    ranked = sorted(per_campaign.items(), key=lambda kv: -kv[1].ctr())
    return {
        "rows": [
            {
                "campaign": name,
                "ctr": agg.ctr(),
                "avgCpc": agg.avg_cpc(),
                "costPerConv": agg.cost_per_conv(),
            }
            for name, agg in ranked
            if agg.clicks > 0 or agg.impressions > 0
        ]
    }


# ---------------------------------------------------------------------------
# dailyRaw (for client-computed custom ranges)
# ---------------------------------------------------------------------------


def build_daily_raw(rows: list[Row], anchor: date) -> list[dict]:
    start = anchor - timedelta(days=RAW_WINDOW_DAYS - 1)
    out = []
    for r in rows:
        if not (start <= r.d <= anchor):
            continue
        out.append({
            "date": date_key(r.d),
            "campaign": r.campaign,
            "cost": round(r.cost, 2),
            "clicks": r.clicks,
            "impressions": r.impressions,
            "conversions": round(r.conversions, 2),
            "value": round(r.value, 2),
        })
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    print("Fetching Google Ads tab ...")
    raw_rows = fetch_rows()
    rows = load_rows(raw_rows)
    print(f"  {len(rows):,} valid rows, {min(r.d for r in rows)} to {max(r.d for r in rows)}")

    anchor = latest_active_date(rows)

    print("Building Executive Summary + Daily Chart + Top Campaigns (picker-driven) ...")
    summary_windows = {}
    daily_chart_windows = {}
    top_campaigns_windows = {}
    for key in PRESET_KEYS:
        start, end = resolve_preset(anchor, key)
        prev_start, prev_end = prev_period(start, end)
        cur, prev = Agg(), Agg()
        for r in rows:
            if start <= r.d <= end:
                cur.add(r)
            elif prev_start <= r.d <= prev_end:
                prev.add(r)
        summary_windows[key] = build_summary(cur, prev)
        daily_chart_windows[key] = build_daily_chart(rows, start, end)
        top_campaigns_windows[key] = build_top_campaigns(rows, start, end)

    print("Building dailyRaw (custom range support) ...")
    daily_raw = build_daily_raw(rows, anchor)

    data = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "anchor": anchor.isoformat(),
        "summary": {"windows": summary_windows},
        "dailyChart": {"windows": daily_chart_windows},
        "topCampaigns": {"windows": top_campaigns_windows},
        "dailyRaw": daily_raw,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2))
    print(f"\nWrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
