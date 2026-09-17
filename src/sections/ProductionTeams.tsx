import { Section } from "../components/shared/Section";
import { HeatmapDataTable } from "../components/shared/HeatmapDataTable";
import grid from "../components/shared/Grid.module.css";
import { productionTeamTables } from "../data/ceoDashboardData";

export function ProductionTeams() {
  return (
    <Section title="Production Teams">
      <div className={grid.tableGrid3}>
        {productionTeamTables.map((table) => (
          <HeatmapDataTable key={table.id} table={table} />
        ))}
      </div>
    </Section>
  );
}
