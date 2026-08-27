import { StatTileGrid } from "../components/shared/StatTileGrid";
import { terraSlateTrackerTiles, terraSlateTrackerSource } from "../data/ceoDashboardData";

export function TerraSlateTracker() {
  return (
    <StatTileGrid title="TerraSlate Tracker" source={terraSlateTrackerSource} tiles={terraSlateTrackerTiles} />
  );
}
