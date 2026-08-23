import { readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import { applyLocalPgliteMigrations } from "@/db/localPglite";

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

async function execSqlFile(client: PGlite, fileName: string): Promise<void> {
  const sqlText = await readFile(path.join(MIGRATIONS_DIR, fileName), "utf8");
  for (const statement of sqlText.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) await client.exec(trimmed);
  }
}

async function hasColumn(client: PGlite, table: string, column: string): Promise<boolean> {
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
    [table, column],
  );
  return Boolean(result.rows[0]?.exists);
}

describe("applyLocalPgliteMigrations", () => {
  let client: PGlite | null = null;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = null;
    }
  });

  it("applies pending Phase 3 columns to a pre-journal historical database", async () => {
    client = new PGlite();
    await execSqlFile(client, "0000_swift_quasimodo.sql");
    await execSqlFile(client, "0001_roster_status.sql");

    expect(await hasColumn(client, "game_sessions", "mode")).toBe(false);

    await applyLocalPgliteMigrations(client);

    expect(await hasColumn(client, "game_sessions", "mode")).toBe(true);
    expect(await hasColumn(client, "game_sessions", "team_skip_remaining")).toBe(true);
    expect(await hasColumn(client, "game_sessions", "era_skip_remaining")).toBe(true);
  });

  it("is idempotent when migrations are already applied", async () => {
    client = new PGlite();
    await applyLocalPgliteMigrations(client);
    await applyLocalPgliteMigrations(client);

    expect(await hasColumn(client, "game_sessions", "mode")).toBe(true);
  });
});
