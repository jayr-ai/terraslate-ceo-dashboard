// Client-side half of the Facebook Ads page's date-range picker — mirrors
// aircallDateRange.ts's architecture exactly (preset windows precomputed in
// Python, "Custom range" computed here over a capped dailyRaw feed), reading
// its own facebookAdsData.json. See scripts/fetch_facebook_ads.py's
// docstring for the aggregation formulas (verified against the reference
// report's exact numbers) this mirrors.

import raw from "../data/facebookAdsData.json";
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
  objective: string;
  campaign: string;
  spend: number;
  reach: number;
  impressions: number;
  freq: number | null;
  clicks: number;
  purchases: number;
  value: number;
};

const dailyRaw = raw.dailyRaw as RawRow[];

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

class Agg {
  spend = 0;
  reach = 0;
  impressions = 0;
  freqSum = 0;
  freqN = 0;
  clicks = 0;
  purchases = 0;
  value = 0;

  add(r: RawRow) {
    this.spend += r.spend;
    this.reach += r.reach;
    this.impressions += r.impressions;
    if (r.freq !== null) {
      this.freqSum += r.freq;
      this.freqN += 1;
    }
    this.clicks += r.clicks;
    this.purchases += r.purchases;
    this.value += r.value;
  }

  freq(): number {
    return this.freqN ? Math.round((this.freqSum / this.freqN) * 100) / 100 : 0;
  }
  cpm(): number {
    return this.impressions ? Math.round((this.spend / this.impressions) * 1000 * 100) / 100 : 0;
  }
  costPerClick(): number | null {
    return this.clicks ? Math.round((this.spend / this.clicks) * 100) / 100 : null;
  }
  ctr(): number {
    return this.impressions ? Math.round((this.clicks / this.impressions) * 100 * 100) / 100 : 0;
  }
  roas(): number {
    return this.spend ? Math.round((this.value / this.spend) * 100) / 100 : 0;
  }
  costPerPurchase(): number | null {
    return this.purchases ? Math.round((this.spend / this.purchases) * 100) / 100 : null;
  }
  toTableRow(labelKey: "date" | "month", label: string): TableRow {
    return {
      [labelKey]: label,
      impressions: Math.round(this.impressions),
      cpm: this.cpm(),
      reach: Math.round(this.reach),
      linkClicks: Math.round(this.clicks),
      costPerLinkClick: this.costPerClick(),
      ctr: this.ctr(),
      freq: this.freq(),
      purchases: Math.round(this.purchases),
      purchaseValue: Math.round(this.value * 100) / 100,
      amountSpent: Math.round(this.spend * 100) / 100,
      roas: this.roas(),
    } as TableRow;
  }
}

export interface TableRow {
  date?: string;
  month?: string;
  impressions: number;
  cpm: number;
  reach: number;
  linkClicks: number;
  costPerLinkClick: number | null;
  ctr: number;
  freq: number;
  purchases: number;
  purchaseValue: number;
  amountSpent: number;
  roas: number;
}

export interface DailyTable {
  rows: TableRow[];
  grandTotal: TableRow;
}

export function computeCustomDailyTable(start: string, end: string): DailyTable {
  const perDay = new Map<string, Agg>();
  for (const r of dailyRaw) {
    if (!inRange(r.date, start, end)) continue;
    const agg = perDay.get(r.date) ?? new Agg();
    agg.add(r);
    perDay.set(r.date, agg);
  }
  const dates = [...perDay.keys()].sort().reverse();
  const grand = new Agg();
  const rows = dates.map((d) => {
    const agg = perDay.get(d)!;
    grand.spend += agg.spend;
    grand.reach += agg.reach;
    grand.impressions += agg.impressions;
    grand.freqSum += agg.freqSum;
    grand.freqN += agg.freqN;
    grand.clicks += agg.clicks;
    grand.purchases += agg.purchases;
    grand.value += agg.value;
    const label = new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return agg.toTableRow("date", label);
  });
  return { rows, grandTotal: grand.toTableRow("date", "Grand total") };
}

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

export interface SummaryMetric {
  value: number;
  trend: Trend | null;
}
export interface SummaryWindow {
  spend: SummaryMetric;
  purchaseValue: SummaryMetric;
  roas: SummaryMetric;
  costPerPurchase: SummaryMetric | null;
  cpm: SummaryMetric;
  impressions: SummaryMetric;
  reach: SummaryMetric;
  linkClicks: SummaryMetric;
  costPerLinkClick: SummaryMetric | null;
  purchases: SummaryMetric;
  narrative: string;
}

function buildNarrative(cur: Agg, prev: Agg | null): string {
  const curTrend = prev ? computeTrend(cur.spend, prev.spend) : undefined;
  let lead = `Spent $${cur.spend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for $${cur.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in purchase value this period (${cur.roas().toFixed(2)}x ROAS)`;
  if (curTrend) {
    const verb = curTrend.direction === "up" ? "up" : "down";
    lead += `, spend ${verb} ${Math.abs(curTrend.changePct)}% vs. the prior period`;
  }
  lead += ".";

  const roasTrend = prev ? computeTrend(cur.roas(), prev.roas()) : undefined;
  let roasLine: string;
  if (roasTrend) {
    if (roasTrend.direction === "up") roasLine = `ROAS improved ${roasTrend.changePct}% vs. the prior period — efficiency is trending the right way.`;
    else if (roasTrend.direction === "down") roasLine = `ROAS fell ${Math.abs(roasTrend.changePct)}% vs. the prior period — the same spend is returning less.`;
    else roasLine = "ROAS held flat vs. the prior period.";
  } else {
    roasLine = "Not enough history yet to compare ROAS period-over-period.";
  }
  return `${lead} ${roasLine}`;
}

