import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import raw from "./aircallDashboardData.json";
import {
  ANCHOR,
  DEFAULT_SELECTION,
  resolvePresetRange,
  computeCustomCallsWindow,
  computeCustomChartWindow,
  type DateRangeSelection,
  type PresetKey,
  type CallsDurationWindow,
  type ChartWindow,
} from "../lib/aircallDateRange";

interface ResolvedWindows {
  calls: CallsDurationWindow;
  chart: ChartWindow;
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
const callsWindows = raw.callsDuration.windows as unknown as Record<PresetKey, CallsDurationWindow>;
const chartWindows = raw.callsCharts.windows as unknown as Record<PresetKey, ChartWindow>;

export function AircallDateRangeProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<DateRangeSelection>(DEFAULT_SELECTION);

  const windows = useMemo<ResolvedWindows>(() => {
    if (selection.kind === "preset") {
      const { key } = selection;
      return {
        calls: callsWindows[key],
        chart: chartWindows[key],
        displayStart: resolvePresetRange(ANCHOR, key)[0],
        displayEnd: resolvePresetRange(ANCHOR, key)[1],
      };
    }
    const { start, end } = selection;
    return {
      calls: computeCustomCallsWindow(start, end),
      chart: computeCustomChartWindow(start, end),
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
