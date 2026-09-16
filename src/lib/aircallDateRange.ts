// Client-side half of the AirCall Dashboard's date-range picker — mirrors
// src/lib/dateRange.ts's architecture exactly (preset windows precomputed in
// Python, "Custom range" computed here over a capped dailyRaw feed), but
// reads its own aircallDashboardData.json rather than the CEO Dashboard's.
//
// Every section on this page is date-driven: Inbound/Outbound/Total Calls
// Duration + their charts, and Calls by Tag / Calls by Tag by User. See
// scripts/fetch_aircall_data.py's docstring for what changed and why.

import raw from "../data/aircallDashboardData.json";
import { PRESET_KEYS, PRESET_LABELS, DEFAULT_SELECTION, resolvePresetRange, addDays, type PresetKey, type DateRangeSelection } from "./dateRange";

export { PRESET_KEYS, PRESET_LABELS, DEFAULT_SELECTION, resolvePresetRange };
export type { PresetKey, DateRangeSelection };

export const ANCHOR: string = raw.anchor;

type CallRow = {
  date: string;
  employee: string;
  direction: "inbound" | "outbound";
  durationTotal: number;
  durationInCall: number;
  count: number;
};

type TagRow = { date: string; tag: string; initial: string; count: number };

const dailyRaw = raw.dailyRaw as { calls: CallRow[]; tags: TagRow[] };

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

// ---------------------------------------------------------------------------
// Inbound / Outbound / Total Calls Duration tables
// ---------------------------------------------------------------------------

export interface CallsDurationRow {
  employee: string;
  durationTotal: number;
  durationInCall: number | null;
  count: number;
  countPct: number;
}
export interface CallsDurationTable {
  rows: CallsDurationRow[];
  grandTotal: { durationTotal: number; durationInCall: number; count: number; countPct: number };
  countLabel: string;
  countPctLabel: string;
}
export interface CallsDurationWindow {
  inbound: CallsDurationTable;
  outbound: CallsDurationTable;
  total: CallsDurationTable;
}

function buildTable(
  rows: CallRow[],
  directions: Set<string>,
  countLabel: string,
  countPctLabel: string,
): CallsDurationTable {
  const perEmp = new Map<string, { durTotal: number; durCall: number; count: number }>();
  for (const r of rows) {
    if (!directions.has(r.direction)) continue;
    const cur = perEmp.get(r.employee) ?? { durTotal: 0, durCall: 0, count: 0 };
    cur.durTotal += r.durationTotal;
    cur.durCall += r.durationInCall;
    cur.count += r.count;
    perEmp.set(r.employee, cur);
  }
  let grandCount = 0;
  let grandDurTotal = 0;
  let grandDurCall = 0;
  for (const v of perEmp.values()) {
    grandCount += v.count;
    grandDurTotal += v.durTotal;
    grandDurCall += v.durCall;
  }

  const tableRows: CallsDurationRow[] = [...perEmp.entries()].map(([employee, v]) => ({
    employee,
    durationTotal: Math.round((v.durTotal / 3600) * 100) / 100,
    durationInCall: v.count ? Math.round((v.durCall / 3600) * 100) / 100 : null,
    count: v.count,
    countPct: grandCount ? Math.round((v.count / grandCount) * 1000) / 10 : 0,
  }));
  tableRows.sort((a, b) => b.count - a.count);

  return {
    rows: tableRows,
    grandTotal: {
      durationTotal: Math.round((grandDurTotal / 3600) * 100) / 100,
      durationInCall: Math.round((grandDurCall / 3600) * 100) / 100,
      count: grandCount,
      countPct: grandCount ? 100 : 0,
    },
    countLabel,
    countPctLabel,
  };
}

export function computeCustomCallsWindow(start: string, end: string): CallsDurationWindow {
  const rows = dailyRaw.calls.filter((r) => inRange(r.date, start, end));
  return {
    inbound: buildTable(rows, new Set(["inbound"]), "IB (total)", "IB %"),
    outbound: buildTable(rows, new Set(["outbound"]), "OB (total)", "OB %"),
    total: buildTable(rows, new Set(["inbound", "outbound"]), "Total Calls", "IB/OB %"),
  };
}

