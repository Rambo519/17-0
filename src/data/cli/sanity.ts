import { openDataDatabase } from "@/data/cli/db";
import {
  assertJohnstonHasFb,
  runHistoricalProductionSanityChecks,
  runHistoricalSanityChecks,
} from "@/data/sanity/historicalExamples";

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

    const production = await runHistoricalProductionSanityChecks(db);
    for (const result of production) {
      const yards = [
        result.values.rushingYards,
        result.values.receivingYards,
        result.values.passingYards,
      ].find((value) => value != null && value !== 0);
      console.log(
        `${result.ok ? "PASS" : "FAIL"} [prod] ${result.label}` +
          (yards != null ? ` yards=${yards}` : ` ${result.detail}`),
      );
    }

    console.log(`Johnston FB eligibility: ${await assertJohnstonHasFb(db)}`);
    if (results.some((result) => !result.ok) || production.some((result) => !result.ok)) {
      process.exitCode = 1;
    }
  } finally {
    await close?.();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
