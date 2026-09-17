import { StatTile } from "../../components/shared/StatTile";
import { AgingMixBar } from "../../components/shared/AgingMixBar";
import grid from "../../components/shared/Grid.module.css";
import { totalOutstandingKpi, totalUnpaidOrdersKpi, dsoKpi, agingMixData } from "../../data/arDashboardData";
import styles from "./HeadlineSection.module.css";

// Fix 1 (Total Outstanding AR + Total Unpaid Orders) + Fix 4 (DSO) as 3
// equal-weight tiles in one row — 2 tiles alone looked oversized/unbalanced,
// per JV — then Fix 3 (aging mix bar) full-width below. All three sit above
// the existing 4 aging-bucket cards/tables (AgingSection), which stay as-is.
export function HeadlineSection() {
  return (
    <div className={styles.stack}>
      <div className={grid.tableGrid3}>
        {[totalOutstandingKpi, totalUnpaidOrdersKpi, dsoKpi].map((kpi) => (
          <StatTile
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            trend={kpi.trend}
            trendSemantic={kpi.trendSemantic}
            trendCaption={kpi.trendCaption}
            empty={kpi.empty}
          />
        ))}
      </div>
      <AgingMixBar segments={agingMixData} />
    </div>
  );
}
