// Client-side half of the date-range picker: preset windows are precomputed
// exactly in Python (scripts/fetch_data.py) and just looked up here; only
// "Custom range" needs real computation, over the capped `dailyRaw` arrays
// (trailing ~180 days — see the script's docstring for why it's capped).
//
// Mirrors scripts/fetch_data.py's resolve_preset/prev_period/trend logic —
// keep the two in sync if either changes.

import raw from "../data/ceoDashboardData.json";
import type { Trend, TrendDirection } from "../data/ceoDashboardMockData";

export const PRESET_KEYS = ["today", "yesterday", "last7", "last30", "thisMonth", "lastMonth"] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

export const PRESET_LABELS: Record<PresetKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  thisMonth: "This month",
  lastMonth: "Last month",
};

export type DateRangeSelection =
  | { kind: "preset"; key: PresetKey }
  | { kind: "custom"; start: string; end: string };

export const DEFAULT_SELECTION: DateRangeSelection = { kind: "preset", key: "last30" };

// ---------------------------------------------------------------------------
// Date helpers (plain ISO "YYYY-MM-DD" strings throughout — string compare
// sorts correctly for this format, and it sidesteps timezone footguns).
// ---------------------------------------------------------------------------

// All parsed/mutated/serialized in UTC deliberately — mixing local-time
// parsing (`new Date(iso)`, `.setDate`/`.getDate`) with UTC serialization
// (`.toISOString()`) makes `addDays` a no-op (or worse) for any viewer in a
// positive-UTC-offset timezone: local midnight rolls back to the *previous*
// UTC day, so the returned date string doesn't advance. That turned the
// `while (d <= end) d = addDays(d, 1)` loop in sparkFromRows() into an
// infinite loop — the actual cause of the custom-range Apply button
// appearing to hang/do nothing for anyone browsing from e.g. Asia/Manila.
function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Immediately-preceding span of the same length as [start,end] — mirrors
 * fetch_data.py's prev_period(). */
export function prevPeriod(start: string, end: string): [string, string] {
  const lengthDays = (toDate(end).getTime() - toDate(start).getTime()) / 86_400_000 + 1;
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(lengthDays - 1));
  return [prevStart, prevEnd];
}

export function trend(curr: number, prev: number): Trend | undefined {
  if (prev === 0) return undefined;
  const pct = Math.round(((curr - prev) / prev) * 1000) / 10;
  const direction: TrendDirection = pct > 0 ? "up" : pct < 0 ? "down" : "na";
  return { changePct: pct, direction };
}

/** Resolves a preset key to [start, end] anchored to that dataset's own
 * latest-active date — mirrors fetch_data.py's resolve_preset(). Only used
 * for display (the actual preset *data* is precomputed server-side); custom
 * range uses this same anchor concept implicitly via the date inputs. */
export function resolvePresetRange(anchor: string, key: PresetKey): [string, string] {
  switch (key) {
    case "today":
      return [anchor, anchor];
    case "yesterday": {
      const d = addDays(anchor, -1);
      return [d, d];
    }
    case "last7":
      return [addDays(anchor, -6), anchor];
    case "last30":
      return [addDays(anchor, -29), anchor];
    case "thisMonth":
      return [startOfMonth(anchor), anchor];
    case "lastMonth": {
      const firstThis = startOfMonth(anchor);
      const lastPrev = addDays(firstThis, -1);
      return [startOfMonth(lastPrev), lastPrev];
    }
  }
}

// ---------------------------------------------------------------------------
// Raw daily data (capped ~180 days) — typed from the generated JSON
// ---------------------------------------------------------------------------

type SalesRow = { date: string; shopify: number; amazon: number; walmart: number };
type MarketingRow = { date: string; spend: number; purchaseValue: number; conversions: number };
type StaffRow = { date: string; name: string; sales: number };
type GraphicDesignRow = { date: string; value: number };
type HoursRow = { date: string; name: string; hours: number };
type TerraSlateTrackerRow = { date: string; prodValue: number; printedOrders: number; blankValue: number; blankOrders: number };

