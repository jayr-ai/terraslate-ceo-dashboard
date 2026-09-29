// Client-side data layer for the Sales Report Dashboard. Unlike every other
// page here, the source sheet is already weekly aggregates (~250 rows total,
// 2022-2026) — small enough to ship whole and compute everything (YTD, QTD,
// quarter tables, contribution %) client-side, filtered by the Year picker.
// See scripts/fetch_sales_report.py's docstring for the row-cleaning rules.

import raw from "../data/salesReportData.json";

export interface SalesRow {
  year: number;
  week: string;
  weekNum: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  weekStart: string;
  forecast: number | null;
  actual: number | null;
  forecastDraft: number | null;
  actualDraft: number | null;
  fcstAmzn: number | null;
  actualAmzn: number | null;
  fcstGd: number | null;
  paidGdWork: number | null;
  fcstWeb: number | null;
  actualWeb: number | null;
  forecastWmt: number | null;
  actualWmt: number | null;
}

const ALL_ROWS = raw.rows as SalesRow[];
export const YEARS: number[] = raw.years;
export const DEFAULT_YEAR: number = YEARS[0];
export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
export type Quarter = (typeof QUARTERS)[number];

export type ChannelKey = "topline" | "draft" | "web" | "amzn" | "gd" | "wmt";

export interface ChannelConfig {
  key: ChannelKey;
  pageTitle: string;
  actualLabel: string;
  forecastLabel: string;
  diffLabel: string;
  varianceLabel: string;
  trendLabel: string;
  actualKey: keyof SalesRow;
  forecastKey: keyof SalesRow;
}

export const CHANNELS: Record<ChannelKey, ChannelConfig> = {
  topline: {
    key: "topline",
    pageTitle: "Top Line Sales Report",
    actualLabel: "Actual",
    forecastLabel: "Forecast",
    diffLabel: "Actual vs Forecast",
    varianceLabel: "% Variance",
    trendLabel: "Actual Sales",
    actualKey: "actual",
    forecastKey: "forecast",
  },
  draft: {
    key: "draft",
    pageTitle: "Draft Report",
    actualLabel: "Actual Draft",
    forecastLabel: "Forecast Draft",
    diffLabel: "Draft (Act vs Fcst)",
    varianceLabel: "Draft % Variance",
    trendLabel: "Actual Draft Trend",
    actualKey: "actualDraft",
    forecastKey: "forecastDraft",
  },
  web: {
    key: "web",
    pageTitle: "Website Sale Report",
    actualLabel: "Actual Web",
    forecastLabel: "Fcst Web",
    diffLabel: "Actual vs Forecast",
    varianceLabel: "Web % Variance",
    trendLabel: "Actual Web",
    actualKey: "actualWeb",
    forecastKey: "fcstWeb",
  },
  amzn: {
    key: "amzn",
    pageTitle: "Amazon Report",
    actualLabel: "Actual AMZN",
    forecastLabel: "Fcst AMZN",
    diffLabel: "Actual vs Forecast",
    varianceLabel: "Amazon % Variance",
    trendLabel: "Actual Trend",
    actualKey: "actualAmzn",
    forecastKey: "fcstAmzn",
  },
  gd: {
    key: "gd",
    pageTitle: "Graphic Design Report",
    actualLabel: "Paid GD Work",
    forecastLabel: "Fcst GD",
    diffLabel: "Actual vs Forecast",
    varianceLabel: "Graphic % Variance",
    trendLabel: "Paid GD Trend",
    actualKey: "paidGdWork",
    forecastKey: "fcstGd",
  },
  wmt: {
    key: "wmt",
    pageTitle: "Walmart Sale Report",
    actualLabel: "Actual WMT",
    forecastLabel: "Forecast WMT",
    diffLabel: "WMT (Act vs Fcst)",
    varianceLabel: "WMT % Variance",
    trendLabel: "Actual WMT",
    actualKey: "actualWmt",
    forecastKey: "forecastWmt",
  },
};

function num(row: SalesRow, key: keyof SalesRow): number {
  const v = row[key];
  return typeof v === "number" ? v : 0;
}

export function rowsForYear(year: number): SalesRow[] {
  return ALL_ROWS.filter((r) => r.year === year);
}

export interface Totals {
  actual: number;
  forecast: number;
  diff: number;
  variancePct: number | null;
}

function totalsOf(rows: SalesRow[], channel: ChannelConfig): Totals {
  const actual = rows.reduce((a, r) => a + num(r, channel.actualKey), 0);
  const forecast = rows.reduce((a, r) => a + num(r, channel.forecastKey), 0);
  const diff = actual - forecast;
  const variancePct = forecast !== 0 ? (diff / forecast) * 100 : null;
  return { actual, forecast, diff, variancePct };
}

