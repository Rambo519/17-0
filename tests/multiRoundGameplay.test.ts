import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/db/client";
import { seedDevelopmentData } from "@/db/seed/seed";
import { draftPlayer } from "@/lib/game/draftPlayer";
import type { GameRepository } from "@/lib/game/ports";
import { spinGame } from "@/lib/game/spin";
import { startGame } from "@/lib/game/startGame";
import { createDrizzleGameRepository } from "@/server/repository/drizzleGameRepository";

import { createTestDatabase } from "./helpers/pgliteDatabase";

/**
 * Regression: sequential spins after picks must keep working against a real
 * SQL-backed repository (the browser "Failed to fetch" failure mode).
 */
describe("multi-round database-backed gameplay", () => {
  let db: Database;
  let repository: GameRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedDevelopmentData(db);
    repository = createDrizzleGameRepository(db);
  }, 60_000);

  it("completes six sequential spin → draft rounds without failing", async () => {
    const game = await startGame(repository, { mode: "CLASSIC" });

    for (let round = 1; round <= 6; round += 1) {
      const spin = await spinGame(repository, game.sessionId);
      expect(spin.candidates.length).toBeGreaterThan(0);

      const candidate = spin.candidates[0]!;
      const slot = candidate.eligibleSlots[0];
      expect(slot).toBeDefined();

      const result = await draftPlayer(repository, {
        sessionId: game.sessionId,
        playerTeamEraCardId: candidate.card.cardId,
        lineupSlot: slot!,
      });

      expect(result.state.roundNumber).toBe(round === 6 ? 6 : round + 1);
      if (round < 6) {
        expect(result.completed).toBe(false);
        expect(result.state.status).toBe("ACTIVE");
      } else {
        expect(result.completed).toBe(true);
        expect(result.state.status).toBe("COMPLETE");
      }
    }
  }, 60_000);
});
