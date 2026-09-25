import { CountrySection } from "../sections/shipping/CountrySection";
import { StateSection } from "../sections/shipping/StateSection";
import { CitySection } from "../sections/shipping/CitySection";
import { ZoneSection } from "../sections/shipping/ZoneSection";
import styles from "./ShippingDashboard.module.css";

export function ShippingDashboard() {
  return (
    <div className={styles.stack}>
      <CountrySection />
      <StateSection />
      <CitySection />
      <ZoneSection />
    </div>
  );
}
