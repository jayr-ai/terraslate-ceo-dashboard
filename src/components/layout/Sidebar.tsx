import {
  LayoutDashboard,
  PhoneCall,
  Package,
  FileText,
  Search,
  ThumbsUp,
  Truck,
  BarChart2,
  BookOpen,
  X,
  type LucideIcon,
} from "lucide-react";
import { navItems } from "../../data/ceoDashboardMockData";
import styles from "./Sidebar.module.css";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "phone-call": PhoneCall,
  package: Package,
  "file-text": FileText,
  search: Search,
  "thumbs-up": ThumbsUp,
  truck: Truck,
  "bar-chart-2": BarChart2,
  "book-open": BookOpen,
};

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />}
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <div className={styles.topRow}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>TS</div>
            <span className={styles.brandWord}>TerraSlate</span>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close menu">
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <nav className={styles.nav} aria-label="Dashboard pages">
          {navItems.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.navItem} ${item.active ? styles.navItemActive : ""}`}
                disabled={!item.active}
                aria-current={item.active ? "page" : undefined}
                title={item.active ? undefined : `${item.label} — coming in a later phase`}
                onClick={item.active ? onClose : undefined}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
