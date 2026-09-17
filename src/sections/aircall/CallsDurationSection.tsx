import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { DualLineChart } from "../../components/shared/DualLineChart";
import { Section } from "../../components/shared/Section";
import grid from "../../components/shared/Grid.module.css";
import { useAircallDateRange } from "../../data/AircallDateRangeContext";
import {
  buildConsolidatedCallsTable,
  buildInboundChartData,
  buildOutboundChartData,
  buildTotalChartData,
} from "../../data/aircallDashboardData";
import styles from "./CallsDurationSection.module.css";

export function CallsDurationSection() {
  const { windows } = useAircallDateRange();
  const consolidatedTable = buildConsolidatedCallsTable(windows.consolidated);
  const inboundChart = buildInboundChartData(windows.chart);
  const outboundChart = buildOutboundChartData(windows.chart);
  const totalChart = buildTotalChartData(windows.chart);

  return (
    <Section title="Call Duration">
      <HeatmapDataTable table={consolidatedTable} />
      <div className={`${grid.tableGrid3} ${styles.chartRow}`}>
        <div className={styles.chartCard}>
          <DualLineChart data={inboundChart} title="Inbound Call Duration — Daily Trend" yAxisUnit="seconds" />
        </div>
        <div className={styles.chartCard}>
          <DualLineChart data={outboundChart} title="Outbound Call Duration — Daily Trend" yAxisUnit="seconds" />
        </div>
        <div className={styles.chartCard}>
          <DualLineChart data={totalChart} title="Total Call Duration — Daily Trend" yAxisUnit="seconds" />
        </div>
      </div>
    </Section>
  );
}
