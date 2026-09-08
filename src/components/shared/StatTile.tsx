import type { Source, Trend } from "../../data/ceoDashboardMockData";
import { useGlowOnScroll } from "../../hooks/useGlowOnScroll";
import { TrendIndicator } from "./TrendIndicator";
import { Sparkline } from "./Sparkline";
import styles from "./StatTile.module.css";

export function StatTile({
  label,
  value,
  trend,
  sparkline,
  empty,
  hero,
  source,
}: {
  label: string;
  value: string;
  trend?: Trend | null;
  sparkline?: number[];
  empty?: boolean;
  hero?: boolean;
  source?: Source;
}) {
  const glowRef = useGlowOnScroll<HTMLDivElement>();
  return (
    <div ref={glowRef} className={`${styles.tile} ${hero ? styles.hero : ""} ${empty ? styles.empty : ""}`}>
      <div className={styles.topRow}>
        <span className={styles.label}>{label}</span>
        {!empty && trend && <TrendIndicator trend={trend} />}
      </div>
      <div className={`${styles.value} tabular-nums`}>{value}</div>
      {!empty && sparkline && (
        <div className={styles.sparklineWrap}>
          <Sparkline data={sparkline} direction={trend?.direction} />
        </div>
      )}
      {source && (
        <span className={styles.source} title={source.label}>
          {!source.confirmed && "⚠ "}
          {source.label}
        </span>
      )}
    </div>
  );
}
