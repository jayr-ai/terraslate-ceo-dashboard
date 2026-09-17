import { StatTile } from "../../components/shared/StatTile";
import { NarrativeCallout } from "../../components/shared/NarrativeCallout";
import { Section } from "../../components/shared/Section";
import grid from "../../components/shared/Grid.module.css";
import { useAircallDateRange } from "../../data/AircallDateRangeContext";
import { buildSummaryKpis } from "../../data/aircallDashboardData";
import styles from "./ExecutiveSummarySection.module.css";

// Priority 1 (brief 2026-09-17) — the one view that answers "how did we do
// this period" without cross-referencing the tables below. Narrative +
// 5 KPI cards, both driven by the same date-range picker as the rest of
// the page (see aircallDateRange.ts's computeCustomSummaryWindow for how
// custom ranges get the same period-over-period deltas as presets).
export function ExecutiveSummarySection() {
  const { windows } = useAircallDateRange();
  const kpis = buildSummaryKpis(windows.summary);

  return (
    <Section title="Executive Summary">
      <div className={styles.stack}>
        <NarrativeCallout text={windows.summary.narrative} />
        <div className={grid.statGrid1x5}>
          {kpis.map((kpi) => (
            <StatTile
              key={kpi.id}
              label={kpi.label}
              value={kpi.value}
              trend={kpi.trend}
              trendSemantic={kpi.trendSemantic}
              trendCaption={kpi.trendCaption}
              empty={kpi.empty}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
