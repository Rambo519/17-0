import { downloadNflverseData } from "@/data/sources/nflverse/download";
import { NFLVERSE_DEFAULT_CUTOFF_SEASON } from "@/data/sources/nflverse/config";
import { openDataDatabase } from "@/data/cli/db";
import { importNflverseHistoricalData } from "@/data/sources/nflverse/import";
import { downloadHistoricalStats } from "@/data/sources/historicalStats/download";
import { enrichPlayerSeasonsWithHistoricalStats } from "@/data/sources/historicalStats/enrich";
import { runCoverageAudit, writeCoverageAuditReports } from "@/data/audit/coverage";

async function main(): Promise<void> {
  const cutoff = Number(process.env.IMPORT_CUTOFF_SEASON ?? NFLVERSE_DEFAULT_CUTOFF_SEASON);
  console.log(`== data:download (cutoff ${cutoff}) ==`);
  await downloadNflverseData({ cutoffSeason: cutoff });

  console.log("== data:import ==");
  const { db, kind, close } = await openDataDatabase();
  console.log(`Using ${kind}`);
  const summary = await importNflverseHistoricalData(db, {
    cutoffSeason: cutoff,
    databaseKind: kind,
  });
  console.log(
    `Imported players=${summary.players} seasons=${summary.playerSeasons} cards=${summary.cards}`,
  );

  console.log("== data:download-historical + enrich ==");
  await downloadHistoricalStats();
  const enrichment = await enrichPlayerSeasonsWithHistoricalStats(db);
  console.log(
    `Historical enriched=${enrichment.summary.enrichedSeasons} ambiguous=${enrichment.summary.ambiguous} unresolved=${enrichment.summary.unresolved}`,
  );

  console.log("== data:audit ==");
  const report = await runCoverageAudit(db);
  const paths = await writeCoverageAuditReports(report);
  console.log(
    `FB coverage: 0=${report.fullbackCoverage.zeroFb} 1=${report.fullbackCoverage.oneFb} 2+=${report.fullbackCoverage.twoOrMoreFb}`,
  );
  for (const row of report.productionByEra) {
    console.log(`${row.era}: ${row.productionCoveragePercent}% production coverage`);
  }
  console.log(`Summary written to ${paths.summaryPath}`);
  await close?.();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