export interface KpiSet {
  ytd: Totals;
  ytdSparkline: number[];
  qtd: Totals;
  qtdSparkline: number[];
  qtdQuarter: Quarter | null;
}

// "Current" quarter = the latest quarter (within the selected year) that
// has at least one row with a non-null Actual — a live calculation, not a
// pinned snapshot. See fetch_sales_report.py's docstring for why this
// deliberately doesn't match the reference screenshots' frozen Q2 numbers.
function currentQuarterOf(rows: SalesRow[], channel: ChannelConfig): Quarter | null {
  let latest: Quarter | null = null;
  for (const r of rows) {
    if (r[channel.actualKey] != null) latest = r.quarter;
  }
  return latest;
}

export function computeKpis(year: number, channelKey: ChannelKey): KpiSet {
  const channel = CHANNELS[channelKey];
  const rows = rowsForYear(year);
  const ytd = totalsOf(rows, channel);
  const ytdSparkline = rows.map((r) => num(r, channel.actualKey));

  const qtdQuarter = currentQuarterOf(rows, channel);
  // Matches the quarter table's own TOTAL row convention (and the
  // reference report's, verified against real numbers): only weeks with
  // a reported Actual count, not the whole quarter's forecast including
  // weeks that haven't happened yet.
  const qtdRows = qtdQuarter ? rows.filter((r) => r.quarter === qtdQuarter && r[channel.actualKey] != null) : [];
  const qtd = totalsOf(qtdRows, channel);
  const qtdSparkline = qtdRows.map((r) => num(r, channel.actualKey));

  return { ytd, ytdSparkline, qtd, qtdSparkline, qtdQuarter };
}

export interface QuarterTableRow {
  week: string;
  actual: number;
  forecast: number;
  diff: number;
  variancePct: number | null;
  trend: number;
}

export interface QuarterTable {
  quarter: Quarter;
  rows: QuarterTableRow[];
  total: Totals;
  hasData: boolean;
}

export function computeQuarterTables(year: number, channelKey: ChannelKey): QuarterTable[] {
  const channel = CHANNELS[channelKey];
  const rows = rowsForYear(year);
  return QUARTERS.map((q) => {
    const qRows = rows.filter((r) => r.quarter === q);
    // Only weeks with a real actual value count as "in" the table — a
    // future week that's View=YES-filtered-in but not yet reported (e.g.
    // this week) shouldn't show as a zeroed row or skew the total.
    const reportedRows = qRows.filter((r) => r[channel.actualKey] != null);
    const tableRows: QuarterTableRow[] = reportedRows.map((r) => ({
      week: r.week,
      actual: num(r, channel.actualKey),
      forecast: num(r, channel.forecastKey),
      diff: num(r, channel.actualKey) - num(r, channel.forecastKey),
      variancePct: num(r, channel.forecastKey) !== 0 ? ((num(r, channel.actualKey) - num(r, channel.forecastKey)) / num(r, channel.forecastKey)) * 100 : null,
      trend: num(r, channel.actualKey),
    }));
    return { quarter: q, rows: tableRows, total: totalsOf(reportedRows, channel), hasData: tableRows.length > 0 };
  });
}

export interface ContributionRow {
  week: string;
  actual: number;
  draftPct: number | null;
  webPct: number | null;
  gdPct: number | null;
  amznPct: number | null;
  wmtPct: number | null;
}

export interface ContributionTable {
  quarter: Quarter;
  rows: ContributionRow[];
  hasData: boolean;
}

function pctOf(part: number | null, whole: number | null): number | null {
  if (part == null || whole == null || whole === 0) return null;
  return (part / whole) * 100;
}

export function computeContributionTables(year: number): ContributionTable[] {
  const rows = rowsForYear(year);
  return QUARTERS.map((q) => {
    const qRows = rows.filter((r) => r.quarter === q && r.actual != null);
    const tableRows: ContributionRow[] = qRows.map((r) => ({
      week: r.week,
      actual: r.actual ?? 0,
      draftPct: pctOf(r.actualDraft, r.actual),
      webPct: pctOf(r.actualWeb, r.actual),
      gdPct: pctOf(r.paidGdWork, r.actual),
      amznPct: pctOf(r.actualAmzn, r.actual),
      wmtPct: pctOf(r.actualWmt, r.actual),
    }));
    return { quarter: q, rows: tableRows, hasData: tableRows.length > 0 };
  });
}
