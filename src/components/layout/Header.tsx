import { Menu } from "lucide-react";
import { DateRangePicker } from "./DateRangePicker";
import { RefreshDataButton } from "./RefreshDataButton";
import styles from "./Header.module.css";

export function Header({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button type="button" className={styles.menuButton} onClick={onMenuClick} aria-label="Open menu">
          <Menu size={20} strokeWidth={2} />
        </button>
        <div className={styles.logo} aria-hidden="true">
          TS
        </div>
        <div className={styles.titleGroup}>
          <span className={styles.wordmark}>TerraSlate</span>
          <h1 className={styles.title}>{title}</h1>
        </div>
      </div>
      <div className={styles.right}>
        <RefreshDataButton />
        <DateRangePicker />
      </div>
    </header>
  );
}
