import { openDataDatabase } from "@/data/cli/db";
import {
  formatDraftabilityImpact,
  runDraftabilityImpactAudit,
} from "@/data/audit/draftabilityImpact";

async function main(): Promise<void> {
  const { db, kind, close } = await openDataDatabase();
  console.log(`Simulating draftability against ${kind} database (read-only)...`);
  const report = await runDraftabilityImpactAudit(db);
  console.log(formatDraftabilityImpact(report));
  await close?.();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
