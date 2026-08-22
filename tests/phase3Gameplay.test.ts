import { beforeEach, describe, expect, it } from "vitest";

import { GameRuleError } from "@/lib/game/errors";
import { draftPlayer } from "@/lib/game/draftPlayer";
import { loadGameState } from "@/lib/game/gameState";
import { eraSkipGame, teamSkipGame } from "@/lib/game/skip";
import { spinGame } from "@/lib/game/spin";
import { startGame } from "@/lib/game/startGame";
import { toGameStateView } from "@/lib/game/view";

import {
  card,
  createInMemoryGameRepository,
  skipScenarioCards,
  type InMemoryGameRepository,
} from "./helpers/inMemoryGameRepository";

describe("game mode", () => {
  it("persists CLASSIC on a new session", async () => {
    const repository = createInMemoryGameRepository(skipScenarioCards());
    const state = await startGame(repository, { mode: "CLASSIC" });
    expect(state.mode).toBe("CLASSIC");
    expect(toGameStateView(state).mode).toBe("CLASSIC");
  });

  it("persists IQ on a new session", async () => {
    const repository = createInMemoryGameRepository(skipScenarioCards());
    const state = await startGame(repository, { mode: "IQ" });
    expect(state.mode).toBe("IQ");
    expect(toGameStateView(state).mode).toBe("IQ");
  });
});

describe("team skip", () => {
  let repository: InMemoryGameRepository;

  beforeEach(() => {
    repository = createInMemoryGameRepository(skipScenarioCards());
  });

  it("preserves era, changes franchise, and consumes exactly once", async () => {
    const game = await startGame(repository, { mode: "CLASSIC" });
    const spin = await spinGame(repository, game.sessionId, () => 0);
    expect(spin.era.id).toBe(1);

    const skipped = await teamSkipGame(repository, game.sessionId, () => 0);
    expect(skipped.era.id).toBe(spin.era.id);
    expect(skipped.franchise.id).not.toBe(spin.franchise.id);

    const after = await loadGameState(repository, game.sessionId);
    expect(after.teamSkipRemaining).toBe(0);
    expect(after.eraSkipRemaining).toBe(1);

    await expect(teamSkipGame(repository, game.sessionId, () => 0)).rejects.toMatchObject({
      code: "NO_TEAM_SKIP_REMAINING",
    });
  });

  it("does not consume when no valid alternate franchise exists", async () => {
    // Only franchise 1 has era-1 cards — team skip has nowhere else to go.
    const repo = createInMemoryGameRepository(
      skipScenarioCards().filter((c) => !(c.eraId === 1 && c.franchiseId !== 1)),
    );
    const game = await startGame(repo, { mode: "CLASSIC" });
    const session = repo.sessions.get(game.sessionId)!;
    session.currentFranchiseId = 1;
    session.currentEraId = 1;

    await expect(teamSkipGame(repo, game.sessionId, () => 0)).rejects.toMatchObject({
      code: "NO_VALID_TEAM_SKIP",
    });
    const after = await loadGameState(repo, game.sessionId);
    expect(after.teamSkipRemaining).toBe(1);
    expect(after.currentSpin).toEqual({ franchiseId: 1, eraId: 1 });
  });

  it("rejects Team Skip without an active spin and does not consume", async () => {
    const game = await startGame(repository, { mode: "CLASSIC" });
    await expect(teamSkipGame(repository, game.sessionId)).rejects.toMatchObject({
      code: "NO_ACTIVE_SPIN",
    });
    const after = await loadGameState(repository, game.sessionId);
    expect(after.teamSkipRemaining).toBe(1);
  });

  it("respects open-position eligibility (FB-only cannot skip to a team without FB)", async () => {
    const repo = createInMemoryGameRepository(skipScenarioCards());
    const game = await startGame(repo, { mode: "CLASSIC" });

    // Manually occupy all non-FB slots from franchise 1 / era 1.
    const session = repo.sessions.get(game.sessionId)!;
    session.currentFranchiseId = 1;
    session.currentEraId = 1;
    const picks = [
      { roundNumber: 1, lineupSlot: "QB" as const, playerId: 301, playerTeamEraCardId: 301, franchiseId: 1, eraId: 1 },
      { roundNumber: 2, lineupSlot: "RB" as const, playerId: 302, playerTeamEraCardId: 302, franchiseId: 1, eraId: 1 },
      { roundNumber: 3, lineupSlot: "WR1" as const, playerId: 304, playerTeamEraCardId: 304, franchiseId: 1, eraId: 1 },
      { roundNumber: 4, lineupSlot: "WR2" as const, playerId: 305, playerTeamEraCardId: 305, franchiseId: 1, eraId: 1 },
      { roundNumber: 5, lineupSlot: "TE" as const, playerId: 306, playerTeamEraCardId: 306, franchiseId: 1, eraId: 1 },
    ];
    repo.picks.set(game.sessionId, picks);

    // Franchise 3 has no FB in era 1; franchise 2 does. Team skip must pick franchise 2.
    const skipped = await teamSkipGame(repo, game.sessionId, () => 0);
    expect(skipped.era.id).toBe(1);
    expect(skipped.franchise.id).toBe(2);
    expect(skipped.candidates.every((c) => c.card.positions.includes("FB"))).toBe(true);
  });
});

