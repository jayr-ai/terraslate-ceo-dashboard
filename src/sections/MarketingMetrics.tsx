import { StatTileGrid } from "../components/shared/StatTileGrid";
import { useDateRange } from "../data/DateRangeContext";
import { buildMarketingMetricsTiles, marketingMetricsSource } from "../data/ceoDashboardData";

export function MarketingMetrics() {
  const { windows } = useDateRange();
  const tiles = buildMarketingMetricsTiles(windows.marketing);
  return <StatTileGrid title="Marketing Metrics" source={marketingMetricsSource} tiles={tiles} />;
}
