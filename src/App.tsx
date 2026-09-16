import { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { DateRangePicker } from "./components/layout/DateRangePicker";
import { RefreshDataButton } from "./components/layout/RefreshDataButton";
import { CeoDashboard } from "./pages/CeoDashboard";
import { AirCallDashboard } from "./pages/AirCallDashboard";
import { DateRangeProvider, useDateRange } from "./data/DateRangeContext";
import { AircallDateRangeProvider, useAircallDateRange } from "./data/AircallDateRangeContext";
import type { NavItem } from "./data/ceoDashboardMockData";
import styles from "./App.module.css";

function CeoDashboardHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { selection, setPreset, setCustom, windows } = useDateRange();
  return (
    <Header title="CEO Dashboard" onMenuClick={onMenuClick}>
      <RefreshDataButton />
      <DateRangePicker
        selection={selection}
        setPreset={setPreset}
        setCustom={setCustom}
        displayStart={windows.displayStart}
        displayEnd={windows.displayEnd}
      />
    </Header>
  );
}

function AirCallDashboardHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { selection, setPreset, setCustom, windows } = useAircallDateRange();
  return (
    <Header title="AirCall Dashboard" subtitle="Source: Aircall.io" onMenuClick={onMenuClick}>
      <RefreshDataButton />
      <DateRangePicker
        selection={selection}
        setPreset={setPreset}
        setCustom={setCustom}
        displayStart={windows.displayStart}
        displayEnd={windows.displayEnd}
      />
    </Header>
  );
}

function App() {
  const [navOpen, setNavOpen] = useState(false);
  const [activePage, setActivePage] = useState<NavItem["id"]>("ceo-dashboard");

  return (
    <DateRangeProvider>
      <AircallDateRangeProvider>
        <div className={styles.shell}>
          <Sidebar
            open={navOpen}
            onClose={() => setNavOpen(false)}
            activePage={activePage}
            onSelectPage={setActivePage}
          />
          <div className={styles.main}>
            {activePage === "aircall-dashboard" ? (
              <AirCallDashboardHeader onMenuClick={() => setNavOpen((v) => !v)} />
            ) : (
              <CeoDashboardHeader onMenuClick={() => setNavOpen((v) => !v)} />
            )}
            <div className={styles.content}>
              {activePage === "aircall-dashboard" ? <AirCallDashboard /> : <CeoDashboard />}
            </div>
          </div>
        </div>
      </AircallDateRangeProvider>
    </DateRangeProvider>
  );
}

export default App;
