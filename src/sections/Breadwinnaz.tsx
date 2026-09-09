import { Section } from "../components/shared/Section";
import { DataTable } from "../components/shared/DataTable";
import { useDateRange } from "../data/DateRangeContext";
import { buildBreadwinnazTable } from "../data/ceoDashboardData";
import styles from "./Breadwinnaz.module.css";

export function Breadwinnaz() {
  const { windows } = useDateRange();
  const table = buildBreadwinnazTable(windows.breadwinnaz);
  return (
    <Section title="Account Managers">
      <div className={styles.wrap}>
        <DataTable table={table} hideTitle />
      </div>
    </Section>
  );
}
