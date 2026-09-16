// Real data adapter — reads scripts/fetch_ar_data.py's output
// (arDashboardData.json) and reshapes it into the typed constants the UI
// components consume. Entirely static/all-time-anchored: unlike CEO/AirCall,
// this page has no interactive date-range picker — the 4 aging buckets are
// always "today-relative" by definition (see the Python script's docstring
// for why, and for what was deliberately dropped from the source report).
//
// To refresh with current numbers: `python3 scripts/fetch_ar_data.py`.

import raw from "./arDashboardData.json";
import type { Source, StatTileDatum, TableSection, Trend } from "./ceoDashboardMockData";
import type { MonthlyBarPoint } from "../components/shared/MonthlyBarChart";

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
  table: TableSection;
}

function fmtMoney(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
    },
    countTile: {
      id: `${key}-count`,
      label: b.unpaidLabel,
      value: empty ? "No data" : String(b.count),
      empty,
      trend: b.countTrend,
    },
    table: {
      id: `${key}-table`,
      title: b.label,
      columns: [
        { key: "date", label: "Date", align: "left" },
        { key: "order", label: "Order", align: "left", sortable: true },
        { key: "total", label: "Total", align: "right", sortable: true, format: "currency" },
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

export const arDataGeneratedAt: string = raw.generatedAt;
