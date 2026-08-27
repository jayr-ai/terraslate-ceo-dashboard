import { Section } from "../components/shared/Section";
import { DataTable } from "../components/shared/DataTable";
import grid from "../components/shared/Grid.module.css";
import { prePressAllTimeTable, prePressTodayYesterdayTable } from "../data/ceoDashboardData";

export function PrePress() {
  return (
    <Section title="Pre-Press">
      <div className={grid.tableGrid2}>
        <DataTable table={prePressAllTimeTable} />
        <DataTable table={prePressTodayYesterdayTable} />
      </div>
    </Section>
  );
}
