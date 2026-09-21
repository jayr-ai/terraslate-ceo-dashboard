import { StatTile } from "../../components/shared/StatTile";
import { NarrativeCallout } from "../../components/shared/NarrativeCallout";
import { Section } from "../../components/shared/Section";
import grid from "../../components/shared/Grid.module.css";
import { useFacebookAdsDateRange } from "../../data/FacebookAdsDateRangeContext";
import { buildSpendKpis, buildFunnelKpis } from "../../data/facebookAdsData";
import styles from "./ExecutiveSummarySection.module.css";

export function ExecutiveSummarySection() {
  const { windows } = useFacebookAdsDateRange();
  const spendKpis = buildSpendKpis(windows.summary);
  const funnelKpis = buildFunnelKpis(windows.summary);

  return (
    <Section title="Executive Summary">
      <div className={styles.stack}>
        <NarrativeCallout text={windows.summary.narrative} />
        <div className={grid.statGrid1x5}>
          {spendKpis.map((kpi) => (
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
        <div className={grid.statGrid1x5}>
          {funnelKpis.map((kpi) => (
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
