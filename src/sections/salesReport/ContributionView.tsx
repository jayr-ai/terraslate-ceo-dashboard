import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { useSalesReport } from "../../data/SalesReportContext";
import { computeContributionTables } from "../../lib/salesReportData";
import type { Source } from "../../data/ceoDashboardMockData";
import grid from "../../components/shared/Grid.module.css";

const source: Source = { label: "Sales Team Weekly Tracker — SALES tab", confirmed: true };

export function ContributionView() {
  const { year } = useSalesReport();
  const quarters = computeContributionTables(year);

  return (
    <Section title="Sales Contribution" source={source}>
      <div className={grid.tableGrid2}>
        {quarters.map((q) => (
          <HeatmapDataTable
            key={q.quarter}
            table={{
              id: `contribution-${q.quarter}`,
              title: `${q.quarter} | Sales Contribution`,
              columns: [
                { key: "week", label: "Week", align: "left" },
                { key: "actual", label: "Actual", align: "right", format: "currency", heat: "blue" },
                { key: "draftPct", label: "Draft %", align: "right", format: "percent" },
                { key: "webPct", label: "Web site %", align: "right", format: "percent" },
                { key: "gdPct", label: "Graphic Design %", align: "right", format: "percent" },
                { key: "amznPct", label: "Amazon %", align: "right", format: "percent" },
                { key: "wmtPct", label: "Walmart %", align: "right", format: "percent" },
              ],
              rows: q.hasData
                ? q.rows.map((r) => ({ ...r }))
                : [{ week: "No data", actual: null, draftPct: null, webPct: null, gdPct: null, amznPct: null, wmtPct: null }],
              source,
            }}
          />
        ))}
      </div>
    </Section>
  );
}
