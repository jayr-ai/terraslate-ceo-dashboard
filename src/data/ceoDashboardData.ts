// Real data adapter — reads scripts/fetch_data.py's output (ceoDashboardData.json)
// and reshapes it into the typed constants the UI components consume. Only
// the data changes here; `Source` labels (where each number comes from) are
// reused as-is from the mock module since those are confirmed/static, not
// sheet-row-derived.
//
// Sections here split into two groups:
//   - All-time/snapshot sections (Pre-Press, Production Teams, Shipping by
//     State, Traffic) are static exports, unaffected by the date-range
//     picker — see fetch_data.py's docstring for why.
//   - Date-driven sections (Sales, TerraSlate Tracker, Marketing,
//     Breadwinnaz, Proof/Graphic Team) are exposed as `build*` functions
//     that take a resolved window (from DateRangeContext) and attach types
//     + Source. See src/lib/dateRange.ts for how that window gets resolved.
//
// To refresh with current numbers: `python3 scripts/fetch_data.py`.

import raw from "./ceoDashboardData.json";
import type { KpiCard, StatTileDatum, TableSection, TableRow } from "./ceoDashboardMockData";
import {
  terraSlateTrackerSource,
  marketingMetricsSource,
  breadwinnazSource,
  prePressSource,
  productionTeamSource,
  shopifySalesByEmployeeSource,
  graphicDesignSource,
  graphicsClockifySource,
  shippingByStateSource,
  trafficTableSource,
  shopifySalesSource,
  amazonSalesSource,
  walmartSalesSource,
  overallSalesSource,
} from "./ceoDashboardMockData";
import type { SalesWindow, MarketingWindow, StaffWindow, GraphicDesignWindow, HoursWindow, TerraSlateTrackerWindow } from "../lib/dateRange";

// ---------------------------------------------------------------------------
// 5.1 Sales Across Channels (date-driven)
// ---------------------------------------------------------------------------
const SALES_KPI_SOURCE: Record<string, KpiCard["source"]> = {
  "overall-sales": overallSalesSource,
  "shopify-sales": shopifySalesSource,
  "amazon-sales": amazonSalesSource,
  "walmart-sales": walmartSalesSource,
};

export function buildSalesAcrossChannels(window: SalesWindow): { kpis: KpiCard[]; channelMix: SalesWindow["channelMix"] } {
  const kpis: KpiCard[] = window.kpis.map((k) => ({ ...k, source: SALES_KPI_SOURCE[k.id] }));
  return { kpis, channelMix: window.channelMix };
}

// ---------------------------------------------------------------------------
// 5.2 TerraSlate Tracker (date-driven)
// ---------------------------------------------------------------------------
export function buildTerraSlateTrackerTiles(window: TerraSlateTrackerWindow): StatTileDatum[] {
  return window.tiles as unknown as StatTileDatum[];
}
export { terraSlateTrackerSource };

// ---------------------------------------------------------------------------
// 5.3 Marketing Metrics (date-driven)
// ---------------------------------------------------------------------------
// Display order: Ad Spend, Purchase Value, CPA Combined, ROAS — independent
// of whatever order fetch_data.py happens to emit the tiles in.
const MARKETING_TILE_ORDER = ["ad-spend", "purchase-value", "cpa-combined", "roas"];

export function buildMarketingMetricsTiles(window: MarketingWindow): StatTileDatum[] {
  const tiles = window.tiles as StatTileDatum[];
  return MARKETING_TILE_ORDER.map((id) => tiles.find((t) => t.id === id)).filter(
    (t): t is StatTileDatum => !!t,
  );
}
export { marketingMetricsSource };

// ---------------------------------------------------------------------------
// 5.4 Breadwinnaz (date-driven)
// ---------------------------------------------------------------------------
export function buildBreadwinnazTable(window: StaffWindow): TableSection {
  return {
    id: "breadwinnaz",
    title: "Account Managers",
    columns: [
      { key: "rank", label: "Rank", align: "left" },
      { key: "name", label: "Name", align: "left", sortable: true },
      { key: "sales", label: "Sales", align: "right", sortable: true, format: "currency" },
    ],
    rows: window.rows as unknown as TableRow[],
    source: breadwinnazSource,
    pageSize: 6,
    defaultSortKey: "sales",
    defaultSortDir: "desc",
  };
}

// ---------------------------------------------------------------------------
// 5.5 Pre-Press (live snapshot, static)
// ---------------------------------------------------------------------------
export const prePressAllTimeTable: TableSection = {
  id: "prepress-all-time",
  title: "Assignee — All Time",
  columns: [
    { key: "assignee", label: "Assignee", align: "left", sortable: true },
    { key: "allTime", label: "All Time", align: "right", sortable: true, format: "number" },
    { key: "allTimePct", label: "All-Time %", align: "right", sortable: true, format: "percent" },
  ],
  rows: raw.prePress.allTime,
  source: prePressSource,
  pageSize: 5,
  defaultSortKey: "allTime",
  defaultSortDir: "desc",
};

