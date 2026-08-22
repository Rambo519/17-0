import { openDataDatabase } from "@/data/cli/db";
import { importNflverseHistoricalData } from "@/data/sources/nflverse/import";

async function main(): Promise<void> {
  const { db, kind, close } = await openDataDatabase();
  console.log(`Importing into ${kind} database...`);
  const summary = await importNflverseHistoricalData(db, { databaseKind: kind });
  console.log(
    JSON.stringify(
      {
        cutoffSeason: summary.cutoffSeason,
        franchises: summary.franchises,
        players: summary.players,
        playerSeasons: summary.playerSeasons,
        cards: summary.cards,
        draftableCards: summary.draftableCards,
        skippedUnmappedFranchise: summary.diagnostics.skippedUnmappedFranchise,
        overridesApplied: summary.diagnostics.overridesApplied,
      },
      null,
      2,
    ),
  );
  await close?.();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
