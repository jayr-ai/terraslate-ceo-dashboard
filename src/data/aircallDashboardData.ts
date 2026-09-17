// Real data adapter — reads scripts/fetch_aircall_data.py's output
// (aircallDashboardData.json) and reshapes it into the typed constants the
// UI components consume. Every section here is date-driven (build*
// functions taking a resolved window from AircallDateRangeContext).
//
// To refresh with current numbers: `python3 scripts/fetch_aircall_data.py`.

import type { Source, StatTileDatum } from "./ceoDashboardMockData";
import type { HeatmapTableData } from "../components/shared/HeatmapDataTable";
import type { PivotHeatmapData } from "../components/shared/PivotHeatmapTable";
import type { DualLineChartPoint } from "../components/shared/DualLineChart";
import type {
  ConsolidatedCallsTable,
  ChartWindow,
  CallsByTagWindow,
  CallsByTagByUserWindow,
  SummaryWindow,
} from "../lib/aircallDateRange";
import raw from "./aircallDashboardData.json";

const rawDataSource: Source = { label: "AirCall Data - Raw Data 4-24", confirmed: true };
const tagsDataSource: Source = { label: "AirCall Data - Tags_Data", confirmed: true };

// ---------------------------------------------------------------------------
// Executive Summary — Priority 1 + 5 (brief 2026-09-17)
// ---------------------------------------------------------------------------

const SUMMARY_CAPTION = "vs. prior period";

function upDownSemantic(direction: string | undefined): "bad" | "good" | undefined {
  if (direction === "up") return "good";
  if (direction === "down") return "bad";
  return undefined;
}

