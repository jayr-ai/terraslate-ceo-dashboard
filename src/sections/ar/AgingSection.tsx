import { StatTile } from "../../components/shared/StatTile";
import { DataTable } from "../../components/shared/DataTable";
import { Section } from "../../components/shared/Section";
import grid from "../../components/shared/Grid.module.css";
import { arBuckets, arSource } from "../../data/arDashboardData";
import styles from "./AgingSection.module.css";

export function AgingSection() {
  return (
    <Section title="Accounts Receivable Aging" source={arSource}>
      <div className={grid.tableGrid4}>
        {arBuckets.map((b) => (
          <div key={b.moneyTile.id} className={styles.bucketColumn}>
            <StatTile label={b.moneyTile.label} value={b.moneyTile.value} trend={b.moneyTile.trend} empty={b.moneyTile.empty} />
            <StatTile label={b.countTile.label} value={b.countTile.value} trend={b.countTile.trend} empty={b.countTile.empty} />
            <DataTable table={b.table} dense />
          </div>
        ))}
      </div>
    </Section>
  );
}
