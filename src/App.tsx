import { useState } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { DateRangePicker } from "./components/layout/DateRangePicker";
import { RefreshDataButton } from "./components/layout/RefreshDataButton";
import { CeoDashboard } from "./pages/CeoDashboard";
import { AirCallDashboard } from "./pages/AirCallDashboard";
import { AccountsReceivable } from "./pages/AccountsReceivable";
import { FacebookAds } from "./pages/FacebookAds";
import { ShippingDashboard } from "./pages/ShippingDashboard";
import { DateRangeProvider, useDateRange } from "./data/DateRangeContext";
import { AircallDateRangeProvider, useAircallDateRange } from "./data/AircallDateRangeContext";
import { FacebookAdsDateRangeProvider, useFacebookAdsDateRange } from "./data/FacebookAdsDateRangeContext";
import { ShippingDateRangeProvider, useShippingDateRange } from "./data/ShippingDateRangeContext";
import { CarrierFilter } from "./components/layout/CarrierFilter";
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

function FacebookAdsHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { selection, setPreset, setCustom, windows } = useFacebookAdsDateRange();
  return (
    <Header title="Facebook Ads" subtitle="Source: Facebook Ads Report" onMenuClick={onMenuClick}>
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

function ShippingDashboardHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { selection, setPreset, setCustom, carrier, setCarrier, windows } = useShippingDateRange();
  return (
    <Header title="Shipping Dashboard" subtitle="FedEx & UPS data" onMenuClick={onMenuClick}>
      <RefreshDataButton />
      <CarrierFilter carrier={carrier} setCarrier={setCarrier} />
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

  let headerEl;
  let contentEl;
  if (activePage === "aircall-dashboard") {
    headerEl = <AirCallDashboardHeader onMenuClick={() => setNavOpen((v) => !v)} />;
    contentEl = <AirCallDashboard />;
  } else if (activePage === "accounts-receivable") {
    headerEl = <AccountsReceivableHeader onMenuClick={() => setNavOpen((v) => !v)} />;
    contentEl = <AccountsReceivable />;
  } else if (activePage === "facebook-ads") {
    headerEl = <FacebookAdsHeader onMenuClick={() => setNavOpen((v) => !v)} />;
    contentEl = <FacebookAds />;
  } else if (activePage === "shipping-dashboard") {
    headerEl = <ShippingDashboardHeader onMenuClick={() => setNavOpen((v) => !v)} />;
    contentEl = <ShippingDashboard />;
  } else {
    headerEl = <CeoDashboardHeader onMenuClick={() => setNavOpen((v) => !v)} />;
    contentEl = <CeoDashboard />;
  }

  return (
    <DateRangeProvider>
      <AircallDateRangeProvider>
        <FacebookAdsDateRangeProvider>
          <ShippingDateRangeProvider>
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
          </ShippingDateRangeProvider>
        </FacebookAdsDateRangeProvider>
      </AircallDateRangeProvider>
    </DateRangeProvider>
  );
}

export default App;