function fmtMinSec(totalSeconds: number): string {
  // Round the total first, then split — rounding minutes/seconds
  // independently can carry seconds up to 60 (e.g. 119.6s -> "1:60").
  const rounded = Math.round(totalSeconds);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function buildSummaryKpis(summary: SummaryWindow): StatTileDatum[] {
  const avg = summary.avgCallDurationSeconds;
  return [
    {
      id: "total-calls",
      label: "Total Calls",
      value: summary.totalCalls.value.toLocaleString("en-US"),
      trend: summary.totalCalls.trend,
      trendSemantic: upDownSemantic(summary.totalCalls.trend?.direction),
      trendCaption: summary.totalCalls.trend ? SUMMARY_CAPTION : undefined,
    },
    {
      id: "total-talk-time",
      label: "Total Talk Time (hrs)",
      value: summary.totalTalkTimeHours.value.toLocaleString("en-US"),
      trend: summary.totalTalkTimeHours.trend,
      trendSemantic: upDownSemantic(summary.totalTalkTimeHours.trend?.direction),
      trendCaption: summary.totalTalkTimeHours.trend ? SUMMARY_CAPTION : undefined,
    },
    {
      id: "avg-call-duration",
      label: "Avg. Call Duration",
      value: avg ? fmtMinSec(avg.value) : "No data",
      empty: !avg,
      // Direction has no clear "good"/"bad" reading here (a longer average
      // could mean more thorough calls or just inefficiency) — stays the
      // app's default meaning-neutral trend color, unlike its siblings.
      trend: avg?.trend,
      trendCaption: avg?.trend ? SUMMARY_CAPTION : undefined,
    },
    {
      id: "inbound-outbound-split",
      label: "Inbound / Outbound Split",
      value: `${summary.inboundPct}% / ${summary.outboundPct}%`,
    },
    {
      id: "tag-coverage",
      label: "Tag Coverage",
      value: `${summary.tagCoveragePct.value}%`,
      trend: summary.tagCoveragePct.trend,
      trendSemantic: upDownSemantic(summary.tagCoveragePct.trend?.direction),
      trendCaption: summary.tagCoveragePct.trend ? SUMMARY_CAPTION : undefined,
    },
  ];
}

export const summaryNarrative = (summary: SummaryWindow): string => summary.narrative;

// ---------------------------------------------------------------------------
// Consolidated Calls Duration table (Priority 2, brief 2026-09-17) — one
// per-employee row (Inbound/Outbound/Total hrs, Total Calls, IB/OB split),
// sorted by Total Duration descending. No decorative per-column heatmap —
// the only color left is the amber `callsDropFlag` on Total Calls.
// ---------------------------------------------------------------------------

export function buildConsolidatedCallsTable(table: ConsolidatedCallsTable): HeatmapTableData {
  return {
    id: "consolidated-calls-duration",
    title: "Call Duration by Employee",
    columns: [
      { key: "employee", label: "Employee", align: "left" },
      { key: "inboundHours", label: "Inbound Duration (hrs)", align: "right", format: "hours", sortable: true },
      { key: "outboundHours", label: "Outbound Duration (hrs)", align: "right", format: "hours", sortable: true },
      { key: "totalHours", label: "Total Duration (hrs)", align: "right", format: "hours", sortable: true },
      {
        key: "totalCalls",
        label: "Total Calls",
        align: "right",
        format: "number",
        sortable: true,
        flagKey: "callsDropFlag",
      },
      { key: "splitLabel", label: "IB/OB Split", align: "right", format: "text" },
    ],
    rows: table.rows.map((r) => ({
      employee: r.employee,
      inboundHours: r.inboundHours,
      outboundHours: r.outboundHours,
      totalHours: r.totalHours,
      totalCalls: r.totalCalls,
      splitLabel: r.splitLabel,
      callsDropFlag: r.callsDropFlag,
    })),
    grandTotalRow: {
      employee: table.grandTotal.employee,
      inboundHours: table.grandTotal.inboundHours,
      outboundHours: table.grandTotal.outboundHours,
      totalHours: table.grandTotal.totalHours,
      totalCalls: table.grandTotal.totalCalls,
      splitLabel: table.grandTotal.splitLabel,
    },
    grandTotalStyle: "border",
    source: rawDataSource,
    pageSize: Math.max(table.rows.length, 1),
  };
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
// Calls by Tag (date-driven)
// ---------------------------------------------------------------------------

// Priority 3 (brief 2026-09-17): a blank Main Tag reads as "-" in the raw
// data, which looks like a data error rather than a finding. Renamed to
// "Untagged" for display only — the underlying `tag` value used for
// grouping/lookups elsewhere (e.g. tagCoverage below) is untouched.
const UNTAGGED_LABEL = "Untagged";

export function buildCallsByTagTable(window: CallsByTagWindow): HeatmapTableData {
  return {
    id: "calls-by-tag",
    title: "Calls by Tag",
    caption: "Tags are consolidated to six main tags.",
    columns: [
      { key: "tag", label: "Main Tag", align: "left" },
      { key: "total", label: "Total", align: "right", format: "number", heat: "blue" },
      { key: "pctOfTotal", label: "% of Total", align: "right", format: "percent", heat: "green" },
    ],
    rows: window.rows.map((r) => ({ ...r, tag: r.tag === "-" ? UNTAGGED_LABEL : r.tag })) as unknown as Record<
      string,
      string | number | null
    >[],
    source: tagsDataSource,
    pageSize: Math.max(window.rows.length, 1),
  };
}

// Priority 3 — numbers for the "Tag Coverage" alert banner above the Calls
// by Tag table (see CallsByTagSection.tsx). Derived from the same window
// the table itself renders, so the banner always matches what's below it.
export interface TagCoverage {
  pct: number;
  taggedCount: number;
  untaggedCount: number;
  grandTotal: number;
}

export function buildTagCoverage(window: CallsByTagWindow): TagCoverage {
  const untaggedCount = window.rows.find((r) => r.tag === "-")?.total ?? 0;
  const grandTotal = window.grandTotal;
  const taggedCount = grandTotal - untaggedCount;
  return {
    pct: grandTotal ? Math.round((taggedCount / grandTotal) * 1000) / 10 : 0,
    taggedCount,
    untaggedCount,
    grandTotal,
  };
}

// ---------------------------------------------------------------------------
// Calls by Tag by User (date-driven, pivot)
// ---------------------------------------------------------------------------

export function buildCallsByTagByUserTable(window: CallsByTagByUserWindow): PivotHeatmapData {
  return {
    title: "Calls by Tag by User",
    caption: "Tags are consolidated to six main tags.",
    cornerLabel: "Employee / Main Tag",
    rowLabel: "Main Tag",
    rowOrder: window.rowOrder,
    colOrder: window.colOrder,
    matrix: window.matrix,
    colTotals: window.colTotals,
    grandTotal: window.grandTotal,
    maxCell: window.maxCell,
    source: tagsDataSource,
  };
}

export const aircallDataGeneratedAt: string = raw.generatedAt;
