import type { Source } from "../../data/ceoDashboardMockData";
import { useGlowOnScroll } from "../../hooks/useGlowOnScroll";
import styles from "./DataTable.module.css";
import pivotStyles from "./PivotHeatmapTable.module.css";

export interface PivotHeatmapData {
  title: string;
  caption?: string;
  cornerLabel: string;
  rowLabel: string;
  rowOrder: string[];
  colOrder: string[];
  matrix: Record<string, Record<string, number>>;
  colTotals: Record<string, number>;
  grandTotal: number;
  maxCell: number;
  source: Source;
}

export function PivotHeatmapTable({ table }: { table: PivotHeatmapData }) {
  const glowRef = useGlowOnScroll<HTMLDivElement>();
  const max = table.maxCell || 1;

  return (
    <div className={styles.card} ref={glowRef}>
      <div className={styles.header}>
        <h3 className={styles.title}>{table.title}</h3>
        {table.caption && <p className={pivotStyles.caption}>{table.caption}</p>}
      </div>
      <div className={pivotStyles.cornerRow}>{table.cornerLabel}</div>
      <div className={styles.scrollWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{table.rowLabel}</th>
              {table.colOrder.map((c) => (
                <th key={c} className={styles.alignRight}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rowOrder.map((tag) => (
              <tr key={tag}>
                <td>{tag === "" ? "-" : tag}</td>
                {table.colOrder.map((c) => {
                  const v = table.matrix[tag]?.[c] ?? 0;
                  const t = Math.max(0, Math.min(1, v / max));
                  return (
                    <td
                      key={c}
                      className={styles.alignRight}
                      style={v > 0 ? { backgroundColor: `rgba(var(--heat-blue), ${(t * 0.6).toFixed(3)})` } : undefined}
                    >
                      {v > 0 ? v.toLocaleString("en-US") : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className={pivotStyles.grandTotalRow}>
              <td>Grand total</td>
              {table.colOrder.map((c) => (
                <td key={c} className={styles.alignRight}>
                  {(table.colTotals[c] ?? 0).toLocaleString("en-US")}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <div className={styles.source}>
          {!table.source.confirmed && <span>⚠ </span>}
          <span>Source: {table.source.label}</span>
        </div>
      </div>
    </div>
  );
}
