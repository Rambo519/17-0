import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/db/client";
import { isDurableLocalPgliteDir } from "@/db/localPglite";
import * as schema from "@/db/schema";

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

/**
 * Unique per call and never the app's durable `.data/pglite` directory.
 * Tests must not share a data dir with `next dev`.
 */
export async function createIsolatedPgliteDataDir(): Promise<string> {
  const dataDir = await mkdtemp(path.join(tmpdir(), `seventeen-pglite-${process.pid}-`));
  if (isDurableLocalPgliteDir(dataDir)) {
    throw new Error(
      "Isolated test PGlite directory resolved to the durable .data/pglite path.",
    );
  }
  return dataDir;
}

/**
 * Spins up an isolated in-process Postgres and applies the generated
 * migrations, so the Drizzle repository and the dev seed can be exercised
 * against real SQL without an external database or the durable app data dir.
 */
export async function createTestDatabase(): Promise<Database> {
  const dataDir = await createIsolatedPgliteDataDir();
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });

  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) await client.exec(trimmed);
    }
  }

  return db as unknown as Database;
}
