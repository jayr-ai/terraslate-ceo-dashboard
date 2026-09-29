import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { buildPaperCatalogTable, paperCatalogSource } from "../../data/paperCatalogData";

export function PaperCatalogSection() {
  const table = buildPaperCatalogTable();
  return (
    <Section title="Paper Catalogue Usage" source={paperCatalogSource}>
      <HeatmapDataTable table={table} />
    </Section>
  );
}
