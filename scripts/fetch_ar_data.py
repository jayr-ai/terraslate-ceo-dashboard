#!/usr/bin/env python3
"""
Pulls the real Accounts Receivable data from the "TerraSlate Shopify" Google
Sheet's "Unpaid" tab and writes src/data/arDashboardData.json in the shape
the UI components expect. From the Unpaid tab itself, only columns A (Date),
C (Order), and H (Total) matter — confirmed by the build instructions and by
every other column being genuinely blank in that tab (Channel, Customer,
Payment status, etc). Fix 7 (below) additionally reads the same workbook's
"AR" tab for customer identity, since Unpaid's own Customer column is blank.

Sheet is link-accessible (no auth needed) — pulled via **XLSX export** (via
openpyxl, mirroring scripts/fetch_aircall_data.py) rather than per-tab CSV,
since Fix 7 needs two tabs (Unpaid + AR) out of the same workbook. Re-run
any time:

    python3 scripts/fetch_ar_data.py

## Aging buckets

Standard AR aging convention, anchored to *today* (not the sheet's own
latest row — unlike the other dashboards' "latest active date" anchor, aging
is inherently relative to the real calendar date, not to when the sheet was
last touched):

    Last 30 Days .... age <= 30 days
    31-60 Days ...... 30 < age <= 60 days
    61-90 Days ...... 60 < age <= 90 days
    90+ Days ........ age > 90 days

Each bucket's trend badge compares its current total against the *same
bucket recomputed 30 days ago* (i.e. re-running the same age-bucketing logic
with the anchor shifted back 30 days over the same historical rows) — a
period-over-period comparison, consistent with every other dashboard in this
app. This won't reproduce the exact percentages in the original report's
screenshot (Looker's own comparison-period semantics for a live,
continuously-changing sheet aren't fully recoverable from a static
screenshot), but it's the same well-defined convention used everywhere else
here, not a guess.

## Deliberately dropped from the original report (per JV, 2026-09-16)

  - The donut chart — every non-Date/Order/Total column is blank, so there's
    nothing real to segment it by.
  - The "Select date range" control and any page-wide date picker — the 4
    aging buckets are always today-relative by definition; there's no
    meaningful "custom range" to apply on top of that, so this page has no
    interactive date filtering at all (unlike CEO/AirCall Dashboards).

## Implementation brief additions (per JV's shared doc, 2026-09-17)

Adds: a headline "Total Outstanding AR" KPI, a DSO (Days Sales Outstanding)
KPI, a 4-segment aging-mix bar, semantic (bad/good, not just up/down) trend
coloring, and an auto-generated one-line narrative. All computed here in
Python and shipped as plain fields — no new client-side logic needed beyond
rendering.

DSO needs a real "total sales" figure, which the Unpaid tab alone can't
provide (checked: the AR spreadsheet's other tabs — "AR Raw", "Raw", "AR" —
are exports of the same ~55 unpaid orders, not broader sales history). Reuses
the same "Shopify" daily-sales tab the CEO Dashboard already pulls from
(DailyDashRaw_TerraSlate spreadsheet) as the sales denominator — a
self-contained second pull, not a dependency on the CEO Dashboard's own
output. Per the brief, this doesn't separate credit vs. cash sales, so the
DSO tile is captioned "(all sales)" rather than implying more precision than
the data supports.

## Fix 7 additions (per JV's shared doc, 2026-09-18) — Top 10 Customers

The brief's own "Data note" flags a prerequisite: this needs a clean
customer identifier per order, which the Unpaid tab doesn't have (its
Customer column is blank on all 55 rows, verified again just now). BUT the
same workbook's "AR" tab is a full native Shopify order export (Name =
order #, Email, Billing Name, Billing Company) covering the same orders —
checked, and all 55 Unpaid orders resolve cleanly to an AR-tab row. That's
the join this uses:

  - Group by **Email** (from the AR tab), not display name — a few of this
    dataset's biggest accounts (e.g. one $56K+ enterprise account) place
    orders under slightly different billing-name/company text per PO, so
    grouping by name text alone would fragment one real customer into
    several rows. Email is the reliable unique key.
  - Display label = that email's **Billing Name**, with any trailing
    `" | PO ..."` reference-number suffix stripped (Shopify's billing-name
    field often carries a PO number appended, e.g.
    "DCL Development Company | PO 4507552645" -> "DCL Development Company").
    Billing Name is populated on every order (unlike Billing Company, which
    is sparse and — checked — has at least one row where it wrongly holds a
    VAT ID instead of a company name), so it's the more reliable label.
  - "Flagged" (single-customer concentration risk, brief's 15-20% band) uses
    **15%** of Total Outstanding AR (Fix 1) as the threshold — the
    lower/more-sensitive end of that range, since this is a risk flag, not
    a hard cutoff.
"""

