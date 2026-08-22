import { readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { config as loadEnv } from "dotenv";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";

import { createDatabase, type Database } from "@/db/client";
import * as schema from "@/db/schema";

loadEnv({ path: ".env.local" });
loadEnv();

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");
export const LOCAL_PGLITE_DIR = path.join(process.cwd(), ".data", "pglite");

async function applyMigrations(client: PGlite): Promise<void> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sqlText = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sqlText.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) await client.exec(trimmed);
    }
  }
}

async function needsMigrations(client: PGlite): Promise<boolean> {
  const result = await client.query<{ reg: string | null }>(
    "select to_regclass('public.eras')::text as reg",
  );
  return result.rows[0]?.reg == null;
}

async function ensureRosterStatusColumn(client: PGlite): Promise<void> {
  await client.exec(`
    ALTER TABLE player_seasons
    ADD COLUMN IF NOT EXISTS roster_status text
  `);
}

/**
 * Opens the database used by historical data commands.
 *
 * Prefers `DATABASE_URL` when set; otherwise uses a durable local PGlite
 * database under `.data/pglite` so Docker/Postgres are not required.
 */
export async function openDataDatabase(): Promise<{
  db: Database;
  kind: "postgres" | "pglite";
  close?: () => Promise<void>;
}> {
  if (process.env.DATABASE_URL) {
    return { db: createDatabase(), kind: "postgres" };
  }

  await mkdir(LOCAL_PGLITE_DIR, { recursive: true });
  const client = new PGlite(LOCAL_PGLITE_DIR);
  if (await needsMigrations(client)) {
    await applyMigrations(client);
  } else {
    await ensureRosterStatusColumn(client);
  }

  const db = drizzlePglite(client, { schema }) as unknown as Database;
  return {
    db,
    kind: "pglite",
    close: async () => {
      await client.close();
    },
  };
}
