import { CallsDurationSection } from "../sections/aircall/CallsDurationSection";
import { CallsByTagSection } from "../sections/aircall/CallsByTagSection";
import styles from "./AirCallDashboard.module.css";

export function AirCallDashboard() {
  return (
    <>
      <div className={styles.stack}>
        <CallsDurationSection />
        <CallsByTagSection />
      </div>
    </>
  );
}
