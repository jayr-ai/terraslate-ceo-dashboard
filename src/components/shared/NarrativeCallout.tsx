import styles from "./NarrativeCallout.module.css";

export function NarrativeCallout({ text }: { text: string }) {
  return <p className={styles.callout}>{text}</p>;
}
