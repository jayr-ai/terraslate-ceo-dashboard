import { TotalArKpi } from "../../components/shared/TotalArKpi";
import { StatTile } from "../../components/shared/StatTile";
import { AgingMixBar } from "../../components/shared/AgingMixBar";
import { totalOutstandingKpi, dsoKpi, agingMixData } from "../../data/arDashboardData";
import styles from "./HeadlineSection.module.css";

// Fix 1 (Total Outstanding AR) + Fix 4 (DSO) side by side, then Fix 3
// (aging mix bar) full-width below — all three sit above the existing 4
// aging-bucket cards/tables (AgingSection), which per the brief stay as-is.
export function HeadlineSection() {
  return (
    <div className={styles.stack}>
      <div className={styles.topRow}>
        <TotalArKpi
          label={totalOutstandingKpi.label}
          value={totalOutstandingKpi.value}
          subLabel={totalOutstandingKpi.subLabel}
          trend={totalOutstandingKpi.trend}
          trendSemantic={totalOutstandingKpi.trendSemantic}
        />
        <StatTile
          label={dsoKpi.label}
          value={dsoKpi.value}
          trend={dsoKpi.trend}
          trendSemantic={dsoKpi.trendSemantic}
          trendCaption={dsoKpi.trendCaption}
          empty={dsoKpi.empty}
        />
      </div>
      <AgingMixBar segments={agingMixData} />
    </div>
  );
}
