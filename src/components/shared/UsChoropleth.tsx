import { useRef, useState, type MouseEvent } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import styles from "./UsChoropleth.module.css";

// Public topology CDN, standard for react-simple-maps — geometry only, no
// business data. properties.name matches full US state names (e.g.
// "California"), same shape as the sheet's cleaned "Shipping region" values.
const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// Sequential single-hue ramp, low → high (dataviz reference palette, blue
// ramp). sqrt-scaled so one dominant state doesn't wash out the rest.
const RAMP = ["#12244a", "#173769", "#1c4a8c", "#2064b8", "#2a78d6", "#3987e5", "#5ea8f2", "#8ec4f7"];

function colorFor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "var(--surface-hover)";
  const t = Math.sqrt(value / max);
  const idx = Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1)));
  return RAMP[idx];
}

export function UsChoropleth({ data }: { data: Record<string, number> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ name: string; value: number; x: number; y: number } | null>(null);
  const max = Math.max(0, ...Object.values(data));

  function updateHover(name: string, value: number, e: MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ name, value, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div className={styles.wrap} ref={wrapRef} onMouseLeave={() => setHover(null)}>
      <ComposableMap projection="geoAlbersUsa" width={520} height={320} className={styles.svg}>
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const name: string = geo.properties.name;
              const value = data[name] ?? 0;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  className={styles.state}
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
        <div
          className={styles.tooltip}
          style={{ left: hover.x, top: hover.y }}
        >
          <strong>{hover.name}</strong>
          <span>{hover.value.toLocaleString("en-US")} orders</span>
        </div>
      )}
      <div className={styles.legend}>
        <span>Fewer</span>
        <div className={styles.legendRamp}>
          {RAMP.map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
