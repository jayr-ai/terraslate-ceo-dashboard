import { TrioSection } from "../sections/googleAds/TrioSection";
import { TopCampaignsSection } from "../sections/googleAds/TopCampaignsSection";
import { useGoogleAdsDateRange } from "../data/GoogleAdsDateRangeContext";
import grid from "../components/shared/Grid.module.css";
import styles from "./GoogleAdsDashboard.module.css";

export function GoogleAdsDashboard() {
  const { windows } = useGoogleAdsDateRange();

  return (
    <div className={styles.stack}>
      <div className={grid.tableGrid3}>
        {windows.summary.trios.map((trio) => (
          <TrioSection key={trio.id} trio={trio} dailyChart={windows.dailyChart} />
        ))}
      </div>
      <TopCampaignsSection />
    </div>
  );
}
