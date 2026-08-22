import { openDataDatabase } from "@/data/cli/db";
import { assertJohnstonHasFb, runHistoricalSanityChecks } from "@/data/sanity/historicalExamples";

async function main(): Promise<void> {
  const { db, close } = await openDataDatabase();
  try {
    const results = await runHistoricalSanityChecks(db);
    for (const result of results) {
      console.log(
        `${result.ok ? "PASS" : "FAIL"} ${result.label}` +
          (result.missing.length ? ` missing=${result.missing.join("; ")}` : ""),
      );
    }
    console.log(`Johnston FB eligibility: ${await assertJohnstonHasFb(db)}`);
    if (results.some((result) => !result.ok)) process.exitCode = 1;
  } finally {
    await close?.();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
