// Client-side half of the AirCall Dashboard's date-range picker — mirrors
// src/lib/dateRange.ts's architecture exactly (preset windows precomputed in
// Python, "Custom range" computed here over a capped dailyRaw feed), but
// reads its own aircallDashboardData.json rather than the CEO Dashboard's.
//
// Every section on this page is date-driven: Inbound/Outbound/Total Calls
// Duration + their charts, and Calls by Tag / Calls by Tag by User. See
// scripts/fetch_aircall_data.py's docstring for what changed and why.

import raw from "../data/aircallDashboardData.json";
import type { Trend } from "../data/ceoDashboardMockData";
import {
  PRESET_KEYS,
  PRESET_LABELS,
  DEFAULT_SELECTION,
  resolvePresetRange,
  addDays,
  prevPeriod,
  trend as computeTrend,
  type PresetKey,
  type DateRangeSelection,
} from "./dateRange";

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

// A prior-period comparison is only trustworthy if the prior window falls
// entirely within the trailing dailyRaw feed (RAW_WINDOW_DAYS in the Python
// script) — otherwise "prior period" would silently mean "prior period,
// partially missing" and produce a misleading delta. Guarded by
// `hasFullPriorCoverage` below wherever a custom range computes a trend.
const EARLIEST_RAW_DATE: string = dailyRaw.calls.reduce(
  (min, r) => (r.date < min ? r.date : min),
  dailyRaw.calls[0]?.date ?? ANCHOR,
);

function hasFullPriorCoverage(priorStart: string): boolean {
  return priorStart >= EARLIEST_RAW_DATE;
}

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

// ---------------------------------------------------------------------------
// Consolidated Calls Duration table (Priority 2, brief 2026-09-17) — one
// per-employee row (replaces the old separate Inbound/Outbound/Total
// tables), sorted by Total Duration descending. `callsDropFlag` mirrors
// fetch_aircall_data.py's build_consolidated_table(): true when that
// employee's Total Calls fell >20% vs. the immediately-prior period.
// ---------------------------------------------------------------------------

export interface ConsolidatedCallsRow {
  employee: string;
  inboundHours: number;
  outboundHours: number;
  totalHours: number;
  totalCalls: number;
  splitLabel: string;
  callsDropFlag: boolean;
}
export interface ConsolidatedCallsTable {
  rows: ConsolidatedCallsRow[];
  grandTotal: ConsolidatedCallsRow;
}

function perEmployeeDirectionTotals(rows: CallRow[]): Map<string, { ib: number; ob: number; ibCount: number; obCount: number }> {
  const per = new Map<string, { ib: number; ob: number; ibCount: number; obCount: number }>();
  for (const r of rows) {
    const cur = per.get(r.employee) ?? { ib: 0, ob: 0, ibCount: 0, obCount: 0 };
    if (r.direction === "inbound") {
      cur.ib += r.durationTotal;
      cur.ibCount += r.count;
    } else {
      cur.ob += r.durationTotal;
      cur.obCount += r.count;
    }
    per.set(r.employee, cur);
  }
  return per;
}

