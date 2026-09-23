import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { useFacebookAdsDateRange } from "../../data/FacebookAdsDateRangeContext";
import { buildByObjectiveTable } from "../../data/facebookAdsData";
import styles from "./ByObjectiveSection.module.css";

// Addition beyond the brief — only 4 distinct Objectives exist across the
// whole dataset, small enough for a clean at-a-glance comparison of
// whether e.g. Sales campaigns actually outperform Traffic/Awareness.
export function ByObjectiveSection() {
  const { windows } = useFacebookAdsDateRange();
  const table = buildByObjectiveTable(windows.byObjective);

  return (
    <Section title="Performance by Objective">
      {/* HeatmapDataTable's own card is height:100% — this wrapper gives it
          a definite, growable height to fill (flex:1) so it always matches
          Top Campaigns' height, same row. See TopCampaignsSection.module.css
          for the mirrored fix on the other side of this row. */}
      <div className={styles.fill}>
        <HeatmapDataTable table={table} />
      </div>
    </Section>
  );
}
