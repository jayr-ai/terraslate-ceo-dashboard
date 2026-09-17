import { NarrativeCallout } from "../components/shared/NarrativeCallout";
import { HeadlineSection } from "../sections/ar/HeadlineSection";
import { AgingSection } from "../sections/ar/AgingSection";
import { MonthlyTrendSection } from "../sections/ar/MonthlyTrendSection";
import { arNarrative } from "../data/arDashboardData";
import styles from "./AccountsReceivable.module.css";

export function AccountsReceivable() {
  return (
    <div className={styles.stack}>
      <NarrativeCallout text={arNarrative} />
      <HeadlineSection />
      <AgingSection />
      <MonthlyTrendSection />
    </div>
  );
}
