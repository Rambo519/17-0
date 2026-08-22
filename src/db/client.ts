import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  return url;
}

export function createDatabase() {
  const client = postgres(connectionString(), { max: 5, prepare: false });
  return drizzle(client, { schema });
}

/**
 * Cached across hot reloads so dev doesn't exhaust Postgres connections.
 */
const globalForDb = globalThis as typeof globalThis & { __db?: Database };

export function getDb(): Database {
  globalForDb.__db ??= createDatabase();
  return globalForDb.__db;
}
