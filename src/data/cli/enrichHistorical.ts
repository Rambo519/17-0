import { downloadHistoricalStats } from "@/data/sources/historicalStats/download";
import { enrichPlayerSeasonsWithHistoricalStats } from "@/data/sources/historicalStats/enrich";
import {
  HISTORICAL_STATS_END_SEASON,
  HISTORICAL_STATS_START_SEASON,
} from "@/data/sources/statsBoundary";
import { openDataDatabase } from "@/data/cli/db";
import { runCoverageAudit, writeCoverageAuditReports } from "@/data/audit/coverage";

async function main(): Promise<void> {
  const startSeason = Number(process.env.HISTORICAL_START_SEASON ?? HISTORICAL_STATS_START_SEASON);
  const endSeason = Number(process.env.HISTORICAL_END_SEASON ?? HISTORICAL_STATS_END_SEASON);
  const force = process.env.HISTORICAL_FORCE === "1";

  console.log(`== data:download-historical (${startSeason}–${endSeason}) ==`);
  const { manifest } = await downloadHistoricalStats({ startSeason, endSeason, force });
  console.log(
    `Downloaded seasons=${manifest.seasonsDownloaded.length} adapters documented in data/manifests/historical-stats.json`,
  );

  console.log("== data:enrich-historical ==");
  const { db, kind, close } = await openDataDatabase();
  console.log(`Using ${kind}`);
  try {
    const result = await enrichPlayerSeasonsWithHistoricalStats(db, {
      startSeason,
      endSeason,
    });
    const s = result.summary;
    console.log(
      `Matched=${s.matched} enriched=${s.enrichedSeasons} fields=${s.fieldsWritten} ambiguous=${s.ambiguous} unresolved=${s.unresolved}`,
    );
    console.log(`Reports: ${result.reportPaths.summaryPath}`);

    console.log("== data:audit (post-enrichment) ==");
    const report = await runCoverageAudit(db);
    const paths = await writeCoverageAuditReports(report);
    if (report.productionByEra) {
      for (const row of report.productionByEra) {
        console.log(
          `${row.era}: ${row.productionCoveragePercent}% production coverage (${row.cardsWithAnyProduction}/${row.draftableCards})`,
        );
      }
    }
    console.log(`Audit summary: ${paths.summaryPath}`);
  } finally {
    await close?.();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
