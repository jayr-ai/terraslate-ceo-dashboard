import { Section } from "../components/shared/Section";
import { DataTable } from "../components/shared/DataTable";
import grid from "../components/shared/Grid.module.css";
import { productionTeamTables } from "../data/ceoDashboardData";

export function ProductionTeams() {
  return (
    <Section title="Production Teams">
      <div className={grid.tableGrid3}>
        {productionTeamTables.map((table) => (
          <DataTable key={table.id} table={table} />
        ))}
      </div>
    </Section>
  );
}
