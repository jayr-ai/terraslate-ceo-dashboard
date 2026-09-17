import { NarrativeCallout } from "../components/shared/NarrativeCallout";
import { HeadlineSection } from "../sections/ar/HeadlineSection";
import { TopCustomersSection } from "../sections/ar/TopCustomersSection";
import { AgingSection } from "../sections/ar/AgingSection";
import { MonthlyTrendSection } from "../sections/ar/MonthlyTrendSection";
import { arNarrative } from "../data/arDashboardData";
import grid from "../components/shared/Grid.module.css";
import styles from "./AccountsReceivable.module.css";

export function AccountsReceivable() {
  return (
    <div className={styles.stack}>
      <NarrativeCallout text={arNarrative} />
      <HeadlineSection />
      <AgingSection />
      <div className={grid.tableGrid2}>
        <TopCustomersSection />
        <MonthlyTrendSection />
      </div>
    </div>
  );
}