const dailyRaw = raw.dailyRaw as {
  sales: SalesRow[];
  marketing: MarketingRow[];
  staffSales: StaffRow[];
  graphicDesign: GraphicDesignRow[];
  graphicsHours: HoursRow[];
  terraSlateTracker: TerraSlateTrackerRow[];
};

export const ANCHORS = raw.anchors;

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

// ---------------------------------------------------------------------------
// Window shapes — same as what Python computes per preset. Custom range
// recomputes these client-side from dailyRaw; preset just looks them up.
// ---------------------------------------------------------------------------

export interface SalesKpiRaw {
  id: string;
  label: string;
  value: string;
  empty?: boolean;
  hero?: boolean;
  // `| null`, not just `| undefined`: a zero-baseline prior period (e.g. a
  // 1-day window with no prior data) legitimately has no trend to show —
  // both fetch_data.py's trend() and the trend() helper below return that
  // as null/undefined interchangeably, and JSON.parse preserves null as-is.
  trend?: Trend | null;
  sparkline?: number[];
}
export interface SalesWindow {
  kpis: SalesKpiRaw[];
  channelMix: { id: string; label: string; pct: number }[];
  windowStart: string;
  windowEnd: string;
}

const CHANNELS = ["shopify", "amazon", "walmart"] as const;
const CHANNEL_LABEL: Record<(typeof CHANNELS)[number], string> = {
  shopify: "Shopify",
  amazon: "Amazon",
  walmart: "Walmart",
};

