import { Suspense, lazy } from "react";
import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { EmptyState } from "../../components/shared/EmptyState";
import { useShippingDateRange } from "../../data/ShippingDateRangeContext";
import { buildCitiesTable, buildCityMapPoints, shippingSource } from "../../data/shippingData";
import mapRowStyles from "./MapRow.module.css";

const CityBubbleMap = lazy(() =>
  import("../../components/shared/CityBubbleMap").then((m) => ({ default: m.CityBubbleMap })),
);

export function CitySection() {
  const { windows } = useShippingDateRange();
  const table = buildCitiesTable(windows);
  const points = buildCityMapPoints(windows);

  return (
    <Section title="Shipment By City" source={shippingSource}>
      <div className={mapRowStyles.mapCard}>
        <h3 className={mapRowStyles.mapTitle}>Shipment By City</h3>
        <Suspense fallback={<EmptyState message="Loading map…" height={260} />}>
          <CityBubbleMap points={points} />
        </Suspense>
      </div>
      <HeatmapDataTable table={table} />
    </Section>
  );
}
