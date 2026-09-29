// Adapter — reads scripts/fetch_paper_catalog.py's output
// (paperCatalogData.json) and reshapes it into the HeatmapDataTable the
// page renders. No date-range/carrier context needed: the source sheet is
// itself a fixed rolling 7-week pivot, not a per-transaction feed.

import raw from "./paperCatalogData.json";
import type { Source } from "./ceoDashboardMockData";
import type { HeatmapTableData } from "../components/shared/HeatmapDataTable";

export const paperCatalogSource: Source = { label: "Paper Catalog — dashboard tab", confirmed: true };

interface RawWeek {
  label: string;
  dateRange: string;
}
interface RawRow {
  name: string;
  weeklyCounts: number[];
  weeklyPcts: (number | null)[];
  goalPct: number;
}
interface RawData {
  generatedAt: string;
  weeks: RawWeek[];
  rows: RawRow[];
  totals: { weeklyCounts: number[]; weeklyPcts: number[] };
}

const data = raw as RawData;

function shortWeekLabel(label: string): string {
  // "2026 | Week 40" -> "Wk 40"
  const m = label.match(/Week (\d+)/);
  return m ? `Wk ${m[1]}` : label;
}

export function buildPaperCatalogTable(): HeatmapTableData {
  const columns: HeatmapTableData["columns"] = [
    { key: "name", label: "Paper Catalogue Name", align: "left", truncate: true },
    { key: "goalPct", label: "Goal % (Last 7-Week Avg)", align: "right", format: "percent", sortable: true },
  ];

  data.weeks.forEach((w, i) => {
    const short = shortWeekLabel(w.label);
    columns.push({ key: `count_${i}`, label: `${short} Qty`, align: "right", format: "number" });
    columns.push({ key: `pct_${i}`, label: `${short} %`, align: "right", format: "percent", heat: "green", sortable: true });
  });

  const rows = data.rows.map((r) => {
    const row: Record<string, string | number | null> = { name: r.name, goalPct: r.goalPct };
    data.weeks.forEach((_, i) => {
      row[`count_${i}`] = r.weeklyCounts[i];
      row[`pct_${i}`] = r.weeklyPcts[i];
    });
    return row;
  });

  const grandTotalRow: Record<string, string | number | null> = { name: "TOTAL", goalPct: 100 };
  data.weeks.forEach((_, i) => {
    grandTotalRow[`count_${i}`] = data.totals.weeklyCounts[i];
    grandTotalRow[`pct_${i}`] = data.totals.weeklyPcts[i];
  });

  return {
    id: "paper-catalog-usage",
    title: "Paper Catalogue Report",
    caption: "Ranked by Goal % (live rolling 7-week average) — the reference sheet's own row order follows an unrelated, manually-maintained lifetime-copies list instead, which had visibly stale/duplicate entries.",
    columns,
    rows,
    grandTotalRow,
    source: paperCatalogSource,
    defaultSortKey: "goalPct",
    defaultSortDir: "desc",
  };
}
