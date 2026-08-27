/** @vitest-environment node */

import { beforeAll, describe, expect, it } from "vitest";

import { applyOverridesAndRebuildCards } from "@/data/cards/rebuildFromDatabase";
import type { Database } from "@/db/client";
import {
  eras,
  franchises,
  franchiseSeasons,
  players,
  playerSeasonPositions,
  playerSeasons,
  playerTeamEraCards,
} from "@/db/schema";
import { ERA_DEFINITIONS } from "@/lib/football/eras";
import { createDrizzleGameRepository } from "@/server/repository/drizzleGameRepository";

import { createTestDatabase } from "./helpers/pgliteDatabase";

describe("draftability rebuild (isolated pglite)", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
    const eraRows = await db.insert(eras).values(ERA_DEFINITIONS.map((era) => ({ ...era }))).returning();
    const era2000s = eraRows.find((era) => era.label === "2000s");
    if (!era2000s) throw new Error("missing 2000s");

    const [dal] = await db
      .insert(franchises)
      .values({
        slug: "dallas-cowboys",
        canonicalName: "Dallas Cowboys",
        canonicalAbbreviation: "DAL",
      })
      .returning();
    if (!dal) throw new Error("franchise");

    await db.insert(franchiseSeasons).values({
      franchiseId: dal.id,
      season: 2005,
      displayName: "Dallas Cowboys",
      abbreviation: "DAL",
    });

    const [producer, rosterOnly] = await db
      .insert(players)
      .values([
        {
          firstName: "Terry",
          lastName: "Glenn",
          displayName: "Terry Glenn",
          externalId: "fixture:glenn",
        },
        {
          firstName: "Alonzo",
          lastName: "Coleman",
          displayName: "Alonzo Coleman",
          externalId: "fixture:coleman",
        },
      ])
      .returning();
    if (!producer || !rosterOnly) throw new Error("players");

    const [producerSeason] = await db
      .insert(playerSeasons)
      .values({
        playerId: producer.id,
        franchiseId: dal.id,
        season: 2005,
        rawPosition: "WR",
        primaryNormalizedPosition: "WR",
        games: 16,
        rosterStatus: "ACT",
        receivingYards: 1136,
        receptions: 62,
        source: "fixture",
      })
      .returning();
    const [rosterSeason] = await db
      .insert(playerSeasons)
      .values({
        playerId: rosterOnly.id,
        franchiseId: dal.id,
        season: 2005,
        rawPosition: "RB",
        primaryNormalizedPosition: "RB",
        games: null,
        rosterStatus: "ACT",
        source: "fixture",
      })
      .returning();
    if (!producerSeason || !rosterSeason) throw new Error("seasons");

    await db.insert(playerSeasonPositions).values([
      { playerSeasonId: producerSeason.id, position: "WR", isManualOverride: false },
      { playerSeasonId: rosterSeason.id, position: "RB", isManualOverride: false },
    ]);

    await applyOverridesAndRebuildCards(db, []);
  }, 60_000);

  it("rebuilds cards so roster-only players are not draftable", async () => {
    const cards = await db.select().from(playerTeamEraCards);
    const named = await db.select().from(players);
    const producerPlayer = named.find((row) => row.displayName === "Terry Glenn");
    const rosterPlayer = named.find((row) => row.displayName === "Alonzo Coleman");
    const producerCard = cards.find((card) => card.playerId === producerPlayer?.id);
    const rosterCard = cards.find((card) => card.playerId === rosterPlayer?.id);

    expect(producerCard?.draftable).toBe(true);
    expect(rosterCard?.draftable).toBe(false);

    const repository = createDrizzleGameRepository(db);
    const draftable = await repository.listDraftableCards({
      positions: ["QB", "RB", "FB", "WR", "TE"],
      excludePlayerIds: [],
    });
    expect(draftable).toHaveLength(1);
    expect(draftable[0]?.playerName).toBe("Terry Glenn");
    expect(draftable.some((card) => card.playerName === "Alonzo Coleman")).toBe(false);
  });
});
