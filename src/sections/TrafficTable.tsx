// Live from the sheet's GoogleSearch tab (verified column-for-column,
// confirmed with JV 2026-08-08). Dates are genuinely sparse there — only a
// handful of rows total — that's the real feed's update cadence, not a data
// quality issue.
import { Section } from "../components/shared/Section";
import { DataTable } from "../components/shared/DataTable";
import { trafficTable, trafficTableSource } from "../data/ceoDashboardData";

export function TrafficTable() {
  return (
    <Section title="Traffic" source={trafficTableSource}>
      <DataTable table={trafficTable} hideTitle />
    </Section>
  );
}
