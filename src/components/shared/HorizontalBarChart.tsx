import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList, Tooltip, ResponsiveContainer } from "recharts";

export interface HorizontalBarDatum {
  id: string;
  label: string;
  value: number;
  flagged?: boolean;
}

const BAR_COLOR = "#3b82f6";
const FLAG_COLOR = "var(--trend-bad)";
const ROW_HEIGHT = 32;
const TICK_MAX_CHARS = 22;

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function HorizontalBarChart({
  data,
  valueFormatter = (v) => v.toLocaleString("en-US"),
  height,
}: {
  data: HorizontalBarDatum[];
  valueFormatter?: (v: number) => string;
  height?: number;
}) {
  const computedHeight = height ?? Math.max(180, data.length * ROW_HEIGHT + 20);

  return (
    <div style={{ width: "100%", height: computedHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--border-hairline)" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: "var(--text-secondary)", fontSize: 11.5 }}
            axisLine={false}
            tickLine={false}
            width={150}
            tickFormatter={(v: string) => truncate(v, TICK_MAX_CHARS)}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)" }}
            formatter={(value) => [valueFormatter(Number(value)), "Outstanding"]}
            labelFormatter={(label) => label}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid var(--border-hairline-strong)",
              background: "var(--surface-card)",
              color: "var(--text-primary)",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            }}
            itemStyle={{ color: "var(--text-primary)" }}
            labelStyle={{ color: "var(--text-secondary)", marginBottom: 2 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={16}>
            {data.map((d) => (
              <Cell key={d.id} fill={d.flagged ? FLAG_COLOR : BAR_COLOR} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: unknown) => valueFormatter(v as number)}
              fill="var(--text-primary)"
              fontSize={11.5}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
