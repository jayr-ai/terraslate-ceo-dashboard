import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { monthlyTable } from "../../data/facebookAdsData";

// NOT date-range-picker-driven — always the trailing 12 months, same
// convention as the AR dashboard's Monthly Trend section.
export function MonthlyCampaignSection() {
  return (
    <Section title="Monthly Campaign Summary">
      <HeatmapDataTable table={monthlyTable} />
    </Section>
  );
}
