import type { Trend } from "../../data/ceoDashboardMockData";
import { useGlowOnScroll } from "../../hooks/useGlowOnScroll";
import { TrendIndicator } from "./TrendIndicator";
import styles from "./TotalArKpi.module.css";

// A dedicated (not StatTile) component for a single headline number — ~2x
// the value font size of a regular StatTile, plus a sub-label line, per the
// AR dashboard brief's Fix 1 ("Total Outstanding AR").
export function TotalArKpi({
  label,
  value,
  subLabel,
  trend,
  trendSemantic,
}: {
  label: string;
  value: string;
  subLabel: string;
  trend?: Trend | null;
  trendSemantic?: "bad" | "good" | "neutral";
}) {
  const glowRef = useGlowOnScroll<HTMLDivElement>();
  return (
    <div ref={glowRef} className={styles.card}>
      <div className={styles.topRow}>
        <span className={styles.label}>{label}</span>
        {trend && <TrendIndicator trend={trend} semantic={trendSemantic} />}
      </div>
      <div className={`${styles.value} tabular-nums`}>{value}</div>
      <span className={styles.subLabel}>{subLabel}</span>
    </div>
  );
}
