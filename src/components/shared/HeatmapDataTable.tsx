import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, CircleAlert } from "lucide-react";
import type { Source } from "../../data/ceoDashboardMockData";
import { useGlowOnScroll } from "../../hooks/useGlowOnScroll";
import styles from "./DataTable.module.css";
import heatStyles from "./HeatmapDataTable.module.css";

export type HeatmapFormat = "hours" | "number" | "percent" | "currency" | "text";
export type HeatColor = "blue" | "green" | "cyan";

export interface HeatmapColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  format?: HeatmapFormat;
  heat?: HeatColor;
  truncate?: boolean;
  sortable?: boolean;
  // When the row's `flagKey` field is truthy, this cell gets a fixed amber
  // conditional-format instead of (or in addition to) any `heat` gradient —
  // for a business-rule highlight (e.g. "this employee's calls dropped
  // >20%") rather than a relative-magnitude heatmap. See AirCall's
  // consolidated duration table.
  flagKey?: string;
}

export interface HeatmapTableData {
  id: string;
  title: string;
  caption?: string;
  columns: HeatmapColumn[];
  rows: Record<string, string | number | boolean | null>[];
  grandTotalRow?: Record<string, string | number | boolean | null>;
  source: Source;
  pageSize?: number;
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
  // "fill" (default) shades the whole grand-total row — the app-wide
  // convention. "border" instead adds a subtle top border and no fill, for
  // tables where a full-row color block would compete with other row-level
  // color (e.g. AirCall's amber drop-flag cells).
  grandTotalStyle?: "fill" | "border";
}

export function HeatmapDataTable({ table }: { table: HeatmapTableData }) {
  const glowRef = useGlowOnScroll<HTMLDivElement>();
  const pageSize = table.pageSize ?? (table.rows.length || 1);
  const [sortKey, setSortKey] = useState<string | undefined>(table.defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(table.defaultSortDir ?? "desc");
  const [page, setPage] = useState(0);

  const heatRanges = useMemo(() => {
    const ranges: Record<string, { min: number; max: number }> = {};
    for (const col of table.columns) {
      if (!col.heat) continue;
      const values = table.rows
        .map((r) => r[col.key])
        .filter((v): v is number => typeof v === "number");
      ranges[col.key] = { min: 0, max: values.length ? Math.max(...values) : 0 };
    }
    return ranges;
  }, [table.columns, table.rows]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return table.rows;
    const copy = [...table.rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [table.rows, sortKey, sortDir]);

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const clampedPage = Math.min(page, totalPages - 1);
  const start = clampedPage * pageSize;
  const visibleRows = sortedRows.slice(start, start + pageSize);
  const rangeStart = totalRows === 0 ? 0 : start + 1;
  const rangeEnd = Math.min(start + pageSize, totalRows);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  function cellStyle(
    col: HeatmapColumn,
    value: string | number | boolean | null,
    row: Record<string, string | number | boolean | null>,
  ): React.CSSProperties | undefined {
    if (col.flagKey && row[col.flagKey]) {
      return { backgroundColor: "var(--warning-bg)" };
    }
    if (!col.heat || typeof value !== "number") return undefined;
    const range = heatRanges[col.key];
    if (!range || range.max <= 0) return undefined;
    const t = Math.max(0, Math.min(1, value / range.max));
    return { backgroundColor: `rgba(var(--heat-${col.heat}), ${(t * 0.55).toFixed(3)})` };
  }

  function renderRow(row: Record<string, string | number | boolean | null>, key: string | number, bold = false) {
    const grandTotalClass =
      table.grandTotalStyle === "border" ? heatStyles.grandTotalRowBorder : heatStyles.grandTotalRow;
    return (
      <tr key={key} className={bold ? grandTotalClass : undefined}>
        {table.columns.map((col) => {
          const raw = row[col.key];
          const display = formatCell(raw, col.format);
          return (
            <td
              key={col.key}
              className={col.align === "right" ? styles.alignRight : undefined}
              style={cellStyle(col, raw, row)}
            >
              {col.truncate && typeof raw === "string" ? (
                <span className={styles.truncateCell} title={raw}>
                  {display}
                </span>
              ) : (
                display
              )}
            </td>
          );
        })}
      </tr>
    );
  }

  return (
    <div className={styles.card} ref={glowRef}>
      <div className={styles.header}>
        <h3 className={styles.title}>{table.title}</h3>
        {table.caption && <p className={heatStyles.caption}>{table.caption}</p>}
      </div>
      <div className={styles.scrollWrap}>
        <table className={`${styles.table} ${heatStyles.table}`}>
          <thead>
            <tr>
              {table.columns.map((col) => (
                <th
                  key={col.key}
                  className={`${heatStyles.wrapHeader} ${col.align === "right" ? styles.alignRight : ""}`}
                >
                  {col.sortable ? (
                    <button type="button" className={styles.sortButton} onClick={() => toggleSort(col.key)}>
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ChevronUp size={13} strokeWidth={2.5} />
                        ) : (
                          <ChevronDown size={13} strokeWidth={2.5} />
                        )
                      ) : (
                        <ChevronDown size={13} strokeWidth={2.5} className={styles.sortHint} />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => renderRow(row, i))}
            {table.grandTotalRow && renderRow(table.grandTotalRow, "grand-total", true)}
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <div className={styles.source}>
          {!table.source.confirmed && (
            <CircleAlert size={13} strokeWidth={2} className={styles.unconfirmedIcon} aria-hidden="true" />
          )}
          <span>Source: {table.source.label}</span>
        </div>
        {totalRows > pageSize && (
          <div className={styles.pagination}>
            <span className={styles.pageRange}>
              {rangeStart}–{rangeEnd}/{totalRows}
            </span>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={clampedPage >= totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCell(value: string | number | boolean | null, format?: HeatmapFormat): string {
  if (value === null || value === undefined) return "-";
  if (format === "hours") return typeof value === "number" ? value.toFixed(2) : String(value);
  if (format === "percent") return typeof value === "number" ? `${value.toFixed(1)}%` : String(value);
  if (format === "number") return typeof value === "number" ? value.toLocaleString("en-US") : String(value);
  if (format === "currency") {
    return typeof value === "number"
      ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : String(value);
  }
  return String(value);
}
