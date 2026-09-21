import { Section } from "../../components/shared/Section";
import { HorizontalBarChart } from "../../components/shared/HorizontalBarChart";
import { useFacebookAdsDateRange } from "../../data/FacebookAdsDateRangeContext";
import { buildTopCampaignBars, fbSource } from "../../data/facebookAdsData";
import styles from "./TopCampaignsSection.module.css";

function fmtMoney(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Addition beyond the brief (per its own "think of other improvements"
// invitation) — the Daily/Monthly rollups aggregate away which specific
// campaigns are driving spend or losing money. Bars in red have ROAS < 1
// (spending more than they earn back).
export function TopCampaignsSection() {
  const { windows } = useFacebookAdsDateRange();
  const bars = buildTopCampaignBars(windows.topCampaigns.rows);

  return (
    <Section title="Top 10 Campaigns by Spend" source={fbSource}>
      <div className={styles.card}>
        <HorizontalBarChart data={bars} valueFormatter={fmtMoney} />
      </div>
    </Section>
  );
}
