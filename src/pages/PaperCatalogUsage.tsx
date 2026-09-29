import { PaperCatalogSection } from "../sections/paperCatalog/PaperCatalogSection";
import styles from "./PaperCatalogUsage.module.css";

export function PaperCatalogUsage() {
  return (
    <div className={styles.stack}>
      <PaperCatalogSection />
    </div>
  );
}
