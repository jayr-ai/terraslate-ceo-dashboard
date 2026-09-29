import { StatTile } from "../../components/shared/StatTile";
import { DiffVarianceTile } from "../../components/shared/DiffVarianceTile";
import { HeatmapDataTable } from "../../components/shared/HeatmapDataTable";
import { Section } from "../../components/shared/Section";
import { useSalesReport } from "../../data/SalesReportContext";
import { CHANNELS, computeKpis, computeQuarterTables, type ChannelKey } from "../../lib/salesReportData";
import type { Source } from "../../data/ceoDashboardMockData";
import grid from "../../components/shared/Grid.module.css";

const source: Source = { label: "Sales Team Weekly Tracker — SALES tab", confirmed: true };

function fmtMoney(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function WeeklyReportView({ channelKey }: { channelKey: ChannelKey }) {
  const { year } = useSalesReport();
  const channel = CHANNELS[channelKey];
  const kpis = computeKpis(year, channelKey);
  const quarters = computeQuarterTables(year, channelKey);

  return (
    <>
      <Section title={channel.pageTitle} source={source}>
        <div className={grid.statGrid1x6}>
          <StatTile label={`YTD ${channel.actualLabel}`} value={fmtMoney(kpis.ytd.actual)} sparkline={kpis.ytdSparkline} />
          <StatTile label={`YTD ${channel.forecastLabel}`} value={fmtMoney(kpis.ytd.forecast)} sparkline={kpis.ytdSparkline.length ? kpis.ytdSparkline : undefined} />
          <DiffVarianceTile diff={kpis.ytd.diff} variancePct={kpis.ytd.variancePct} />
          <StatTile
            label={kpis.qtdQuarter ? `${kpis.qtdQuarter} (Current) ${channel.actualLabel}` : `QTD ${channel.actualLabel}`}
            value={fmtMoney(kpis.qtd.actual)}
            sparkline={kpis.qtdSparkline}
          />
          <StatTile
            label={kpis.qtdQuarter ? `${kpis.qtdQuarter} (Current) ${channel.forecastLabel}` : `QTD ${channel.forecastLabel}`}
            value={fmtMoney(kpis.qtd.forecast)}
            sparkline={kpis.qtdSparkline.length ? kpis.qtdSparkline : undefined}
          />
          <DiffVarianceTile diff={kpis.qtd.diff} variancePct={kpis.qtd.variancePct} />
        </div>
      </Section>

      <Section title="Quarterly Breakdown" source={source}>
        <div className={grid.tableGrid2}>
          {quarters.map((q) => (
            <HeatmapDataTable
              key={q.quarter}
              table={{
                id: `${channelKey}-${q.quarter}`,
                title: `${channel.pageTitle} | ${q.quarter}`,
                columns: [
                  { key: "week", label: "Week", align: "left" },
                  { key: "actual", label: channel.actualLabel, align: "right", format: "currency" },
                  { key: "forecast", label: channel.forecastLabel, align: "right", format: "currency" },
                  { key: "diff", label: channel.diffLabel, align: "right", format: "currency" },
                  { key: "variancePct", label: channel.varianceLabel, align: "right", format: "percent" },
                  { key: "trend", label: channel.trendLabel, align: "right", bar: true },
                ],
                rows: q.hasData
                  ? q.rows.map((r) => ({
                      week: r.week,
                      actual: r.actual,
                      forecast: r.forecast,
                      diff: r.diff,
                      variancePct: r.variancePct,
                      trend: r.trend,
                    }))
                  : [{ week: "No data", actual: null, forecast: null, diff: null, variancePct: null, trend: null }],
                grandTotalRow: q.hasData
                  ? {
                      week: "TOTAL",
                      actual: q.total.actual,
                      forecast: q.total.forecast,
                      diff: q.total.diff,
                      variancePct: q.total.variancePct,
                      trend: null,
                    }
                  : undefined,
                source,
              }}
            />
          ))}
        </div>
      </Section>
    </>
  );
}
