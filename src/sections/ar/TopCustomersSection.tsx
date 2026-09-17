import { Section } from "../../components/shared/Section";
import { HorizontalBarChart } from "../../components/shared/HorizontalBarChart";
import { topCustomerBars, topCustomersConcentrationPct, arSource } from "../../data/arDashboardData";
import styles from "./TopCustomersSection.module.css";

function fmtMoney(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Fix 7 (brief 2026-09-18) — placed below the aging mix bar (Fix 3, inside
// HeadlineSection) and above the 4 aging-bucket tables (AgingSection).
export function TopCustomersSection() {
  return (
    <Section title="Top 10 Customers by Outstanding AR" source={arSource}>
      <div className={styles.card}>
        <HorizontalBarChart data={topCustomerBars} valueFormatter={fmtMoney} />
        <p className={styles.caption}>
          Top 10 customers = {topCustomersConcentrationPct}% of total outstanding AR
        </p>
      </div>
    </Section>
  );
}
