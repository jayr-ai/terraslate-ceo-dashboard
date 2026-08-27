import type { StatTileDatum, Source } from "../../data/ceoDashboardMockData";
import { StatTile } from "./StatTile";
import { Section } from "./Section";
import grid from "./Grid.module.css";

export function StatTileGrid({
  title,
  source,
  tiles,
}: {
  title: string;
  source: Source;
  tiles: StatTileDatum[];
}) {
  return (
    <Section title={title} source={source}>
      <div className={grid.statGrid1x4}>
        {tiles.map((tile) => (
          <StatTile
            key={tile.id}
            label={tile.label}
            value={tile.value}
            trend={tile.trend}
            empty={tile.empty}
          />
        ))}
      </div>
    </Section>
  );
}
