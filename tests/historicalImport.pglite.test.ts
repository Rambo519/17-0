import { beforeAll, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  eras,
  franchises,
  players,
  playerSeasonPositions,
  playerSeasons,
  playerTeamEraCards,
} from "@/db/schema";
import { runCoverageAudit } from "@/data/audit/coverage";
import { derivePlayerTeamEraCards, replacePlayerTeamEraCards } from "@/data/cards/buildCards";
import { applyPositionOverrides } from "@/data/positions/overrides";
import { ERA_DEFINITIONS } from "@/lib/football/eras";

import { createTestDatabase } from "./helpers/pgliteDatabase";

describe("historical import behaviors (pglite)", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();

    const eraRows = await db
      .insert(eras)
      .values(ERA_DEFINITIONS.map((era) => ({ ...era })))
      .returning();
    const eraId = (label: string) => {
      const row = eraRows.find((era) => era.label === label);
      if (!row) throw new Error(label);
      return row.id;
    };

    const [sf, dal] = await db
      .insert(franchises)
      .values([
        {
          slug: "san-francisco-49ers",
          canonicalName: "San Francisco 49ers",
          canonicalAbbreviation: "SF",
        },
        {
          slug: "dallas-cowboys",
          canonicalName: "Dallas Cowboys",
          canonicalAbbreviation: "DAL",
        },
      ])
      .returning();
    if (!sf || !dal) throw new Error("franchise insert failed");

    const { franchiseSeasons } = await import("@/db/schema");
    await db.insert(franchiseSeasons).values([
      { franchiseId: sf.id, season: 1987, displayName: "San Francisco 49ers", abbreviation: "SF" },
      { franchiseId: sf.id, season: 1990, displayName: "San Francisco 49ers", abbreviation: "SF" },
      { franchiseId: sf.id, season: 1992, displayName: "San Francisco 49ers", abbreviation: "SF" },
      { franchiseId: dal.id, season: 1992, displayName: "Dallas Cowboys", abbreviation: "DAL" },
      { franchiseId: dal.id, season: 1994, displayName: "Dallas Cowboys", abbreviation: "DAL" },
    ]);

    const [montana] = await db
      .insert(players)
      .values({
        firstName: "Joe",
        lastName: "Montana",
        displayName: "Joe Montana",
        gsisId: "00-fixture-montana",
        externalId: "nflverse:gsis:00-fixture-montana",
      })
      .returning();
    const [journeyman] = await db
      .insert(players)
      .values({
        firstName: "Two",
        lastName: "Teams",
        displayName: "Two Teams",
        gsisId: "00-fixture-two-teams",
        externalId: "nflverse:gsis:00-fixture-two-teams",
      })
      .returning();
    const [fullback] = await db
      .insert(players)
      .values({
        firstName: "Moose",
        lastName: "Johnston",
        displayName: "Daryl Johnston",
        gsisId: "00-fixture-johnston",
        externalId: "nflverse:gsis:00-fixture-johnston",
      })
      .returning();
    if (!montana || !journeyman || !fullback) throw new Error("player insert failed");

    // One player, two decades, same franchise.
    for (const season of [1987, 1990]) {
      const [row] = await db
        .insert(playerSeasons)
        .values({
          playerId: montana.id,
          franchiseId: sf.id,
          season,
          rawPosition: "QB",
          primaryNormalizedPosition: "QB",
          games: 12,
          rosterStatus: "ACT",
          source: "fixture",
        })
        .returning();
      if (!row) throw new Error("season");
      await db.insert(playerSeasonPositions).values({
        playerSeasonId: row.id,
        position: "QB",
        isManualOverride: false,
      });
    }

    // One player, two franchises, same decade.
    for (const [franchiseId, season] of [
      [sf.id, 1992],
      [dal.id, 1994],
    ] as const) {
      const [row] = await db
        .insert(playerSeasons)
        .values({
          playerId: journeyman.id,
          franchiseId,
          season,
          rawPosition: "WR",
          primaryNormalizedPosition: "WR",
          games: 10,
          rosterStatus: "ACT",
          source: "fixture",
        })
        .returning();
      if (!row) throw new Error("season");
      await db.insert(playerSeasonPositions).values({
        playerSeasonId: row.id,
        position: "WR",
        isManualOverride: false,
      });
    }

    // Override adds FB after automatic RB.
    const automatic = ["RB"] as const;
    const overridden = applyPositionOverrides(automatic, [
      {
        gsisId: "00-fixture-johnston",
        eligiblePositions: ["RB", "FB"],
        reason: "fixture override",
      },
    ], {
      gsisId: "00-fixture-johnston",
      playerName: "Daryl Johnston",
      franchiseSlug: "dallas-cowboys",
      season: 1992,
    });

    const [fbSeason] = await db
      .insert(playerSeasons)
      .values({
        playerId: fullback.id,
        franchiseId: dal.id,
        season: 1992,
        rawPosition: "RB",
        primaryNormalizedPosition: "RB",
        games: 16,
        rosterStatus: "ACT",
        source: "fixture",
      })
      .returning();
    if (!fbSeason) throw new Error("fb season");
    await db.insert(playerSeasonPositions).values(
      overridden.positions.map((position) => ({
        playerSeasonId: fbSeason.id,
        position,
        isManualOverride: true,
        notes: "fixture override",
      })),
    );

    const cards = derivePlayerTeamEraCards([
      {
        playerId: montana.id,
        franchiseId: sf.id,
        seasons: [
          {
            season: 1987,
            eraId: eraId("1980s"),
            positions: ["QB"],
            games: 12,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
          {
            season: 1990,
            eraId: eraId("1990s"),
            positions: ["QB"],
            games: 12,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
        ],
      },
      {
        playerId: journeyman.id,
        franchiseId: sf.id,
        seasons: [
          {
            season: 1992,
            eraId: eraId("1990s"),
            positions: ["WR"],
            games: 10,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
        ],
      },
      {
        playerId: journeyman.id,
        franchiseId: dal.id,
        seasons: [
          {
            season: 1994,
            eraId: eraId("1990s"),
            positions: ["WR"],
            games: 10,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
        ],
      },
      {
        playerId: fullback.id,
        franchiseId: dal.id,
        seasons: [
          {
            season: 1992,
            eraId: eraId("1990s"),
            positions: overridden.positions,
            games: 16,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
        ],
      },
    ]);

    await replacePlayerTeamEraCards(db, cards);
  }, 60_000);

  it("deduplicates one player across decades into separate era cards", async () => {
    const [montana] = await db.select().from(players).where(eq(players.displayName, "Joe Montana"));
    expect(montana).toBeTruthy();
    const cards = await db
      .select()
      .from(playerTeamEraCards)
      .where(eq(playerTeamEraCards.playerId, montana!.id));
    expect(cards).toHaveLength(2);
  });

  it("creates one card per franchise when a player appears for two teams", async () => {
    const [player] = await db.select().from(players).where(eq(players.displayName, "Two Teams"));
    const cards = await db
      .select()
      .from(playerTeamEraCards)
      .where(eq(playerTeamEraCards.playerId, player!.id));
    expect(cards).toHaveLength(2);
  });

  it("applies manual override positions onto the card", async () => {
    const audit = await runCoverageAudit(db);
    expect(audit.cards).toBeGreaterThanOrEqual(4);
    const dallasNineties = audit.franchiseEraRows.find(
      (row) => row.franchiseSlug === "dallas-cowboys" && row.era === "1990s",
    );
    expect(dallasNineties?.fbCount).toBeGreaterThanOrEqual(1);
  });
});
