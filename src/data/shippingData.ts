// Real data adapter — reads scripts/fetch_shipping_data.py's output
// (shippingData.json) and reshapes it into the typed constants the UI
// components consume. Every section is date-range + carrier driven — see
// ShippingDateRangeContext.tsx / lib/shippingDateRange.ts.

import type { Source } from "./ceoDashboardMockData";
import type { HeatmapTableData } from "../components/shared/HeatmapDataTable";
import type { HorizontalBarDatum } from "../components/shared/HorizontalBarChart";
import type { CategoryLegendItem } from "../components/shared/UsChoropleth";
import type { ShippingWindow } from "../lib/shippingDateRange";

export const shippingSource: Source = { label: "Shipping Dashboard — ALL tab (UPS + FedEx)", confirmed: true };

function fmtMoney(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Top Countries / State / Cities By Shipping Spend tables
// ---------------------------------------------------------------------------

// Only the 5 names (of the ~15 this dashboard's data has ever produced)
// that don't already match the world-atlas's own name verbatim — see
// WorldChoropleth.tsx for why 50m resolution is required to cover these.
const COUNTRY_NAME_TO_ATLAS: Record<string, string> = {
  USA: "United States of America",
  "Cook Islands": "Cook Is.",
  "Saint Barthélemy": "St-Barthélemy",
  "Sint Maarten (Dutch part)": "Sint Maarten",
  "Virgin Islands (U.S.)": "U.S. Virgin Is.",
};

export function buildCountryMapCounts(window: ShippingWindow): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of window.countries.rows) {
    const atlasName = COUNTRY_NAME_TO_ATLAS[r.name] ?? r.name;
    counts[atlasName] = (counts[atlasName] ?? 0) + r.count;
  }
  return counts;
}

export function buildCountriesTable(window: ShippingWindow): HeatmapTableData {
  return {
    id: "top-countries",
    title: "Top Countries By Shipping Spend",
    columns: [
      { key: "name", label: "Country", align: "left" },
      { key: "count", label: "No. of Shipment", align: "right", format: "number" },
      { key: "price", label: "Shipping Price", align: "right", format: "currency", sortable: true },
    ],
    rows: window.countries.rows.map((r) => ({ name: r.name, count: r.count, price: r.price })),
    grandTotalRow: { name: "Grand total", count: window.countries.grandTotal.count, price: window.countries.grandTotal.price },
    source: shippingSource,
    pageSize: 10,
  };
}

export function buildStatesTable(window: ShippingWindow): HeatmapTableData {
  return {
    id: "top-states",
    title: "Top State By Shipping Spend",
    columns: [
      { key: "state", label: "State", align: "left" },
      { key: "country", label: "Country", align: "left" },
      { key: "count", label: "No. of Shipment", align: "right", format: "number" },
      { key: "price", label: "Shipping Price", align: "right", format: "currency", sortable: true },
    ],
    rows: window.states.rows.map((r) => ({ state: r.state, country: r.country, count: r.count, price: r.price })),
    grandTotalRow: { state: "Grand total", country: "", count: window.states.grandTotal.count, price: window.states.grandTotal.price },
    source: shippingSource,
    pageSize: 10,
  };
}

export function buildCitiesTable(window: ShippingWindow): HeatmapTableData {
  return {
    id: "top-cities",
    title: "Top Cities By Shipping Spend",
    caption: "Excludes Lahaina, Maui — same exclusion as the source report.",
    columns: [
      { key: "city", label: "City", align: "left" },
      { key: "country", label: "Country", align: "left" },
      { key: "count", label: "No. of Shipment", align: "right", format: "number" },
      { key: "price", label: "Shipping Price", align: "right", format: "currency", sortable: true },
    ],
    rows: window.cities.rows.map((r) => ({ city: r.city, country: r.country, count: r.count, price: r.price })),
    grandTotalRow: { city: "Grand total", country: "", count: window.cities.grandTotal.count, price: window.cities.grandTotal.price },
    source: shippingSource,
    pageSize: 10,
  };
}

// ---------------------------------------------------------------------------
// Shipment by Zone — bar chart + price table
// ---------------------------------------------------------------------------

export function buildZoneBars(window: ShippingWindow): HorizontalBarDatum[] {
  return window.zones.barChart.map((z) => ({
    id: `zone-${z.zone}`,
    label: `Zone ${z.zone}`,
    value: z.count,
  }));
}

export function buildZoneTable(window: ShippingWindow): HeatmapTableData {
  return {
    id: "zone-price",
    title: "Shipment by ZONE",
    columns: [
      { key: "zone", label: "Zone", align: "left" },
      { key: "price", label: "Shipping Price", align: "right", format: "currency", sortable: true },
    ],
    rows: window.zones.rows.map((r) => ({ zone: r.zone === "null" ? "No zone (int'l)" : `Zone ${r.zone}`, price: r.price })),
    grandTotalRow: { zone: "Total", price: window.zones.grandTotal.price },
    source: shippingSource,
    pageSize: 10,
  };
}

// ---------------------------------------------------------------------------
// Zone choropleth — categorical color per state, dominant zone
// ---------------------------------------------------------------------------

const ZONE_COLORS: Record<string, string> = {
  "2": "#3ddc97",
  "3": "#22d3ee",
  "4": "#3b9eff",
  "5": "#8b5cf6",
  "6": "#f59e0b",
  "7": "#ff6b6b",
};

const ZONE_LEGEND: CategoryLegendItem[] = ["2", "3", "4", "5", "6", "7"].map((z) => ({
  key: z,
  label: `Zone ${z}`,
  color: ZONE_COLORS[z],
}));

export function buildZoneMapCategory(window: ShippingWindow): { valueByState: Record<string, string>; colors: Record<string, string>; legend: CategoryLegendItem[] } {
  return {
    valueByState: window.zones.dominantZoneByState,
    colors: ZONE_COLORS,
    legend: ZONE_LEGEND,
  };
}

export { fmtMoney };
