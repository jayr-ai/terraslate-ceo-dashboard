import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { useGoogleAdsDateRange } from "../../data/GoogleAdsDateRangeContext";
import type { Source } from "../../data/ceoDashboardMockData";

const source: Source = { label: "Google Ads — TerraSlate Ads Account (via Adveronix extract)", confirmed: true };

export function TopCampaignsSection() {
  const { windows } = useGoogleAdsDateRange();
  const rows = windows.topCampaigns.rows;

  return (
    <Section title="Top Campaigns" source={source}>
      <HeatmapDataTable
        table={{
          id: "google-ads-top-campaigns",
          title: "Top Campaigns",
          caption: `by CTR, Avg. CPC, and Cost / Conv. — ${rows.length} campaign${rows.length === 1 ? "" : "s"} active in this period`,
          columns: [
            { key: "campaign", label: "Campaign", align: "left", truncate: true },
            { key: "ctr", label: "CTR", align: "right", format: "percent", sortable: true },
            { key: "avgCpc", label: "Avg. CPC", align: "right", format: "currency", sortable: true },
            { key: "costPerConv", label: "Cost / Conv.", align: "right", format: "currency", sortable: true },
          ],
          rows: rows.map((r) => ({ ...r })),
          source,
          defaultSortKey: "ctr",
          defaultSortDir: "desc",
        }}
      />
    </Section>
  );
}
