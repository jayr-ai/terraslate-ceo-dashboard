import { useEffect, useRef, useState } from "react";
import { Truck, Check, ChevronDown } from "lucide-react";
import { CARRIERS, type Carrier } from "../../lib/shippingDateRange";
import styles from "./CarrierFilter.module.css";

// Matches DateRangePicker's visual language exactly (same trigger/panel
// pattern) but simpler — just a flat list of options, no custom-range
// footer. Shipping-page-specific: only that page has a second filter
// dimension beyond the date range.
export function CarrierFilter({ carrier, setCarrier }: { carrier: Carrier; setCarrier: (c: Carrier) => void }) {
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
        <Truck size={16} strokeWidth={2} aria-hidden="true" />
        <span className={styles.triggerLabel}>{carrier === "All" ? "All Carriers" : carrier}</span>
        <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.panel} role="listbox" aria-label="Select carrier">
          {CARRIERS.map((c) => (
            <button
              key={c}
              type="button"
              className={styles.row}
              role="option"
              aria-selected={carrier === c}
              onClick={() => {
                setCarrier(c);
                setOpen(false);
              }}
            >
              <span className={`${styles.check} ${carrier === c ? styles.checkOn : ""}`}>
                {carrier === c && <Check size={12} strokeWidth={3} />}
              </span>
              {c === "All" ? "All Carriers" : c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
