import { AlertBanner } from "../components/shared/AlertBanner";
import { TrioSection } from "../sections/googleAds/TrioSection";
import { TopCampaignsSection } from "../sections/googleAds/TopCampaignsSection";
import { DeviceBreakdownSection } from "../sections/googleAds/DeviceBreakdownSection";
import { googleAdsTrios } from "../data/googleAdsMockData";
import grid from "../components/shared/Grid.module.css";
import styles from "./GoogleAdsDashboard.module.css";

export function GoogleAdsDashboard() {
  return (
    <div className={styles.stack}>
      <AlertBanner
        title="Not yet connected to live data"
        text="This page mirrors the native Google Ads Looker Studio report's exact layout, using the reference report's own example numbers (Sep 2-29, 2026) — not fabricated. Live data is blocked on Google's own Basic Access approval for the AZ Digital PH developer token actually taking effect on the API backend (OAuth + credentials are already confirmed working). Once that clears, this becomes a live, self-refreshing page like every other tab, with a Last 28 days (excluding today) date range and period-over-period comparison, matching the reference."
      />
      <div className={grid.tableGrid3}>
        {googleAdsTrios.map((trio) => (
          <TrioSection key={trio.id} trio={trio} />
        ))}
      </div>
      <TopCampaignsSection />
      <DeviceBreakdownSection />
    </div>
  );
}
