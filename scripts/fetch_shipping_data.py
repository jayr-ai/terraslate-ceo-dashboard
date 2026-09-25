#!/usr/bin/env python3
"""
Pulls the real Shipping Dashboard data from the "ALL" tab of its own
Google Sheet (~30.7k rows, one row per shipment, UPS + FedEx combined,
Aug 2025 - Aug 2026) and writes src/data/shippingData.json in the shape
the UI components expect.

Sheet: https://docs.google.com/spreadsheets/d/16VVJuxHd23wbYBTI3QSXyk7AMa3Ng-iYbNvVsoCTgTM
Tab: ALL (gid 2065189606). Pulled via CSV export.

## Data cleaning (verified against the reference report's exact numbers
## for Aug 1-31, 2026 before writing any UI — every total below reconciles
## to the cent, not assumed)

  - A handful of rows (11) are leftover template/placeholder rows with
    literal text like "R_State  R_State  R_State" instead of real values
    — dropped.
  - Rows where `Country` is blank are refund/adjustment line items (many
    with negative Shipping Price) or otherwise-incomplete rows with no
    real shipment destination — dropped. This one rule alone reproduces
    the reference's Grand Total exactly (1,958 shipments / $49,659.05 for
    Aug 2026), and every per-country breakdown matches it to the cent.
  - The "Top Cities" table additionally excludes Lahaina, Maui — this
    isn't a data-quality artifact (checked: it's a real, populous row,
    $1,389.38 in Aug 2026 alone, would rank #3) but the reference report
    itself excludes it from that one table (not from Country/State/Zone),
    reproduced here as a deliberate, matching exclusion.

## Zone choropleth caveat

UPS/FedEx rate zones are inherently per-shipment (distance-based from the
origin), not per-state — a state near a zone boundary genuinely has
shipments split across two zones (e.g. Iowa was ~51/49 zone 5/zone 4 in
this data). The zone map colors each state by its single MOST COMMON
zone among that state's shipments in the selected window — a real
simplification for border states, not a bug.

## Scope decisions (flagged to JV, not silently done)

  - No world map for Shipment By Country: 99%+ of shipments are US-only
    (16 of 1,958 in the Aug 2026 reference window) — the Top Countries
    table already carries the same information for that small a slice.
  - No city-level bubble/geo map for Shipment By City: the sheet has zip
    codes but no lat/lng, so plotting real city positions would need an
    external zip->coordinate dataset this pipeline doesn't have. The Top
    Cities table carries the same ranking.

## Date-range + Carrier picker architecture (mirrors scripts/fetch_facebook_ads.py)

  1. **`windows`** — the 6 preset ranges, CARRIER="All" only, anchored to
     the latest date with any shipment. Any other carrier selection, or a
     custom date range, is computed client-side from `dailyRaw` instead —
     precomputing all (6 presets x 3 carriers) combinations wasn't worth
     the extra pipeline complexity for a 3-way toggle.
  2. **`dailyRaw`** — per-shipment rows, capped to the trailing
     RAW_WINDOW_DAYS days (same convention/cap as every other dashboard
     here), for client-computed windows.
"""

from __future__ import annotations

import csv
import io
import json
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

SHEET_ID = "16VVJuxHd23wbYBTI3QSXyk7AMa3Ng-iYbNvVsoCTgTM"
ALL_GID = "2065189606"

OUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "shippingData.json"

PRESET_KEYS = ["today", "yesterday", "last7", "last30", "thisMonth", "lastMonth"]
RAW_WINDOW_DAYS = 180
EXCLUDED_CITY = "LAHAINA"


def fetch_rows() -> list[dict[str, str]]:
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={ALL_GID}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        raw = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(raw)))


def money(s: str | None) -> float:
    s = (s or "").strip()
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_date(s: str | None) -> date | None:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return datetime.strptime(s, "%b-%d-%Y").date()
    except ValueError:
        return None


def is_junk(r: dict[str, str]) -> bool:
    return "R_State" in (r.get("State") or "") or "R_Cntry" in (r.get("Country") or "") or "R_City" in (r.get("City") or "")


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
# Load + clean
# ---------------------------------------------------------------------------


class Row:
    __slots__ = ("d", "carrier", "country", "country_full", "state", "state_full", "city", "zone", "price")


def load_rows(raw_rows: list[dict[str, str]]) -> list[Row]:
    out: list[Row] = []
    for r in raw_rows:
        if is_junk(r):
            continue
        country = (r.get("Country") or "").strip()
        if not country:
            continue  # refund/adjustment rows — see module docstring
        d = parse_date(r.get("Shipment Date"))
        if not d:
            continue
        row = Row()
        row.d = d
        row.carrier = (r.get("CARRIER") or "").strip().upper()
        row.country = country
        row.country_full = (r.get("Country [Complete]") or "").strip() or country
        row.state = (r.get("State") or "").strip()
        row.state_full = (r.get("STATE") or "").strip()
        row.city = (r.get("City") or "").strip()
        row.zone = (r.get("ZONE") or "").strip()
        row.price = money(r.get("Shipping Price"))
        out.append(row)
    return out


def latest_active_date(rows: list[Row]) -> date:
    return max(r.d for r in rows)


def filter_rows(rows: list[Row], start: date, end: date, carrier: str) -> list[Row]:
    return [r for r in rows if start <= r.d <= end and (carrier == "All" or r.carrier == carrier)]


# ---------------------------------------------------------------------------
# Section builders — each takes the already date+carrier-filtered rows
# ---------------------------------------------------------------------------


