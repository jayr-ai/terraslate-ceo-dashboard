import { TriangleAlert } from "lucide-react";
import styles from "./AlertBanner.module.css";

export function AlertBanner({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.banner}>
      <TriangleAlert size={16} strokeWidth={2} className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        <p className={styles.text}>{text}</p>
      </div>
    </div>
  );
}
