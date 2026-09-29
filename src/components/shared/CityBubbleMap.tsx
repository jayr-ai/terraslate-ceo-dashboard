import { useRef, useState, type MouseEvent } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import type { CityMapPoint } from "../../lib/shippingDateRange";
import styles from "./CityBubbleMap.module.css";

// Same public topology CDN as UsChoropleth — geometry only, no business
// data. White-basemap style matching WorldChoropleth, since this is meant
// to read as the same visual family (and matches the source report).
const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const RAMP = ["#dbeef9", "#c3e2f4", "#a4d3ec", "#82c0e0", "#5ea8d3", "#3f8fc4", "#2874ae", "#155a90"];
const MIN_RADIUS = 2.5;
const MAX_RADIUS = 13;

function scaleFor(value: number, max: number): number {
  return max > 0 ? Math.sqrt(value / max) : 0;
}

function colorFor(t: number): string {
  const idx = Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1)));
  return RAMP[idx];
}

function radiusFor(t: number): number {
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

export function CityBubbleMap({ points, valueLabel = "shipments" }: { points: CityMapPoint[]; valueLabel?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ label: string; value: number; x: number; y: number } | null>(null);

  const max = Math.max(0, ...points.map((p) => p.count));
  const min = points.length ? Math.min(...points.map((p) => p.count)) : 0;

  function updateHover(p: CityMapPoint, e: MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const label = p.state ? `${p.city}, ${p.state}` : p.city;
    setHover({ label, value: p.count, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div className={styles.wrap} ref={wrapRef} onMouseLeave={() => setHover(null)}>
      <ComposableMap projection="geoAlbersUsa" width={520} height={320} className={styles.svg}>
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => <Geography key={geo.rsmKey} geography={geo} className={styles.state} style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }} />)
          }
        </Geographies>
        {points.map((p, i) => {
          const t = scaleFor(p.count, max);
          return (
            <Marker key={`${p.lat},${p.lng},${i}`} coordinates={[p.lng, p.lat]}>
              <circle
                r={radiusFor(t)}
                fill={colorFor(t)}
                fillOpacity={0.85}
                className={styles.bubble}
                onMouseEnter={(e) => updateHover(p, e)}
                onMouseMove={(e) => updateHover(p, e)}
                onMouseLeave={() => setHover(null)}
              />
            </Marker>
          );
        })}
      </ComposableMap>
      {hover && (
        <div className={styles.tooltip} style={{ left: hover.x, top: hover.y }}>
          <strong>{hover.label}</strong>
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
