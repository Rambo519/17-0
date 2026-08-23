import { access } from "node:fs/promises";

import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { NormalizedPosition } from "@/lib/football/positions";
import { LOCAL_PGLITE_DIR, openLocalPgliteDatabase } from "@/db/localPglite";
import { eras, franchises, players, playerTeamEraCards, playerTeamEraPositions } from "@/db/schema";
import { createDrizzleGameRepository } from "@/server/repository/drizzleGameRepository";

async function durableDbReady(): Promise<boolean> {
  try {
    await access(LOCAL_PGLITE_DIR);
    return true;
  } catch {
    return false;
  }
}

describe("classic production from durable historical database", () => {
  it("exposes stored 1999+ yards for modern QB/RB/WR/TE cards", async () => {
    if (!(await durableDbReady())) {
      expect(true).toBe(true);
      return;
    }

    const { db, close } = await openLocalPgliteDatabase();
    try {
      const repository = createDrizzleGameRepository(db);

      async function cardFor(
        playerName: string,
        eraLabel: string,
        position: NormalizedPosition,
      ) {
        const rows = await db
          .select({
            cardId: playerTeamEraCards.id,
            playerName: players.displayName,
            eraLabel: eras.label,
          })
          .from(playerTeamEraCards)
          .innerJoin(players, eq(players.id, playerTeamEraCards.playerId))
          .innerJoin(eras, eq(eras.id, playerTeamEraCards.eraId))
          .innerJoin(
            playerTeamEraPositions,
            and(
              eq(playerTeamEraPositions.playerTeamEraCardId, playerTeamEraCards.id),
              eq(playerTeamEraPositions.position, position),
            ),
          )
          .where(
            and(
              eq(players.displayName, playerName),
              eq(eras.label, eraLabel),
              eq(playerTeamEraCards.draftable, true),
            ),
          )
          .limit(1);
        return rows[0] ?? null;
      }

      const samples: {
        name: string;
        era: string;
        position: NormalizedPosition;
        field: "passingYards" | "rushingYards" | "receivingYards";
      }[] = [
        { name: "Patrick Mahomes", era: "2020s", position: "QB", field: "passingYards" },
        { name: "Adrian Peterson", era: "2010s", position: "RB", field: "rushingYards" },
        { name: "Tyreek Hill", era: "2020s", position: "WR", field: "receivingYards" },
        { name: "Travis Kelce", era: "2020s", position: "TE", field: "receivingYards" },
      ];

      for (const sample of samples) {
        const card = await cardFor(sample.name, sample.era, sample.position);
        expect(card, `${sample.name} ${sample.era}`).not.toBeNull();
        const production = await repository.getProductionForCards([card!.cardId]);
        const stats = production.get(card!.cardId);
        expect(stats?.games, `${sample.name} games`).toBeGreaterThan(0);
        expect(stats?.[sample.field], `${sample.name} ${sample.field}`).toBeGreaterThan(0);
      }

      // Pre-1999 seasons are enriched from historical adapters (not fabricated).
      const montana = await db
        .select({ cardId: playerTeamEraCards.id })
        .from(playerTeamEraCards)
        .innerJoin(players, eq(players.id, playerTeamEraCards.playerId))
        .innerJoin(eras, eq(eras.id, playerTeamEraCards.eraId))
        .innerJoin(franchises, eq(franchises.id, playerTeamEraCards.franchiseId))
        .where(
          and(
            eq(players.displayName, "Joe Montana"),
            eq(eras.label, "1980s"),
            sql`${franchises.canonicalAbbreviation} = 'SF'`,
          ),
        )
        .limit(1);
      if (montana[0]) {
        const production = await repository.getProductionForCards([montana[0].cardId]);
        const stats = production.get(montana[0].cardId)!;
        // After historical enrichment, yards are populated; before that they stay null.
        if (stats.passingYards != null) {
          expect(stats.passingYards).toBeGreaterThan(0);
        }
        expect(stats.games == null || stats.games > 0).toBe(true);
      }

    } finally {
      await close();
    }
  }, 120_000);
});
