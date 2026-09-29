import { useState } from "react";
import { DollarSign, TrendingUp, Globe, Store, Palette, ShoppingCart, PieChart } from "lucide-react";
import { WeeklyReportView } from "../sections/salesReport/WeeklyReportView";
import { ContributionView } from "../sections/salesReport/ContributionView";
import type { ChannelKey } from "../lib/salesReportData";
import styles from "./SalesReportDashboard.module.css";

type TabKey = ChannelKey | "contribution";

const TABS: { key: TabKey; label: string; icon: typeof DollarSign }[] = [
  { key: "topline", label: "Top Line Sales", icon: DollarSign },
  { key: "draft", label: "Draft Report", icon: TrendingUp },
  { key: "web", label: "Website Report", icon: Globe },
  { key: "amzn", label: "Amazon Report", icon: Store },
  { key: "gd", label: "Graphic Design", icon: Palette },
  { key: "wmt", label: "Walmart Report", icon: ShoppingCart },
  { key: "contribution", label: "Sls Contribution %", icon: PieChart },
];

export function SalesReportDashboard() {
  const [tab, setTab] = useState<TabKey>("topline");

  return (
    <div className={styles.stack}>
      <div className={styles.tabs}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`}
            onClick={() => setTab(key)}
          >
            <Icon size={14} strokeWidth={2} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <div className={styles.content}>
        {tab === "contribution" ? <ContributionView /> : <WeeklyReportView channelKey={tab} />}
      </div>
    </div>
  );
}
