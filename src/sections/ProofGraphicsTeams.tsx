import { Section } from "../components/shared/Section";
import { DataTable } from "../components/shared/DataTable";
import { StatTile } from "../components/shared/StatTile";
import { useDateRange } from "../data/DateRangeContext";
import {
  buildProofTeamSalesTable,
  buildGraphicDesignValueTile,
  buildGraphicTeamSalesTable,
  buildGraphicsTeamHoursTable,
} from "../data/ceoDashboardData";
import styles from "./ProofGraphicsTeams.module.css";

export function ProofGraphicsTeams() {
  const { windows } = useDateRange();
  const proofTeamSalesTable = buildProofTeamSalesTable(windows.proofSales);
  const graphicDesignValueTile = buildGraphicDesignValueTile(windows.graphicDesign);
  const graphicTeamSalesTable = buildGraphicTeamSalesTable(windows.graphicSales);
  const graphicsTeamHoursTable = buildGraphicsTeamHoursTable(windows.graphicsHours);

  return (
    <Section title="Proof Team / Graphic Team">
      <div className={styles.row}>
        <div className={styles.col}>
          <DataTable table={proofTeamSalesTable} />
        </div>
        <div className={styles.col}>
          <StatTile
            label={graphicDesignValueTile.label}
            value={graphicDesignValueTile.value}
            trend={graphicDesignValueTile.trend}
            source={graphicDesignValueTile.source}
          />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.col}>
          <DataTable table={graphicTeamSalesTable} />
        </div>
        <div className={styles.col}>
          <DataTable table={graphicsTeamHoursTable} />
        </div>
      </div>
    </Section>
  );
}
