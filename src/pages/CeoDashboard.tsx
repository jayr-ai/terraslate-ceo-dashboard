import { SalesAcrossChannels } from "../sections/SalesAcrossChannels";
import { TerraSlateTracker } from "../sections/TerraSlateTracker";
import { MarketingMetrics } from "../sections/MarketingMetrics";
import { PrePress } from "../sections/PrePress";
import { ProductionTeams } from "../sections/ProductionTeams";
import { ProofGraphicsTeams } from "../sections/ProofGraphicsTeams";
import { ShippingByState } from "../sections/ShippingByState";
import { TrafficTable } from "../sections/TrafficTable";
import styles from "./CeoDashboard.module.css";

export function CeoDashboard() {
  return (
    <div className={styles.stack}>
      <SalesAcrossChannels />
      <TerraSlateTracker />
      <MarketingMetrics />
      <PrePress />
      <ProductionTeams />
      <ProofGraphicsTeams />
      <ShippingByState />
      <TrafficTable />
    </div>
  );
}