from __future__ import annotations

import csv
import io
import json
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import openpyxl

SHEET_ID = "13DQSWYiyHiLqMJqEoOgbUtrXoHsz4mmcbENO1LMES68"
UNPAID_TAB = "Unpaid"
AR_TAB = "AR"

# For DSO's sales denominator — same sheet scripts/fetch_data.py pulls for
# the CEO Dashboard's "Shopify Sales" figure: CombinedSales filtered to the
# Shopify channel (there's also a standalone "Shopify" tab, gid=0, but it's
# frozen at Oct 2023 — CombinedSales is the one that's actually kept live).
SALES_SHEET_ID = "1Xa3lc7x2pFQzoja-b56MDbVFSEa_2YjGHAq6QjV4jDs"
SALES_GID = "638946072"

OUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "arDashboardData.json"

BUCKET_KEYS = ["last30", "d31to60", "d61to90", "d90plus"]
BUCKET_LABELS = {
    "last30": "Last 30 Days Rec.",
    "d31to60": "31-60 Days Rec.",
    "d61to90": "61-90 Days Rec.",
    "d90plus": "90+ Days Rec.",
}
UNPAID_LABEL = "Unpaid"


def fetch_csv(sheet_id: str, gid: str) -> list[dict[str, str]]:
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        raw = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(raw)))


def download_workbook(sheet_id: str) -> openpyxl.Workbook:
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"
    with urllib.request.urlopen(url, timeout=60) as resp:
        raw = resp.read()
    tmp_path = Path("/tmp/ar_sheet.xlsx")
    tmp_path.write_bytes(raw)
    return openpyxl.load_workbook(tmp_path, read_only=True, data_only=True)


def sheet_rows(wb: openpyxl.Workbook, tab: str):
    ws = wb[tab]
    rows_iter = ws.iter_rows(values_only=True)
    header = next(rows_iter)
    idx = {h: i for i, h in enumerate(header) if h}
    return idx, rows_iter


