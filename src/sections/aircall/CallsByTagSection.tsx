import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { PivotHeatmapTable } from "../../components/shared/PivotHeatmapTable";
import { Section } from "../../components/shared/Section";
import grid from "../../components/shared/Grid.module.css";
import { useAircallDateRange } from "../../data/AircallDateRangeContext";
import { buildCallsByTagTable, buildCallsByTagByUserTable } from "../../data/aircallDashboardData";

export function CallsByTagSection() {
  const { windows } = useAircallDateRange();
  const callsByTagTable = buildCallsByTagTable(windows.callsByTag);
  const callsByTagByUserTable = buildCallsByTagByUserTable(windows.callsByTagByUser);

  return (
    <Section title="Calls by Tag">
      <div className={grid.tableGrid1x2}>
        <HeatmapDataTable table={callsByTagTable} />
        <PivotHeatmapTable table={callsByTagByUserTable} />
      </div>
    </Section>
  );
}
