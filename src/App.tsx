import { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { DateRangePicker } from "./components/layout/DateRangePicker";
import { RefreshDataButton } from "./components/layout/RefreshDataButton";
import { CeoDashboard } from "./pages/CeoDashboard";
import { AirCallDashboard } from "./pages/AirCallDashboard";
import { AccountsReceivable } from "./pages/AccountsReceivable";
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

function AccountsReceivableHeader({ onMenuClick }: { onMenuClick: () => void }) {
  // No date-range picker here, deliberately — the aging buckets are always
  // today-relative, so there's no meaningful custom range to layer on top.
  return (
    <Header title="Accounts Receivable" subtitle="Source: TerraSlate Shopify" onMenuClick={onMenuClick}>
      <RefreshDataButton />
    </Header>
  );
}

function App() {
  const [navOpen, setNavOpen] = useState(false);
  const [activePage, setActivePage] = useState<NavItem["id"]>("ceo-dashboard");

  let headerEl;
  let contentEl;
  if (activePage === "aircall-dashboard") {
    headerEl = <AirCallDashboardHeader onMenuClick={() => setNavOpen((v) => !v)} />;
    contentEl = <AirCallDashboard />;
  } else if (activePage === "accounts-receivable") {
    headerEl = <AccountsReceivableHeader onMenuClick={() => setNavOpen((v) => !v)} />;
    contentEl = <AccountsReceivable />;
  } else {
    headerEl = <CeoDashboardHeader onMenuClick={() => setNavOpen((v) => !v)} />;
    contentEl = <CeoDashboard />;
  }

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
            {headerEl}
            <div className={styles.content}>{contentEl}</div>
          </div>
        </div>
      </AircallDateRangeProvider>
    </DateRangeProvider>
  );
}

export default App;
