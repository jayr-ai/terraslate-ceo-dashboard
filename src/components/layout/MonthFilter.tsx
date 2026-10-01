import { useEffect, useRef, useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";
import type { MonthOption } from "../../lib/shippingDateRange";
import styles from "./CarrierFilter.module.css";

// Same trigger/panel visual language as CarrierFilter/YearFilter — Shipping
// Dashboard's date picker, replaced with a plain Monthly dropdown (JV,
// 2026-10-01) since the source sheet updates monthly, not daily, so a
// trailing-N-days window never meant much here.
export function MonthFilter({
  month,
  setMonth,
  months,
}: {
  month: string;
  setMonth: (key: string) => void;
  months: MonthOption[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedLabel = months.find((m) => m.key === month)?.label ?? month;

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

  useEffect(() => {
    if (open) panelRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox">
        <Calendar size={16} strokeWidth={2} aria-hidden="true" />
        <span className={styles.triggerLabel}>{selectedLabel}</span>
        <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.panel} style={{ maxHeight: 280, overflowY: "auto" }} role="listbox" aria-label="Select month" ref={panelRef}>
          {months.map((m) => (
            <button
              key={m.key}
              type="button"
              className={styles.row}
              role="option"
              aria-selected={month === m.key}
              onClick={() => {
                setMonth(m.key);
                setOpen(false);
              }}
            >
              <span className={`${styles.check} ${month === m.key ? styles.checkOn : ""}`}>
                {month === m.key && <Check size={12} strokeWidth={3} />}
              </span>
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
