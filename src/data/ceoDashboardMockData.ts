// Mock data for the CEO Dashboard (Phase 1 — UI only, no live sources wired up).
//
// Every metric/table carries a `source` label. Sources marked `confirmed: false`
// are guesses about where the number should come from once we wire up real data —
// confirm with JV before pointing anything at them. Numbers below were snapshotted
// from the live Data Studio report on Aug 6, 2026 as placeholder shape/example data
// only — not live truth. Reconcile against source before this goes live.
//
// Real source (confirmed 2026-08-08): Google Sheet "DailyDashRaw_TerraSlate"
// https://docs.google.com/spreadsheets/d/1Xa3lc7x2pFQzoja-b56MDbVFSEa_2YjGHAq6QjV4jDs
// Tab-by-tab mapping verified directly against the sheet's CSV export — see
// each `Source` label below for the exact tab. Two things worth flagging:
//   - CombinedSales already unions Shopify + Amazon + Walmart into one
//     DATE/SALE/CHANNEL feed (built from the three per-channel tabs), so it's
//     the simplest single source for 5.1's Overall Sales and channel mix.
//   - The Walmart tab's real sales data STOPS at 2026-04-25 — no rows after
//     that. That's why the live report shows "Walmart Sales: No data" for the
//     Jul 8–Aug 6, 2026 window: the feed appears to have gone stale, not that
//     Walmart has no channel. Worth fixing before this goes live.

export type TrendDirection = "up" | "down" | "na";

export interface Trend {
  changePct: number;
  direction: TrendDirection;
}

export interface Source {
  label: string;
  confirmed: boolean;
}

export interface KpiCard {
  id: string;
  label: string;
  value: string;
  empty?: boolean;
  // `| null`, not just `| undefined`: fetch_data.py's trend() returns None
  // (→ JSON null) when the prior period was zero — a real, expected case
  // (e.g. a 1-day "Yesterday" window with no baseline), not missing data.
  trend?: Trend | null;
  sparkline?: number[];
  hero?: boolean;
  source?: Source;
}

export interface StatTileDatum {
  id: string;
  label: string;
  value: string;
  empty?: boolean;
  trend?: Trend | null;
  source?: Source;
}

export type ColumnFormat = "currency" | "number" | "percent" | "text";

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  sortable?: boolean;
  truncate?: boolean;
  format?: ColumnFormat;
}

export interface TableRow {
  [key: string]: string | number;
}

export interface TableSection {
  id: string;
  title: string;
  columns: TableColumn[];
  rows: TableRow[];
  source: Source;
  pageSize?: number;
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
}

