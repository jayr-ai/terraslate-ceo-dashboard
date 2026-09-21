import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import raw from "./facebookAdsData.json";
import {
  ANCHOR,
  DEFAULT_SELECTION,
  resolvePresetRange,
  computeCustomDailyTable,
  computeCustomSummary,
  computeCustomTopCampaigns,
  computeCustomByObjective,
  type DateRangeSelection,
  type PresetKey,
  type DailyTable,
  type SummaryWindow,
  type CampaignRow,
  type ByObjectiveWindow,
} from "../lib/facebookAdsDateRange";

interface ResolvedWindows {
  summary: SummaryWindow;
  dailyTable: DailyTable;
  topCampaigns: { rows: CampaignRow[] };
  byObjective: ByObjectiveWindow;
  displayStart: string;
  displayEnd: string;
}

interface FacebookAdsDateRangeContextValue {
  selection: DateRangeSelection;
  setPreset: (key: PresetKey) => void;
  setCustom: (start: string, end: string) => void;
  windows: ResolvedWindows;
}

const FacebookAdsDateRangeContext = createContext<FacebookAdsDateRangeContextValue | null>(null);

const summaryWindows = raw.summary.windows as unknown as Record<PresetKey, SummaryWindow>;
const dailyTableWindows = raw.dailyTable.windows as unknown as Record<PresetKey, DailyTable>;
const topCampaignsWindows = raw.topCampaigns.windows as unknown as Record<PresetKey, { rows: CampaignRow[] }>;
const byObjectiveWindows = raw.byObjective.windows as unknown as Record<PresetKey, ByObjectiveWindow>;

export function FacebookAdsDateRangeProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<DateRangeSelection>(DEFAULT_SELECTION);

  const windows = useMemo<ResolvedWindows>(() => {
    if (selection.kind === "preset") {
      const { key } = selection;
      return {
        summary: summaryWindows[key],
        dailyTable: dailyTableWindows[key],
        topCampaigns: topCampaignsWindows[key],
        byObjective: byObjectiveWindows[key],
        displayStart: resolvePresetRange(ANCHOR, key)[0],
        displayEnd: resolvePresetRange(ANCHOR, key)[1],
      };
    }
    const { start, end } = selection;
    return {
      summary: computeCustomSummary(start, end),
      dailyTable: computeCustomDailyTable(start, end),
      topCampaigns: computeCustomTopCampaigns(start, end),
      byObjective: computeCustomByObjective(start, end),
      displayStart: start,
      displayEnd: end,
    };
  }, [selection]);

  const value: FacebookAdsDateRangeContextValue = {
    selection,
    setPreset: (key) => setSelection({ kind: "preset", key }),
    setCustom: (start, end) => setSelection({ kind: "custom", start, end }),
    windows,
  };

  return <FacebookAdsDateRangeContext.Provider value={value}>{children}</FacebookAdsDateRangeContext.Provider>;
}

export function useFacebookAdsDateRange(): FacebookAdsDateRangeContextValue {
  const ctx = useContext(FacebookAdsDateRangeContext);
  if (!ctx) throw new Error("useFacebookAdsDateRange must be used within FacebookAdsDateRangeProvider");
  return ctx;
}
