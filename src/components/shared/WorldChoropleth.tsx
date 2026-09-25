import { useRef, useState, type MouseEvent } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import styles from "./WorldChoropleth.module.css";

// Public topology CDN, same convention as UsChoropleth. The 50m (not 110m)
// resolution is required here — the low-res 110m atlas only has 177
// countries and is missing several of our actual destinations (Guam,
// Anguilla, Sint Maarten, St-Barthélemy, U.S. Virgin Is.); 50m has 241 and
// covers every country name this dashboard's data has ever produced.
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

// White-landmass style, matching the source Looker Studio report's own
// world map (light blue sequential ramp on white land, dark ocean, plain
// numeric min/max legend) rather than UsChoropleth's dark-navy ramp.
const RAMP = ["#dbeef9", "#c3e2f4", "#a4d3ec", "#82c0e0", "#5ea8d3", "#3f8fc4", "#2874ae", "#155a90"];
const NO_DATA_FILL = "#ffffff";

function colorFor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return NO_DATA_FILL;
  const t = Math.sqrt(value / max);
  const idx = Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1)));
  return RAMP[idx];
}

export function WorldChoropleth({
  data,
  valueLabel = "shipments",
}: {
  // Keyed by the world-atlas's own country names (see shippingData.ts's
  // COUNTRY_NAME_TO_ATLAS for the mapping from this dashboard's source
  // names, e.g. "USA" -> "United States of America").
  data: Record<string, number>;
  valueLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ name: string; value: number; x: number; y: number } | null>(null);

  const values = Object.values(data).filter((v) => v > 0);
  const max = Math.max(0, ...values);
  const min = values.length ? Math.min(...values) : 0;

  function updateHover(name: string, value: number, e: MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ name, value, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div className={styles.wrap} ref={wrapRef} onMouseLeave={() => setHover(null)}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 98 }}
        width={520}
        height={300}
        className={styles.svg}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const name: string = geo.properties.name;
              const value = data[name] ?? 0;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  className={styles.country}
                  fill={colorFor(value, max)}
                  onMouseEnter={(e) => updateHover(name, value, e)}
                  onMouseMove={(e) => updateHover(name, value, e)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    default: { outline: "none", transition: "fill 150ms ease" },
                    hover: { outline: "none", fill: "var(--blue-500)", cursor: "pointer" },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      {hover && (
        <div className={styles.tooltip} style={{ left: hover.x, top: hover.y }}>
          <strong>{hover.name}</strong>
          <span>
            {hover.value.toLocaleString("en-US")} {valueLabel}
          </span>
        </div>
      )}
      {max > 0 && (
        <div className={styles.legend}>
          <span className={styles.legendValue}>{min.toLocaleString("en-US")}</span>
          <div className={styles.legendRamp} style={{ background: `linear-gradient(90deg, ${RAMP.join(", ")})` }} />
          <span className={styles.legendValue}>{max.toLocaleString("en-US")}</span>
        </div>
      )}
    </div>
  );
}
