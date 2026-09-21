import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { useFacebookAdsDateRange } from "../../data/FacebookAdsDateRangeContext";
import { buildDailyCampaignTable } from "../../data/facebookAdsData";

export function DailyCampaignSection() {
  const { windows } = useFacebookAdsDateRange();
  const table = buildDailyCampaignTable(windows.dailyTable);

  return (
    <Section title="Daily Campaign Summary">
      <HeatmapDataTable table={table} />
    </Section>
  );
}
