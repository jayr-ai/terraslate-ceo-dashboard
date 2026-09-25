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

export interface CategoryLegendItem {
  key: string;
  label: string;
  color: string;
}

export function UsChoropleth({
  data,
  valueLabel = "orders",
  category,
}: {
  data: Record<string, number>;
  // Label suffix in the hover tooltip, e.g. "orders" -> "1,942 orders".
  valueLabel?: string;
  // Opt-in categorical mode (e.g. AirCall/Shipping's carrier-zone map) —
  // colors each state by a discrete category instead of a value ramp.
  // `data` is still used for the tooltip's own count, just not for color.
  category?: {
    valueByState: Record<string, string>; // full state name -> category key
    colors: Record<string, string>; // category key -> fill color
    legend: CategoryLegendItem[];
  };
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ name: string; value: number; categoryLabel?: string; x: number; y: number } | null>(
    null,
  );
  const max = Math.max(0, ...Object.values(data));

  function updateHover(name: string, value: number, e: MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const categoryLabel = category
      ? category.legend.find((l) => l.key === category.valueByState[name])?.label
      : undefined;
    setHover({ name, value, categoryLabel, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function fillFor(name: string): string {
    if (category) {
      const key = category.valueByState[name];
      return key ? category.colors[key] ?? "var(--surface-hover)" : "var(--surface-hover)";
    }
    return colorFor(data[name] ?? 0, max);
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
          {hover.categoryLabel && <span>{hover.categoryLabel}</span>}
          <span>
            {hover.value.toLocaleString("en-US")} {valueLabel}
          </span>
        </div>
      )}
      {category ? (
        <div className={styles.legend}>
          {category.legend.map((item) => (
            <span key={item.key} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: item.color, display: "inline-block" }} />
              {item.label}
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.legend}>
          <span>Fewer</span>
          <div className={styles.legendRamp}>
            {RAMP.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </div>
          <span>More</span>
        </div>
      )}
    </div>
  );
}
