import { StatTileGrid } from "../components/shared/StatTileGrid";
import { useDateRange } from "../data/DateRangeContext";
import { buildTerraSlateTrackerTiles, terraSlateTrackerSource } from "../data/ceoDashboardData";

export function TerraSlateTracker() {
  const { windows } = useDateRange();
  const tiles = buildTerraSlateTrackerTiles(windows.terraSlateTracker);
  return <StatTileGrid title="TerraSlate Tracker" source={terraSlateTrackerSource} tiles={tiles} />;
}
