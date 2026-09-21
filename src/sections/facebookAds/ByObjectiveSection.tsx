import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { useFacebookAdsDateRange } from "../../data/FacebookAdsDateRangeContext";
import { buildByObjectiveTable } from "../../data/facebookAdsData";

// Addition beyond the brief — only 4 distinct Objectives exist across the
// whole dataset, small enough for a clean at-a-glance comparison of
// whether e.g. Sales campaigns actually outperform Traffic/Awareness.
export function ByObjectiveSection() {
  const { windows } = useFacebookAdsDateRange();
  const table = buildByObjectiveTable(windows.byObjective);

  return (
    <Section title="Performance by Objective">
      <HeatmapDataTable table={table} />
    </Section>
  );
}
