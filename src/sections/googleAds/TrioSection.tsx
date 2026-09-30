import { StatTile } from "../../components/shared/StatTile";
import { EmptyState } from "../../components/shared/EmptyState";
import type { GoogleAdsTrio } from "../../data/googleAdsMockData";
import grid from "../../components/shared/Grid.module.css";
import styles from "./TrioSection.module.css";

export function TrioSection({ trio }: { trio: GoogleAdsTrio }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{trio.title}</h3>
      <p className={styles.subtitle}>{trio.subtitle}</p>
      <div className={grid.statGrid1x3}>
        {trio.stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} trend={s.trend} />
        ))}
      </div>
      <div className={styles.chartSlot}>
        <EmptyState message="Live trend pending" detail={trio.chartUnavailableDetail} height={180} />
      </div>
    </div>
  );
}
