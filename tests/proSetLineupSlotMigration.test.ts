import { readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import { createIsolatedPgliteDataDir } from "./helpers/pgliteDatabase";

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

async function execSqlFile(client: PGlite, fileName: string): Promise<void> {
  const sqlText = await readFile(path.join(MIGRATIONS_DIR, fileName), "utf8");
  for (const statement of sqlText.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) await client.exec(trimmed);
  }
}

describe("0003 pro-set lineup_slot migration (isolated PGlite only)", () => {
  let client: PGlite | null = null;

  afterEach(async () => {
    if (client) {
      await client.close();
      client = null;
    }
  });

  it("remaps RB/FB picks and replaces the lineup_slot enum", { timeout: 15_000 }, async () => {
    client = new PGlite(await createIsolatedPgliteDataDir());
    await execSqlFile(client, "0000_swift_quasimodo.sql");
    await execSqlFile(client, "0001_roster_status.sql");
    await execSqlFile(client, "0002_game_mode_and_skips.sql");

    await client.exec(`
      INSERT INTO eras (label, start_year, end_year) VALUES ('1980s', 1980, 1989);
      INSERT INTO franchises (slug, canonical_name, canonical_abbreviation)
        VALUES ('sf', 'San Francisco 49ers', 'SF');
      INSERT INTO players (first_name, last_name, display_name)
        VALUES ('Test', 'Back', 'Test Back'), ('Test', 'Full', 'Test Full');
      INSERT INTO player_team_era_cards (player_id, franchise_id, era_id, first_season, last_season)
        VALUES (1, 1, 1, 1980, 1985), (2, 1, 1, 1980, 1985);
      INSERT INTO game_sessions (id, status)
        VALUES ('00000000-0000-4000-8000-000000000001', 'COMPLETE');
      INSERT INTO game_picks (
        game_session_id, round_number, lineup_slot, player_id,
        player_team_era_card_id, franchise_id, era_id
      ) VALUES
        ('00000000-0000-4000-8000-000000000001', 1, 'RB', 1, 1, 1, 1),
        ('00000000-0000-4000-8000-000000000001', 2, 'FB', 2, 2, 1, 1);
    `);

    await execSqlFile(client, "0003_pro_set_lineup_slots.sql");

    const picks = await client.query<{ lineup_slot: string }>(
      "select lineup_slot from game_picks order by round_number",
    );
    expect(picks.rows.map((row) => row.lineup_slot)).toEqual(["RB1", "RB2"]);

    const leftover = await client.query<{ count: number }>(
      `select count(*)::int as count from game_picks
       where lineup_slot::text in ('RB', 'FB')`,
    );
    expect(leftover.rows[0]?.count).toBe(0);

    const labels = await client.query<{ enumlabel: string }>(
      `select e.enumlabel
       from pg_enum e
       join pg_type t on e.enumtypid = t.oid
       where t.typname = 'lineup_slot'
       order by e.enumsortorder`,
    );
    expect(labels.rows.map((row) => row.enumlabel)).toEqual([
      "QB",
      "RB1",
      "RB2",
      "WR1",
      "WR2",
      "TE",
    ]);

    const positions = await client.query<{ enumlabel: string }>(
      `select e.enumlabel
       from pg_enum e
       join pg_type t on e.enumtypid = t.oid
       where t.typname = 'normalized_position'
       order by e.enumsortorder`,
    );
    expect(positions.rows.map((row) => row.enumlabel)).toEqual([
      "QB",
      "RB",
      "FB",
      "WR",
      "TE",
    ]);
  });
});
