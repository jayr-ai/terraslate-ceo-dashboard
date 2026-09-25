import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { useShippingDateRange } from "../../data/ShippingDateRangeContext";
import { buildCountriesTable, shippingSource } from "../../data/shippingData";

// No world map here, deliberately — 99%+ of shipments are US-only (16 of
// 1,958 in the reference Aug 2026 window), so a full world choropleth
// would be mostly blank for the actual data. This table carries the same
// ranking the reference report's map conveyed visually.
export function CountrySection() {
  const { windows } = useShippingDateRange();
  const table = buildCountriesTable(windows);

  return (
    <Section title="Shipment By Country" source={shippingSource}>
      <HeatmapDataTable table={table} />
    </Section>
  );
}
