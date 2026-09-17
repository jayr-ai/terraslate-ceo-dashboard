import { Fragment } from "react";
import { StatTile } from "../../components/shared/StatTile";
import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { arBuckets, arSource } from "../../data/arDashboardData";
import styles from "./AgingSection.module.css";

// One grid, `grid-auto-flow: column` with 3 explicit row tracks: DOM order
// stays bucket-grouped (money, count, table per bucket, repeated per
// bucket — the order mobile should read top-to-bottom), while the browser
// fills it column-first, landing each bucket in its own column on wide
// screens. Because all 4 columns share the same 3 row tracks, CSS Grid's
// track sizing equalizes every row's height across all columns natively —
// no per-column height fix needed. See AgingSection.module.css for the
// breakpoints that revert to plain row-flow once there's only 1 column.
export function AgingSection() {
  return (
    <Section title="Accounts Receivable Aging" source={arSource}>
      <div className={styles.agingGrid}>
        {arBuckets.map((b) => (
          <Fragment key={b.moneyTile.id}>
            <StatTile
              label={b.moneyTile.label}
              value={b.moneyTile.value}
              trend={b.moneyTile.trend}
              trendSemantic={b.moneyTile.trendSemantic}
              trendCaption={b.moneyTile.trendCaption}
              empty={b.moneyTile.empty}
            />
            <StatTile
              label={b.countTile.label}
              value={b.countTile.value}
              trend={b.countTile.trend}
              trendSemantic={b.countTile.trendSemantic}
              trendCaption={b.countTile.trendCaption}
              empty={b.countTile.empty}
            />
            <HeatmapDataTable table={b.table} />
          </Fragment>
        ))}
      </div>
    </Section>
  );
}
