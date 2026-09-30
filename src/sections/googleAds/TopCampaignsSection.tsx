import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { googleAdsTopCampaigns, googleAdsTopCampaignsTotalCount } from "../../data/googleAdsMockData";
import type { Source } from "../../data/ceoDashboardMockData";

const source: Source = { label: "Google Ads — TerraSlate Ads Account (example data, not yet live)", confirmed: false };

export function TopCampaignsSection() {
  return (
    <Section title="Top Campaigns" source={source}>
      <HeatmapDataTable
        table={{
          id: "google-ads-top-campaigns",
          title: "Top Campaigns",
          caption: `by CTR, Avg. CPC, and Cost / Conv. — showing ${googleAdsTopCampaigns.length} of ${googleAdsTopCampaignsTotalCount} campaigns from the reference report (rest not guessed at)`,
          columns: [
            { key: "campaign", label: "Campaign", align: "left", truncate: true },
            { key: "ctr", label: "CTR", align: "right", format: "percent", sortable: true },
            { key: "avgCpc", label: "Avg. CPC", align: "right", format: "currency", sortable: true },
            { key: "costPerConv", label: "Cost / Conv.", align: "right", format: "currency", sortable: true },
          ],
          rows: googleAdsTopCampaigns.map((r) => ({ ...r })),
          source,
          defaultSortKey: "ctr",
          defaultSortDir: "desc",
        }}
      />
    </Section>
  );
}
