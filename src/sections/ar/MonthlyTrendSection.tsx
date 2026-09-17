import { MonthlyBarChart } from "../../components/shared/MonthlyBarChart";
import { Section } from "../../components/shared/Section";
import { monthlyChartData, arSource } from "../../data/arDashboardData";
import styles from "./MonthlyTrendSection.module.css";

export function MonthlyTrendSection() {
  return (
    <Section title="Monthly Trend" source={arSource}>
      <div className={styles.chartCard}>
        <MonthlyBarChart data={monthlyChartData} seriesName="Accounts Receivable" />
      </div>
    </Section>
  );
}
