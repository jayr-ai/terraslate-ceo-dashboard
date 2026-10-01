import { StatTile } from "../../components/shared/StatTile";
import { DualLineChart, type DualLineSeriesConfig } from "../../components/shared/DualLineChart";
import type { GoogleAdsTrio, DailyChartPoint } from "../../lib/googleAdsDateRange";
import grid from "../../components/shared/Grid.module.css";
import styles from "./TrioSection.module.css";

const fmtK = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v)));
const fmtPctTick = (v: number) => `${v.toFixed(1)}%`;
const fmtMoneyTick = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`);

// Which 2 of DailyChartPoint's fields each trio's chart plots, mirroring
// the reference report's own per-card chart pairing.
const CHART_SERIES: Record<string, DualLineSeriesConfig[]> = {
  "ctr-impressions": [
    { key: "clicks", name: "Clicks", color: "var(--glow-blue)", yAxisId: "a", formatAxisTick: fmtK },
    { key: "ctr", name: "CTR", color: "var(--series-3)", yAxisId: "b", formatAxisTick: fmtPctTick },
  ],
  "conversion-cost": [
    { key: "conversions", name: "Conversions", color: "var(--glow-blue)", yAxisId: "a", formatAxisTick: fmtK },
    { key: "convRate", name: "Conv. rate", color: "var(--series-3)", yAxisId: "b", formatAxisTick: fmtPctTick },
  ],
  "cost-per-click": [
    { key: "cost", name: "Cost", color: "var(--glow-blue)", yAxisId: "a", formatAxisTick: fmtMoneyTick },
    { key: "avgCpc", name: "Avg. CPC", color: "var(--series-3)", yAxisId: "b", formatAxisTick: fmtMoneyTick },
  ],
};

export function TrioSection({ trio, dailyChart }: { trio: GoogleAdsTrio; dailyChart: DailyChartPoint[] }) {
  const series = CHART_SERIES[trio.id];
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
        <DualLineChart data={dailyChart} series={series} height={180} />
      </div>
    </div>
  );
}
