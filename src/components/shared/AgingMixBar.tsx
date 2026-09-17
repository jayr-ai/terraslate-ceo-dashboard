import styles from "./AgingMixBar.module.css";

export interface AgingMixSegment {
  key: string;
  label: string;
  pct: number;
}

// Left-to-right gradient from "healthy" to "risk", per the brief's Fix 3 —
// a single 100%-stacked bar showing the aging mix as a % of Total AR, not
// per-bucket absolute dollars (those already live in the 8 tiles below).
const SEGMENT_COLOR: Record<string, string> = {
  last30: "#3b82f6",
  d31to60: "#f59e0b",
  d61to90: "#f97316",
  d90plus: "#dc2626",
};

export function AgingMixBar({ segments }: { segments: AgingMixSegment[] }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        {segments.map(
          (s) =>
            s.pct > 0 && (
              <div
                key={s.key}
                className={styles.segment}
                style={{ width: `${s.pct}%`, background: SEGMENT_COLOR[s.key] }}
                title={`${s.label}: ${s.pct}%`}
              >
                {s.pct >= 6 && <span className={styles.segmentLabel}>{s.pct}%</span>}
              </div>
            ),
        )}
      </div>
      <div className={styles.legend}>
        {segments.map((s) => (
          <span key={s.key} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: SEGMENT_COLOR[s.key] }} aria-hidden="true" />
            {s.label} ({s.pct}%)
          </span>
        ))}
      </div>
    </div>
  );
}
