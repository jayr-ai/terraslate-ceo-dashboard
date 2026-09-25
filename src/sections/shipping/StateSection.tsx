import { Suspense, lazy } from "react";
import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { EmptyState } from "../../components/shared/EmptyState";
import { useShippingDateRange } from "../../data/ShippingDateRangeContext";
import { buildStatesTable, shippingSource } from "../../data/shippingData";
import styles from "./MapRow.module.css";

// Same lazy-load convention as ShippingByState.tsx — react-simple-maps +
// d3-geo are heavy for a below-the-fold widget.
const UsChoropleth = lazy(() =>
  import("../../components/shared/UsChoropleth").then((m) => ({ default: m.UsChoropleth })),
);

export function StateSection() {
  const { windows } = useShippingDateRange();
  const table = buildStatesTable(windows);

  return (
    <Section title="Shipment By State" source={shippingSource}>
      <div className={styles.row}>
        <div className={styles.mapCard}>
          <h3 className={styles.mapTitle}>Shipment By State</h3>
          <Suspense fallback={<EmptyState message="Loading map…" height={260} />}>
            <UsChoropleth data={windows.states.mapCounts} valueLabel="shipments" />
          </Suspense>
        </div>
        <HeatmapDataTable table={table} />
      </div>
    </Section>
  );
}
