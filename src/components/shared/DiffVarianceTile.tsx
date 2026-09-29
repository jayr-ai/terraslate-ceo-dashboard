import styles from "./DiffVarianceTile.module.css";

function fmtDiff(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return v < 0 ? `(${abs})` : abs;
}

function toneOf(v: number): "bad" | "good" | "neutral" {
  if (v < 0) return "bad";
  if (v > 0) return "good";
  return "neutral";
}

// The compound "Act vs Fcst $ / % Variance" stacked card from the
// reference report — two mini boxes in one tile slot, each colored by
// sign (red negative, green positive), matching StatTile's neighbors in
// the same KPI row.
export function DiffVarianceTile({ diff, variancePct }: { diff: number; variancePct: number | null }) {
  const diffTone = toneOf(diff);
  const varTone = variancePct == null ? "neutral" : toneOf(variancePct);
  return (
    <div className={styles.tile}>
      <div className={`${styles.box} ${styles[diffTone]}`}>
        <span className={styles.label}>Act vs Fcst $</span>
        <span className={styles.value}>{fmtDiff(diff)}</span>
      </div>
      <div className={`${styles.box} ${styles[varTone]}`}>
        <span className={styles.label}>% Variance</span>
        <span className={styles.value}>{variancePct == null ? "—" : `${variancePct.toFixed(2)}%`}</span>
      </div>
    </div>
  );
}
