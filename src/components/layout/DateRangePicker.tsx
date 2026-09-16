import { useEffect, useRef, useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";
import { PRESET_KEYS, PRESET_LABELS, type PresetKey, type DateRangeSelection } from "../../lib/dateRange";
import styles from "./DateRangePicker.module.css";

// Deliberately decoupled from any specific date-range context: the CEO
// Dashboard and AirCall Dashboard each have their own (different sections,
// different underlying data), so this component takes whichever one's
// hook result the caller passes in, rather than importing one directly.
export interface DateRangePickerProps {
  selection: DateRangeSelection;
  setPreset: (key: PresetKey) => void;
  setCustom: (start: string, end: string) => void;
  displayStart: string;
  displayEnd: string;
}

export function DateRangePicker({ selection, setPreset, setCustom, displayStart, displayEnd }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(displayStart);
  const [customEnd, setCustomEnd] = useState(displayEnd);
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
    setCustomStart(displayStart);
    setCustomEnd(displayEnd);
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
      : `${formatDisplay(displayStart)} – ${formatDisplay(displayEnd)}`;

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
