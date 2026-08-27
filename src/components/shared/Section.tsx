import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import type { Source } from "../../data/ceoDashboardMockData";
import styles from "./Section.module.css";

export function Section({
  title,
  source,
  children,
}: {
  title: string;
  source?: Source;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>{title}</h2>
        {source && (
          <div className={styles.source}>
            {!source.confirmed && (
              <CircleAlert size={13} strokeWidth={2} className={styles.unconfirmedIcon} aria-hidden="true" />
            )}
            <span>Source: {source.label}</span>
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
