import { openDataDatabase } from "@/data/cli/db";
import { writePeerBaselineSnapshot } from "@/data/scoring/writePeerBaselineSnapshot";

async function main(): Promise<void> {
  const { db, kind, close } = await openDataDatabase();
  console.log(`Building peer-baseline snapshot from ${kind} database...`);
  try {
    const result = await writePeerBaselineSnapshot(db);
    console.log(
      JSON.stringify(
        {
          path: result.path,
          version: result.version,
          playerSeasonCount: result.playerSeasonCount,
          bucketCount: result.bucketCount,
          seasonRange: result.seasonRange,
          bytes: result.bytes,
        },
        null,
        2,
      ),
    );
    console.log(
      "Regenerate after historical import, player-season production changes, or peer-baseline rule changes.",
    );
  } finally {
    await close?.();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
