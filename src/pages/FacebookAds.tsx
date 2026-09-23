import { ExecutiveSummarySection } from "../sections/facebookAds/ExecutiveSummarySection";
import { TopCampaignsSection } from "../sections/facebookAds/TopCampaignsSection";
import { ByObjectiveSection } from "../sections/facebookAds/ByObjectiveSection";
import { DailyCampaignSection } from "../sections/facebookAds/DailyCampaignSection";
import { MonthlyCampaignSection } from "../sections/facebookAds/MonthlyCampaignSection";
import styles from "./FacebookAds.module.css";

export function FacebookAds() {
  return (
    <div className={styles.stack}>
      <ExecutiveSummarySection />
      <div className={styles.equalHeightRow}>
        <TopCampaignsSection />
        <ByObjectiveSection />
      </div>
      <DailyCampaignSection />
      <MonthlyCampaignSection />
    </div>
  );
}
