import { beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/db/client";
import { seedDevelopmentData, type SeedSummary } from "@/db/seed/seed";
import { LINEUP_SLOTS, type LineupSlot } from "@/lib/football/positions";
import { draftPlayer } from "@/lib/game/draftPlayer";
import { loadGameState } from "@/lib/game/gameState";
import type { GameRepository } from "@/lib/game/ports";
import { loadCurrentSpin, spinGame } from "@/lib/game/spin";
import { startGame } from "@/lib/game/startGame";
import { createDrizzleGameRepository } from "@/server/repository/drizzleGameRepository";

import { createTestDatabase } from "./helpers/pgliteDatabase";

let db: Database;
let repository: GameRepository;
let summary: SeedSummary;

/** Deterministic sequence so the walkthrough below is reproducible. */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe("postgres-backed engine", () => {
  beforeAll(async () => {
    db = await createTestDatabase();
    summary = await seedDevelopmentData(db);
    repository = createDrizzleGameRepository(db);
  }, 60_000);

  it("seeds eras, franchises, players and cards", () => {
    expect(summary.eras).toBe(6);
    expect(summary.franchises).toBe(4);
    expect(summary.players).toBeGreaterThanOrEqual(20);
    expect(summary.players).toBeLessThanOrEqual(40);
    expect(summary.playerSeasons).toBeGreaterThan(summary.players);
    expect(summary.cards).toBeGreaterThan(summary.players);
    expect(summary.skippedSeasons).toBe(0);
  });

  it("returns multi-position cards with their full position list", async () => {
    const cards = await repository.listDraftableCards({
      positions: ["RB", "FB"],
      excludePlayerIds: [],
    });

    const dual = cards.filter(
      (card) => card.positions.includes("RB") && card.positions.includes("FB"),
    );

    expect(dual.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.positions.length).toBeGreaterThan(0);
      expect(card.franchiseName.length).toBeGreaterThan(0);
      expect(card.eraLabel).toMatch(/^\d{4}s$/);
    }
  });

  it("plays a complete six-round game end to end", async () => {
    const rng = seededRng(7);
    const initial = await startGame(repository, { mode: "CLASSIC" });
    const sessionId = initial.sessionId;

    expect(initial.openSlots).toEqual([...LINEUP_SLOTS]);

    const usedSlots: LineupSlot[] = [];

    for (let round = 1; round <= LINEUP_SLOTS.length; round += 1) {
      const spin = await spinGame(repository, sessionId, rng);
      expect(spin.candidates.length).toBeGreaterThan(0);

      // The spin should be restorable from stored session state alone.
      const restored = await loadCurrentSpin(repository, await loadGameState(repository, sessionId));
      expect(restored?.franchise.id).toBe(spin.franchise.id);
      expect(restored?.era.id).toBe(spin.era.id);

      const candidate = spin.candidates.find((entry) => entry.eligibleSlots.length > 0);
      expect(candidate).toBeDefined();

      const slot = candidate!.eligibleSlots[0]!;
      const result = await draftPlayer(repository, {
        sessionId,
        playerTeamEraCardId: candidate!.card.cardId,
        lineupSlot: slot,
      });

      usedSlots.push(slot);
      expect(result.pick.roundNumber).toBe(round);
      expect(result.completed).toBe(round === LINEUP_SLOTS.length);
    }

    const finalState = await loadGameState(repository, sessionId);

    expect(new Set(usedSlots).size).toBe(6);
    expect(finalState.status).toBe("COMPLETE");
    expect(finalState.filledSlots).toEqual([...LINEUP_SLOTS]);
    expect(finalState.currentSpin).toBeNull();
    expect(new Set(finalState.draftedPlayerIds).size).toBe(6);
  }, 60_000);

  it("enforces slot and eligibility rules against the database", async () => {
    const state = await startGame(repository, { mode: "CLASSIC" });
    const spin = await spinGame(repository, state.sessionId, () => 0);

    const candidate = spin.candidates[0]!;
    const illegalSlot = LINEUP_SLOTS.find(
      (slot) => !candidate.eligibleSlots.includes(slot),
    );

    await expect(
      draftPlayer(repository, {
        sessionId: state.sessionId,
        playerTeamEraCardId: candidate.card.cardId,
        lineupSlot: illegalSlot!,
      }),
    ).rejects.toMatchObject({ code: "POSITION_NOT_ELIGIBLE" });

    await draftPlayer(repository, {
      sessionId: state.sessionId,
      playerTeamEraCardId: candidate.card.cardId,
      lineupSlot: candidate.eligibleSlots[0]!,
    });

    await expect(
      draftPlayer(repository, {
        sessionId: state.sessionId,
        playerTeamEraCardId: candidate.card.cardId,
        lineupSlot: candidate.eligibleSlots[0]!,
      }),
    ).rejects.toMatchObject({ code: "NO_ACTIVE_SPIN" });
  }, 60_000);

  it("keeps unknown statistics null instead of zero", async () => {
    const rows = await db.query.playerSeasons.findMany({ limit: 200 });
    const withoutStats = rows.filter((row) => row.games === null);
    const withStats = rows.filter((row) => row.games !== null);

    expect(withoutStats.length).toBeGreaterThan(0);
    expect(withStats.length).toBeGreaterThan(0);
    for (const row of withoutStats) {
      expect(row.rushingYards).toBeNull();
      expect(row.receptions).toBeNull();
    }
  });
});
