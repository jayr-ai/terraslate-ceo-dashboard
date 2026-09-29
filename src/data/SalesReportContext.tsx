import { createContext, useContext, useState, type ReactNode } from "react";
import { DEFAULT_YEAR } from "../lib/salesReportData";

interface SalesReportContextValue {
  year: number;
  setYear: (y: number) => void;
}

const SalesReportContext = createContext<SalesReportContextValue | null>(null);

export function SalesReportProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState<number>(DEFAULT_YEAR);
  return <SalesReportContext.Provider value={{ year, setYear }}>{children}</SalesReportContext.Provider>;
}

export function useSalesReport(): SalesReportContextValue {
  const ctx = useContext(SalesReportContext);
  if (!ctx) throw new Error("useSalesReport must be used within SalesReportProvider");
  return ctx;
}
