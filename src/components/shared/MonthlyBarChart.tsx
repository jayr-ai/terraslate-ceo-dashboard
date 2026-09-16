import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";

export interface MonthlyBarPoint {
  label: string;
  total: number;
}

export function MonthlyBarChart({
  data,
  seriesName,
  height = 280,
}: {
  data: MonthlyBarPoint[];
  seriesName: string;
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border-hairline)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border-hairline-strong)" }}
            tickLine={false}
          />
          <YAxis
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
            iconType="square"
            formatter={() => <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{seriesName}</span>}
          />
          <Bar dataKey="total" name={seriesName} fill="var(--blue-500)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatAxisValue(v: number): string {
  if (v >= 1000) return `${Math.round(v / 1000)}K`;
  return String(Math.round(v));
}