function fmtMoney(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtMoneyK(v: number): string {
  return `$${(v / 1000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K`;
}

function sparkFromRows<T extends { date: string }>(
  rows: T[],
  start: string,
  end: string,
  pick: (r: T) => number,
): number[] | undefined {
  const lengthDays = (toDate(end).getTime() - toDate(start).getTime()) / 86_400_000;
  if (lengthDays < 1) return undefined; // single-day windows — no line to draw
  const byDate = new Map(rows.map((r) => [r.date, pick(r)]));
  const out: number[] = [];
  let d = start;
  while (d <= end) {
    out.push(Math.round((byDate.get(d) ?? 0) * 100) / 100);
    d = addDays(d, 1);
  }
  return out;
}

export function computeCustomSalesWindow(start: string, end: string): SalesWindow {
  const [prevStart, prevEnd] = prevPeriod(start, end);
  const sum = (pick: (r: SalesRow) => number, s: string, e: string) =>
    dailyRaw.sales.filter((r) => inRange(r.date, s, e)).reduce((acc, r) => acc + pick(r), 0);

  const cur: Record<string, number> = {};
  const prev: Record<string, number> = {};
  for (const ch of CHANNELS) {
    cur[ch] = sum((r) => r[ch], start, end);
    prev[ch] = sum((r) => r[ch], prevStart, prevEnd);
  }
  const overallCur = CHANNELS.reduce((a, ch) => a + cur[ch], 0);
  const overallPrev = CHANNELS.reduce((a, ch) => a + prev[ch], 0);

  function kpi(id: string, label: string, curV: number, prevV: number, pick: (r: SalesRow) => number, hero = false): SalesKpiRaw {
    if (curV === 0) return { id, label, value: "No data", empty: true };
    return {
      id,
      label,
      value: fmtMoney(curV),
      hero,
      trend: trend(curV, prevV),
      sparkline: sparkFromRows(dailyRaw.sales, start, end, pick),
    };
  }

  const kpis: SalesKpiRaw[] = [
    kpi("overall-sales", "Overall Sales", overallCur, overallPrev, (r) => r.shopify + r.amazon + r.walmart, true),
    kpi("shopify-sales", "Shopify Sales", cur.shopify, prev.shopify, (r) => r.shopify),
    kpi("amazon-sales", "Amazon Sales", cur.amazon, prev.amazon, (r) => r.amazon),
    kpi("walmart-sales", "Walmart Sales", cur.walmart, prev.walmart, (r) => r.walmart),
  ];

  const channelMix =
    overallCur > 0
      ? CHANNELS.map((ch) => ({ id: ch, label: CHANNEL_LABEL[ch], pct: Math.round((cur[ch] / overallCur) * 1000) / 10 }))
      : CHANNELS.map((ch) => ({ id: ch, label: CHANNEL_LABEL[ch], pct: 0 }));

  return { kpis, channelMix, windowStart: start, windowEnd: end };
}

export interface MarketingTileRaw {
  id: string;
  label: string;
  value: string;
  // `| null`, not just `| undefined`: a zero-baseline prior period (e.g. a
  // 1-day window with no prior data) legitimately has no trend to show —
  // both fetch_data.py's trend() and the trend() helper below return that
  // as null/undefined interchangeably, and JSON.parse preserves null as-is.
  trend?: Trend | null;
}
export interface MarketingWindow {
  tiles: MarketingTileRaw[];
  windowStart: string;
  windowEnd: string;
}

export function computeCustomMarketingWindow(start: string, end: string): MarketingWindow {
  const [prevStart, prevEnd] = prevPeriod(start, end);
  function totals(s: string, e: string) {
    const rows = dailyRaw.marketing.filter((r) => inRange(r.date, s, e));
    const spend = rows.reduce((a, r) => a + r.spend, 0);
    const purchaseValue = rows.reduce((a, r) => a + r.purchaseValue, 0);
    const conversions = rows.reduce((a, r) => a + r.conversions, 0);
    return {
      spend,
      purchaseValue,
      roas: spend ? purchaseValue / spend : 0,
      cpa: conversions ? spend / conversions : 0,
    };
  }
  const cur = totals(start, end);
  const prev = totals(prevStart, prevEnd);

  function tile(id: string, label: string, curV: number, prevV: number, fmt: (v: number) => string): MarketingTileRaw {
    return { id, label, value: fmt(curV), trend: trend(curV, prevV) };
  }

  return {
    tiles: [
      tile("roas", "ROAS [FB/GA]", cur.roas, prev.roas, (v) => v.toFixed(2)),
      tile("ad-spend", "Ad Spend", cur.spend, prev.spend, fmtMoneyK),
      tile("cpa-combined", "CPA Combined", cur.cpa, prev.cpa, (v) => `$${v.toFixed(2)}`),
      tile("purchase-value", "Purchase Value", cur.purchaseValue, prev.purchaseValue, fmtMoneyK),
    ],
    windowStart: start,
    windowEnd: end,
  };
}

export interface StaffRowRaw {
  rank?: number;
  name: string;
  sales: number;
}
export interface StaffWindow {
  rows: StaffRowRaw[];
}

function computeStaffTotals(start: string, end: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of dailyRaw.staffSales) {
    if (!inRange(r.date, start, end)) continue;
    totals.set(r.name, (totals.get(r.name) ?? 0) + r.sales);
  }
  return totals;
}

export function computeCustomStaffWindows(
  start: string,
  end: string,
): { breadwinnaz: StaffWindow; proof: StaffWindow; graphic: StaffWindow } {
  const totals = computeStaffTotals(start, end);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const PROOF_TEAM = new Set(["Jose Soto", "Dakota George"]);
  const GRAPHIC_TEAM = new Set(["Steven Peralta Cornejo", "Bailey Pixton", "Luke Bosick", "Steven Cornejo"]);

  const toRows = (filter?: Set<string>, topN?: number): StaffRowRaw[] => {
    let items = filter ? ranked.filter(([n]) => filter.has(n)) : ranked;
    if (topN) items = items.slice(0, topN);
    return items.map(([name, sales]) => ({ name, sales: Math.round(sales * 100) / 100 }));
  };

  return {
    breadwinnaz: { rows: toRows(undefined, 15).map((r, i) => ({ rank: i + 1, ...r })) },
    proof: { rows: toRows(PROOF_TEAM) },
    graphic: { rows: toRows(GRAPHIC_TEAM) },
  };
}