def as_date(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    return None


def load_unpaid_rows(wb: openpyxl.Workbook) -> list[tuple[date, str, float]]:
    idx, rows_iter = sheet_rows(wb, UNPAID_TAB)
    rows = []
    for row in rows_iter:
        order = row[idx["Order"]]
        if not order:
            continue
        d = as_date(row[idx["DATE"]])
        if not d:
            continue
        total = row[idx["Total"]]
        rows.append((d, str(order).strip(), float(total) if isinstance(total, (int, float)) else money(total)))
    return rows


def clean_billing_name(name: str | None) -> str | None:
    """Strips a trailing '| PO ...' (or similar) reference-number suffix
    Shopify's Billing Name export often carries — see module docstring."""
    if not name:
        return None
    return name.split("|")[0].strip()


def load_customer_lookup(wb: openpyxl.Workbook) -> dict[str, dict]:
    """order# -> {email, billingName} from the AR tab — see module docstring
    for why (Unpaid's own Customer column is blank on every row)."""
    idx, rows_iter = sheet_rows(wb, AR_TAB)
    lookup: dict[str, dict] = {}
    for row in rows_iter:
        name = row[idx.get("Name", -1)] if "Name" in idx else None
        if not name:
            continue
        order = str(name).strip()
        entry = lookup.setdefault(order, {"email": None, "billingName": None})
        email = row[idx["Email"]] if "Email" in idx else None
        billing = row[idx["Billing Name"]] if "Billing Name" in idx else None
        if not entry["email"] and email:
            entry["email"] = str(email).strip()
        if not entry["billingName"] and billing:
            entry["billingName"] = clean_billing_name(str(billing))
    return lookup


def load_daily_sales() -> dict[date, float]:
    """CombinedSales tab, Shopify channel only, summed per day."""
    rows = fetch_csv(SALES_SHEET_ID, SALES_GID)
    daily: dict[date, float] = defaultdict(float)
    for r in rows:
        if (r.get("CHANNEL") or "").strip() != "Shopify":
            continue
        d = parse_date(r.get("DATE"))
        if not d:
            continue
        daily[d] += money(r.get("SALE"))
    return daily


def sales_sum(daily: dict[date, float], start: date, end: date) -> float:
    return sum(v for d, v in daily.items() if start <= d <= end)


def money(s: str | None) -> float:
    if not s:
        return 0.0
    s = s.strip().replace("$", "").replace(",", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_date(s: str | None) -> date | None:
    if not s:
        return None
    try:
        return datetime.strptime(s.strip(), "%m/%d/%Y").date()
    except ValueError:
        return None


def bucket_for_age(age: int) -> str:
    if age <= 30:
        return "last30"
    if age <= 60:
        return "d31to60"
    if age <= 90:
        return "d61to90"
    return "d90plus"


def trend(curr: float, prev: float) -> dict | None:
    if prev == 0:
        return None
    pct = round((curr - prev) / prev * 100, 1)
    direction = "up" if pct > 0 else "down" if pct < 0 else "na"
    return {"changePct": pct, "direction": direction}


def group_by_bucket(rows: list[tuple[date, str, float]], anchor: date) -> dict[str, list[tuple[date, str, float]]]:
    grouped: dict[str, list[tuple[date, str, float]]] = defaultdict(list)
    for d, order, total in rows:
        age = (anchor - d).days
        if age < 0:
            continue  # future-dated row — shouldn't happen, ignore defensively
        grouped[bucket_for_age(age)].append((d, order, total))
    return grouped


def bucket_totals(grouped: dict[str, list[tuple[date, str, float]]]) -> dict[str, dict]:
    return {
        key: {"total": round(sum(t for _, _, t in grouped[key]), 2), "count": len(grouped[key])}
        for key in BUCKET_KEYS
    }


# Buckets other than "Last 30 Days" are the "risk" buckets for Fix 5's
# narrative and Fix 2's semantic trend coloring: growth there means slower
# collections, not just more sales (which is what growth in Last 30 usually
# means), so an increase there is a genuinely bad signal.
RISK_BUCKET_KEYS = ["d31to60", "d61to90", "d90plus"]


def build_narrative(buckets: dict, total_trend: dict | None) -> str:
    candidates = [
        (key, buckets[key]["trend"]["changePct"])
        for key in RISK_BUCKET_KEYS
        if buckets[key]["trend"] and buckets[key]["trend"]["direction"] == "up"
    ]
    if not candidates:
        if total_trend and total_trend["direction"] == "up":
            return (
                f"Total outstanding AR rose {total_trend['changePct']}% vs. the prior 30 days — "
                "no single aging bucket stands out; check the Last 30 Days table for newly unpaid orders."
            )
        if total_trend and total_trend["direction"] == "down":
            return (
                f"Total outstanding AR fell {abs(total_trend['changePct'])}% vs. the prior 30 days — "
                "collections are keeping pace with new unpaid orders."
            )
        return "Not enough history yet to compare AR trends period-over-period."

    worst_key, worst_pct = max(candidates, key=lambda kv: kv[1])
    worst_count = buckets[worst_key]["count"]
    worst_label = BUCKET_LABELS[worst_key].replace(" Rec.", "")
    order_word = "order" if worst_count == 1 else "orders"
    roll_word = "it rolls" if worst_count == 1 else "they roll"
    total_clause = f"{total_trend['changePct']}%" if total_trend else "an unmeasured amount"
    verb = "grew" if (total_trend and total_trend["direction"] == "up") else "changed"

    return (
        f"AR {verb} {total_clause} vs. the prior 30 days, driven mainly by a {worst_pct}% jump in "
        f"{worst_label} receivables — prioritize collection on the {worst_count} unpaid {order_word} "
        f"in that bucket before {roll_word} into the next aging tier."
    )


# Fix 7 — Top 10 Customers by Outstanding AR. Single-customer concentration
# flag uses the lower/more-sensitive end of the brief's stated 15-20% band.
CONCENTRATION_FLAG_PCT = 15.0


def build_top_customers(
    rows: list[tuple[date, str, float]],
    customer_lookup: dict[str, dict],
    total_outstanding: float,
) -> dict:
    per_email: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0, "name": None})
    for _d, order, total in rows:
        c = customer_lookup.get(order, {})
        key = c.get("email") or order  # order# fallback if the AR-tab join ever misses
        entry = per_email[key]
        entry["total"] += total
        entry["count"] += 1
        if not entry["name"]:
            entry["name"] = c.get("billingName") or c.get("email") or order

    ranked = sorted(per_email.values(), key=lambda v: -v["total"])
    top10 = ranked[:10]

    customer_rows = [
        {
            "name": v["name"],
            "total": round(v["total"], 2),
            "pct": round(v["total"] / total_outstanding * 100, 1) if total_outstanding else 0,
            "orderCount": v["count"],
            "flagged": bool(total_outstanding) and (v["total"] / total_outstanding * 100) >= CONCENTRATION_FLAG_PCT,
        }
        for v in top10
    ]
    top10_total = sum(v["total"] for v in top10)
    concentration_pct = round(top10_total / total_outstanding * 100, 1) if total_outstanding else 0

    return {"rows": customer_rows, "concentrationPct": concentration_pct}


