// PLACEHOLDER DATA — Google Ads Dashboard.
//
// Unlike every other page in this app, this one isn't wired to a live source
// yet: the client's Looker Studio report connects directly to the Google Ads
// API (no Google Sheet intermediary), and that connection is still blocked
// on Google's own Basic Access approval actually taking effect on the API
// backend (confirmed working OAuth + developer token, but the API still
// returns CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION as of this build — see
// AlertBanner on the page itself).
//
// The numbers below are transcribed directly from the reference report's own
// screenshots (Sep 2-29, 2026 window) so the UI's shape/scale is realistic,
// NOT fabricated or estimated. They will be replaced by scripts/
// fetch_google_ads.py output the moment API access clears — same
// architecture as every other page (Python fetch script -> JSON -> adapter).

import type { Trend } from "./ceoDashboardMockData";

export interface GoogleAdsStat {
  label: string;
  value: string;
  trend: Trend;
}

export interface GoogleAdsTrio {
  id: string;
  title: string;
  subtitle: string;
  stats: GoogleAdsStat[];
  chartUnavailableDetail: string;
}

export const googleAdsTrios: GoogleAdsTrio[] = [
  {
    id: "ctr-impressions",
    title: "Click Through Rate & Impressions",
    subtitle: "by Clicks, CTR, and Impressions",
    stats: [
      { label: "Clicks", value: "3.1K", trend: { changePct: -16.7, direction: "down" } },
      { label: "CTR", value: "1.4%", trend: { changePct: -13.4, direction: "down" } },
      { label: "Impressions", value: "220.2K", trend: { changePct: -26.5, direction: "down" } },
    ],
    chartUnavailableDetail: "Daily Clicks / CTR trend — needs live data",
  },
  {
    id: "conversion-cost",
    title: "Conversion Rate & Cost",
    subtitle: "by Conversions Rate and Cost / Conv.",
    stats: [
      { label: "Conversions", value: "367.4", trend: { changePct: 4.6, direction: "up" } },
      { label: "Conv. rate", value: "4.4%", trend: { changePct: 129.3, direction: "up" } },
      { label: "Cost / conv.", value: "$57.90", trend: { changePct: -3.9, direction: "down" } },
    ],
    chartUnavailableDetail: "Daily Conversions / Conv. rate trend — needs live data",
  },
  {
    id: "cost-per-click",
    title: "Cost Per Click",
    subtitle: "by Cost, CPC, and CPM",
    stats: [
      { label: "Cost", value: "$21.27K", trend: { changePct: 0.5, direction: "up" } },
      { label: "Avg. CPC", value: "$6.77", trend: { changePct: 20.6, direction: "up" } },
      { label: "Avg. CPM", value: "$96.58", trend: { changePct: 26.7, direction: "up" } },
    ],
    chartUnavailableDetail: "Daily Cost / Avg. CPC trend — needs live data",
  },
];

export interface GoogleAdsCampaignRow {
  campaign: string;
  ctr: number;
  avgCpc: number;
  costPerConv: number | null;
}

// The reference report's Top Campaigns table paginates 173 total campaigns.
// Only the first page (8 rows) was visible in the reference screenshot —
// the rest aren't guessed at here.
export const googleAdsTopCampaigns: GoogleAdsCampaignRow[] = [
  { campaign: "SN - Branded II", ctr: 25.4, avgCpc: 5.08, costPerConv: 24.19 },
  { campaign: "SN - Waterproof Paper II", ctr: 6.54, avgCpc: 8.85, costPerConv: 0 },
  { campaign: "DSA - Category - Paper II", ctr: 5.68, avgCpc: 7.63, costPerConv: 99.84 },
  { campaign: "PMAX - Waterproof Menus", ctr: 1.35, avgCpc: 11.96, costPerConv: 314.28 },
  { campaign: "PMAX (Full) - Waterproof Paper", ctr: 1.17, avgCpc: 6.39, costPerConv: 66.66 },
  { campaign: "Shopping - WM - Top 10", ctr: 0.74, avgCpc: 9.19, costPerConv: 312.3 },
  { campaign: "PMAX - Waterproof Paper II", ctr: 0.55, avgCpc: 6.01, costPerConv: 140.05 },
  { campaign: "PMAX - Menu Design", ctr: 0.42, avgCpc: 2.98, costPerConv: 81.18 },
];
export const googleAdsTopCampaignsTotalCount = 173;

export interface DeviceSlice {
  id: string;
  label: string;
  pct: number;
}

export interface DeviceBreakdownMetric {
  id: string;
  title: string;
  slices: DeviceSlice[];
}

// Reference donuts each showed two dominant slices (the exact device labels
// weren't legible in the screenshot, so these are generically named "Device
// A / Device B" rather than guessed as specifically Mobile/Desktop/Tablet —
// the real device breakdown will replace this once connected).
export const googleAdsDeviceBreakdown: DeviceBreakdownMetric[] = [
  { id: "clicks", title: "Clicks", slices: [{ id: "a", label: "Device A", pct: 38.7 }, { id: "b", label: "Device B", pct: 60.7 }, { id: "c", label: "Other", pct: 0.6 }] },
  { id: "cost", title: "Cost", slices: [{ id: "a", label: "Device A", pct: 20.8 }, { id: "b", label: "Device B", pct: 78.8 }, { id: "c", label: "Other", pct: 0.4 }] },
  { id: "conversions", title: "Conversions", slices: [{ id: "a", label: "Device A", pct: 19.4 }, { id: "b", label: "Device B", pct: 79.8 }, { id: "c", label: "Other", pct: 0.8 }] },
];
