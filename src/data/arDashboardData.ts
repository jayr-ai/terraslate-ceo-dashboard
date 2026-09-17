// Real data adapter — reads scripts/fetch_ar_data.py's output
// (arDashboardData.json) and reshapes it into the typed constants the UI
// components consume. Entirely static/all-time-anchored: unlike CEO/AirCall,
// this page has no interactive date-range picker — the 4 aging buckets are
// always "today-relative" by definition (see the Python script's docstring
// for why, and for what was deliberately dropped from the source report).
//
// To refresh with current numbers: `python3 scripts/fetch_ar_data.py`.

import raw from "./arDashboardData.json";
import type { Source, StatTileDatum, Trend } from "./ceoDashboardMockData";
import type { MonthlyBarPoint } from "../components/shared/MonthlyBarChart";
import type { HeatmapTableData } from "../components/shared/HeatmapDataTable";

const arSource: Source = { label: "TerraSlate Shopify > Unpaid tab", confirmed: true };
export { arSource };

const BUCKET_ORDER = ["last30", "d31to60", "d61to90", "d90plus"] as const;

interface ArBucketRaw {
  label: string;
  unpaidLabel: string;
  total: number;
  count: number;
  trend: Trend | null;
  countTrend: Trend | null;
  rows: { date: string; order: string; total: number }[];
}

const buckets = raw.buckets as unknown as Record<(typeof BUCKET_ORDER)[number], ArBucketRaw>;

export interface ArBucket {
  moneyTile: StatTileDatum;
  countTile: StatTileDatum;
  table: HeatmapTableData;
}

function fmtMoney(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Fix 2 (implementation brief, 2026-09-17): a rising 31-60/61-90/90+ balance
// means collections are slowing — a bad signal, not the neutral "up" this
// app's other dashboards use trend color for. "Last 30 Days" growing is
// expected (it's mostly just new sales landing in the bucket), so it stays
// neutral regardless of direction.
function bucketSemantic(bucketKey: string, direction: string): "bad" | "good" | "neutral" | undefined {
  if (bucketKey === "last30") return "neutral";
  if (direction === "up") return "bad";
  if (direction === "down") return "good";
  return undefined;
}

const TREND_CAPTION = "vs. prior 30 days";

export const arBuckets: ArBucket[] = BUCKET_ORDER.map((key) => {
  const b = buckets[key];
  const empty = b.count === 0;
  return {
    moneyTile: {
      id: `${key}-total`,
      label: b.label,
      value: empty ? "No data" : fmtMoney(b.total),
      empty,
      trend: b.trend,
      trendSemantic: b.trend ? bucketSemantic(key, b.trend.direction) : undefined,
      trendCaption: b.trend ? TREND_CAPTION : undefined,
    },
    countTile: {
      id: `${key}-count`,
      label: b.unpaidLabel,
      value: empty ? "No data" : String(b.count),
      empty,
      trend: b.countTrend,
      trendSemantic: b.countTrend ? bucketSemantic(key, b.countTrend.direction) : undefined,
      trendCaption: b.countTrend ? TREND_CAPTION : undefined,
    },
    table: {
      id: `${key}-table`,
      title: b.label,
      columns: [
        { key: "date", label: "Date", align: "left" },
        { key: "order", label: "Order", align: "left", sortable: true },
        { key: "total", label: "Total", align: "right", sortable: true, format: "currency", heat: "blue" },
      ],
      rows: b.rows,
      source: arSource,
      pageSize: 10,
    },
  };
});

export const allTimeReceivableTile: StatTileDatum = {
  id: "all-time-receivable",
  label: "All Time Receivable",
  value: fmtMoney(raw.allTimeReceivable),
};

export const monthlyChartData: MonthlyBarPoint[] = raw.monthly.map((m) => ({ label: m.label, total: m.total }));

// ---------------------------------------------------------------------------
// Fix 1 — Total Outstanding AR headline KPI (sum of the 4 buckets — NOT
// allTimeReceivable, which is a different, cumulative-forever metric)
// ---------------------------------------------------------------------------

export interface TotalOutstandingKpi {
  label: string;
  value: string;
  subLabel: string;
  trend: Trend | null;
  trendSemantic: "bad" | "good" | undefined;
}

const totalOutstandingRaw = raw.totalOutstanding as unknown as { total: number; count: number; trend: Trend | null };

export const totalOutstandingKpi: TotalOutstandingKpi = {
  label: "Total Outstanding AR",
  value: fmtMoney(totalOutstandingRaw.total),
  subLabel: `${totalOutstandingRaw.count} unpaid order${totalOutstandingRaw.count === 1 ? "" : "s"}`,
  trend: totalOutstandingRaw.trend,
  trendSemantic: totalOutstandingRaw.trend
    ? totalOutstandingRaw.trend.direction === "up"
      ? "bad"
      : totalOutstandingRaw.trend.direction === "down"
        ? "good"
        : undefined
    : undefined,
};

// ---------------------------------------------------------------------------
// Fix 3 — Aging mix (% of Total Outstanding AR per bucket)
// ---------------------------------------------------------------------------

export interface AgingMixSegment {
  key: string;
  label: string;
  pct: number;
}

export const agingMixData: AgingMixSegment[] = raw.agingMix;

// ---------------------------------------------------------------------------
// Fix 4 — DSO (Days Sales Outstanding), 30-day rolling
// ---------------------------------------------------------------------------

const dsoRaw = raw.dso as unknown as { value: number | null; trend: Trend | null; salesWindowLabel: string };

export const dsoKpi: StatTileDatum = {
  id: "dso",
  label: `DSO (30-day rolling, ${dsoRaw.salesWindowLabel.replace(/[()]/g, "")})`,
  value: dsoRaw.value !== null ? `${dsoRaw.value} days` : "No data",
  empty: dsoRaw.value === null,
  trend: dsoRaw.trend,
  trendSemantic: dsoRaw.trend
    ? dsoRaw.trend.direction === "up"
      ? "bad"
      : dsoRaw.trend.direction === "down"
        ? "good"
        : undefined
    : undefined,
  trendCaption: dsoRaw.trend ? TREND_CAPTION : undefined,
};

// ---------------------------------------------------------------------------
// Fix 5 — auto-generated one-line narrative
// ---------------------------------------------------------------------------

export const arNarrative: string = raw.narrative;

export const arDataGeneratedAt: string = raw.generatedAt;
