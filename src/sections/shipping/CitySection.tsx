import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { useShippingDateRange } from "../../data/ShippingDateRangeContext";
import { buildCitiesTable, shippingSource } from "../../data/shippingData";

// No city-level geo map here, deliberately — the sheet has zip codes but
// no lat/lng, so plotting real city positions would need an external
// zip -> coordinate dataset this pipeline doesn't have. This table
// carries the same ranking the reference report's bubble map conveyed.
export function CitySection() {
  const { windows } = useShippingDateRange();
  const table = buildCitiesTable(windows);

  return (
    <Section title="Shipment By City" source={shippingSource}>
      <HeatmapDataTable table={table} />
    </Section>
  );
}