export const prePressTodayYesterdayTable: TableSection = {
  id: "prepress-t-y",
  title: "Assignee — T / Y",
  columns: [
    { key: "assignee", label: "Assignee", align: "left", sortable: true },
    { key: "t", label: "T", align: "right", sortable: true, format: "number" },
    { key: "tPct", label: "%", align: "right", sortable: true, format: "percent" },
    { key: "y", label: "Y", align: "right", sortable: true, format: "number" },
    { key: "yPct", label: "%", align: "right", sortable: true, format: "percent" },
  ],
  rows: raw.prePress.todayYesterday,
  source: prePressSource,
  pageSize: 5,
  defaultSortKey: "y",
  defaultSortDir: "desc",
};

// ---------------------------------------------------------------------------
// 5.6 Production team tables (all-time, static)
// ---------------------------------------------------------------------------
export const productionTeamTables: TableSection[] = raw.productionTeams.map((t) => ({
  id: t.id,
  title: t.title,
  columns: [
    { key: "person", label: t.personLabel, align: "left" as const, sortable: true, truncate: true },
    { key: "value", label: "Order Value", align: "right" as const, sortable: true, format: "currency" as const },
  ],
  rows: t.rows,
  source: productionTeamSource,
  pageSize: 5,
  defaultSortKey: "value",
  defaultSortDir: "desc" as const,
}));

// ---------------------------------------------------------------------------
// 5.7 Proof Team / Graphic Team (date-driven)
// ---------------------------------------------------------------------------
export function buildProofTeamSalesTable(window: StaffWindow): TableSection {
  return {
    id: "proof-team-sales",
    title: "Proof Team",
    columns: [
      { key: "name", label: "Name", align: "left", sortable: true },
      { key: "sales", label: "Sales", align: "right", sortable: true, format: "currency" },
    ],
    rows: window.rows as unknown as TableRow[],
    source: shopifySalesByEmployeeSource,
    pageSize: 5,
    defaultSortKey: "sales",
    defaultSortDir: "desc",
  };
}

export function buildGraphicDesignValueTile(window: GraphicDesignWindow): StatTileDatum {
  return {
    id: "graphic-design-value",
    label: "Graphic Design Value",
    value: `$${window.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    trend: window.trend,
    source: graphicDesignSource,
  };
}

export function buildGraphicTeamSalesTable(window: StaffWindow): TableSection {
  return {
    id: "graphic-team-sales",
    title: "Graphic Team",
    columns: [
      { key: "name", label: "Name", align: "left", sortable: true, truncate: true },
      { key: "sales", label: "Sales", align: "right", sortable: true, format: "currency" },
    ],
    rows: window.rows as unknown as TableRow[],
    source: shopifySalesByEmployeeSource,
    pageSize: 5,
    defaultSortKey: "sales",
    defaultSortDir: "desc",
  };
}

export function buildGraphicsTeamHoursTable(window: HoursWindow): TableSection {
  return {
    id: "graphics-team-hrs",
    title: "Graphics Team Hrs",
    columns: [
      { key: "name", label: "Name", align: "left", sortable: true, truncate: true },
      { key: "hours", label: "Hours", align: "right", sortable: true, format: "number" },
    ],
    rows: window.rows as unknown as TableRow[],
    source: graphicsClockifySource,
    pageSize: 5,
    defaultSortKey: "hours",
    defaultSortDir: "desc",
  };
}

// ---------------------------------------------------------------------------
// 5.8 Shipping Report | By State (all-time, static)
// ---------------------------------------------------------------------------
export const shippingByStateTable: TableSection = {
  id: "shipping-by-state",
  title: "Shipping region / Orders",
  columns: [
    { key: "region", label: "Shipping region", align: "left", sortable: true },
    { key: "orders", label: "Orders", align: "right", sortable: true, format: "number" },
  ],
  rows: raw.shippingByState.rows,
  source: shippingByStateSource,
  pageSize: 5,
  defaultSortKey: "orders",
  defaultSortDir: "desc",
};
export const shippingByStateGrandTotal = raw.shippingByState.grandTotal;
export const shippingByStateMap: Record<string, number> = Object.fromEntries(
  raw.shippingByState.rows.map((r) => [r.region, r.orders]),
);
export { shippingByStateSource };

// ---------------------------------------------------------------------------
// 5.9 Traffic table (all rows, static)
// ---------------------------------------------------------------------------
export const trafficTable: TableSection = {
  id: "traffic-table",
  title: "Traffic",
  columns: [
    { key: "date", label: "Date", align: "left", sortable: true },
    { key: "impressions", label: "Impressions", align: "right", sortable: true, format: "number" },
    { key: "clicks", label: "Clicks", align: "right", sortable: true, format: "number" },
    { key: "pagesFirstImpression", label: "Pages w/ 1st impres", align: "right", sortable: true, format: "number" },
    { key: "clicksDesktop", label: "Clicks (Desktop)", align: "right", sortable: true, format: "number" },
    { key: "clicksMobile", label: "Clicks (Mobile)", align: "right", sortable: true, format: "number" },
    { key: "clicksTablet", label: "Clicks (Tablet)", align: "right", sortable: true, format: "number" },
  ],
  rows: raw.trafficTable.rows,
  source: trafficTableSource,
  pageSize: 5,
};
export { trafficTableSource };

export const dataGeneratedAt: string = raw.generatedAt;
