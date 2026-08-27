import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { Trend } from "../../data/ceoDashboardMockData";
import styles from "./TrendIndicator.module.css";

export function TrendIndicator({ trend }: { trend: Trend }) {
  if (trend.direction === "na") {
    return (
      <span className={`${styles.pill} ${styles.na}`}>
        <Minus size={12} strokeWidth={2.5} aria-hidden="true" />
        N/A
      </span>
    );
  }

  const isUp = trend.direction === "up";
  const Icon = isUp ? ArrowUp : ArrowDown;
  const pct = Math.abs(trend.changePct).toFixed(1);

  return (
    <span
      className={`${styles.pill} ${isUp ? styles.up : styles.down}`}
      aria-label={`${isUp ? "Up" : "Down"} ${pct}%`}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {pct}%
    </span>
  );
}
