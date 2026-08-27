import { PieChart, Pie, Cell, Tooltip } from "recharts";
import styles from "./DonutChart.module.css";

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

export function DonutChart({
  data,
}: {
  data: { id: string; label: string; pct: number }[];
}) {
  return (
    <div className={styles.wrap}>
      <PieChart width={104} height={104}>
        <Pie
          data={data}
          dataKey="pct"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={30}
          outerRadius={48}
          paddingAngle={2}
          stroke="var(--surface-card)"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((entry, i) => (
            <Cell key={entry.id} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid var(--border-hairline-strong)",
            background: "var(--surface-card)",
            color: "var(--text-primary)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
          }}
          itemStyle={{ color: "var(--text-primary)" }}
          labelStyle={{ color: "var(--text-secondary)" }}
        />
      </PieChart>
      <ul className={styles.legend}>
        {data.map((entry, i) => (
          <li key={entry.id} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: COLORS[i % COLORS.length] }} />
            <span className={styles.legendLabel}>{entry.label}</span>
            <span className={`${styles.legendValue} tabular-nums`}>{entry.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
