import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import raw from "./aircallDashboardData.json";
import {
  ANCHOR,
  DEFAULT_SELECTION,
  resolvePresetRange,
  computeCustomConsolidatedCallsWindow,
  computeCustomChartWindow,
  computeCustomCallsByTagWindow,
  computeCustomCallsByTagByUserWindow,
  computeCustomSummaryWindow,
  type DateRangeSelection,
  type PresetKey,
  type ConsolidatedCallsTable,
  type ChartWindow,
  type CallsByTagWindow,
  type CallsByTagByUserWindow,
  type SummaryWindow,
} from "../lib/aircallDateRange";

interface ResolvedWindows {
  summary: SummaryWindow;
  consolidated: ConsolidatedCallsTable;
  chart: ChartWindow;
  callsByTag: CallsByTagWindow;
  callsByTagByUser: CallsByTagByUserWindow;
  displayStart: string;
  displayEnd: string;
}

interface AircallDateRangeContextValue {
  selection: DateRangeSelection;
  setPreset: (key: PresetKey) => void;
  setCustom: (start: string, end: string) => void;
  windows: ResolvedWindows;
}

const AircallDateRangeContext = createContext<AircallDateRangeContextValue | null>(null);

// `as unknown as X` — same JSON-boundary reasoning as DateRangeContext.tsx:
// TS would otherwise infer the exact literal shape of whatever numbers came
// back on the last refresh, which is fragile by construction.
const summaryWindows = raw.summary.windows as unknown as Record<PresetKey, SummaryWindow>;
const consolidatedWindows = raw.consolidatedDuration.windows as unknown as Record<PresetKey, ConsolidatedCallsTable>;
const chartWindows = raw.callsCharts.windows as unknown as Record<PresetKey, ChartWindow>;
const callsByTagWindows = raw.callsByTag.windows as unknown as Record<PresetKey, CallsByTagWindow>;
const callsByTagByUserWindows = raw.callsByTagByUser.windows as unknown as Record<PresetKey, CallsByTagByUserWindow>;

export function AircallDateRangeProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<DateRangeSelection>(DEFAULT_SELECTION);

  const windows = useMemo<ResolvedWindows>(() => {
    if (selection.kind === "preset") {
      const { key } = selection;
      return {
        summary: summaryWindows[key],
        consolidated: consolidatedWindows[key],
        chart: chartWindows[key],
        callsByTag: callsByTagWindows[key],
        callsByTagByUser: callsByTagByUserWindows[key],
        displayStart: resolvePresetRange(ANCHOR, key)[0],
        displayEnd: resolvePresetRange(ANCHOR, key)[1],
      };
    }
    const { start, end } = selection;
    return {
      summary: computeCustomSummaryWindow(start, end),
      consolidated: computeCustomConsolidatedCallsWindow(start, end),
      chart: computeCustomChartWindow(start, end),
      callsByTag: computeCustomCallsByTagWindow(start, end),
      callsByTagByUser: computeCustomCallsByTagByUserWindow(start, end),
      displayStart: start,
      displayEnd: end,
    };
  }, [selection]);

  const value: AircallDateRangeContextValue = {
    selection,
    setPreset: (key) => setSelection({ kind: "preset", key }),
    setCustom: (start, end) => setSelection({ kind: "custom", start, end }),
    windows,
  };

  return <AircallDateRangeContext.Provider value={value}>{children}</AircallDateRangeContext.Provider>;
}

export function useAircallDateRange(): AircallDateRangeContextValue {
  const ctx = useContext(AircallDateRangeContext);
  if (!ctx) throw new Error("useAircallDateRange must be used within AircallDateRangeProvider");
  return ctx;
}