def build_countries(rows: list[Row]) -> dict:
    per: dict[str, dict] = defaultdict(lambda: {"count": 0, "price": 0.0})
    for r in rows:
        agg = per[r.country_full]
        agg["count"] += 1
        agg["price"] += r.price
    ranked = sorted(per.items(), key=lambda kv: -kv[1]["price"])
    total_count = sum(v["count"] for v in per.values())
    total_price = sum(v["price"] for v in per.values())
    return {
        "rows": [{"name": name, "count": v["count"], "price": round(v["price"], 2)} for name, v in ranked],
        "grandTotal": {"count": total_count, "price": round(total_price, 2)},
    }


def build_states(rows: list[Row]) -> dict:
    per: dict[str, dict] = defaultdict(lambda: {"count": 0, "price": 0.0, "country": ""})
    for r in rows:
        if not r.state:
            continue
        agg = per[r.state]
        agg["count"] += 1
        agg["price"] += r.price
        agg["country"] = r.country_full
    ranked = sorted(per.items(), key=lambda kv: -kv[1]["price"])
    # Grand total is the FULL filtered set (not just rows with a listed
    # state) — verified against the reference, whose State table's own
    # Grand Total (1,958 / $49,659.05) matches Country's, not the sum of
    # its own visible state rows (which is lower — some rows have no state).
    total_count = len(rows)
    total_price = sum(r.price for r in rows)

    map_counts: dict[str, int] = defaultdict(int)
    for r in rows:
        if r.state_full:
            map_counts[r.state_full] += 1

    return {
        "rows": [
            {"state": st, "country": v["country"], "count": v["count"], "price": round(v["price"], 2)}
            for st, v in ranked
        ],
        "grandTotal": {"count": total_count, "price": round(total_price, 2)},
        "mapCounts": dict(map_counts),
    }


def build_cities(rows: list[Row]) -> dict:
    per: dict[tuple[str, str], dict] = defaultdict(lambda: {"count": 0, "price": 0.0})
    for r in rows:
        if not r.city or r.city.upper() == EXCLUDED_CITY:
            continue
        key = (r.city, r.country_full)
        agg = per[key]
        agg["count"] += 1
        agg["price"] += r.price
    ranked = sorted(per.items(), key=lambda kv: -kv[1]["price"])
    total_count = sum(v["count"] for v in per.values())
    total_price = sum(v["price"] for v in per.values())
    return {
        "rows": [
            {"city": city, "country": country, "count": v["count"], "price": round(v["price"], 2)}
            for (city, country), v in ranked
        ],
        "grandTotal": {"count": total_count, "price": round(total_price, 2)},
    }


ZONE_KEYS = ["2", "3", "4", "5", "6", "7", "null"]


def build_zones(rows: list[Row]) -> dict:
    per: dict[str, dict] = defaultdict(lambda: {"count": 0, "price": 0.0})
    for r in rows:
        key = r.zone or "null"
        agg = per[key]
        agg["count"] += 1
        agg["price"] += r.price
    ranked = sorted(per.items(), key=lambda kv: -kv[1]["price"])
    total_count = sum(v["count"] for v in per.values())
    total_price = sum(v["price"] for v in per.values())

    # Most-common zone per full state name, for the categorical choropleth
    # — see module docstring for the border-state caveat.
    state_zone_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in rows:
        if r.state_full and r.zone:
            state_zone_counts[r.state_full][r.zone] += 1
    dominant_zone = {
        state: max(zc.items(), key=lambda kv: kv[1])[0] for state, zc in state_zone_counts.items()
    }

    return {
        "rows": [{"zone": z, "count": v["count"], "price": round(v["price"], 2)} for z, v in ranked],
        "grandTotal": {"count": total_count, "price": round(total_price, 2)},
        "barChart": [
            {"zone": z, "count": per[z]["count"]}
            for z in sorted((k for k in per if k != "null"), key=lambda z: -per[z]["count"])
        ],
        "dominantZoneByState": dominant_zone,
    }


def build_section_window(rows: list[Row]) -> dict:
    return {
        "countries": build_countries(rows),
        "states": build_states(rows),
        "cities": build_cities(rows),
        "zones": build_zones(rows),
    }


def build_windows(rows: list[Row], anchor: date) -> dict:
    out = {}
    for key in PRESET_KEYS:
        start, end = resolve_preset(anchor, key)
        window_rows = filter_rows(rows, start, end, "All")
        out[key] = build_section_window(window_rows)
    return out


def build_daily_raw(rows: list[Row], anchor: date) -> list[dict]:
    start = anchor - timedelta(days=RAW_WINDOW_DAYS - 1)
    out = []
    for r in rows:
        if not (start <= r.d <= anchor):
            continue
        out.append({
            "date": date_key(r.d),
            "carrier": r.carrier,
            "country": r.country,
            "countryFull": r.country_full,
            "state": r.state,
            "stateFull": r.state_full,
            "city": r.city,
            "zone": r.zone,
            "price": round(r.price, 2),
        })
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    print("Fetching ALL tab ...")
    raw_rows = fetch_rows()
    rows = load_rows(raw_rows)
    print(f"  {len(rows):,} valid rows, {min(r.d for r in rows)} to {max(r.d for r in rows)}")

    anchor = latest_active_date(rows)

    print("Building Country/State/City/Zone sections (6 presets, Carrier=All) ...")
    windows = build_windows(rows, anchor)

    print("Building dailyRaw (custom range + carrier filter support) ...")
    daily_raw = build_daily_raw(rows, anchor)

    data = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "anchor": anchor.isoformat(),
        "windows": windows,
        "dailyRaw": daily_raw,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2))
    print(f"\nWrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
