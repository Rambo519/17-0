import { openDataDatabase } from "@/data/cli/db";
import { rebuildCardsFromDatabase } from "@/data/sources/nflverse/import";

async function main(): Promise<void> {
  const { db, kind, close } = await openDataDatabase();
  console.log(`Rebuilding cards in ${kind} database...`);
  const count = await rebuildCardsFromDatabase(db);
  console.log(`Wrote ${count} player-team-era cards.`);
  await close?.();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
