import { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { CeoDashboard } from "./pages/CeoDashboard";
import { DateRangeProvider } from "./data/DateRangeContext";
import styles from "./App.module.css";

function App() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <DateRangeProvider>
      <div className={styles.shell}>
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div className={styles.main}>
          <Header title="CEO Dashboard" onMenuClick={() => setNavOpen((v) => !v)} />
          <div className={styles.content}>
            <CeoDashboard />
          </div>
        </div>
      </div>
    </DateRangeProvider>
  );
}

export default App;
