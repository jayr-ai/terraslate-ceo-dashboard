import { SalesAcrossChannels } from "../sections/SalesAcrossChannels";
import { TerraSlateTracker } from "../sections/TerraSlateTracker";
import { MarketingMetrics } from "../sections/MarketingMetrics";
import { Breadwinnaz } from "../sections/Breadwinnaz";
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
      <Breadwinnaz />
      <PrePress />
      <ProductionTeams />
      <ProofGraphicsTeams />
      <ShippingByState />
      <TrafficTable />
    </div>
  );
}