// ---------------------------------------------------------------------------
// The 3 line charts — daily series, summed across employees, in raw seconds
// (not converted to hours — matches the reference report's chart scale)
// ---------------------------------------------------------------------------

export interface ChartPoint {
  date: string;
  inboundDurationTotal: number;
  inboundDurationInCall: number;
  outboundDurationTotal: number;
  outboundDurationInCall: number;
  totalDurationTotal: number;
  totalDurationInCall: number;
}
export interface ChartWindow {
  points: ChartPoint[];
}

export function computeCustomChartWindow(start: string, end: string): ChartWindow {
  const byDate = new Map<string, ChartPoint>();
  let d = start;
  while (d <= end) {
    byDate.set(d, {
      date: d,
      inboundDurationTotal: 0,
      inboundDurationInCall: 0,
      outboundDurationTotal: 0,
      outboundDurationInCall: 0,
      totalDurationTotal: 0,
      totalDurationInCall: 0,
    });
    d = addDays(d, 1);
  }
  for (const r of dailyRaw.calls) {
    const pt = byDate.get(r.date);
    if (!pt) continue;
    if (r.direction === "inbound") {
      pt.inboundDurationTotal += r.durationTotal;
      pt.inboundDurationInCall += r.durationInCall;
    } else {
      pt.outboundDurationTotal += r.durationTotal;
      pt.outboundDurationInCall += r.durationInCall;
    }
    pt.totalDurationTotal = pt.inboundDurationTotal + pt.outboundDurationTotal;
    pt.totalDurationInCall = pt.inboundDurationInCall + pt.outboundDurationInCall;
  }
  return { points: [...byDate.values()] };
}

// ---------------------------------------------------------------------------
// Calls by Tag / Calls by Tag by User
// ---------------------------------------------------------------------------

export interface CallsByTagRow {
  tag: string;
  total: number;
  pctOfTotal: number;
}
export interface CallsByTagWindow {
  rows: CallsByTagRow[];
  grandTotal: number;
}

export function computeCustomCallsByTagWindow(start: string, end: string): CallsByTagWindow {
  const totals = new Map<string, number>();
  let grand = 0;
  for (const r of dailyRaw.tags) {
    if (!inRange(r.date, start, end)) continue;
    totals.set(r.tag, (totals.get(r.tag) ?? 0) + r.count);
    grand += r.count;
  }
  const rows = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag, total]) => ({ tag, total, pctOfTotal: grand ? Math.round((total / grand) * 10000) / 100 : 0 }));
  return { rows, grandTotal: grand };
}

export interface CallsByTagByUserWindow {
  rowOrder: string[];
  colOrder: string[];
  matrix: Record<string, Record<string, number>>;
  colTotals: Record<string, number>;
  grandTotal: number;
  maxCell: number;
}

export function computeCustomCallsByTagByUserWindow(start: string, end: string): CallsByTagByUserWindow {
  const matrix = new Map<string, Map<string, number>>();
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  let grand = 0;
  let maxCell = 0;

  for (const r of dailyRaw.tags) {
    if (!inRange(r.date, start, end) || r.tag === "-" || !r.initial) continue;
    const row = matrix.get(r.tag) ?? new Map<string, number>();
    const cell = (row.get(r.initial) ?? 0) + r.count;
    row.set(r.initial, cell);
    matrix.set(r.tag, row);
    rowTotals.set(r.tag, (rowTotals.get(r.tag) ?? 0) + r.count);
    colTotals.set(r.initial, (colTotals.get(r.initial) ?? 0) + r.count);
    grand += r.count;
    if (cell > maxCell) maxCell = cell;
  }

  const rowOrder = [...rowTotals.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const colOrder = [...colTotals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);

  return {
    rowOrder,
    colOrder,
    matrix: Object.fromEntries(
      rowOrder.map((t) => [t, Object.fromEntries(colOrder.map((c) => [c, matrix.get(t)?.get(c) ?? 0]))]),
    ),
    colTotals: Object.fromEntries(colOrder.map((c) => [c, colTotals.get(c) ?? 0])),
    grandTotal: grand,
    maxCell,
  };
}
