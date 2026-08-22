import { readFile } from "node:fs/promises";
import path from "node:path";

import { openDataDatabase } from "@/data/cli/db";
import { runCoverageAudit, writeCoverageAuditReports } from "@/data/audit/coverage";

async function main(): Promise<void> {
  const { db, kind, close } = await openDataDatabase();
  console.log(`Auditing ${kind} database...`);
  const report = await runCoverageAudit(db);
  const paths = await writeCoverageAuditReports(report);
  const summary = await readFile(paths.summaryPath, "utf8");
  console.log(summary);
  console.log(`Reports: ${path.relative(process.cwd(), paths.summaryPath)}`);
  await close?.();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
