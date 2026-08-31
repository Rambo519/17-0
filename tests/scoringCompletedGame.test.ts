import { describe, expect, it } from "vitest";

import { REGULAR_SEASON_GAMES } from "@/lib/football/season";
import { ScoringError, evaluateCompletedGame } from "@/lib/scoring/evaluateGame";
import { draftPlayer } from "@/lib/game/draftPlayer";
import { loadGameState } from "@/lib/game/gameState";
import { spinGame } from "@/lib/game/spin";
import { startGame } from "@/lib/game/startGame";
import { seedDevelopmentData } from "@/db/seed/seed";
import { createDrizzleScoringRepository } from "@/server/repository/drizzleScoringRepository";

import { createTestDatabase } from "./helpers/pgliteDatabase";

function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe("evaluateCompletedGame", () => {
  it("rejects incomplete sessions", { timeout: 15_000 }, async () => {
    const db = await createTestDatabase();
    await seedDevelopmentData(db);
    const repository = createDrizzleScoringRepository(db);
    const { sessionId } = await startGame(repository, { mode: "CLASSIC" });

    await expect(evaluateCompletedGame(repository, sessionId)).rejects.toThrow(ScoringError);
  });

  it("evaluates a completed six-pick session from stored cards", async () => {
    const db = await createTestDatabase();
    await seedDevelopmentData(db);
    const repository = createDrizzleScoringRepository(db);
    const rng = seededRng(42);
    const { sessionId } = await startGame(repository, { mode: "CLASSIC" });

    for (let round = 0; round < 6; round += 1) {
      const spin = await spinGame(repository, sessionId, rng);
      const candidate = spin.candidates.find((entry) => entry.eligibleSlots.length > 0);
      expect(candidate).toBeDefined();
      const slot = candidate!.eligibleSlots[0]!;
      await draftPlayer(repository, {
        sessionId,
        playerTeamEraCardId: candidate!.card.cardId,
        lineupSlot: slot,
      });
    }

    const finalState = await loadGameState(repository, sessionId);
    expect(finalState.status).toBe("COMPLETE");

    const result = await evaluateCompletedGame(repository, sessionId);
    expect(result.offense.players.length).toBe(6);
    expect(result.projection.projectedWins).toBeGreaterThanOrEqual(0);
    expect(result.projection.projectedLosses).toBe(
      REGULAR_SEASON_GAMES - result.projection.projectedWins,
    );
    expect(result.projection.perfectSeasonProbability).toBeGreaterThan(0);
    expect(result.projection.perfectSeasonProbability).toBeLessThanOrEqual(1);
  });
});
