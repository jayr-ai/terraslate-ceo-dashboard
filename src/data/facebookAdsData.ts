// Real data adapter — reads scripts/fetch_facebook_ads.py's output
// (facebookAdsData.json) and reshapes it into the typed constants the UI
// components consume. Every section here is date-driven except Monthly
// Campaign Summary (always trailing 12 months — see the Python script's
// docstring for why).
//
// To refresh with current numbers: `python3 scripts/fetch_facebook_ads.py`.

import type { Source, StatTileDatum } from "./ceoDashboardMockData";
import type { HeatmapTableData } from "../components/shared/HeatmapDataTable";
import type { HorizontalBarDatum } from "../components/shared/HorizontalBarChart";
import type { SummaryWindow, DailyTable, TableRow, CampaignRow, ByObjectiveWindow } from "../lib/facebookAdsDateRange";
import raw from "./facebookAdsData.json";

const fbSource: Source = { label: "Facebook Ads Report — Advert tab", confirmed: true };
export { fbSource };

const CAPTION = "vs. prior period";

function upDownSemantic(direction: string | undefined, invert = false): "bad" | "good" | undefined {
  if (!direction) return undefined;
  if (direction === "up") return invert ? "bad" : "good";
  if (direction === "down") return invert ? "good" : "bad";
  return undefined;
}

