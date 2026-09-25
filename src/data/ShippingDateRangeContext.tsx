import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import raw from "./shippingData.json";
import {
  ANCHOR,
  DEFAULT_SELECTION,
  resolvePresetRange,
  computeCustomWindow,
  type DateRangeSelection,
  type PresetKey,
  type Carrier,
  type ShippingWindow,
} from "../lib/shippingDateRange";

interface ResolvedWindows extends ShippingWindow {
  displayStart: string;
  displayEnd: string;
}

interface ShippingDateRangeContextValue {
  selection: DateRangeSelection;
  setPreset: (key: PresetKey) => void;
  setCustom: (start: string, end: string) => void;
  carrier: Carrier;
  setCarrier: (c: Carrier) => void;
  windows: ResolvedWindows;
}

const ShippingDateRangeContext = createContext<ShippingDateRangeContextValue | null>(null);

const presetWindows = raw.windows as unknown as Record<PresetKey, ShippingWindow>;

export function ShippingDateRangeProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<DateRangeSelection>(DEFAULT_SELECTION);
  const [carrier, setCarrier] = useState<Carrier>("All");

  const windows = useMemo<ResolvedWindows>(() => {
    if (selection.kind === "preset" && carrier === "All") {
      const { key } = selection;
      return {
        ...presetWindows[key],
        displayStart: resolvePresetRange(ANCHOR, key)[0],
        displayEnd: resolvePresetRange(ANCHOR, key)[1],
      };
    }
    const [start, end] =
      selection.kind === "preset" ? resolvePresetRange(ANCHOR, selection.key) : [selection.start, selection.end];
    return {
      ...computeCustomWindow(start, end, carrier),
      displayStart: start,
      displayEnd: end,
    };
  }, [selection, carrier]);

  const value: ShippingDateRangeContextValue = {
    selection,
    setPreset: (key) => setSelection({ kind: "preset", key }),
    setCustom: (start, end) => setSelection({ kind: "custom", start, end }),
    carrier,
    setCarrier,
    windows,
  };

  return <ShippingDateRangeContext.Provider value={value}>{children}</ShippingDateRangeContext.Provider>;
}

export function useShippingDateRange(): ShippingDateRangeContextValue {
  const ctx = useContext(ShippingDateRangeContext);
  if (!ctx) throw new Error("useShippingDateRange must be used within ShippingDateRangeProvider");
  return ctx;
}
