import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";

const TOTAL_COLOR = "var(--glow-blue)";
const INCALL_COLOR = "var(--series-3)";

export interface DualLineChartPoint {
  date: string;
  total: number;
  inCall: number;
}

export function DualLineChart({ data, height = 220 }: { data: DualLineChartPoint[]; height?: number }) {
  const uid = `${data.length}-${data[0]?.date ?? ""}`;
  const glowId = `dual-line-glow-${uid}`;

  return (
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
            yAxisId="total"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border-hairline-strong)" }}
            tickLine={false}
            tickFormatter={formatAxisValue}
            width={44}
          />
          <YAxis
            yAxisId="inCall"
            orientation="right"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--border-hairline-strong)" }}
            tickLine={false}
            tickFormatter={formatAxisValue}
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
            yAxisId="total"
            type="monotone"
            dataKey="total"
            name="duration (total)"
            stroke={TOTAL_COLOR}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            style={{ filter: `url(#${glowId})` }}
          />
          <Line
            yAxisId="inCall"
            type="monotone"
            dataKey="inCall"
            name="duration (in call)"
            stroke={INCALL_COLOR}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            style={{ filter: `url(#${glowId})` }}
          />
        </LineChart>
      </ResponsiveContainer>
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
