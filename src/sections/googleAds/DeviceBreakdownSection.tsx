import { DonutChart } from "../../components/shared/DonutChart";
import { Section } from "../../components/shared/Section";
import { googleAdsDeviceBreakdown } from "../../data/googleAdsMockData";
import type { Source } from "../../data/ceoDashboardMockData";
import grid from "../../components/shared/Grid.module.css";
import styles from "./DeviceBreakdownSection.module.css";

const source: Source = { label: "Google Ads — TerraSlate Ads Account (example data, not yet live)", confirmed: false };

export function DeviceBreakdownSection() {
  return (
    <Section title="Device Breakdown" source={source}>
      <p className={styles.caption}>
        by Clicks, Cost, and Conversions — device labels are generic placeholders ("Device A/B") since the
        reference screenshot didn't show which device each slice was; real labels arrive with live data.
      </p>
      <div className={grid.tableGrid3}>
        {googleAdsDeviceBreakdown.map((metric) => (
          <div key={metric.id} className={styles.metricCard}>
            <h4 className={styles.metricTitle}>{metric.title}</h4>
            <DonutChart data={metric.slices} />
          </div>
        ))}
      </div>
    </Section>
  );
}
