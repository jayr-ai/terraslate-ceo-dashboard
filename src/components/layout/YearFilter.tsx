import { useEffect, useRef, useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";
import { YEARS } from "../../lib/salesReportData";
import styles from "./CarrierFilter.module.css";

// Same trigger/panel visual language as CarrierFilter — Sales Report's
// second filter dimension (Year) instead of a date range, since the
// source sheet is weekly aggregates, not per-transaction rows.
export function YearFilter({ year, setYear }: { year: number; setYear: (y: number) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div className={styles.root} ref={rootRef}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox">
        <Calendar size={16} strokeWidth={2} aria-hidden="true" />
        <span className={styles.triggerLabel}>Year: {year}</span>
        <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.panel} role="listbox" aria-label="Select year">
          {YEARS.map((y) => (
            <button
              key={y}
              type="button"
              className={styles.row}
              role="option"
              aria-selected={year === y}
              onClick={() => {
                setYear(y);
                setOpen(false);
              }}
            >
              <span className={`${styles.check} ${year === y ? styles.checkOn : ""}`}>
                {year === y && <Check size={12} strokeWidth={3} />}
              </span>
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
