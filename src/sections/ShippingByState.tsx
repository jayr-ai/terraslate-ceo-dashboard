import { Suspense, lazy } from "react";
import { Section } from "../components/shared/Section";
import { DataTable } from "../components/shared/DataTable";
import { EmptyState } from "../components/shared/EmptyState";
import { useGlowOnScroll } from "../hooks/useGlowOnScroll";
import {
  shippingByStateSource,
  shippingByStateTable,
  shippingByStateGrandTotal,
  shippingByStateMap,
} from "../data/ceoDashboardData";
import styles from "./ShippingByState.module.css";

// react-simple-maps + d3-geo are a heavy pull for a below-the-fold widget —
// load them only when this section actually mounts.
const UsChoropleth = lazy(() =>
  import("../components/shared/UsChoropleth").then((m) => ({ default: m.UsChoropleth })),
);

// Live from the sheet's country_city tab (verified 2026-08-08 — see
// ceoDashboardData.ts / the fetch script for the aggregation). The blank
// widget in the original Data Studio report was most likely a broken chart
// config there, not missing data.
export function ShippingByState() {
  const mapGlowRef = useGlowOnScroll<HTMLDivElement>();
  return (
    <Section title="Shipping Report | By State" source={shippingByStateSource}>
      <div className={styles.row}>
        <div className={styles.tableCard}>
          <DataTable table={shippingByStateTable} />
          <div className={styles.grandTotal}>
            Grand Total:{" "}
            <span className={styles.grandTotalValue}>
              {shippingByStateGrandTotal.toLocaleString("en-US")}
            </span>
          </div>
        </div>
        <div className={styles.mapCard} ref={mapGlowRef}>
          <h3 className={styles.tableTitle}>Orders by State</h3>
          <Suspense fallback={<EmptyState message="Loading map…" height={260} />}>
            <UsChoropleth data={shippingByStateMap} />
          </Suspense>
        </div>
      </div>
    </Section>
  );
}