def main():
    print("Downloading AR workbook (Unpaid + AR tabs) ...")
    wb = download_workbook(SHEET_ID)
    rows = load_unpaid_rows(wb)

    anchor = date.today()
    prev_anchor = anchor - timedelta(days=30)

    grouped_rows = group_by_bucket(rows, anchor)
    cur = bucket_totals(grouped_rows)
    prev = bucket_totals(group_by_bucket(rows, prev_anchor))

    buckets = {}
    for key in BUCKET_KEYS:
        bucket_rows = sorted(grouped_rows[key], key=lambda r: r[0], reverse=True)
        buckets[key] = {
            "label": BUCKET_LABELS[key],
            "unpaidLabel": UNPAID_LABEL,
            "total": cur[key]["total"],
            "count": cur[key]["count"],
            "trend": trend(cur[key]["total"], prev[key]["total"]),
            "countTrend": trend(cur[key]["count"], prev[key]["count"]),
            "rows": [
                {"date": d.strftime("%b %-d, %Y"), "order": order, "total": round(total, 2)}
                for d, order, total in bucket_rows
            ],
        }

    all_time_receivable = round(sum(t for _, _, t in rows), 2)

    monthly_totals: dict[str, float] = defaultdict(float)
    for d, _order, total in rows:
        monthly_totals[f"{d.year:04d}-{d.month:02d}"] += total
    monthly = [
        {"month": m, "label": datetime.strptime(m, "%Y-%m").strftime("%b"), "total": round(v, 2)}
        for m, v in sorted(monthly_totals.items())
    ]

    # Fix 1 — Total Outstanding AR (sum of the 4 bucket totals — deliberately
    # NOT allTimeReceivable, which is a different, cumulative-forever metric).
    total_outstanding_cur = round(sum(cur[k]["total"] for k in BUCKET_KEYS), 2)
    total_outstanding_prev = round(sum(prev[k]["total"] for k in BUCKET_KEYS), 2)
    total_outstanding_count = sum(cur[k]["count"] for k in BUCKET_KEYS)
    total_outstanding_count_prev = sum(prev[k]["count"] for k in BUCKET_KEYS)
    total_outstanding_trend = trend(total_outstanding_cur, total_outstanding_prev)
    total_outstanding_count_trend = trend(total_outstanding_count, total_outstanding_count_prev)

    # Fix 3 — aging mix as % of Total Outstanding AR.
    aging_mix = [
        {
            "key": key,
            "label": BUCKET_LABELS[key].replace(" Rec.", ""),
            "pct": round(cur[key]["total"] / total_outstanding_cur * 100, 1) if total_outstanding_cur else 0,
        }
        for key in BUCKET_KEYS
    ]

    # Fix 4 — DSO, 30-day rolling. Sales denominator excludes the "credit vs.
    # cash" distinction the source data doesn't have (see module docstring).
    print("Fetching Shopify daily sales (for DSO) ...")
    daily_sales = load_daily_sales()
    sales_last30 = round(sales_sum(daily_sales, anchor - timedelta(days=29), anchor), 2)
    sales_prev30 = round(sales_sum(daily_sales, prev_anchor - timedelta(days=29), prev_anchor), 2)

    def compute_dso(total_ar: float, sales_30d: float) -> float | None:
        return round((total_ar / sales_30d) * 30, 1) if sales_30d else None

    dso_cur = compute_dso(total_outstanding_cur, sales_last30)
    dso_prev = compute_dso(total_outstanding_prev, sales_prev30)
    dso_trend = trend(dso_cur, dso_prev) if dso_cur is not None and dso_prev is not None else None

    # Fix 5 — one-line narrative.
    narrative = build_narrative(buckets, total_outstanding_trend)

    # Fix 7 — Top 10 Customers by Outstanding AR (see module docstring for
    # the AR-tab join this depends on).
    print("Building Top 10 Customers (AR tab join) ...")
    customer_lookup = load_customer_lookup(wb)
    top_customers = build_top_customers(rows, customer_lookup, total_outstanding_cur)

    data = {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "anchor": anchor.isoformat(),
        "buckets": buckets,
        "allTimeReceivable": all_time_receivable,
        "monthly": monthly,
        "totalOutstanding": {
            "total": total_outstanding_cur,
            "count": total_outstanding_count,
            "trend": total_outstanding_trend,
            "countTrend": total_outstanding_count_trend,
        },
        "agingMix": aging_mix,
        "dso": {
            "value": dso_cur,
            "trend": dso_trend,
            "salesWindowLabel": "(all sales)",
        },
        "narrative": narrative,
        "topCustomers": top_customers,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2))
    print(f"\nWrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
