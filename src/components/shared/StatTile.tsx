import type { Source, Trend } from "../../data/ceoDashboardMockData";
import { useGlowOnScroll } from "../../hooks/useGlowOnScroll";
import { TrendIndicator } from "./TrendIndicator";
import { Sparkline } from "./Sparkline";
import styles from "./StatTile.module.css";

export function StatTile({
  label,
  value,
  trend,
  trendSemantic,
  trendCaption,
  sparkline,
  empty,
  hero,
  source,
  stacked,
}: {
  label: string;
  value: string;
  trend?: Trend | null;
  // See TrendIndicator — overrides the badge's color for contexts where
  // up/down isn't meaning-neutral (e.g. AR aging). Omit elsewhere.
  trendSemantic?: "bad" | "good" | "neutral";
  // Small text under the badge clarifying the comparison period, e.g.
  // "vs. prior 30 days" — optional, only rendered alongside a real trend.
  trendCaption?: string;
  sparkline?: number[];
  empty?: boolean;
  hero?: boolean;
  source?: Source;
  // Label / value / trend badge stacked as 3 rows instead of label+badge
  // sharing a row — for narrow tiles (e.g. 3-up inside an already-narrow
  // card, like Google Ads' trio KPIs) where a long label ("Conv. rate",
  // "Cost / conv.") collides with the badge at that width. Every other
  // page's StatTile usage is unaffected (defaults to the original layout).
  stacked?: boolean;
}) {
  const glowRef = useGlowOnScroll<HTMLDivElement>();
  return (
    <div ref={glowRef} className={`${styles.tile} ${hero ? styles.hero : ""} ${empty ? styles.empty : ""}`}>
      {stacked ? (
        <>
          <span className={styles.label}>{label}</span>
          <div className={`${styles.value} tabular-nums`}>{value}</div>
          {!empty && trend && (
            <div className={styles.trendRow}>
              <TrendIndicator trend={trend} semantic={trendSemantic} />
            </div>
          )}
        </>
      ) : (
        <>
          <div className={styles.topRow}>
            <span className={styles.label}>{label}</span>
            {!empty && trend && <TrendIndicator trend={trend} semantic={trendSemantic} />}
          </div>
          <div className={`${styles.value} tabular-nums`}>{value}</div>
        </>
      )}
      {!empty && trend && trendCaption && <span className={styles.trendCaption}>{trendCaption}</span>}
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