export function computeCustomSummary(start: string, end: string): SummaryWindow {
  const [prevStart, prevEnd] = prevPeriod(start, end);
  const cur = new Agg();
  const prev = new Agg();
  let hasPrev = false;
  for (const r of dailyRaw) {
    if (inRange(r.date, start, end)) cur.add(r);
    else if (inRange(r.date, prevStart, prevEnd)) {
      prev.add(r);
      hasPrev = true;
    }
  }
  const prevOrNull = hasPrev ? prev : null;

  function metric(curV: number, prevV: number): SummaryMetric {
    return { value: curV, trend: (hasPrev ? computeTrend(curV, prevV) : undefined) ?? null };
  }

  const curCpp = cur.costPerPurchase();
  const prevCpp = prev.costPerPurchase();
  const curCpc = cur.costPerClick();
  const prevCpc = prev.costPerClick();

  return {
    spend: metric(Math.round(cur.spend * 100) / 100, Math.round(prev.spend * 100) / 100),
    purchaseValue: metric(Math.round(cur.value * 100) / 100, Math.round(prev.value * 100) / 100),
    roas: metric(cur.roas(), prev.roas()),
    costPerPurchase:
      curCpp !== null
        ? { value: curCpp, trend: (hasPrev && prevCpp !== null ? computeTrend(curCpp, prevCpp) : undefined) ?? null }
        : null,
    cpm: metric(cur.cpm(), prev.cpm()),
    impressions: metric(Math.round(cur.impressions), Math.round(prev.impressions)),
    reach: metric(Math.round(cur.reach), Math.round(prev.reach)),
    linkClicks: metric(Math.round(cur.clicks), Math.round(prev.clicks)),
    costPerLinkClick:
      curCpc !== null
        ? { value: curCpc, trend: (hasPrev && prevCpc !== null ? computeTrend(curCpc, prevCpc) : undefined) ?? null }
        : null,
    purchases: metric(Math.round(cur.purchases), Math.round(prev.purchases)),
    narrative: buildNarrative(cur, prevOrNull),
  };
}

// ---------------------------------------------------------------------------
// Top Campaigns by Spend
// ---------------------------------------------------------------------------

const TOP_CAMPAIGNS_LIMIT = 10;
const ROAS_FLAG_THRESHOLD = 1.0;

export interface CampaignRow {
  name: string;
  spend: number;
  roas: number;
  purchases: number;
  flagged: boolean;
}

export function computeCustomTopCampaigns(start: string, end: string): { rows: CampaignRow[] } {
  const perCampaign = new Map<string, Agg>();
  for (const r of dailyRaw) {
    if (!inRange(r.date, start, end)) continue;
    const agg = perCampaign.get(r.campaign) ?? new Agg();
    agg.add(r);
    perCampaign.set(r.campaign, agg);
  }
  const ranked = [...perCampaign.entries()].sort((a, b) => b[1].spend - a[1].spend).slice(0, TOP_CAMPAIGNS_LIMIT);
  return {
    rows: ranked.map(([name, agg]) => ({
      name,
      spend: Math.round(agg.spend * 100) / 100,
      roas: agg.roas(),
      purchases: Math.round(agg.purchases),
      flagged: agg.spend > 0 && agg.roas() < ROAS_FLAG_THRESHOLD,
    })),
  };
}

// ---------------------------------------------------------------------------
// Performance by Objective
// ---------------------------------------------------------------------------

export interface ObjectiveRow {
  objective: string;
  amountSpent: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
}
export interface ByObjectiveWindow {
  rows: ObjectiveRow[];
  grandTotal: ObjectiveRow;
}

export function computeCustomByObjective(start: string, end: string): ByObjectiveWindow {
  const perObj = new Map<string, Agg>();
  for (const r of dailyRaw) {
    if (!inRange(r.date, start, end)) continue;
    const agg = perObj.get(r.objective) ?? new Agg();
    agg.add(r);
    perObj.set(r.objective, agg);
  }
  const ranked = [...perObj.entries()].sort((a, b) => b[1].spend - a[1].spend);
  const grand = new Agg();
  const rows: ObjectiveRow[] = ranked.map(([objective, agg]) => {
    grand.spend += agg.spend;
    grand.reach += agg.reach;
    grand.impressions += agg.impressions;
    grand.clicks += agg.clicks;
    grand.purchases += agg.purchases;
    grand.value += agg.value;
    return {
      objective,
      amountSpent: Math.round(agg.spend * 100) / 100,
      impressions: Math.round(agg.impressions),
      reach: Math.round(agg.reach),
      linkClicks: Math.round(agg.clicks),
      purchases: Math.round(agg.purchases),
      purchaseValue: Math.round(agg.value * 100) / 100,
      roas: agg.roas(),
    };
  });
  return {
    rows,
    grandTotal: {
      objective: "Grand total",
      amountSpent: Math.round(grand.spend * 100) / 100,
      impressions: Math.round(grand.impressions),
      reach: Math.round(grand.reach),
      linkClicks: Math.round(grand.clicks),
      purchases: Math.round(grand.purchases),
      purchaseValue: Math.round(grand.value * 100) / 100,
      roas: grand.roas(),
    },
  };
}
