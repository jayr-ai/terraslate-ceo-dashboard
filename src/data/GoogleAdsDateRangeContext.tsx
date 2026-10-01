import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import raw from "./googleAdsData.json";
import {
  ANCHOR,
  DEFAULT_SELECTION,
  resolvePresetRange,
  computeCustomSummary,
  computeCustomDailyChart,
  computeCustomTopCampaigns,
  type DateRangeSelection,
  type PresetKey,
  type SummaryWindow,
  type DailyChartPoint,
  type CampaignRow,
} from "../lib/googleAdsDateRange";

interface ResolvedWindows {
  summary: SummaryWindow;
  dailyChart: DailyChartPoint[];
  topCampaigns: { rows: CampaignRow[] };
  displayStart: string;
  displayEnd: string;
}

interface GoogleAdsDateRangeContextValue {
  selection: DateRangeSelection;
  setPreset: (key: PresetKey) => void;
  setCustom: (start: string, end: string) => void;
  windows: ResolvedWindows;
}

const GoogleAdsDateRangeContext = createContext<GoogleAdsDateRangeContextValue | null>(null);

const summaryWindows = raw.summary.windows as unknown as Record<PresetKey, SummaryWindow>;
const dailyChartWindows = raw.dailyChart.windows as unknown as Record<PresetKey, DailyChartPoint[]>;
const topCampaignsWindows = raw.topCampaigns.windows as unknown as Record<PresetKey, { rows: CampaignRow[] }>;

export function GoogleAdsDateRangeProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<DateRangeSelection>(DEFAULT_SELECTION);

  const windows = useMemo<ResolvedWindows>(() => {
    if (selection.kind === "preset") {
      const { key } = selection;
      return {
        summary: summaryWindows[key],
        dailyChart: dailyChartWindows[key],
        topCampaigns: topCampaignsWindows[key],
        displayStart: resolvePresetRange(ANCHOR, key)[0],
        displayEnd: resolvePresetRange(ANCHOR, key)[1],
      };
    }
    const { start, end } = selection;
    return {
      summary: computeCustomSummary(start, end),
      dailyChart: computeCustomDailyChart(start, end),
      topCampaigns: computeCustomTopCampaigns(start, end),
      displayStart: start,
      displayEnd: end,
    };
  }, [selection]);

  const value: GoogleAdsDateRangeContextValue = {
    selection,
    setPreset: (key) => setSelection({ kind: "preset", key }),
    setCustom: (start, end) => setSelection({ kind: "custom", start, end }),
    windows,
  };

  return <GoogleAdsDateRangeContext.Provider value={value}>{children}</GoogleAdsDateRangeContext.Provider>;
}

export function useGoogleAdsDateRange(): GoogleAdsDateRangeContextValue {
  const ctx = useContext(GoogleAdsDateRangeContext);
  if (!ctx) throw new Error("useGoogleAdsDateRange must be used within GoogleAdsDateRangeProvider");
  return ctx;
}
