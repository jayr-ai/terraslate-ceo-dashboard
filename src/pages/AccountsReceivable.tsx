import { AgingSection } from "../sections/ar/AgingSection";
import { MonthlyTrendSection } from "../sections/ar/MonthlyTrendSection";
import styles from "./AccountsReceivable.module.css";

export function AccountsReceivable() {
  return (
    <div className={styles.stack}>
      <AgingSection />
      <MonthlyTrendSection />
    </div>
  );
}
