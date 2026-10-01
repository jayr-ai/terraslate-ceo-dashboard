// Client-side half of the Google Ads page's date-range picker — mirrors
// facebookAdsDateRange.ts exactly (preset windows precomputed in Python,
// "Custom range" computed here over a capped dailyRaw feed). See
// scripts/fetch_google_ads.py's docstring for the aggregation formulas.

import raw from "../data/googleAdsData.json";
import type { Trend } from "../data/ceoDashboardMockData";
import {
  PRESET_KEYS,
  PRESET_LABELS,
  DEFAULT_SELECTION,
  resolvePresetRange,
  prevPeriod,
  trend as computeTrend,
  type PresetKey,
  type DateRangeSelection,
} from "./dateRange";

export { PRESET_KEYS, PRESET_LABELS, DEFAULT_SELECTION, resolvePresetRange };
export type { PresetKey, DateRangeSelection };

export const ANCHOR: string = raw.anchor;

type RawRow = {
  date: string;
  campaign: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  value: number;
};

const dailyRaw = raw.dailyRaw as RawRow[];

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function fmtCount(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return Math.round(v).toLocaleString("en-US");
}
function fmtConversions(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toFixed(1);
}
function fmtMoney(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}
function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

class Agg {
  cost = 0;
  clicks = 0;
  impressions = 0;
  conversions = 0;
  value = 0;

  add(r: RawRow) {
    this.cost += r.cost;
    this.clicks += r.clicks;
    this.impressions += r.impressions;
    this.conversions += r.conversions;
    this.value += r.value;
  }

  ctr(): number {
    return this.impressions ? Math.round((this.clicks / this.impressions) * 100 * 100) / 100 : 0;
  }
  avgCpc(): number {
    return this.clicks ? Math.round((this.cost / this.clicks) * 100) / 100 : 0;
  }
  avgCpm(): number {
    return this.impressions ? Math.round((this.cost / this.impressions) * 1000 * 100) / 100 : 0;
  }
  convRate(): number {
    return this.clicks ? Math.round((this.conversions / this.clicks) * 100 * 100) / 100 : 0;
  }
  costPerConv(): number | null {
    return this.conversions ? Math.round((this.cost / this.conversions) * 100) / 100 : null;
  }
}

export interface GoogleAdsStat {
  label: string;
  value: string;
  trend?: Trend | null;
}
export interface GoogleAdsTrio {
  id: string;
  title: string;
  subtitle: string;
  stats: GoogleAdsStat[];
}
export interface SummaryWindow {
  trios: GoogleAdsTrio[];
}

export function computeCustomSummary(start: string, end: string): SummaryWindow {
  const [prevStart, prevEnd] = prevPeriod(start, end);
  const cur = new Agg();
  const prev = new Agg();
  for (const r of dailyRaw) {
    if (inRange(r.date, start, end)) cur.add(r);
    else if (inRange(r.date, prevStart, prevEnd)) prev.add(r);
  }

  const curCpConv = cur.costPerConv();
  const prevCpConv = prev.costPerConv();

  return {
    trios: [
      {
        id: "ctr-impressions",
        title: "Click Through Rate & Impressions",
        subtitle: "by Clicks, CTR, and Impressions",
        stats: [
          { label: "Clicks", value: fmtCount(cur.clicks), trend: computeTrend(cur.clicks, prev.clicks) },
          { label: "CTR", value: fmtPct(cur.ctr()), trend: computeTrend(cur.ctr(), prev.ctr()) },
          { label: "Impressions", value: fmtCount(cur.impressions), trend: computeTrend(cur.impressions, prev.impressions) },
        ],
      },
      {
        id: "conversion-cost",
        title: "Conversion Rate & Cost",
        subtitle: "by Conversions Rate and Cost / Conv.",
        stats: [
          { label: "Conversions", value: fmtConversions(cur.conversions), trend: computeTrend(cur.conversions, prev.conversions) },
          { label: "Conv. rate", value: fmtPct(cur.convRate()), trend: computeTrend(cur.convRate(), prev.convRate()) },
          {
            label: "Cost / conv.",
            value: curCpConv !== null ? fmtMoney(curCpConv) : "No data",
            trend: curCpConv !== null && prevCpConv !== null ? computeTrend(curCpConv, prevCpConv) : null,
          },
        ],
      },
      {
        id: "cost-per-click",
        title: "Cost Per Click",
        subtitle: "by Cost, CPC, and CPM",
        stats: [
          { label: "Cost", value: fmtMoney(cur.cost), trend: computeTrend(cur.cost, prev.cost) },
          { label: "Avg. CPC", value: fmtMoney(cur.avgCpc()), trend: computeTrend(cur.avgCpc(), prev.avgCpc()) },
          { label: "Avg. CPM", value: fmtMoney(cur.avgCpm()), trend: computeTrend(cur.avgCpm(), prev.avgCpm()) },
        ],
      },
    ],
  };
}

export interface DailyChartPoint {
  date: string;
  clicks: number;
  ctr: number;
  impressions: number;
  conversions: number;
  convRate: number;
  cost: number;
  avgCpc: number;
  avgCpm: number;
}

export function computeCustomDailyChart(start: string, end: string): DailyChartPoint[] {
  const byDay = new Map<string, Agg>();
  for (const r of dailyRaw) {
    if (!inRange(r.date, start, end)) continue;
    if (!byDay.has(r.date)) byDay.set(r.date, new Agg());
    byDay.get(r.date)!.add(r);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, agg]) => ({
      date,
      clicks: Math.round(agg.clicks),
      ctr: agg.ctr(),
      impressions: Math.round(agg.impressions),
      conversions: Math.round(agg.conversions * 10) / 10,
      convRate: agg.convRate(),
      cost: Math.round(agg.cost * 100) / 100,
      avgCpc: agg.avgCpc(),
      avgCpm: agg.avgCpm(),
    }));
}

export interface CampaignRow {
  campaign: string;
  ctr: number;
  avgCpc: number;
  costPerConv: number | null;
}

export function computeCustomTopCampaigns(start: string, end: string): { rows: CampaignRow[] } {
  const perCampaign = new Map<string, Agg>();
  for (const r of dailyRaw) {
    if (!inRange(r.date, start, end)) continue;
    if (!perCampaign.has(r.campaign)) perCampaign.set(r.campaign, new Agg());
    perCampaign.get(r.campaign)!.add(r);
  }
  const ranked = [...perCampaign.entries()]
    .filter(([, agg]) => agg.clicks > 0 || agg.impressions > 0)
    .sort(([, a], [, b]) => b.ctr() - a.ctr());
  return {
    rows: ranked.map(([campaign, agg]) => ({
      campaign,
      ctr: agg.ctr(),
      avgCpc: agg.avgCpc(),
      costPerConv: agg.costPerConv(),
    })),
  };
}
