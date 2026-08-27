import { useEffect, useRef, useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";
import { useDateRange } from "../../data/DateRangeContext";
import { PRESET_KEYS, PRESET_LABELS, type PresetKey } from "../../lib/dateRange";
import styles from "./DateRangePicker.module.css";

export function DateRangePicker() {
  const { selection, setPreset, setCustom, windows } = useDateRange();
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(windows.displayStart);
  const [customEnd, setCustomEnd] = useState(windows.displayEnd);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  function openPanel() {
    // Seed the custom-range inputs from whatever's currently showing, so
    // switching to "Custom" starts from something sensible.
    setCustomStart(windows.displayStart);
    setCustomEnd(windows.displayEnd);
    setOpen((v) => !v);
  }

  function applyPreset(key: PresetKey) {
    setPreset(key);
    setOpen(false);
  }

  function applyCustom() {
    if (customStart > customEnd) return; // guard against an inverted range
    setCustom(customStart, customEnd);
    setOpen(false);
  }

  const label =
    selection.kind === "preset"
      ? PRESET_LABELS[selection.key]
      : `${formatDisplay(windows.displayStart)} – ${formatDisplay(windows.displayEnd)}`;

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={openPanel}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Calendar size={16} strokeWidth={2} aria-hidden="true" />
        <span className={styles.triggerLabel}>{label}</span>
        <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Select date range">
          <ul className={styles.presetList}>
            {PRESET_KEYS.map((key) => (
              <li key={key}>
                <button type="button" className={styles.presetRow} onClick={() => applyPreset(key)}>
                  <span
                    className={`${styles.check} ${selection.kind === "preset" && selection.key === key ? styles.checkOn : ""}`}
                  >
                    {selection.kind === "preset" && selection.key === key && <Check size={12} strokeWidth={3} />}
                  </span>
                  {PRESET_LABELS[key]}
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.customFooter}>
            <span className={styles.customLabel}>Custom range</span>
            <div className={styles.customInputs}>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className={styles.dateInput}
                aria-label="Start date"
              />
              <span className={styles.customDash}>–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className={styles.dateInput}
                aria-label="End date"
              />
            </div>
            <button type="button" className={styles.applyButton} onClick={applyCustom}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDisplay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
