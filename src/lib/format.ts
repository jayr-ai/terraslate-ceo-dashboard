import type { ColumnFormat } from "../data/ceoDashboardMockData";

export function formatCellValue(value: string | number, format?: ColumnFormat): string {
  if (typeof value === "string") return value;
  switch (format) {
    case "currency":
      // Whole dollars, no cents (JV, 2026-10-08) — this formatter backs
      // DataTable, which on this app is used exclusively by CEO Dashboard
      // sections (Account Managers / Proof Team / Graphic Team, Shipping
      // By State, Pre-Press, Traffic), so this is safe to change here
      // rather than needing a new opt-in variant.
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    case "percent":
      return `${value.toFixed(2)}%`;
    case "number":
      return value.toLocaleString("en-US");
    default:
      return String(value);
  }
}
