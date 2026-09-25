import { Suspense, lazy } from "react";
import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { HorizontalBarChart } from "../../components/shared/HorizontalBarChart";
import { Section } from "../../components/shared/Section";
import { EmptyState } from "../../components/shared/EmptyState";
import { useShippingDateRange } from "../../data/ShippingDateRangeContext";
import { buildZoneBars, buildZoneTable, buildZoneMapCategory, shippingSource } from "../../data/shippingData";
import mapRowStyles from "./MapRow.module.css";
import styles from "./ZoneSection.module.css";

const UsChoropleth = lazy(() =>
  import("../../components/shared/UsChoropleth").then((m) => ({ default: m.UsChoropleth })),
);

// UPS/FedEx rate zones are per-shipment (distance from origin), not
// per-state — the map colors each state by its single most common zone
// in the selected window (see fetch_shipping_data.py's docstring for the
// border-state caveat, e.g. Iowa split ~51/49 between zones 4 and 5).
export function ZoneSection() {
  const { windows } = useShippingDateRange();
  const bars = buildZoneBars(windows);
  const table = buildZoneTable(windows);
  const category = buildZoneMapCategory(windows);

  return (
    <Section title="Shipment By Zone" source={shippingSource}>
      <div className={mapRowStyles.row}>
        <div className={mapRowStyles.mapCard}>
          <h3 className={mapRowStyles.mapTitle}>Shipment By Zone</h3>
          <Suspense fallback={<EmptyState message="Loading map…" height={260} />}>
            <UsChoropleth data={windows.states.mapCounts} valueLabel="shipments" category={category} />
          </Suspense>
        </div>
        <div className={styles.stack}>
          <div className={styles.barCard}>
            <h3 className={mapRowStyles.mapTitle}>Shipment by ZONE</h3>
            <HorizontalBarChart data={bars} valueFormatter={(v) => v.toLocaleString("en-US")} height={220} />
          </div>
          <HeatmapDataTable table={table} />
        </div>
      </div>
    </Section>
  );
}
