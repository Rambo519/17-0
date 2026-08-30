import { applyOverridesAndRebuildCards } from "@/data/cards/rebuildFromDatabase";
import { openDataDatabase } from "@/data/cli/db";
import { writePeerBaselineSnapshot } from "@/data/scoring/writePeerBaselineSnapshot";

async function main(): Promise<void> {
  const { db, kind, close } = await openDataDatabase();
  console.log(`Rebuilding cards in ${kind} database (applying position overrides)...`);
  try {
    const result = await applyOverridesAndRebuildCards(db);
    console.log(
      JSON.stringify(
        {
          overridesLoaded: result.overridesLoaded,
          seasonsTouched: result.seasonsTouched,
          positionsInserted: result.positionsInserted,
          cardsWritten: result.cardsWritten,
        },
        null,
        2,
      ),
    );

    console.log("== scoring:build-baselines ==");
    const snapshot = await writePeerBaselineSnapshot(db);
    console.log(
      JSON.stringify(
        {
          path: snapshot.path,
          playerSeasonCount: snapshot.playerSeasonCount,
          bucketCount: snapshot.bucketCount,
          bytes: snapshot.bytes,
        },
        null,
        2,
      ),
    );
  } finally {
    await close?.();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
