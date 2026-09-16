import { StatTile } from "../../components/shared/StatTile";
import { MonthlyBarChart } from "../../components/shared/MonthlyBarChart";
import { Section } from "../../components/shared/Section";
import grid from "../../components/shared/Grid.module.css";
import { allTimeReceivableTile, monthlyChartData, arSource } from "../../data/arDashboardData";
import styles from "./MonthlyTrendSection.module.css";

export function MonthlyTrendSection() {
  return (
    <Section title="Monthly Trend" source={arSource}>
      <div className={grid.tableGrid1x3}>
        <StatTile label={allTimeReceivableTile.label} value={allTimeReceivableTile.value} hero />
        <div className={styles.chartCard}>
          <MonthlyBarChart data={monthlyChartData} seriesName="Accounts Receivable" />
        </div>
      </div>
    </Section>
  );
}
