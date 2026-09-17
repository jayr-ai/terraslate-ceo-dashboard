import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { Trend } from "../../data/ceoDashboardMockData";
import styles from "./TrendIndicator.module.css";

// `semantic` overrides the color only (direction still picks the arrow) —
// for contexts where up/down isn't meaning-neutral, e.g. AR aging: a rising
// 31-60/61-90/90+ balance is a bad signal, not a "positive change" gold
// badge. Omit it to keep every other dashboard's existing up=gold/down=red
// styling exactly as-is.
export function TrendIndicator({ trend, semantic }: { trend: Trend; semantic?: "bad" | "good" | "neutral" }) {
  if (trend.direction === "na" || semantic === "neutral") {
    return (
      <span className={`${styles.pill} ${styles.na}`}>
        <Minus size={12} strokeWidth={2.5} aria-hidden="true" />
        {trend.direction === "na" ? "N/A" : `${Math.abs(trend.changePct).toFixed(1)}%`}
      </span>
    );
  }

  const isUp = trend.direction === "up";
  const Icon = isUp ? ArrowUp : ArrowDown;
  const pct = Math.abs(trend.changePct).toFixed(1);
  const colorClass = semantic ? styles[semantic] : isUp ? styles.up : styles.down;

  return (
    <span className={`${styles.pill} ${colorClass}`} aria-label={`${isUp ? "Up" : "Down"} ${pct}%`}>
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {pct}%
    </span>
  );
}
