import { describe, expect, it } from "vitest";

import { eras, franchises, players, playerSeasons, playerTeamEraCards, playerTeamEraPositions } from "@/db/schema";
import { createDrizzleGameRepository } from "@/server/repository/drizzleGameRepository";

import { createTestDatabase } from "./helpers/pgliteDatabase";

describe("classic production from isolated database", () => {
  it("sums stored 1999+ yards for modern QB/RB/WR/TE cards without opening .data/pglite", async () => {
    const db = await createTestDatabase();
    const repository = createDrizzleGameRepository(db);

    const eraRows = await db
      .insert(eras)
      .values([
        { label: "1980s", startYear: 1980, endYear: 1989 },
        { label: "2010s", startYear: 2010, endYear: 2019 },
        { label: "2020s", startYear: 2020, endYear: 2029 },
      ])
      .returning();
    const eraId = (label: string) => {
      const row = eraRows.find((era) => era.label === label);
      if (!row) throw new Error(label);
      return row.id;
    };

    const [franchise] = await db
      .insert(franchises)
      .values({
        slug: "kansas-city-chiefs",
        canonicalName: "Kansas City Chiefs",
        canonicalAbbreviation: "KC",
      })
      .returning();
    if (!franchise) throw new Error("franchise insert failed");
    const franchiseId = franchise.id;

    async function insertCard(input: {
      firstName: string;
      lastName: string;
      era: string;
      position: "QB" | "RB" | "WR" | "TE";
      seasons: { season: number; games: number; passingYards?: number; rushingYards?: number; receivingYards?: number }[];
    }) {
      const [player] = await db
        .insert(players)
        .values({
          firstName: input.firstName,
          lastName: input.lastName,
          displayName: `${input.firstName} ${input.lastName}`,
        })
        .returning();
      if (!player) throw new Error("player insert failed");

      const seasons = [...input.seasons].sort((a, b) => a.season - b.season);
      for (const season of seasons) {
        await db.insert(playerSeasons).values({
          playerId: player.id,
          franchiseId,
          season: season.season,
          rawPosition: input.position,
          primaryNormalizedPosition: input.position,
          games: season.games,
          passingYards: season.passingYards ?? null,
          rushingYards: season.rushingYards ?? null,
          receivingYards: season.receivingYards ?? null,
          source: "isolated-fixture",
        });
      }

      const [card] = await db
        .insert(playerTeamEraCards)
        .values({
          playerId: player.id,
          franchiseId,
          eraId: eraId(input.era),
          firstSeason: seasons[0]!.season,
          lastSeason: seasons[seasons.length - 1]!.season,
          representativeSeason: seasons[0]!.season,
          draftable: true,
        })
        .returning();
      if (!card) throw new Error("card insert failed");

      await db.insert(playerTeamEraPositions).values({
        playerTeamEraCardId: card.id,
        position: input.position,
      });

      return card.id;
    }

    const qbId = await insertCard({
      firstName: "Modern",
      lastName: "Quarterback",
      era: "2020s",
      position: "QB",
      seasons: [
        { season: 2020, games: 16, passingYards: 4740 },
        { season: 2021, games: 17, passingYards: 4839 },
      ],
    });
    const rbId = await insertCard({
      firstName: "Modern",
      lastName: "Runner",
      era: "2010s",
      position: "RB",
      seasons: [
        { season: 2012, games: 16, rushingYards: 2097 },
        { season: 2015, games: 16, rushingYards: 1485 },
      ],
    });
    const wrId = await insertCard({
      firstName: "Modern",
      lastName: "Receiver",
      era: "2020s",
      position: "WR",
      seasons: [{ season: 2023, games: 16, receivingYards: 1799 }],
    });
    const teId = await insertCard({
      firstName: "Modern",
      lastName: "Tightend",
      era: "2020s",
      position: "TE",
      seasons: [
        { season: 2020, games: 15, receivingYards: 1416 },
        { season: 2022, games: 17, receivingYards: 1338 },
      ],
    });
    const classicQbId = await insertCard({
      firstName: "Classic",
      lastName: "Quarterback",
      era: "1980s",
      position: "QB",
      seasons: [{ season: 1984, games: 16, passingYards: 3630 }],
    });

    const production = await repository.getProductionForCards([qbId, rbId, wrId, teId, classicQbId]);

    expect(production.get(qbId)?.games).toBe(33);
    expect(production.get(qbId)?.passingYards).toBe(9579);
    expect(production.get(rbId)?.games).toBe(32);
    expect(production.get(rbId)?.rushingYards).toBe(3582);
    expect(production.get(wrId)?.games).toBe(16);
    expect(production.get(wrId)?.receivingYards).toBe(1799);
    expect(production.get(teId)?.games).toBe(32);
    expect(production.get(teId)?.receivingYards).toBe(2754);
    expect(production.get(classicQbId)?.games).toBe(16);
    expect(production.get(classicQbId)?.passingYards).toBe(3630);
  }, 60_000);

  it("sums BAL 2000s TE production across the full card window, not a single season", async () => {
    const db = await createTestDatabase();
    const repository = createDrizzleGameRepository(db);
    const [era] = await db.insert(eras).values({ label: "2000s", startYear: 2000, endYear: 2009 }).returning();
    const [franchise] = await db
      .insert(franchises)
      .values({
        slug: "baltimore-ravens",
        canonicalName: "Baltimore Ravens",
        canonicalAbbreviation: "BAL",
      })
      .returning();
    if (!era || !franchise) throw new Error("fixture insert failed");
    const [player] = await db
      .insert(players)
      .values({ firstName: "Todd", lastName: "Heap", displayName: "Todd Heap" })
      .returning();
    if (!player) throw new Error("player insert failed");

    await db.insert(playerSeasons).values([
      {
        playerId: player.id,
        franchiseId: franchise.id,
        season: 2001,
        rawPosition: "TE",
        primaryNormalizedPosition: "TE",
        games: 12,
        receptions: 16,
        receivingYards: 206,
        receivingTouchdowns: 1,
        source: "isolated-fixture",
      },
      {
        playerId: player.id,
        franchiseId: franchise.id,
        season: 2005,
        rawPosition: "TE",
        primaryNormalizedPosition: "TE",
        games: 16,
        receptions: 75,
        receivingYards: 855,
        receivingTouchdowns: 7,
        source: "isolated-fixture",
      },
    ]);
    const [card] = await db
      .insert(playerTeamEraCards)
      .values({
        playerId: player.id,
        franchiseId: franchise.id,
        eraId: era.id,
        firstSeason: 2001,
        lastSeason: 2005,
        representativeSeason: 2005,
        draftable: true,
      })
      .returning();
    if (!card) throw new Error("card insert failed");
    await db.insert(playerTeamEraPositions).values({ playerTeamEraCardId: card.id, position: "TE" });

    const production = await repository.getProductionForCards([card.id]);
    expect(production.get(card.id)?.receptions).toBe(91);
    expect(production.get(card.id)?.receivingYards).toBe(1061);
    expect(production.get(card.id)?.receivingTouchdowns).toBe(8);
  }, 60_000);
});