function sparkFromTrend(direction: TrendDirection, seed: number): number[] {
  // Deterministic placeholder sparkline shaped to roughly match the trend direction.
  const points = 12;
  const out: number[] = [];
  let v = 50 + (seed % 20);
  for (let i = 0; i < points; i++) {
    const noise = ((seed * (i + 1)) % 7) - 3;
    const drift = direction === "up" ? 1.6 : direction === "down" ? -1.6 : 0;
    v = Math.max(5, v + drift + noise * 0.6);
    out.push(Math.round(v * 10) / 10);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5.1 Sales Across Channels
// ---------------------------------------------------------------------------
// Confirmed with JV 2026-08-08, then verified directly against the sheet:
// each channel has its own tab (Shopify, Amazon, Walmart), and a separate
// CombinedSales tab already unions all three into one DATE/SALE/CHANNEL feed
// — that's the simplest single source for Overall Sales + the channel mix.
// NOTE: the Walmart tab's data stops at 2026-04-25 (stale feed, not "no
// channel") — see the file-level comment above.
export const shopifySalesSource: Source = { label: "DailyDashRaw_TerraSlate > Shopify tab", confirmed: true };
export const amazonSalesSource: Source = { label: "DailyDashRaw_TerraSlate > Amazon tab", confirmed: true };
export const walmartSalesSource: Source = {
  label: "DailyDashRaw_TerraSlate > Walmart tab — feed stale since 2026-04-25",
  confirmed: true,
};
export const overallSalesSource: Source = {
  label: "DailyDashRaw_TerraSlate > CombinedSales tab (unions Shopify + Amazon + Walmart)",
  confirmed: true,
};

export const salesAcrossChannelsKpis: KpiCard[] = [
  {
    id: "overall-sales",
    label: "Overall Sales",
    value: "$772,746",
    hero: true,
    trend: { changePct: -25.9, direction: "down" },
    sparkline: sparkFromTrend("down", 3),
    source: overallSalesSource,
  },
  {
    id: "shopify-sales",
    label: "Shopify Sales",
    value: "$676,841",
    trend: { changePct: -26.3, direction: "down" },
    sparkline: sparkFromTrend("down", 7),
    source: shopifySalesSource,
  },
  {
    id: "amazon-sales",
    label: "Amazon Sales",
    value: "$95,905",
    trend: { changePct: -23.2, direction: "down" },
    sparkline: sparkFromTrend("down", 11),
    source: amazonSalesSource,
  },
  {
    id: "walmart-sales",
    label: "Walmart Sales",
    value: "No data",
    empty: true,
    source: walmartSalesSource,
  },
];

export const salesChannelMix = [
  { id: "shopify", label: "Shopify", pct: 86.4 },
  { id: "amazon", label: "Amazon", pct: 13.5 },
  { id: "walmart", label: "Walmart", pct: 0.1 },
];

// ---------------------------------------------------------------------------
// 5.2 TerraSlate Tracker
// ---------------------------------------------------------------------------
export const terraSlateTrackerSource: Source = {
  label: "DailyDashRaw_TerraSlate > ProductionRaw + BlankOrders tabs",
  confirmed: true,
};

export const terraSlateTrackerTiles: StatTileDatum[] = [
  { id: "production-order-value", label: "Production Order Value", value: "$535,064.86", empty: true },
  { id: "printed-orders", label: "Printed Orders", value: "949", trend: { changePct: 0, direction: "na" } },
  { id: "blank-order-value", label: "Blank Order Value", value: "$122,450.03", empty: true },
  { id: "blank-orders", label: "Blank Orders", value: "502", trend: { changePct: 0, direction: "na" } },
];

// ---------------------------------------------------------------------------
// 5.3 Marketing Metrics
// ---------------------------------------------------------------------------
export const marketingMetricsSource: Source = {
  label: "DailyDashRaw_TerraSlate > ADS tab (pulled via IMPORTRANGE from MasterRaw_FBGA)",
  confirmed: true,
};

export const marketingMetricsTiles: StatTileDatum[] = [
  { id: "roas", label: "ROAS [FB/GA]", value: "6.12", trend: { changePct: -7.6, direction: "down" } },
  { id: "ad-spend", label: "Ad Spend", value: "$33.24K", trend: { changePct: -7.9, direction: "down" } },
  { id: "cpa-combined", label: "CPA Combined", value: "$57.93", trend: { changePct: 4.7, direction: "up" } },
  { id: "purchase-value", label: "Purchase Value", value: "$203.29K", trend: { changePct: -14.8, direction: "down" } },
];

// ---------------------------------------------------------------------------
// 5.4 Breadwinnaz (sales-by-rep leaderboard)
// ---------------------------------------------------------------------------
export const breadwinnazSource: Source = { label: "DailyDashRaw_TerraSlate > SalesPerStaff tab", confirmed: true };

export const breadwinnazTable: TableSection = {
  id: "breadwinnaz",
  title: "Breadwinnaz",
  columns: [
    { key: "rank", label: "Rank", align: "left" },
    { key: "name", label: "Name", align: "left", sortable: true },
    { key: "sales", label: "Sales", align: "right", sortable: true, format: "currency" },
  ],
  rows: [
    { rank: 1, name: "Ian Gindhart", sales: 120264.59 },
    { rank: 2, name: "Bikus Rodriguez", sales: 65301.73 },
    { rank: 3, name: "Mark Ruiz", sales: 57019.94 },
    { rank: 4, name: "Julian Meisner", sales: 54400.93 },
  ],
  source: breadwinnazSource,
  pageSize: 5,
  defaultSortKey: "sales",
  defaultSortDir: "desc",
};

// ---------------------------------------------------------------------------
// 5.5 Pre-Press
// ---------------------------------------------------------------------------
export const prePressSource: Source = { label: "DailyDashRaw_TerraSlate > PrePress tab", confirmed: true };

export const prePressAllTimeTable: TableSection = {
  id: "prepress-all-time",
  title: "Assignee — All Time",
  columns: [
    { key: "assignee", label: "Assignee", align: "left", sortable: true },
    { key: "allTime", label: "All Time", align: "right", sortable: true, format: "number" },
    { key: "allTimePct", label: "All-Time %", align: "right", sortable: true, format: "percent" },
  ],
  rows: [
    { assignee: "RM", allTime: 257, allTimePct: 33.12 },
    { assignee: "RFM", allTime: 188, allTimePct: 24.23 },
    { assignee: "RQ", allTime: 181, allTimePct: 23.32 },
    { assignee: "LF", allTime: 150, allTimePct: 19.33 },
  ],
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
  rows: [
    { assignee: "RM", t: 1, tPct: 100.0, y: 15, yPct: 34.09 },
    { assignee: "RFM", t: 0, tPct: 0.0, y: 13, yPct: 29.55 },
    { assignee: "RQ", t: 0, tPct: 0.0, y: 9, yPct: 20.45 },
    { assignee: "LF", t: 0, tPct: 0.0, y: 7, yPct: 15.91 },
  ],
  source: prePressSource,
  pageSize: 5,
  defaultSortKey: "y",
  defaultSortDir: "desc",
};

// ---------------------------------------------------------------------------
// 5.6 Production team tables — JV confirmed 2026-08-08 this shares Pre-Press's
// source; verified against the sheet it's actually a sibling tab (ProductionRaw,
// not PrePress) in the same workbook — same "Tracker" concept, different tab.
// ProductionRaw is a per-order log with exactly these columns: Proof Owner,
// Printed By, Quality By, Coated By, Cut By, Shipped By, Order Value.
// ---------------------------------------------------------------------------
export const productionTeamSource: Source = {
  label: "DailyDashRaw_TerraSlate > ProductionRaw tab",
  confirmed: true,
};

function orderValueTable(
  id: string,
  title: string,
  personLabel: string,
  entries: [string, number][],
): TableSection {
  return {
    id,
    title,
    columns: [
      { key: "person", label: personLabel, align: "left", sortable: true, truncate: true },
      { key: "value", label: "Order Value", align: "right", sortable: true, format: "currency" },
    ],
    rows: entries.map(([person, value]) => ({ person, value })),
    source: productionTeamSource,
    pageSize: 5,
    defaultSortKey: "value",
    defaultSortDir: "desc",
  };
}

export const proofTeamOrderValueTable = orderValueTable("proof-team-ov", "Proof Team", "Proof Owner", [
  ["DG", 70303],
  ["RM", 68934],
  ["JS", 60984],
  ["MQ", 57966],
  ["RQ", 56964],
  ["LF", 56160],
  ["RFM", 55385],
  ["X", 44694],
  ["x", 37087],
]);

export const printTeamTable = orderValueTable("print-team", "Print Team", "Printed By", [
  ["WW", 92035],
  ["CA", 91397],
  ["AJH", 75863],
  ["DM", 62380],
  ["PS", 54833],
  ["SD", 42118],
  ["JMH", 7133],
  ["In Pro...", 6916],
  ["JMS", 3590],
]);

export const qualityTeamTable = orderValueTable("quality-team", "Quality Team", "Quality By", [
  ["RK", 99269],
  ["RP", 78392],
  ["CK", 77912],
  ["SPS", 38684],
  ["VC", 31312],
  ["JB", 26250],
  ["KL", 24533],
  ["In Prog...", 15078],
  ["AO", 9311],
]);

export const coatingTeamTable = orderValueTable("coating-team", "Coating Team", "Coated By", [
  ["CK", 150445],
  ["RP", 56490],
  ["JB", 55877],
  ["KL", 43899],
  ["VC", 37094],
  ["RK", 29760],
  ["Not Co...", 20114],
  ["In Pro...", 14546],
]);

export const cuttingTeamTable = orderValueTable("cutting-team", "Cutting Team", "Cutting Team", [
  ["VC", 194746],
  ["AH", 175474],
  ["VM", 25858],
  ["In Prog...", 7539],
  ["AO", 6094],
  ["JMS", 4880],
  ["SPS", 2781],
  ["No Cuts", 2498],
]);

export const shippingTeamTable = orderValueTable("shipping-team", "Shipping Team", "Shipped By", [
  ["DJ", 296104],
  ["AM", 125442],
  ["R2Ship", 4571],
  ["RM", 1219],
  ["JMH", 732],
  ["VM", 379],
  ["X", 106],
  ["SMC", 98],
]);

export const productionTeamTables: TableSection[] = [
  proofTeamOrderValueTable,
  printTeamTable,
  qualityTeamTable,
  coatingTeamTable,
  cuttingTeamTable,
  shippingTeamTable,
];

// Full text for truncated labels — used for hover tooltips. Anything not listed
// here (e.g. "SMC") is already shown in full, matching the source report.
export const truncatedLabelTooltips: Record<string, string> = {
  "In Pro...": "In Progress",
  "In Prog...": "In Progress",
  "Not Co...": "Not Coated",
};

// ---------------------------------------------------------------------------
// 5.7 Proof Team / Graphic Team (sales)
// ---------------------------------------------------------------------------
export const shopifySalesByEmployeeSource: Source = {
  label: "DailyDashRaw_TerraSlate > SalesPerStaff tab",
  confirmed: true,
};
// NOTE: corrected 2026-08-08 after checking the real sheet — the dollar
// value and the hours are two different tabs, not one "Graphic Design"
// source as originally assumed:
export const graphicDesignSource: Source = {
  label: "DailyDashRaw_TerraSlate > graphic_design tab (Shopify order line items)",
  confirmed: true,
};
export const graphicsClockifySource: Source = {
  label: "DailyDashRaw_TerraSlate > graphics_clockify tab (Clockify time export)",
  confirmed: true,
};

export const proofTeamSalesTable: TableSection = {
  id: "proof-team-sales",
  title: "Proof Team",
  columns: [
    { key: "name", label: "Name", align: "left", sortable: true },
    { key: "sales", label: "Sales", align: "right", sortable: true, format: "currency" },
  ],
  rows: [
    { name: "Jose Soto", sales: 10809.69 },
    { name: "Dakota George", sales: 6805.31 },
  ],
  source: shopifySalesByEmployeeSource,
  pageSize: 5,
  defaultSortKey: "sales",
  defaultSortDir: "desc",
};

export const graphicDesignValueTile: StatTileDatum = {
  id: "graphic-design-value",
  label: "Graphic Design Value",
  value: "$27,769.56",
  trend: { changePct: -11.1, direction: "down" },
  source: graphicDesignSource,
};

export const graphicTeamSalesTable: TableSection = {
  id: "graphic-team-sales",
  title: "Graphic Team",
  columns: [
    { key: "name", label: "Name", align: "left", sortable: true, truncate: true },
    { key: "sales", label: "Sales", align: "right", sortable: true, format: "currency" },
  ],
  rows: [
    { name: "Steven Peralta Cornejo", sales: 26857.11 },
    { name: "Bailey Pixton", sales: 25112.95 },
    { name: "Luke Bosick", sales: 16041.66 },
  ],
  source: shopifySalesByEmployeeSource,
  pageSize: 5,
  defaultSortKey: "sales",
  defaultSortDir: "desc",
};

export const graphicsTeamHoursTable: TableSection = {
  id: "graphics-team-hrs",
  title: "Graphics Team Hrs",
  columns: [
    { key: "name", label: "Name", align: "left", sortable: true },
    { key: "hours", label: "Hours", align: "right", sortable: true, format: "number" },
  ],
  rows: [
    { name: "Bailey Pixton", hours: 146.24 },
    { name: "Luke Bosick", hours: 88.32 },
    { name: "Steven Cornejo", hours: 68.25 },
  ],
  source: graphicsClockifySource,
  pageSize: 5,
  defaultSortKey: "hours",
  defaultSortDir: "desc",
};

// ---------------------------------------------------------------------------
// 5.8 Shipping Report | By State — appeared unconfigured/blank in the
// original Looker Studio report. CORRECTION (2026-08-08): verified directly
// against the sheet — the country_city tab already had this data fully
// populated (Day, Shipping country, Shipping city, Shipping region, Orders,
// DATE — 10,700+ rows). "Shipping region" is the US state name. The blank
// widget in the original report was most likely a broken Looker Studio chart
// config, not missing data. Wired to real data in Step 3 (see
// src/data/ceoDashboardData.ts + scripts/fetch_data.py).
// ---------------------------------------------------------------------------
export const shippingByStateSource: Source = {
  label: "DailyDashRaw_TerraSlate > country_city tab",
  confirmed: true,
};

// ---------------------------------------------------------------------------
// 5.9 Traffic table — confirmed with JV 2026-08-08 as Google Search Console;
// verified against the sheet's GoogleSearch tab, which matches column-for-
// column (Impressions, Clicks, Pages w/ 1st impression, Clicks by device,
// Google Search type Web/Image/Video) and has the exact same 4 sparse dates
// as this mock data — so the irregular dates are real, not a data quality
// issue. See the TODO in sections/TrafficTable.tsx.
// ---------------------------------------------------------------------------
export const trafficTableSource: Source = {
  label: "DailyDashRaw_TerraSlate > GoogleSearch tab",
  confirmed: true,
};

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
  rows: [
    { date: "May 1, 2026", impressions: 931000, clicks: 3370, pagesFirstImpression: 1250, clicksDesktop: 1940, clicksMobile: 1390, clicksTablet: 42 },
    { date: "Mar 1, 2026", impressions: 1130000, clicks: 3620, pagesFirstImpression: 680, clicksDesktop: 2160, clicksMobile: 1410, clicksTablet: 50 },
    { date: "Feb 1, 2026", impressions: 891000, clicks: 3020, pagesFirstImpression: 570, clicksDesktop: 1680, clicksMobile: 1300, clicksTablet: 37 },
    { date: "Dec 1, 2024", impressions: 278000, clicks: 2810, pagesFirstImpression: 91, clicksDesktop: 1440, clicksMobile: 1330, clicksTablet: 42 },
  ],
  source: trafficTableSource,
  pageSize: 5,
};

// ---------------------------------------------------------------------------
// Sidebar nav
// ---------------------------------------------------------------------------
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  active: boolean;
}

export const navItems: NavItem[] = [
  { id: "ceo-dashboard", label: "CEO Dashboard", icon: "layout-dashboard", active: true },
  { id: "aircall-dashboard", label: "AirCall Dashboard", icon: "phone-call", active: false },
  { id: "amazon-restock", label: "Amazon Restock Report", icon: "package", active: false },
  { id: "accounts-receivable", label: "Accounts Receivable", icon: "file-text", active: false },
  { id: "google-ads", label: "Google Ads", icon: "search", active: false },
  { id: "facebook-ads", label: "Facebook Ads", icon: "thumbs-up", active: false },
  { id: "shipping-dashboard", label: "Shipping Dashboard", icon: "truck", active: false },
  { id: "sales-report", label: "Sales Report Dashboard", icon: "bar-chart-2", active: false },
  { id: "paper-catalog", label: "Paper Catalog Usage", icon: "book-open", active: false },
];

export const dateRangeDefault = { start: "Jul 8, 2026", end: "Aug 6, 2026" };