export function computeCustomConsolidatedCallsWindow(start: string, end: string): ConsolidatedCallsTable {
  const [prevStart, prevEnd] = prevPeriod(start, end);
  const cur = perEmployeeDirectionTotals(dailyRaw.calls.filter((r) => inRange(r.date, start, end)));
  const priorCoverage = hasFullPriorCoverage(prevStart);
  const prev = priorCoverage ? perEmployeeDirectionTotals(dailyRaw.calls.filter((r) => inRange(r.date, prevStart, prevEnd))) : new Map();

  const splitLabel = (ibCount: number, obCount: number, total: number): string =>
    total ? `${Math.round((ibCount / total) * 100)}% / ${Math.round((obCount / total) * 100)}%` : "-";

  const rows: ConsolidatedCallsRow[] = [...cur.entries()].map(([employee, v]) => {
    const totalCalls = v.ibCount + v.obCount;
    const prevV = prev.get(employee);
    const prevTotalCalls = prevV ? prevV.ibCount + prevV.obCount : 0;
    const callsDropFlag = prevTotalCalls > 0 && (totalCalls - prevTotalCalls) / prevTotalCalls <= -0.2;
    return {
      employee,
      inboundHours: Math.round((v.ib / 3600) * 100) / 100,
      outboundHours: Math.round((v.ob / 3600) * 100) / 100,
      totalHours: Math.round(((v.ib + v.ob) / 3600) * 100) / 100,
      totalCalls,
      splitLabel: splitLabel(v.ibCount, v.obCount, totalCalls),
      callsDropFlag,
    };
  });
  rows.sort((a, b) => b.totalHours - a.totalHours);

  let grandIb = 0, grandOb = 0, grandIbCount = 0, grandObCount = 0;
  for (const v of cur.values()) {
    grandIb += v.ib;
    grandOb += v.ob;
    grandIbCount += v.ibCount;
    grandObCount += v.obCount;
  }
  const grandCalls = grandIbCount + grandObCount;

  return {
    rows,
    grandTotal: {
      employee: "Grand total",
      inboundHours: Math.round((grandIb / 3600) * 100) / 100,
      outboundHours: Math.round((grandOb / 3600) * 100) / 100,
      totalHours: Math.round(((grandIb + grandOb) / 3600) * 100) / 100,
      totalCalls: grandCalls,
      splitLabel: splitLabel(grandIbCount, grandObCount, grandCalls),
      callsDropFlag: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Executive Summary (Priority 1 + 5, brief 2026-09-17) — mirrors
// fetch_aircall_data.py's build_summary_window()/build_summary_narrative()
// exactly, so a custom range gets the same KPIs + narrative as a preset.
// ---------------------------------------------------------------------------

export interface SummaryMetric {
  value: number;
  trend: Trend | null;
}
export interface SummaryWindow {
  totalCalls: SummaryMetric;
  totalTalkTimeHours: SummaryMetric;
  avgCallDurationSeconds: SummaryMetric | null;
  inboundPct: number;
  outboundPct: number;
  tagCoveragePct: SummaryMetric;
  narrative: string;
}

function callsTotals(rows: CallRow[], directions: Set<string>): { durTotalSeconds: number; count: number } {
  let durTotalSeconds = 0;
  let count = 0;
  for (const r of rows) {
    if (!directions.has(r.direction)) continue;
    durTotalSeconds += r.durationTotal;
    count += r.count;
  }
  return { durTotalSeconds, count };
}

function tagTotals(rows: TagRow[]): { tagged: number; grand: number } {
  let grand = 0;
  let untagged = 0;
  for (const r of rows) {
    grand += r.count;
    if (r.tag === "-") untagged += r.count;
  }
  return { tagged: grand - untagged, grand };
}

function buildSummaryNarrative(
  totalCalls: number,
  callsTrend: Trend | undefined,
  talkHours: number,
  ibPct: number,
  obPct: number,
  tagPct: number,
): string {
  let deltaClause = "";
  if (callsTrend) {
    const verb = callsTrend.direction === "up" ? "up" : callsTrend.direction === "down" ? "down" : "flat";
    deltaClause = `, ${verb} ${Math.abs(callsTrend.changePct)}% vs. the prior period`;
  }
  const lead = `Team handled ${totalCalls.toLocaleString("en-US")} calls totaling ${talkHours} hours this period${deltaClause}.`;

  let split: string;
  if (obPct > ibPct) split = `Outbound activity (${obPct}% of calls) continues to outpace inbound.`;
  else if (ibPct > obPct) split = `Inbound activity (${ibPct}% of calls) continues to outpace outbound.`;
  else split = "Inbound and outbound activity are evenly split this period.";

  let tagLine: string;
  if (tagPct < 60) tagLine = `Tag coverage remains a gap at ${tagPct}% of calls categorized.`;
  else if (tagPct >= 85) tagLine = `Tag coverage is strong at ${tagPct}% of calls categorized.`;
  else tagLine = `Tag coverage stands at ${tagPct}% of calls categorized.`;

  return `${lead} ${split} ${tagLine}`;
}

export function computeCustomSummaryWindow(start: string, end: string): SummaryWindow {
  const [prevStart, prevEnd] = prevPeriod(start, end);
  const priorCoverage = hasFullPriorCoverage(prevStart);

  const { durTotalSeconds, count } = callsTotals(dailyRaw.calls.filter((r) => inRange(r.date, start, end)), new Set(["inbound", "outbound"]));
  const prevCalls = priorCoverage
    ? callsTotals(dailyRaw.calls.filter((r) => inRange(r.date, prevStart, prevEnd)), new Set(["inbound", "outbound"]))
    : null;
  const { count: ibCount } = callsTotals(dailyRaw.calls.filter((r) => inRange(r.date, start, end)), new Set(["inbound"]));
  const { count: obCount } = callsTotals(dailyRaw.calls.filter((r) => inRange(r.date, start, end)), new Set(["outbound"]));
  const { tagged, grand: tagGrand } = tagTotals(dailyRaw.tags.filter((r) => inRange(r.date, start, end)));
  const prevTags = priorCoverage ? tagTotals(dailyRaw.tags.filter((r) => inRange(r.date, prevStart, prevEnd))) : null;

  const talkHours = Math.round((durTotalSeconds / 3600) * 10) / 10;
  const talkHoursPrev = prevCalls ? Math.round((prevCalls.durTotalSeconds / 3600) * 10) / 10 : 0;
  const avgSeconds = count ? Math.round((durTotalSeconds / count) * 10) / 10 : null;
  const avgSecondsPrev = prevCalls && prevCalls.count ? Math.round((prevCalls.durTotalSeconds / prevCalls.count) * 10) / 10 : null;
  const ibPct = count ? Math.round((ibCount / count) * 1000) / 10 : 0;
  const obPct = count ? Math.round((obCount / count) * 1000) / 10 : 0;
  const tagCoveragePct = tagGrand ? Math.round((tagged / tagGrand) * 1000) / 10 : 0;
  const tagCoveragePctPrev = prevTags && prevTags.grand ? Math.round((prevTags.tagged / prevTags.grand) * 1000) / 10 : 0;

  const callsTrend = prevCalls ? computeTrend(count, prevCalls.count) : undefined;

  return {
    totalCalls: { value: count, trend: callsTrend ?? null },
    totalTalkTimeHours: { value: talkHours, trend: (prevCalls ? computeTrend(talkHours, talkHoursPrev) : undefined) ?? null },
    avgCallDurationSeconds:
      avgSeconds !== null
        ? { value: avgSeconds, trend: (avgSecondsPrev !== null ? computeTrend(avgSeconds, avgSecondsPrev) : undefined) ?? null }
        : null,
    inboundPct: ibPct,
    outboundPct: obPct,
    tagCoveragePct: { value: tagCoveragePct, trend: (prevTags ? computeTrend(tagCoveragePct, tagCoveragePctPrev) : undefined) ?? null },
    narrative: buildSummaryNarrative(count, callsTrend, talkHours, ibPct, obPct, tagCoveragePct),
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
