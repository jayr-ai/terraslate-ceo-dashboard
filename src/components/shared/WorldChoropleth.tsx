import { useRef, useState, type MouseEvent } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import styles from "./WorldChoropleth.module.css";

// Public topology CDN, same convention as UsChoropleth. The 50m (not 110m)
// resolution is required here — the low-res 110m atlas only has 177
// countries and is missing several of our actual destinations (Guam,
// Anguilla, Sint Maarten, St-Barthélemy, U.S. Virgin Is.); 50m has 241 and
// covers every country name this dashboard's data has ever produced.
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

const US_NAME = "United States of America";

// Same sequential ramp as UsChoropleth.
const RAMP = ["#12244a", "#173769", "#1c4a8c", "#2064b8", "#2a78d6", "#3987e5", "#5ea8f2", "#8ec4f7"];
const US_COLOR = "var(--warning)";

function colorFor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "var(--surface-hover)";
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

  // USA dwarfs every other country in this data (order of magnitude+), and
  // its own state-level breakdown is already the map right above this one
  // — so it gets a fixed highlight color instead of dominating the ramp
  // and washing out every international destination to near-black.
  const maxIntl = Math.max(0, ...Object.entries(data).filter(([name]) => name !== US_NAME).map(([, v]) => v));

  function updateHover(name: string, value: number, e: MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ name, value, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function fillFor(name: string): string {
    const value = data[name] ?? 0;
    if (value <= 0) return "var(--surface-hover)";
    return name === US_NAME ? US_COLOR : colorFor(value, maxIntl);
  }

  return (
    <div className={styles.wrap} ref={wrapRef} onMouseLeave={() => setHover(null)}>
      <ComposableMap projection="geoEqualEarth" width={520} height={300} className={styles.svg}>
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
                  fill={fillFor(name)}
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
      <div className={styles.legend}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: US_COLOR, display: "inline-block" }} />
          USA
        </span>
        <span>Fewer</span>
        <div className={styles.legendRamp}>
          {RAMP.map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </div>
        <span>More (Int'l)</span>
      </div>
    </div>
  );
}
