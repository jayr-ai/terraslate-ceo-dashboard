// Real data adapter — reads scripts/fetch_aircall_data.py's output
// (aircallDashboardData.json) and reshapes it into the typed constants the
// UI components consume.
//
//   - Inbound/Outbound/Total Calls Duration tables + their 3 line charts are
//     date-driven (build* functions taking a resolved window from
//     AircallDateRangeContext).
//   - Calls by Tag and Calls by Tag by User are all-time, static exports —
//     verified against the source report, not an oversight. See
//     scripts/fetch_aircall_data.py's docstring for the verification.
//
// To refresh with current numbers: `python3 scripts/fetch_aircall_data.py`.

import raw from "./aircallDashboardData.json";
import type { Source } from "./ceoDashboardMockData";
import type { HeatmapTableData } from "../components/shared/HeatmapDataTable";
import type { PivotHeatmapData } from "../components/shared/PivotHeatmapTable";
import type { DualLineChartPoint } from "../components/shared/DualLineChart";
import type { CallsDurationTable, CallsDurationWindow, ChartWindow } from "../lib/aircallDateRange";

const rawDataSource: Source = { label: "AirCall Data - Raw Data 4-24", confirmed: true };
const tagsDataSource: Source = { label: "AirCall Data - Tags_Data", confirmed: true };

// ---------------------------------------------------------------------------
// Inbound / Outbound / Total Calls Duration (date-driven)
// ---------------------------------------------------------------------------

function buildDurationTable(id: string, title: string, table: CallsDurationTable): HeatmapTableData {
  return {
    id,
    title,
    columns: [
      { key: "employee", label: "Employee", align: "left", truncate: true },
      { key: "durationTotal", label: "Duration (total)", align: "right", format: "hours", heat: "blue" },
      { key: "durationInCall", label: "Duration (in call)", align: "right", format: "hours", heat: "green" },
      { key: "count", label: table.countLabel, align: "right", format: "number", heat: "cyan" },
      { key: "countPct", label: table.countPctLabel, align: "right", format: "percent", heat: "cyan" },
    ],
    rows: table.rows.map((r) => ({
      employee: r.employee,
      durationTotal: r.durationTotal,
      durationInCall: r.durationInCall,
      count: r.count,
      countPct: r.countPct,
    })),
    grandTotalRow: {
      employee: "Grand total",
      durationTotal: table.grandTotal.durationTotal,
      durationInCall: table.grandTotal.durationInCall,
      count: table.grandTotal.count,
      countPct: table.grandTotal.countPct,
    },
    source: rawDataSource,
    pageSize: Math.max(table.rows.length, 1),
  };
}

export function buildInboundCallsTable(window: CallsDurationWindow): HeatmapTableData {
  return buildDurationTable("inbound-calls-duration", "Inbound Calls Duration", window.inbound);
}
export function buildOutboundCallsTable(window: CallsDurationWindow): HeatmapTableData {
  return buildDurationTable("outbound-calls-duration", "Outbound Calls Duration", window.outbound);
}
export function buildTotalCallsTable(window: CallsDurationWindow): HeatmapTableData {
  return buildDurationTable("total-calls-duration", "Total Calls Duration", window.total);
}

// ---------------------------------------------------------------------------
// The 3 line charts (date-driven, raw-seconds scale)
// ---------------------------------------------------------------------------

export function buildInboundChartData(window: ChartWindow): DualLineChartPoint[] {
  return window.points.map((p) => ({ date: p.date, total: p.inboundDurationTotal, inCall: p.inboundDurationInCall }));
}
export function buildOutboundChartData(window: ChartWindow): DualLineChartPoint[] {
  return window.points.map((p) => ({ date: p.date, total: p.outboundDurationTotal, inCall: p.outboundDurationInCall }));
}
export function buildTotalChartData(window: ChartWindow): DualLineChartPoint[] {
  return window.points.map((p) => ({ date: p.date, total: p.totalDurationTotal, inCall: p.totalDurationInCall }));
}

// ---------------------------------------------------------------------------
// Calls by Tag (all-time, static)
// ---------------------------------------------------------------------------

export const callsByTagTable: HeatmapTableData = {
  id: "calls-by-tag",
  title: "Calls by Tag",
  caption: "Tags are consolidated to six main tags.",
  columns: [
    { key: "tag", label: "Main Tag", align: "left" },
    { key: "total", label: "Total", align: "right", format: "number", heat: "blue" },
    { key: "pctOfTotal", label: "% of Total", align: "right", format: "percent", heat: "green" },
  ],
  rows: raw.callsByTag.rows as unknown as { tag: string; total: number; pctOfTotal: number }[],
  source: tagsDataSource,
  pageSize: raw.callsByTag.rows.length,
};

// ---------------------------------------------------------------------------
// Calls by Tag by User (all-time, static, pivot)
// ---------------------------------------------------------------------------

export const callsByTagByUserTable: PivotHeatmapData = {
  title: "Calls by Tag by User",
  caption: "Tags are consolidated to six main tags.",
  cornerLabel: "Employee / Main Tag",
  rowLabel: "Main Tag",
  rowOrder: raw.callsByTagByUser.rowOrder,
  colOrder: raw.callsByTagByUser.colOrder,
  matrix: raw.callsByTagByUser.matrix,
  colTotals: raw.callsByTagByUser.colTotals,
  grandTotal: raw.callsByTagByUser.grandTotal,
  maxCell: raw.callsByTagByUser.maxCell,
  source: tagsDataSource,
};

export const aircallDataGeneratedAt: string = raw.generatedAt;
