import { config as loadEnv } from "dotenv";

import { createDatabase, type Database } from "@/db/client";
import { LOCAL_PGLITE_DIR, openLocalPgliteDatabase } from "@/db/localPglite";

loadEnv({ path: ".env.local" });
loadEnv();

export { LOCAL_PGLITE_DIR };

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

  const { db, close } = await openLocalPgliteDatabase();
  return {
    db,
    kind: "pglite",
    close,
  };
}
