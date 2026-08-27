import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import raw from "./ceoDashboardData.json";
import {
  ANCHORS,
  DEFAULT_SELECTION,
  resolvePresetRange,
  computeCustomSalesWindow,
  computeCustomMarketingWindow,
  computeCustomStaffWindows,
  computeCustomGraphicDesignWindow,
  computeCustomGraphicsHoursWindow,
  type DateRangeSelection,
  type PresetKey,
  type SalesWindow,
  type MarketingWindow,
  type StaffWindow,
  type GraphicDesignWindow,
  type HoursWindow,
} from "../lib/dateRange";

interface ResolvedWindows {
  sales: SalesWindow;
  marketing: MarketingWindow;
  breadwinnaz: StaffWindow;
  proofSales: StaffWindow;
  graphicSales: StaffWindow;
  graphicDesign: GraphicDesignWindow;
  graphicsHours: HoursWindow;
  displayStart: string;
  displayEnd: string;
}

interface DateRangeContextValue {
  selection: DateRangeSelection;
  setPreset: (key: PresetKey) => void;
  setCustom: (start: string, end: string) => void;
  windows: ResolvedWindows;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

const salesWindows = raw.salesAcrossChannels.windows as Record<PresetKey, SalesWindow>;
const marketingWindows = raw.marketingMetrics.windows as Record<PresetKey, MarketingWindow>;
const breadwinnazWindows = raw.breadwinnaz.windows as Record<PresetKey, StaffWindow>;
const proofWindows = raw.proofTeamSales.windows as Record<PresetKey, StaffWindow>;
const graphicSalesWindows = raw.graphicTeamSales.windows as Record<PresetKey, StaffWindow>;
const graphicDesignWindows = raw.graphicDesignValue.windows as Record<PresetKey, GraphicDesignWindow>;
const graphicsHoursWindows = raw.graphicsTeamHours.windows as Record<PresetKey, HoursWindow>;

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<DateRangeSelection>(DEFAULT_SELECTION);

  const windows = useMemo<ResolvedWindows>(() => {
    if (selection.kind === "preset") {
      const { key } = selection;
      return {
        sales: salesWindows[key],
        marketing: marketingWindows[key],
        breadwinnaz: breadwinnazWindows[key],
        proofSales: proofWindows[key],
        graphicSales: graphicSalesWindows[key],
        graphicDesign: graphicDesignWindows[key],
        graphicsHours: graphicsHoursWindows[key],
        displayStart: resolvePresetRange(ANCHORS.sales, key)[0],
        displayEnd: resolvePresetRange(ANCHORS.sales, key)[1],
      };
    }
    const { start, end } = selection;
    const staff = computeCustomStaffWindows(start, end);
    return {
      sales: computeCustomSalesWindow(start, end),
      marketing: computeCustomMarketingWindow(start, end),
      breadwinnaz: staff.breadwinnaz,
      proofSales: staff.proof,
      graphicSales: staff.graphic,
      graphicDesign: computeCustomGraphicDesignWindow(start, end),
      graphicsHours: computeCustomGraphicsHoursWindow(start, end),
      displayStart: start,
      displayEnd: end,
    };
  }, [selection]);

  const value: DateRangeContextValue = {
    selection,
    setPreset: (key) => setSelection({ kind: "preset", key }),
    setCustom: (start, end) => setSelection({ kind: "custom", start, end }),
    windows,
  };

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange(): DateRangeContextValue {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider");
  return ctx;
}
