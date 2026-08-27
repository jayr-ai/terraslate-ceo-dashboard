import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, CircleAlert } from "lucide-react";
import type { TableSection } from "../../data/ceoDashboardMockData";
import { truncatedLabelTooltips } from "../../data/ceoDashboardMockData";
import { useGlowOnScroll } from "../../hooks/useGlowOnScroll";
import { formatCellValue } from "../../lib/format";
import styles from "./DataTable.module.css";

export function DataTable({ table, hideTitle = false }: { table: TableSection; hideTitle?: boolean }) {
  const glowRef = useGlowOnScroll<HTMLDivElement>();
  const pageSize = table.pageSize ?? 5;
  const [sortKey, setSortKey] = useState<string | undefined>(table.defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(table.defaultSortDir ?? "desc");
  const [page, setPage] = useState(0);

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
        cmp = String(av).localeCompare(String(bv));
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

  return (
    <div className={styles.card} ref={glowRef}>
      {!hideTitle && (
        <div className={styles.header}>
          <h3 className={styles.title}>{table.title}</h3>
        </div>
      )}
      <div className={styles.scrollWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {table.columns.map((col) => (
                <th
                  key={col.key}
                  className={col.align === "right" ? styles.alignRight : undefined}
                  style={col.truncate ? { maxWidth: 140 } : undefined}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() => toggleSort(col.key)}
                    >
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
            {visibleRows.map((row, i) => (
              <tr key={i}>
                {table.columns.map((col) => {
                  const raw = row[col.key];
                  const display = formatCellValue(raw, col.format);
                  const tooltip = typeof raw === "string" ? truncatedLabelTooltips[raw] : undefined;
                  return (
                    <td
                      key={col.key}
                      className={col.align === "right" ? styles.alignRight : undefined}
                    >
                      {col.truncate ? (
                        <span
                          className={styles.truncateCell}
                          title={tooltip ?? display}
                        >
                          {display}
                        </span>
                      ) : (
                        display
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
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
