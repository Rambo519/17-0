import { applyOverridesAndRebuildCards } from "@/data/cards/rebuildFromDatabase";
import { openDataDatabase } from "@/data/cli/db";

async function main(): Promise<void> {
  const { db, kind, close } = await openDataDatabase();
  console.log(`Rebuilding cards in ${kind} database (applying position overrides)...`);
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
  await close?.();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
