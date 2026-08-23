import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

export type AppDatabaseBackend = "postgres" | "pglite";

/**
 * Pure resolution of which database backend the web app should use.
 * Production never falls back to PGlite.
 */
export function resolveAppDatabaseBackend(env: {
  DATABASE_URL?: string;
  NODE_ENV?: string;
}): AppDatabaseBackend {
  if (env.DATABASE_URL) return "postgres";
  if (env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  return "pglite";
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  return url;
}

/** Explicit Postgres connection. Requires `DATABASE_URL`. */
export function createDatabase() {
  const client = postgres(connectionString(), { max: 5, prepare: false });
  return drizzle(client, { schema });
}

/**
 * Cached across hot reloads so dev doesn't exhaust Postgres connections or
 * open multiple PGlite handles against the same durable directory.
 */
const globalForDb = globalThis as typeof globalThis & {
  __db?: Database;
  __dbPromise?: Promise<Database>;
};

async function openAppDatabase(): Promise<Database> {
  const backend = resolveAppDatabaseBackend({
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (backend === "postgres") {
    return createDatabase();
  }

  const { openLocalPgliteDatabase } = await import("./localPglite");
  const { db } = await openLocalPgliteDatabase();
  return db;
}

export async function getDb(): Promise<Database> {
  if (globalForDb.__db) return globalForDb.__db;
  globalForDb.__dbPromise ??= openAppDatabase();
  const db = await globalForDb.__dbPromise;
  globalForDb.__db = db;
  return db;
}
