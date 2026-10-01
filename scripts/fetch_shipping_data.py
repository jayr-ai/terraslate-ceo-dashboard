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

## Shipment By City bubble map

Each row's `Zip Code` is resolved to a lat/lng via `data/zip_centroids.csv`
— a one-time export (33,791 rows) of the US Census Bureau's 2024 ZCTA
Gazetteer (public domain, https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html),
not a live lookup, so a refresh never depends on an external geocoding
service being up. Coverage check against every zip actually in this
sheet: 5,817 unique zips, 165 unmapped (2.8%) — 111 of those are
malformed junk (concatenated digits, all-zero placeholders) that
wouldn't have resolved to anything real anyway, leaving 54 genuine
zips (0.9% of the total) the Census Bureau doesn't assign a ZCTA to
(mostly PO-Box-only zips, which have no residential footprint to
centroid). Rows with an unmapped zip are simply skipped for the map
(they still count everywhere else — Country/State/City/Zone tables).

Map points are grouped by exact lat/lng, i.e. by zip (not by city
name) — this is deliberately finer-grained than the "Top Cities" table
so nearby-but-distinct zips within the same metro render as separate
dots, matching the reference report's clustered look. Unlike the Top
Cities table, the map does NOT exclude Lahaina — that exclusion is
specific to the ranked-spend table in the reference, and Lahaina is a
real ship-to location that belongs on a map of where shipments go.

## Month + Carrier picker architecture (JV, 2026-10-01: replaced the
## standard Today/Yesterday/Last Week/etc. picker with a plain Monthly
## dropdown — this sheet is updated on a monthly cadence, not daily, so a
## trailing-N-days window never meant much here anyway)

`windows` precomputes every (month x carrier) combination up front —
Jan 2025 (or the real data's own earliest month, if that's earlier)
through December of the current year, x All/UPS/FEDEX. That's a small,
fully enumerable grid (no "custom range" exists anymore, so there's no
need for a client-computed fallback or a capped per-shipment `dailyRaw`
feed like the other pickers use) — the client does a pure lookup by
`${monthKey}.${carrier}`, nothing is computed in the browser.
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
ZIP_CENTROIDS_PATH = Path(__file__).resolve().parent / "data" / "zip_centroids.csv"

EXCLUDED_CITY = "LAHAINA"


def fetch_rows() -> list[dict[str, str]]:
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={ALL_GID}"
    with urllib.request.urlopen(url, timeout=60) as resp:
        raw = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(raw)))


def load_zip_centroids() -> dict[str, tuple[float, float]]:
    out: dict[str, tuple[float, float]] = {}
    with ZIP_CENTROIDS_PATH.open(newline="") as f:
        for zip_code, lat, lng in csv.reader(f):
            out[zip_code] = (float(lat), float(lng))
    return out


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


def date_key(d: date) -> str:
    return d.isoformat()


def month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def month_label(year: int, month: int) -> str:
    return date(year, month, 1).strftime("%b %Y")


def month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    end = date(year, 12, 31) if month == 12 else date(year, month + 1, 1) - timedelta(days=1)
    return start, end


def generate_months(rows: list[Row]) -> list[tuple[int, int]]:
    """Jan 2025 through December of the current real year (JV, 2026-10-01:
    a plain Monthly dropdown, no Today/Last Week/etc.) — extended backward
    if real data starts earlier than Jan 2025, so a real month is never
    silently dropped from the dropdown."""
    earliest = min(r.d for r in rows)
    start_year, start_month = min((2025, 1), (earliest.year, earliest.month))
    this_year = date.today().year
    months: list[tuple[int, int]] = []
    y, m = start_year, start_month
    while (y, m) <= (this_year, 12):
        months.append((y, m))
        m += 1
        if m == 13:
            m = 1
            y += 1
    return months


# ---------------------------------------------------------------------------
# Load + clean
# ---------------------------------------------------------------------------


class Row:
    __slots__ = ("d", "carrier", "country", "country_full", "state", "state_full", "city", "zone", "price", "lat", "lng")


def resolve_zip(zip_code: str, centroids: dict[str, tuple[float, float]]) -> tuple[float, float] | None:
    zip_code = zip_code.strip()
    if not zip_code:
        return None
    return centroids.get(zip_code) or centroids.get(zip_code.zfill(5))


def load_rows(raw_rows: list[dict[str, str]], centroids: dict[str, tuple[float, float]]) -> list[Row]:
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
        latlng = resolve_zip(r.get("Zip Code") or "", centroids)
        row.lat, row.lng = latlng if latlng else (None, None)
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
        "mapPoints": build_city_map_points(rows),
    }


def in_albers_usa_bounds(lat: float, lng: float) -> bool:
    # react-simple-maps' geoAlbersUsa composite projection only plots
    # CONUS plus an inset Alaska/Hawaii — a real, valid lat/lng outside
    # those (Puerto Rico, US Virgin Islands, other territories) makes the
    # underlying d3 projection return null and crashes <Marker>. Verified
    # against real data: Ponce, PR (17.99, -66.66) and St. Thomas, USVI
    # (18.34, -64.93) both resolve a real zip centroid but fall outside
    # every box below. Boxes are deliberately generous, not precise borders.
    if 24.0 <= lat <= 50.0 and -125.0 <= lng <= -66.0:
        return True  # CONUS
    if 51.0 <= lat <= 72.0 and -180.0 <= lng <= -129.0:
        return True  # Alaska
    if 18.0 <= lat <= 23.0 and -160.0 <= lng <= -154.0:
        return True  # Hawaii
    return False


def build_city_map_points(rows: list[Row]) -> list[dict]:
    # Grouped by exact (lat, lng), i.e. by zip — see module docstring.
    # No Lahaina exclusion here, deliberately (also see module docstring).
    per: dict[tuple[float, float], dict] = defaultdict(lambda: {"count": 0, "price": 0.0, "city": "", "state": ""})
    for r in rows:
        if r.lat is None or r.lng is None or not in_albers_usa_bounds(r.lat, r.lng):
            continue
        agg = per[(r.lat, r.lng)]
        agg["count"] += 1
        agg["price"] += r.price
        if not agg["city"]:
            agg["city"] = r.city
            agg["state"] = r.state_full
    return [
        {"lat": lat, "lng": lng, "count": v["count"], "price": round(v["price"], 2), "city": v["city"], "state": v["state"]}
        for (lat, lng), v in per.items()
    ]


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


CARRIERS = ["All", "UPS", "FEDEX"]


def build_month_windows(rows: list[Row], months: list[tuple[int, int]]) -> dict:
    out: dict[str, dict] = {}
    for y, m in months:
        start, end = month_bounds(y, m)
        key = month_key(y, m)
        out[key] = {}
        for carrier in CARRIERS:
            window_rows = filter_rows(rows, start, end, carrier)
            out[key][carrier] = build_section_window(window_rows)
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    print("Fetching ALL tab ...")
    raw_rows = fetch_rows()
    centroids = load_zip_centroids()
    rows = load_rows(raw_rows, centroids)
    print(f"  {len(rows):,} valid rows, {min(r.d for r in rows)} to {max(r.d for r in rows)}")

    anchor = latest_active_date(rows)
    months = generate_months(rows)

    print(f"Building {len(months)} months x {len(CARRIERS)} carriers ...")
    windows = build_month_windows(rows, months)

    data = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "anchor": anchor.isoformat(),
        "defaultMonth": month_key(anchor.year, anchor.month),
        "months": [{"key": month_key(y, m), "label": month_label(y, m)} for y, m in months],
        "windows": windows,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2))
    print(f"\nWrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
