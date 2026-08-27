import { Inbox } from "lucide-react";
import styles from "./EmptyState.module.css";

export function EmptyState({
  message = "No data",
  detail,
  height = 160,
}: {
  message?: string;
  detail?: string;
  height?: number;
}) {
  return (
    <div className={styles.root} style={{ minHeight: height }}>
      <Inbox size={22} strokeWidth={1.5} aria-hidden="true" />
      <span className={styles.message}>{message}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </div>
  );
}
