import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import styles from "./DualLineChart.module.css";

const TOTAL_COLOR = "var(--glow-blue)";
const INCALL_COLOR = "var(--series-3)";

export interface DualLineChartPoint {
  date: string;
  // Index signature rather than `total`/`inCall` directly so callers can
  // plot any two numeric fields via the `series` prop below — AirCall (the
  // original/default caller) still just uses `total`/`inCall`.
  [key: string]: string | number;
}

export interface DualLineSeriesConfig {
  key: string;
  name: string;
  color: string;
  yAxisId: string;
  // Axis tick formatter for this series' own Y axis — defaults to the
  // K-suffix numeric formatter below if omitted.
  formatAxisTick?: (v: number) => string;
}

const DEFAULT_SERIES: DualLineSeriesConfig[] = [
  { key: "total", name: "duration (total)", color: TOTAL_COLOR, yAxisId: "total" },
  { key: "inCall", name: "duration (in call)", color: INCALL_COLOR, yAxisId: "inCall" },
];

export function DualLineChart({
  data,
  height = 220,
  title,
  yAxisUnit,
  series = DEFAULT_SERIES,
}: {
  data: DualLineChartPoint[];
  height?: number;
  title?: string;
  // Small muted caption next to the title clarifying what the Y-axis scale
  // means, e.g. "seconds" — the axis ticks alone (e.g. "18K") are ambiguous.
  yAxisUnit?: string;
  // Exactly 2 series expected (one per Y axis, left/right) — defaults to
  // AirCall's original total/inCall duration pair.
  series?: DualLineSeriesConfig[];
}) {
  const uid = `${data.length}-${data[0]?.date ?? ""}`;
  const glowId = `dual-line-glow-${uid}`;
  const [seriesA, seriesB] = series;

  return (
    <div>
      {title && (
        <div className={styles.header}>
          <h4 className={styles.title}>{title}</h4>
          {yAxisUnit && <span className={styles.unit}>Y-axis: {yAxisUnit}</span>}
        </div>
      )}
      <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <filter id={glowId} x="-20%" y="-80%" width="140%" height="280%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid stroke="var(--border-hairline)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickFormatter={formatTick}
            axisLine={{ stroke: "var(--border-hairline-strong)" }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            yAxisId={seriesA.yAxisId}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border-hairline-strong)" }}
            tickLine={false}
            tickFormatter={seriesA.formatAxisTick ?? formatAxisValue}
            width={44}
          />
          <YAxis
            yAxisId={seriesB.yAxisId}
            orientation="right"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border-hairline-strong)" }}
            tickLine={false}
            tickFormatter={seriesB.formatAxisTick ?? formatAxisValue}
            width={44}
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={28}
            iconType="plainline"
            formatter={(value) => <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{value}</span>}
          />
          <Line
            yAxisId={seriesA.yAxisId}
            type="monotone"
            dataKey={seriesA.key}
            name={seriesA.name}
            stroke={seriesA.color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            style={{ filter: `url(#${glowId})` }}
          />
          <Line
            yAxisId={seriesB.yAxisId}
            type="monotone"
            dataKey={seriesB.key}
            name={seriesB.name}
            stroke={seriesB.color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            style={{ filter: `url(#${glowId})` }}
          />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatTick(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }).replace(" ", "");
}

function formatAxisValue(v: number): string {
  if (v >= 1000) return `${Math.round(v / 1000)}K`;
  return String(Math.round(v));
}
