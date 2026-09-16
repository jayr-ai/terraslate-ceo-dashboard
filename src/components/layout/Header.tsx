import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import styles from "./Header.module.css";

export function Header({
  title,
  subtitle,
  onMenuClick,
  children,
}: {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  children?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button type="button" className={styles.menuButton} onClick={onMenuClick} aria-label="Open menu">
          <Menu size={20} strokeWidth={2} />
        </button>
        <div className={styles.titleGroup}>
          <span className={styles.wordmark}>TerraSlate</span>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
      </div>
      <div className={styles.right}>{children}</div>
    </header>
  );
}
