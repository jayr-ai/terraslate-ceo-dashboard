import { StatTile } from "../components/shared/StatTile";
import { DonutChart } from "../components/shared/DonutChart";
import { Section } from "../components/shared/Section";
import grid from "../components/shared/Grid.module.css";
import { useGlowOnScroll } from "../hooks/useGlowOnScroll";
import { useDateRange } from "../data/DateRangeContext";
import { buildSalesAcrossChannels } from "../data/ceoDashboardData";
import styles from "./SalesAcrossChannels.module.css";

export function SalesAcrossChannels() {
  const donutGlowRef = useGlowOnScroll<HTMLDivElement>();
  const { windows } = useDateRange();
  const { kpis, channelMix } = buildSalesAcrossChannels(windows.sales);

  return (
    <Section title="Sales Across Channels">
      <div className={grid.kpiRow}>
        {kpis.map((kpi) => (
          <StatTile
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            trend={kpi.trend}
            sparkline={kpi.sparkline}
            empty={kpi.empty}
            hero={kpi.hero}
            source={kpi.source}
          />
        ))}
        <div className={styles.donutCard} ref={donutGlowRef}>
          <span className={styles.donutLabel}>Channel Mix</span>
          <DonutChart data={channelMix} />
        </div>
      </div>
    </Section>
  );
}