describe("era skip", () => {
  it("preserves franchise, changes era, and consumes exactly once", async () => {
    const repository = createInMemoryGameRepository(skipScenarioCards());
    const game = await startGame(repository, { mode: "CLASSIC" });
    // Force franchise 1 / era 1 spin.
    const session = repository.sessions.get(game.sessionId)!;
    session.currentFranchiseId = 1;
    session.currentEraId = 1;

    const skipped = await eraSkipGame(repository, game.sessionId, () => 0);
    expect(skipped.franchise.id).toBe(1);
    expect(skipped.era.id).toBe(2);

    const after = await loadGameState(repository, game.sessionId);
    expect(after.eraSkipRemaining).toBe(0);
    expect(after.teamSkipRemaining).toBe(1);

    await expect(eraSkipGame(repository, game.sessionId, () => 0)).rejects.toMatchObject({
      code: "NO_ERA_SKIP_REMAINING",
    });
  });

  it("does not consume when no valid alternate era exists", async () => {
    const repository = createInMemoryGameRepository(
      skipScenarioCards().filter((c) => !(c.franchiseId === 1 && c.eraId === 2)),
    );
    const game = await startGame(repository, { mode: "CLASSIC" });
    const session = repository.sessions.get(game.sessionId)!;
    session.currentFranchiseId = 1;
    session.currentEraId = 1;

    await expect(eraSkipGame(repository, game.sessionId, () => 0)).rejects.toMatchObject({
      code: "NO_VALID_ERA_SKIP",
    });
    const after = await loadGameState(repository, game.sessionId);
    expect(after.eraSkipRemaining).toBe(1);
    expect(after.currentSpin).toEqual({ franchiseId: 1, eraId: 1 });
  });

  it("rejects Era Skip without an active spin", async () => {
    const repository = createInMemoryGameRepository(skipScenarioCards());
    const game = await startGame(repository, { mode: "CLASSIC" });
    await expect(eraSkipGame(repository, game.sessionId)).rejects.toBeInstanceOf(GameRuleError);
    await expect(eraSkipGame(repository, game.sessionId)).rejects.toMatchObject({
      code: "NO_ACTIVE_SPIN",
    });
  });
});

describe("stale spin after skip", () => {
  it("rejects drafting a candidate from the previous spin", async () => {
    const repository = createInMemoryGameRepository(skipScenarioCards());
    const game = await startGame(repository, { mode: "CLASSIC" });
    const session = repository.sessions.get(game.sessionId)!;
    session.currentFranchiseId = 1;
    session.currentEraId = 1;

    const before = await teamSkipGame(repository, game.sessionId, () => 0);
    expect(before.franchise.id).toBe(2);

    // Card 301 belongs to franchise 1 / era 1 — the stale spin.
    await expect(
      draftPlayer(repository, {
        sessionId: game.sessionId,
        playerTeamEraCardId: 301,
        lineupSlot: "QB",
      }),
    ).rejects.toMatchObject({ code: "SPIN_MISMATCH" });
  });
});

describe("complete game rejects further actions", () => {
  it("rejects spin, pick, team skip, and era skip", async () => {
    const repository = createInMemoryGameRepository(singleTeamCompleteReady());
    const game = await startGame(repository, { mode: "IQ" });
    const session = repository.sessions.get(game.sessionId)!;
    session.status = "COMPLETE";
    session.completedAt = new Date();
    session.currentFranchiseId = 1;
    session.currentEraId = 1;

    await expect(spinGame(repository, game.sessionId)).rejects.toMatchObject({
      code: "GAME_NOT_ACTIVE",
    });
    await expect(teamSkipGame(repository, game.sessionId)).rejects.toMatchObject({
      code: "GAME_NOT_ACTIVE",
    });
    await expect(eraSkipGame(repository, game.sessionId)).rejects.toMatchObject({
      code: "GAME_NOT_ACTIVE",
    });
    await expect(
      draftPlayer(repository, {
        sessionId: game.sessionId,
        playerTeamEraCardId: 101,
        lineupSlot: "QB",
      }),
    ).rejects.toMatchObject({ code: "GAME_NOT_ACTIVE" });
  });
});

describe("new game", () => {
  it("creates a fresh session with empty lineup, both skips, mode, and ACTIVE", async () => {
    const repository = createInMemoryGameRepository(skipScenarioCards());
    const first = await startGame(repository, { mode: "IQ" });
    const second = await startGame(repository, { mode: "CLASSIC" });

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.mode).toBe("CLASSIC");
    expect(second.status).toBe("ACTIVE");
    expect(second.teamSkipRemaining).toBe(1);
    expect(second.eraSkipRemaining).toBe(1);
    expect(second.openSlots).toHaveLength(6);
    expect(second.currentSpin).toBeNull();
    expect(second.picks).toHaveLength(0);
  });
});

function singleTeamCompleteReady() {
  return [
    card({ cardId: 101, playerId: 101, positions: ["QB"], franchiseId: 1, eraId: 1 }),
  ];
}
