import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_MONTH,
  MONTHS,
  getShippingWindow,
  type Carrier,
  type MonthOption,
  type ShippingWindow,
} from "../lib/shippingDateRange";

interface ShippingDateRangeContextValue {
  month: string;
  setMonth: (key: string) => void;
  months: MonthOption[];
  carrier: Carrier;
  setCarrier: (c: Carrier) => void;
  windows: ShippingWindow;
}

const ShippingDateRangeContext = createContext<ShippingDateRangeContextValue | null>(null);

export function ShippingDateRangeProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<string>(DEFAULT_MONTH);
  const [carrier, setCarrier] = useState<Carrier>("All");

  const windows = useMemo(() => getShippingWindow(month, carrier), [month, carrier]);

  const value: ShippingDateRangeContextValue = {
    month,
    setMonth,
    months: MONTHS,
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
