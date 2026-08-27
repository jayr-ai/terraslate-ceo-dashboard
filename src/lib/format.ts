import type { ColumnFormat } from "../data/ceoDashboardMockData";

export function formatCellValue(value: string | number, format?: ColumnFormat): string {
  if (typeof value === "string") return value;
  switch (format) {
    case "currency":
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case "percent":
      return `${value.toFixed(2)}%`;
    case "number":
      return value.toLocaleString("en-US");
    default:
      return String(value);
  }
}
