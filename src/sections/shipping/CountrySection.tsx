import { Suspense, lazy } from "react";
import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { EmptyState } from "../../components/shared/EmptyState";
import { useShippingDateRange } from "../../data/ShippingDateRangeContext";
import { buildCountriesTable, buildCountryMapCounts, shippingSource } from "../../data/shippingData";
import styles from "./MapRow.module.css";

// Same lazy-load convention as UsChoropleth's other call sites — heavy
// react-simple-maps + d3-geo dependency, loaded only when this section
// mounts.
const WorldChoropleth = lazy(() =>
  import("../../components/shared/WorldChoropleth").then((m) => ({ default: m.WorldChoropleth })),
);

export function CountrySection() {
  const { windows } = useShippingDateRange();
  const table = buildCountriesTable(windows);
  const mapCounts = buildCountryMapCounts(windows);

  return (
    <Section title="Shipment By Country" source={shippingSource}>
      <div className={styles.row}>
        <div className={styles.mapCard}>
          <h3 className={styles.mapTitle}>Shipment By Country</h3>
          <Suspense fallback={<EmptyState message="Loading map…" height={260} />}>
            <WorldChoropleth data={mapCounts} valueLabel="shipments" />
          </Suspense>
        </div>
        <HeatmapDataTable table={table} />
      </div>
    </Section>
  );
}