export interface GraphicDesignWindow {
  value: number;
  // `| null`, not just `| undefined`: a zero-baseline prior period (e.g. a
  // 1-day window with no prior data) legitimately has no trend to show —
  // both fetch_data.py's trend() and the trend() helper below return that
  // as null/undefined interchangeably, and JSON.parse preserves null as-is.
  trend?: Trend | null;
}

export function computeCustomGraphicDesignWindow(start: string, end: string): GraphicDesignWindow {
  const [prevStart, prevEnd] = prevPeriod(start, end);
  const sum = (s: string, e: string) =>
    dailyRaw.graphicDesign.filter((r) => inRange(r.date, s, e)).reduce((a, r) => a + r.value, 0);
  const cur = sum(start, end);
  const prev = sum(prevStart, prevEnd);
  return { value: Math.round(cur * 100) / 100, trend: trend(cur, prev) };
}

export interface HoursWindow {
  rows: { name: string; hours: number }[];
}

export function computeCustomGraphicsHoursWindow(start: string, end: string): HoursWindow {
  const totals = new Map<string, number>();
  for (const r of dailyRaw.graphicsHours) {
    if (!inRange(r.date, start, end)) continue;
    totals.set(r.name, (totals.get(r.name) ?? 0) + r.hours);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  return { rows: ranked.filter(([, h]) => h > 0).map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 })) };
}

export interface TerraSlateTrackerTileRaw {
  id: string;
  label: string;
  value: string;
  empty?: boolean;
  // `| null`, not just `| undefined`: a zero-baseline prior period (e.g. a
  // 1-day window with no prior data) legitimately has no trend to show —
  // both fetch_data.py's trend() and the trend() helper above return that
  // as null/undefined interchangeably, and JSON.parse preserves null as-is.
  trend?: Trend | null;
}
export interface TerraSlateTrackerWindow {
  tiles: TerraSlateTrackerTileRaw[];
}

export function computeCustomTerraSlateTrackerWindow(start: string, end: string): TerraSlateTrackerWindow {
  const [prevStart, prevEnd] = prevPeriod(start, end);
  const sum = (pick: (r: TerraSlateTrackerRow) => number, s: string, e: string) =>
    dailyRaw.terraSlateTracker.filter((r) => inRange(r.date, s, e)).reduce((a, r) => a + pick(r), 0);

  const prodCur = sum((r) => r.prodValue, start, end);
  const prodPrev = sum((r) => r.prodValue, prevStart, prevEnd);
  const printedCur = sum((r) => r.printedOrders, start, end);
  const printedPrev = sum((r) => r.printedOrders, prevStart, prevEnd);
  const blankValCur = sum((r) => r.blankValue, start, end);
  const blankValPrev = sum((r) => r.blankValue, prevStart, prevEnd);
  const blankOrdCur = sum((r) => r.blankOrders, start, end);
  const blankOrdPrev = sum((r) => r.blankOrders, prevStart, prevEnd);

  function moneyTile(id: string, label: string, curV: number, prevV: number): TerraSlateTrackerTileRaw {
    if (curV === 0) return { id, label, value: "No data", empty: true };
    return { id, label, value: fmtMoney(curV), trend: trend(curV, prevV) };
  }
  function countTile(id: string, label: string, curV: number, prevV: number): TerraSlateTrackerTileRaw {
    return { id, label, value: String(Math.round(curV)), trend: trend(curV, prevV) };
  }

  return {
    tiles: [
      moneyTile("production-order-value", "Production Order Value", prodCur, prodPrev),
      countTile("printed-orders", "Printed Orders", printedCur, printedPrev),
      moneyTile("blank-order-value", "Blank Order Value", blankValCur, blankValPrev),
      countTile("blank-orders", "Blank Orders", blankOrdCur, blankOrdPrev),
    ],
  };
}
