import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { DualLineChart } from "../../components/shared/DualLineChart";
import { Section } from "../../components/shared/Section";
import grid from "../../components/shared/Grid.module.css";
import { useAircallDateRange } from "../../data/AircallDateRangeContext";
import {
  buildInboundCallsTable,
  buildOutboundCallsTable,
  buildTotalCallsTable,
  buildInboundChartData,
  buildOutboundChartData,
  buildTotalChartData,
} from "../../data/aircallDashboardData";
import styles from "./CallsDurationSection.module.css";

export function CallsDurationSection() {
  const { windows } = useAircallDateRange();
  const inboundTable = buildInboundCallsTable(windows.calls);
  const outboundTable = buildOutboundCallsTable(windows.calls);
  const totalTable = buildTotalCallsTable(windows.calls);
  const inboundChart = buildInboundChartData(windows.chart);
  const outboundChart = buildOutboundChartData(windows.chart);
  const totalChart = buildTotalChartData(windows.chart);

  return (
    <Section title="Call Duration">
      <div className={grid.tableGrid3}>
        <HeatmapDataTable table={inboundTable} />
        <HeatmapDataTable table={outboundTable} />
        <HeatmapDataTable table={totalTable} />
      </div>
      <div className={`${grid.tableGrid3} ${styles.chartRow}`}>
        <div className={styles.chartCard}>
          <DualLineChart data={inboundChart} />
        </div>
        <div className={styles.chartCard}>
          <DualLineChart data={outboundChart} />
        </div>
        <div className={styles.chartCard}>
          <DualLineChart data={totalChart} />
        </div>
      </div>
    </Section>
  );
}
