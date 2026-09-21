#!/usr/bin/env python3
"""
Pulls the real Facebook Ads data from the "Advert" tab of its own Google
Sheet (separate spreadsheet from DailyDashRaw_TerraSlate — this is a raw,
row-per-campaign-per-day Meta export, not the same source as the CEO
Dashboard's own "Marketing Metrics" section, which pulls a different,
already-summarized ADS tab via IMPORTRANGE. The two pages can legitimately
show different numbers; they're not meant to reconcile.) and writes
src/data/facebookAdsData.json in the shape the UI components expect.

Sheet: https://docs.google.com/spreadsheets/d/1tW7g3c8zyUeOPpYQTyviADueGwl9nhbSnd8vTAaX17A
Tab: Advert (gid 1032778712). Columns: Day, Objective, Campaign Name,
Amount Spent, Reach, Impressions, Frequency, Results, Link Clicks,
Purchases, Purchases Conversion Value. ~25k rows, one row per
campaign-per-day, back to 2024-01-01. Pulled via CSV export.

"Results" (column H) is deliberately NOT used here — it's populated on
only ~13% of rows and its meaning shifts with each row's own Objective
(Meta defines "Results" differently per objective type), so summing it
across mixed objectives would produce a number with no consistent
meaning. Not in the reference view either. Flagged as a possible future
addition, not guessed at.

## Aggregation formulas (verified against the reference screenshot's exact
## numbers before writing any of this — every formula below reconciles
## to the cent/decimal against real rows, not assumed)

  - Amount Spent, Reach, Impressions, Link Clicks, Purchases, Purchases
    Conversion Value: plain SUM across rows in the period.
  - Frequency: simple UNWEIGHTED MEAN of each row's own Frequency value
    in the period — NOT Impressions/Reach recomputed at the rollup level
    (checked: those two do not agree, e.g. 2026-09-20 sum(Impr)/sum(Reach)
    = 1.46 but the reference's own Freq = 1.32, which matches the simple
    mean of the day's 35 row-level Frequency values exactly).
  - CPM = Amount Spent / Impressions * 1000
  - Cost Per Link Click = Amount Spent / Link Clicks
  - CTR = Link Clicks / Impressions
  - ROAS = Purchases Conversion Value / Amount Spent

## Date-range picker architecture (mirrors scripts/fetch_aircall_data.py)

  1. **`windows`** — the 6 preset ranges, anchored to the latest date with
     any spend activity. Summary KPIs, the Daily Campaign Summary table,
     Top Campaigns, and Performance by Objective are all picker-driven.
  2. **`dailyRaw`** — per (date, objective, campaign) rows, capped to the
     trailing RAW_WINDOW_DAYS days, for client-computed "Custom range".
  3. **`monthly`** — NOT picker-driven (same convention as the AR
     dashboard's Monthly Trend): always the trailing 12 calendar months
     of history, computed once.

## Additions beyond the brief's literal "recreate this view" (per its own
## invitation to suggest improvements — see doc)

  - **Top 10 Campaigns by Spend** — the original view aggregates away
    Objective/Campaign Name entirely (day/month rollups only), so which
    specific campaigns are actually driving spend or losing money is
    invisible. Flags any campaign whose ROAS < 1 (spending more than it
    earns back) in red, same semantic-flag pattern as the AR dashboard's
    Top Customers concentration bar.
  - **Performance by Objective** — only 4 distinct Objectives exist in
    the whole dataset, small enough for a clean at-a-glance table; shows
    whether e.g. Sales campaigns actually outperform Traffic/Awareness.
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
ADVERT_GID = "1032778712"

OUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "facebookAdsData.json"

PRESET_KEYS = ["today", "yesterday", "last7", "last30", "thisMonth", "lastMonth"]
RAW_WINDOW_DAYS = 180
TOP_CAMPAIGNS_LIMIT = 10
ROAS_FLAG_THRESHOLD = 1.0

# ---------------------------------------------------------------------------
# Fetch + parse helpers
# ---------------------------------------------------------------------------


def fetch_rows() -> list[dict[str, str]]:
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={ADVERT_GID}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        raw = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(raw)))


def money(s: str | None) -> float:
    if not s:
        return 0.0
    s = s.strip().replace("$", "").replace(",", "")
    if s in ("", "-", "N/A", "n/a"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def num(s: str | None) -> float:
    return money(s)


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
# Load + clean raw rows
# ---------------------------------------------------------------------------


class Row:
    __slots__ = ("d", "objective", "campaign", "spend", "reach", "impressions", "freq", "clicks", "purchases", "value")


def load_rows(raw_rows: list[dict[str, str]]) -> list[Row]:
    out: list[Row] = []
    for r in raw_rows:
        d = parse_date(r.get("Day"))
        if not d:
            continue
        row = Row()
        row.d = d
        row.objective = (r.get("Objective") or "").strip() or "(unspecified)"
        row.campaign = (r.get("Campaign Name") or "").strip() or "(unnamed campaign)"
        row.spend = money(r.get("Amount Spent"))
        row.reach = num(r.get("Reach"))
        row.impressions = num(r.get("Impressions"))
        row.freq = num(r.get("Frequency")) if (r.get("Frequency") or "").strip() else None
        row.clicks = num(r.get("Link Clicks"))
        row.purchases = num(r.get("Purchases"))
        row.value = money(r.get("Purchases Conversion Value"))
        out.append(row)
    return out


def latest_active_date(rows: list[Row]) -> date:
    active = {r.d for r in rows if r.spend != 0 or r.impressions != 0}
    return max(active) if active else max(r.d for r in rows)


# ---------------------------------------------------------------------------
# Rollup aggregation (shared by daily/monthly/window rollups)
# ---------------------------------------------------------------------------


class Agg:
    __slots__ = ("spend", "reach", "impressions", "freq_sum", "freq_n", "clicks", "purchases", "value")

    def __init__(self) -> None:
        self.spend = 0.0
        self.reach = 0.0
        self.impressions = 0.0
        self.freq_sum = 0.0
        self.freq_n = 0
        self.clicks = 0.0
        self.purchases = 0.0
        self.value = 0.0

    def add(self, r: Row) -> None:
        self.spend += r.spend
        self.reach += r.reach
        self.impressions += r.impressions
        if r.freq is not None:
            self.freq_sum += r.freq
            self.freq_n += 1
        self.clicks += r.clicks
        self.purchases += r.purchases
        self.value += r.value

    def freq(self) -> float:
        return round(self.freq_sum / self.freq_n, 2) if self.freq_n else 0.0

    def cpm(self) -> float:
        return round(self.spend / self.impressions * 1000, 2) if self.impressions else 0.0

    def cost_per_click(self) -> float | None:
        return round(self.spend / self.clicks, 2) if self.clicks else None

    def ctr(self) -> float:
        return round(self.clicks / self.impressions * 100, 2) if self.impressions else 0.0

    def roas(self) -> float:
        return round(self.value / self.spend, 2) if self.spend else 0.0

    def cost_per_purchase(self) -> float | None:
        return round(self.spend / self.purchases, 2) if self.purchases else None

    def to_table_row(self, label_key: str, label: str) -> dict:
        return {
            label_key: label,
            "impressions": round(self.impressions),
            "cpm": self.cpm(),
            "reach": round(self.reach),
            "linkClicks": round(self.clicks),
            "costPerLinkClick": self.cost_per_click(),
            "ctr": self.ctr(),
            "freq": self.freq(),
            "purchases": round(self.purchases),
            "purchaseValue": round(self.value, 2),
            "amountSpent": round(self.spend, 2),
            "roas": self.roas(),
        }


# ---------------------------------------------------------------------------
# Daily Campaign Summary (picker-driven)
# ---------------------------------------------------------------------------


def build_daily_table(rows: list[Row], start: date, end: date) -> dict:
    per_day: dict[date, Agg] = defaultdict(Agg)
    for r in rows:
        if start <= r.d <= end:
            per_day[r.d].add(r)

    grand = Agg()
    day_rows = []
    for d in sorted(per_day.keys(), reverse=True):
        agg = per_day[d]
        grand.spend += agg.spend
        grand.reach += agg.reach
        grand.impressions += agg.impressions
        grand.freq_sum += agg.freq_sum
        grand.freq_n += agg.freq_n
        grand.clicks += agg.clicks
        grand.purchases += agg.purchases
        grand.value += agg.value
        row = agg.to_table_row("date", d.strftime("%b %-d, %Y"))
        day_rows.append(row)

    return {"rows": day_rows, "grandTotal": grand.to_table_row("date", "Grand total")}


# ---------------------------------------------------------------------------
# Executive Summary KPIs (picker-driven)
# ---------------------------------------------------------------------------


def build_summary(rows: list[Row], start: date, end: date, prev_start: date, prev_end: date) -> dict:
    cur, prev = Agg(), Agg()
    for r in rows:
        if start <= r.d <= end:
            cur.add(r)
        elif prev_start <= r.d <= prev_end:
            prev.add(r)

    def metric(cur_v, prev_v) -> dict:
        return {"value": cur_v, "trend": trend(cur_v, prev_v)}

    cur_cpp, prev_cpp = cur.cost_per_purchase(), prev.cost_per_purchase()
    cur_cpc, prev_cpc = cur.cost_per_click(), prev.cost_per_click()

    narrative = build_narrative(cur, prev)

    return {
        "spend": metric(round(cur.spend, 2), round(prev.spend, 2)),
        "purchaseValue": metric(round(cur.value, 2), round(prev.value, 2)),
        "roas": metric(cur.roas(), prev.roas()),
        "costPerPurchase": {"value": cur_cpp, "trend": trend(cur_cpp, prev_cpp) if cur_cpp is not None and prev_cpp is not None else None},
        "cpm": metric(cur.cpm(), prev.cpm()),
        "impressions": metric(round(cur.impressions), round(prev.impressions)),
        "reach": metric(round(cur.reach), round(prev.reach)),
        "linkClicks": metric(round(cur.clicks), round(prev.clicks)),
        "costPerLinkClick": {"value": cur_cpc, "trend": trend(cur_cpc, prev_cpc) if cur_cpc is not None and prev_cpc is not None else None},
        "purchases": metric(round(cur.purchases), round(prev.purchases)),
        "narrative": narrative,
    }


def build_narrative(cur: Agg, prev: Agg) -> str:
    spend_trend = trend(cur.spend, prev.spend)
    roas_trend = trend(cur.roas(), prev.roas())

    lead = f"Spent ${cur.spend:,.2f} for ${cur.value:,.2f} in purchase value this period ({cur.roas():.2f}x ROAS)"
    if spend_trend:
        verb = "up" if spend_trend["direction"] == "up" else "down"
        lead += f", spend {verb} {abs(spend_trend['changePct'])}% vs. the prior period"
    lead += "."

    if roas_trend:
        if roas_trend["direction"] == "up":
            roas_line = f"ROAS improved {roas_trend['changePct']}% vs. the prior period — efficiency is trending the right way."
        elif roas_trend["direction"] == "down":
            roas_line = f"ROAS fell {abs(roas_trend['changePct'])}% vs. the prior period — the same spend is returning less."
        else:
            roas_line = "ROAS held flat vs. the prior period."
    else:
        roas_line = "Not enough history yet to compare ROAS period-over-period."

    return f"{lead} {roas_line}"


# ---------------------------------------------------------------------------
# Top Campaigns by Spend (picker-driven, addition beyond the brief)
# ---------------------------------------------------------------------------


def build_top_campaigns(rows: list[Row], start: date, end: date) -> dict:
    per_campaign: dict[str, Agg] = defaultdict(Agg)
    for r in rows:
        if start <= r.d <= end:
            per_campaign[r.campaign].add(r)

    ranked = sorted(per_campaign.items(), key=lambda kv: -kv[1].spend)[:TOP_CAMPAIGNS_LIMIT]
    return {
        "rows": [
            {
                "name": name,
                "spend": round(agg.spend, 2),
                "roas": agg.roas(),
                "purchases": round(agg.purchases),
                "flagged": agg.spend > 0 and agg.roas() < ROAS_FLAG_THRESHOLD,
            }
            for name, agg in ranked
        ]
    }


# ---------------------------------------------------------------------------
# Performance by Objective (picker-driven, addition beyond the brief)
# ---------------------------------------------------------------------------


def build_by_objective(rows: list[Row], start: date, end: date) -> dict:
    per_obj: dict[str, Agg] = defaultdict(Agg)
    for r in rows:
        if start <= r.d <= end:
            per_obj[r.objective].add(r)

    ranked = sorted(per_obj.items(), key=lambda kv: -kv[1].spend)
    grand = Agg()
    obj_rows = []
    for name, agg in ranked:
        grand.spend += agg.spend
        grand.reach += agg.reach
        grand.impressions += agg.impressions
        grand.freq_sum += agg.freq_sum
        grand.freq_n += agg.freq_n
        grand.clicks += agg.clicks
        grand.purchases += agg.purchases
        grand.value += agg.value
        obj_rows.append({
            "objective": name,
            "amountSpent": round(agg.spend, 2),
            "impressions": round(agg.impressions),
            "reach": round(agg.reach),
            "linkClicks": round(agg.clicks),
            "purchases": round(agg.purchases),
            "purchaseValue": round(agg.value, 2),
            "roas": agg.roas(),
        })
    return {
        "rows": obj_rows,
        "grandTotal": {
            "objective": "Grand total",
            "amountSpent": round(grand.spend, 2),
            "impressions": round(grand.impressions),
            "reach": round(grand.reach),
            "linkClicks": round(grand.clicks),
            "purchases": round(grand.purchases),
            "purchaseValue": round(grand.value, 2),
            "roas": grand.roas(),
        },
    }


# ---------------------------------------------------------------------------
# Monthly Campaign Summary (NOT picker-driven — trailing 12 months, always)
# ---------------------------------------------------------------------------


def build_monthly(rows: list[Row], anchor: date) -> dict:
    per_month: dict[str, Agg] = defaultdict(Agg)
    for r in rows:
        per_month[f"{r.d.year:04d}-{r.d.month:02d}"].add(r)

    months: list[str] = []
    y, m = anchor.year, anchor.month
    for _ in range(12):
        months.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    months.reverse()

    out = []
    for mk in months:
        if mk not in per_month:
            continue
        agg = per_month[mk]
        label = datetime.strptime(mk, "%Y-%m").strftime("%b %Y")
        out.append(agg.to_table_row("month", label))

    grand = Agg()
    for mk in months:
        agg = per_month.get(mk)
        if not agg:
            continue
        grand.spend += agg.spend
        grand.reach += agg.reach
        grand.impressions += agg.impressions
        grand.freq_sum += agg.freq_sum
        grand.freq_n += agg.freq_n
        grand.clicks += agg.clicks
        grand.purchases += agg.purchases
        grand.value += agg.value

    return {"rows": out, "grandTotal": grand.to_table_row("month", "Grand total")}


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
            "objective": r.objective,
            "campaign": r.campaign,
            "spend": round(r.spend, 2),
            "reach": r.reach,
            "impressions": r.impressions,
            "freq": r.freq,
            "clicks": r.clicks,
            "purchases": r.purchases,
            "value": round(r.value, 2),
        })
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    print("Fetching Advert tab ...")
    raw_rows = fetch_rows()
    rows = load_rows(raw_rows)
    print(f"  {len(rows):,} valid rows, {min(r.d for r in rows)} to {max(r.d for r in rows)}")

    anchor = latest_active_date(rows)

    print("Building Executive Summary + Daily Campaign Summary + Top Campaigns + By Objective (picker-driven) ...")
    summary_windows = {}
    daily_windows = {}
    top_campaigns_windows = {}
    by_objective_windows = {}
    for key in PRESET_KEYS:
        start, end = resolve_preset(anchor, key)
        prev_start, prev_end = prev_period(start, end)
        summary_windows[key] = build_summary(rows, start, end, prev_start, prev_end)
        daily_windows[key] = build_daily_table(rows, start, end)
        top_campaigns_windows[key] = build_top_campaigns(rows, start, end)
        by_objective_windows[key] = build_by_objective(rows, start, end)

    print("Building Monthly Campaign Summary (trailing 12 months) ...")
    monthly = build_monthly(rows, anchor)

    print("Building dailyRaw (custom range support) ...")
    daily_raw = build_daily_raw(rows, anchor)

    data = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "anchor": anchor.isoformat(),
        "summary": {"windows": summary_windows},
        "dailyTable": {"windows": daily_windows},
        "topCampaigns": {"windows": top_campaigns_windows},
        "byObjective": {"windows": by_objective_windows},
        "monthly": monthly,
        "dailyRaw": daily_raw,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2))
    print(f"\nWrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
