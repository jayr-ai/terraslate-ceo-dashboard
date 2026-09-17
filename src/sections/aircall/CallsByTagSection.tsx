import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { PivotHeatmapTable } from "../../components/shared/PivotHeatmapTable";
import { AlertBanner } from "../../components/shared/AlertBanner";
import { Section } from "../../components/shared/Section";
import grid from "../../components/shared/Grid.module.css";
import { useAircallDateRange } from "../../data/AircallDateRangeContext";
import { buildCallsByTagTable, buildCallsByTagByUserTable, buildTagCoverage } from "../../data/aircallDashboardData";
import styles from "./CallsByTagSection.module.css";

export function CallsByTagSection() {
  const { windows } = useAircallDateRange();
  const callsByTagTable = buildCallsByTagTable(windows.callsByTag);
  const callsByTagByUserTable = buildCallsByTagByUserTable(windows.callsByTagByUser);
  const coverage = buildTagCoverage(windows.callsByTag);
  const untaggedPct = Math.round((100 - coverage.pct) * 10) / 10;

  return (
    <Section title="Calls by Tag">
      <AlertBanner
        title={`Tag Coverage: ${coverage.pct}% (${coverage.taggedCount.toLocaleString("en-US")} of ${coverage.grandTotal.toLocaleString("en-US")} calls)`}
        text={`${untaggedPct}% of all calls have no tag applied. Tag-based reporting below reflects only tagged calls — actual category volumes may be higher than shown. Recommend a tagging compliance push if this doesn't improve.`}
      />
      <div className={`${grid.tableGrid1x2} ${styles.tablesRow}`}>
        <HeatmapDataTable table={callsByTagTable} />
        <PivotHeatmapTable table={callsByTagByUserTable} />
      </div>
    </Section>
  );
}
