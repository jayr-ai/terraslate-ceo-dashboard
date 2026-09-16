import { Fragment } from "react";
import { StatTile } from "../../components/shared/StatTile";
import { DataTable } from "../../components/shared/DataTable";
import { Section } from "../../components/shared/Section";
import grid from "../../components/shared/Grid.module.css";
import { arBuckets, arSource } from "../../data/arDashboardData";
import styles from "./AgingSection.module.css";

export function AgingSection() {
  return (
    <Section title="Accounts Receivable Aging" source={arSource}>
      <div className={grid.statGrid1x4}>
        {arBuckets.map((b) => (
          <Fragment key={b.moneyTile.id}>
            <StatTile label={b.moneyTile.label} value={b.moneyTile.value} trend={b.moneyTile.trend} empty={b.moneyTile.empty} />
            <StatTile label={b.countTile.label} value={b.countTile.value} trend={b.countTile.trend} empty={b.countTile.empty} />
          </Fragment>
        ))}
      </div>
      <div className={`${grid.tableGrid4} ${styles.tablesRow}`}>
        {arBuckets.map((b) => (
          <DataTable key={b.table.id} table={b.table} dense />
        ))}
      </div>
    </Section>
  );
}
