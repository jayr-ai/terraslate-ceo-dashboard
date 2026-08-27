import { AreaChart, Area, ResponsiveContainer } from "recharts";
import type { TrendDirection } from "../../data/ceoDashboardMockData";

// Line color is always the luminous brand blue — trend direction is already
// carried by the TrendIndicator pill next to it, so the line itself stays
// consistent rather than re-encoding up/down in a second place.
const LINE_COLOR = "var(--glow-blue)";

export function Sparkline({
  data,
  direction = "na",
  height = 36,
}: {
  data: number[];
  direction?: TrendDirection;
  height?: number;
}) {
  const color = LINE_COLOR;
  const chartData = data.map((v, i) => ({ i, v }));
  const uid = `${direction}-${data.length}-${data[0]}`;
  const gradientId = `spark-fill-${uid}`;
  const glowId = `spark-glow-${uid}`;

  return (
    <div style={{ width: "100%", height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 1, bottom: 1, left: 1 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <filter id={glowId} x="-30%" y="-80%" width="160%" height="280%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Luminous glow pass — blurred, thin, behind the crisp line */}
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={0.8}
            fill="none"
            isAnimationActive={false}
            style={{ filter: `url(#${glowId})` }}
          />
          {/* Crisp core line + soft fill, on top */}
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
