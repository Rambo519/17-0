import { mkdir, readFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";

import type { Database } from "./client";
import * as schema from "./schema";

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");
const MIGRATIONS_TABLE = "__local_migrations";

/** Durable local PGlite directory shared by data CLI and Next.js development. */
export const LOCAL_PGLITE_DIR = path.join(process.cwd(), ".data", "pglite");

/** True when this Node process is a Vitest worker. CLI and Next.js are not. */
export function isAutomatedTestProcess(): boolean {
  return Boolean(process.env.VITEST);
}

export function isDurableLocalPgliteDir(dataDir: string | undefined | null): boolean {
  if (dataDir == null || dataDir === "") return false;
  return path.resolve(dataDir) === path.resolve(LOCAL_PGLITE_DIR);
}

/**
 * The durable `.data/pglite` directory is exclusive to the local Next.js app
 * and to data CLI commands. Automated tests must use an isolated in-memory or
 * temporary directory instead — two PGlite WASM instances on the same data dir
 * abort (`Aborted(). Build with -sASSERTIONS for more info.`).
 */
export function assertDurablePgliteNotOpenedFromTests(): void {
  if (!isAutomatedTestProcess()) return;
  throw new Error(
    "Automated tests must not open the durable .data/pglite database. Use an isolated in-memory or temporary PGlite directory unique to the test process.",
  );
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Unclean PGlite shutdowns leave `postmaster.pid`. A live owner keeps the lock;
 * a missing, malformed, or dead pid is removed so the app can reopen the same
 * historical files. This does not delete relation data.
 */
async function removeStalePglitePid(dataDir: string): Promise<void> {
  const pidPath = path.join(dataDir, "postmaster.pid");
  let contents: string;
  try {
    contents = await readFile(pidPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  const pid = Number.parseInt(contents.split(/\r?\n/)[0]?.trim() ?? "", 10);
  if (Number.isInteger(pid) && pid > 0 && isProcessAlive(pid)) return;

  await unlink(pidPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

type LocalPgliteHandle = {
  db: Database;
  close: () => Promise<void>;
};

const globalForPglite = globalThis as typeof globalThis & {
  __localPgliteHandle?: LocalPgliteHandle;
  __localPglitePromise?: Promise<LocalPgliteHandle>;
};

async function listMigrationFiles(): Promise<string[]> {
  return (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
}

async function execMigrationSql(client: PGlite, sqlText: string): Promise<void> {
  for (const statement of sqlText.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) await client.exec(trimmed);
  }
}

async function ensureMigrationsTable(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrationIds(client: PGlite): Promise<Set<string>> {
  const result = await client.query<{ id: string }>(`select id from ${MIGRATIONS_TABLE}`);
  return new Set(result.rows.map((row) => row.id));
}

async function recordMigration(client: PGlite, id: string): Promise<void> {
  await client.query(`insert into ${MIGRATIONS_TABLE} (id) values ($1) on conflict (id) do nothing`, [
    id,
  ]);
}

async function tableExists(client: PGlite, tableName: string): Promise<boolean> {
  const result = await client.query<{ reg: string | null }>(
    "select to_regclass($1)::text as reg",
    [`public.${tableName}`],
  );
  return result.rows[0]?.reg != null;
}

async function columnExists(
  client: PGlite,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = $1
          and column_name = $2
      ) as exists
    `,
    [tableName, columnName],
  );
  return Boolean(result.rows[0]?.exists);
}

/**
 * Databases created before migration journaling already have early schema.
 * Mark those migrations applied so we don't re-run CREATE TABLE scripts.
 */
async function bootstrapPreJournalDatabase(
  client: PGlite,
  applied: Set<string>,
): Promise<void> {
  if (!(await tableExists(client, "eras"))) return;

  if (!applied.has("0000_swift_quasimodo.sql")) {
    await recordMigration(client, "0000_swift_quasimodo.sql");
    applied.add("0000_swift_quasimodo.sql");
  }

  if (
    !applied.has("0001_roster_status.sql") &&
    (await columnExists(client, "player_seasons", "roster_status"))
  ) {
    await recordMigration(client, "0001_roster_status.sql");
    applied.add("0001_roster_status.sql");
  }

  if (
    !applied.has("0002_game_mode_and_skips.sql") &&
    (await columnExists(client, "game_sessions", "mode"))
  ) {
    await recordMigration(client, "0002_game_mode_and_skips.sql");
    applied.add("0002_game_mode_and_skips.sql");
  }
}

/**
 * Applies any Drizzle SQL migrations not yet recorded on this PGlite database.
 * Safe for both empty and durable historical databases.
 */
export async function applyLocalPgliteMigrations(client: PGlite): Promise<void> {
  await ensureMigrationsTable(client);
  const applied = await appliedMigrationIds(client);
  await bootstrapPreJournalDatabase(client, applied);

  for (const file of await listMigrationFiles()) {
    if (applied.has(file)) continue;
    const sqlText = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await execMigrationSql(client, sqlText);
    await recordMigration(client, file);
    applied.add(file);
  }
}

async function openFreshLocalPgliteDatabase(): Promise<LocalPgliteHandle> {
  assertDurablePgliteNotOpenedFromTests();
  await mkdir(LOCAL_PGLITE_DIR, { recursive: true });
  await removeStalePglitePid(LOCAL_PGLITE_DIR);
  const client = new PGlite(LOCAL_PGLITE_DIR);
  await applyLocalPgliteMigrations(client);

  const db = drizzlePglite(client, { schema }) as unknown as Database;
  return {
    db,
    close: async () => {
      await client.close();
      if (globalForPglite.__localPgliteHandle?.db === db) {
        globalForPglite.__localPgliteHandle = undefined;
        globalForPglite.__localPglitePromise = undefined;
      }
    },
  };
}

/**
 * Opens the durable `.data/pglite` database used by historical data commands
 * and by the Next.js app in local development when `DATABASE_URL` is unset.
 *
 * Within a single Node process this is a singleton: opening the same data
 * directory twice can crash or invalidate the first handle (which surfaced in
 * the browser as `TypeError: Failed to fetch` on later spins).
 */
export async function openLocalPgliteDatabase(): Promise<LocalPgliteHandle> {
  assertDurablePgliteNotOpenedFromTests();

  if (globalForPglite.__localPgliteHandle) {
    return globalForPglite.__localPgliteHandle;
  }

  globalForPglite.__localPglitePromise ??= openFreshLocalPgliteDatabase()
    .then((handle) => {
      globalForPglite.__localPgliteHandle = handle;
      return handle;
    })
    .catch((error) => {
      globalForPglite.__localPglitePromise = undefined;
      throw error;
    });

  return globalForPglite.__localPglitePromise;
}