function fmtMoney(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Executive Summary KPIs — two rows of 5. Cost/efficiency metrics (CPM,
// Cost Per Click, Cost Per Purchase) are semantically inverted: a DECREASE
// is the good direction there, unlike everything else on this page.
// ---------------------------------------------------------------------------

export function buildSpendKpis(summary: SummaryWindow): StatTileDatum[] {
  return [
    {
      id: "spend",
      label: "Ad Spend",
      value: fmtMoney(summary.spend.value),
      trend: summary.spend.trend,
      trendCaption: summary.spend.trend ? CAPTION : undefined,
    },
    {
      id: "purchase-value",
      label: "Purchase Value",
      value: fmtMoney(summary.purchaseValue.value),
      trend: summary.purchaseValue.trend,
      trendSemantic: upDownSemantic(summary.purchaseValue.trend?.direction),
      trendCaption: summary.purchaseValue.trend ? CAPTION : undefined,
    },
    {
      id: "roas",
      label: "ROAS",
      value: summary.roas.value.toFixed(2),
      trend: summary.roas.trend,
      trendSemantic: upDownSemantic(summary.roas.trend?.direction),
      trendCaption: summary.roas.trend ? CAPTION : undefined,
    },
    {
      id: "cost-per-purchase",
      label: "Cost Per Purchase",
      value: summary.costPerPurchase ? fmtMoney(summary.costPerPurchase.value) : "No data",
      empty: !summary.costPerPurchase,
      trend: summary.costPerPurchase?.trend,
      trendSemantic: upDownSemantic(summary.costPerPurchase?.trend?.direction, true),
      trendCaption: summary.costPerPurchase?.trend ? CAPTION : undefined,
    },
    {
      id: "cpm",
      label: "CPM (1,000 imp.)",
      value: fmtMoney(summary.cpm.value),
      trend: summary.cpm.trend,
      trendSemantic: upDownSemantic(summary.cpm.trend?.direction, true),
      trendCaption: summary.cpm.trend ? CAPTION : undefined,
    },
  ];
}

export function buildFunnelKpis(summary: SummaryWindow): StatTileDatum[] {
  return [
    {
      id: "impressions",
      label: "Impressions",
      value: summary.impressions.value.toLocaleString("en-US"),
      trend: summary.impressions.trend,
      trendCaption: summary.impressions.trend ? CAPTION : undefined,
    },
    {
      id: "reach",
      label: "Reach",
      value: summary.reach.value.toLocaleString("en-US"),
      trend: summary.reach.trend,
      trendCaption: summary.reach.trend ? CAPTION : undefined,
    },
    {
      id: "link-clicks",
      label: "Link Clicks",
      value: summary.linkClicks.value.toLocaleString("en-US"),
      trend: summary.linkClicks.trend,
      trendSemantic: upDownSemantic(summary.linkClicks.trend?.direction),
      trendCaption: summary.linkClicks.trend ? CAPTION : undefined,
    },
    {
      id: "cost-per-link-click",
      label: "Cost Per Link Click",
      value: summary.costPerLinkClick ? fmtMoney(summary.costPerLinkClick.value) : "No data",
      empty: !summary.costPerLinkClick,
      trend: summary.costPerLinkClick?.trend,
      trendSemantic: upDownSemantic(summary.costPerLinkClick?.trend?.direction, true),
      trendCaption: summary.costPerLinkClick?.trend ? CAPTION : undefined,
    },
    {
      id: "purchases",
      label: "Purchases",
      value: summary.purchases.value.toLocaleString("en-US"),
      trend: summary.purchases.trend,
      trendSemantic: upDownSemantic(summary.purchases.trend?.direction),
      trendCaption: summary.purchases.trend ? CAPTION : undefined,
    },
  ];
}

export const summaryNarrative = (summary: SummaryWindow): string => summary.narrative;

// ---------------------------------------------------------------------------
// Daily / Monthly Campaign Summary tables — same column shape, different
// label key (date vs month) and grouping granularity.
// ---------------------------------------------------------------------------

const ROAS_FLAG_THRESHOLD = 1.0;

function tableColumns(labelKey: "date" | "month", labelText: string) {
  return [
    { key: labelKey, label: labelText, align: "left" as const },
    { key: "impressions", label: "Impressions", align: "right" as const, format: "number" as const, heat: "blue" as const },
    { key: "cpm", label: "CPM (1,000)", align: "right" as const, format: "currency" as const, heat: "cyan" as const },
    { key: "reach", label: "Reach", align: "right" as const, format: "number" as const, heat: "blue" as const },
    { key: "linkClicks", label: "Link Clicks", align: "right" as const, format: "number" as const, heat: "cyan" as const },
    { key: "costPerLinkClick", label: "Cost Per Link Click", align: "right" as const, format: "currency" as const, heat: "cyan" as const },
    { key: "ctr", label: "CTR", align: "right" as const, format: "percent" as const, heat: "cyan" as const },
    { key: "freq", label: "Freq", align: "right" as const, format: "number" as const },
    { key: "purchases", label: "Purchases", align: "right" as const, format: "number" as const, heat: "green" as const },
    { key: "purchaseValue", label: "Purchase Value", align: "right" as const, format: "currency" as const, heat: "green" as const },
    { key: "amountSpent", label: "Amount Spent", align: "right" as const, format: "currency" as const, heat: "blue" as const },
    { key: "roas", label: "ROAS", align: "right" as const, format: "number" as const, flagKey: "roasBelow1" },
  ];
}

function toRow(r: TableRow, labelKey: "date" | "month") {
  return {
    [labelKey]: r[labelKey] ?? "",
    impressions: r.impressions,
    cpm: r.cpm,
    reach: r.reach,
    linkClicks: r.linkClicks,
    costPerLinkClick: r.costPerLinkClick,
    ctr: r.ctr,
    freq: r.freq,
    purchases: r.purchases,
    purchaseValue: r.purchaseValue,
    amountSpent: r.amountSpent,
    roas: r.roas,
    roasBelow1: r.amountSpent > 0 && r.roas < ROAS_FLAG_THRESHOLD,
  };
}

export function buildDailyCampaignTable(table: DailyTable): HeatmapTableData {
  return {
    id: "daily-campaign-summary",
    title: "Daily Campaign Summary",
    columns: tableColumns("date", "Day"),
    rows: table.rows.map((r) => toRow(r, "date")),
    grandTotalRow: toRow(table.grandTotal, "date"),
    source: fbSource,
    pageSize: 10,
  };
}

export function buildMonthlyCampaignTable(rows: TableRow[], grandTotal: TableRow): HeatmapTableData {
  return {
    id: "monthly-campaign-summary",
    title: "Monthly Campaign Summary",
    caption: "Trailing 12 months",
    columns: tableColumns("month", "Month"),
    rows: rows.map((r) => toRow(r, "month")),
    grandTotalRow: toRow(grandTotal, "month"),
    source: fbSource,
    pageSize: Math.max(rows.length, 1),
  };
}

// ---------------------------------------------------------------------------
// Top 10 Campaigns by Spend (addition beyond the brief)
// ---------------------------------------------------------------------------

export function buildTopCampaignBars(rows: CampaignRow[]): HorizontalBarDatum[] {
  return rows.map((r, i) => ({
    id: `campaign-${i}`,
    label: r.name,
    value: r.spend,
    flagged: r.flagged,
  }));
}

// ---------------------------------------------------------------------------
// Performance by Objective (addition beyond the brief)
// ---------------------------------------------------------------------------

export function buildByObjectiveTable(window: ByObjectiveWindow): HeatmapTableData {
  return {
    id: "by-objective",
    title: "Performance by Objective",
    columns: [
      { key: "objective", label: "Objective", align: "left" },
      { key: "amountSpent", label: "Amount Spent", align: "right", format: "currency", heat: "blue" },
      { key: "impressions", label: "Impressions", align: "right", format: "number", heat: "blue" },
      { key: "reach", label: "Reach", align: "right", format: "number", heat: "blue" },
      { key: "linkClicks", label: "Link Clicks", align: "right", format: "number", heat: "cyan" },
      { key: "purchases", label: "Purchases", align: "right", format: "number", heat: "green" },
      { key: "purchaseValue", label: "Purchase Value", align: "right", format: "currency", heat: "green" },
      { key: "roas", label: "ROAS", align: "right", format: "number" },
    ],
    rows: window.rows as unknown as Record<string, string | number | null>[],
    grandTotalRow: window.grandTotal as unknown as Record<string, string | number | null>,
    source: fbSource,
    pageSize: Math.max(window.rows.length, 1),
  };
}

// ---------------------------------------------------------------------------
// Monthly (static, trailing 12 months)
// ---------------------------------------------------------------------------

const monthlyRaw = raw.monthly as unknown as { rows: TableRow[]; grandTotal: TableRow };
export const monthlyTable: HeatmapTableData = buildMonthlyCampaignTable(monthlyRaw.rows, monthlyRaw.grandTotal);

export const fbAdsDataGeneratedAt: string = raw.generatedAt;
