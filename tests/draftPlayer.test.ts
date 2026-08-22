import { beforeEach, describe, expect, it } from "vitest";

import { LINEUP_SLOTS, type LineupSlot } from "@/lib/football/positions";
import { draftPlayer } from "@/lib/game/draftPlayer";
import { loadGameState } from "@/lib/game/gameState";
import { spinGame } from "@/lib/game/spin";
import { startGame } from "@/lib/game/startGame";

import {
  card,
  createInMemoryGameRepository,
  singleTeamCards,
  type InMemoryGameRepository,
} from "./helpers/inMemoryGameRepository";

let repository: InMemoryGameRepository;
let sessionId: string;

/** Every card below lives in franchise 1 / era 1 so spins are deterministic. */
function testCards() {
  return [
    ...singleTeamCards(),
    card({ cardId: 107, playerId: 107, playerName: "Dev QB 2", positions: ["QB"] }),
    card({ cardId: 108, playerId: 108, playerName: "Dev RB/FB", positions: ["RB", "FB"] }),
    // Same player as card 104, different era: used to prove a player cannot be
    // drafted twice through a second card.
    card({ cardId: 109, playerId: 104, playerName: "Dev WR A", positions: ["WR"], eraId: 2 }),
    // A different franchise, used to prove the spin is enforced.
    card({ cardId: 110, playerId: 110, positions: ["TE"], franchiseId: 2, eraId: 1 }),
  ];
}

async function spinAndDraft(cardId: number, lineupSlot: LineupSlot) {
  await spinGame(repository, sessionId, () => 0);
  return draftPlayer(repository, { sessionId, playerTeamEraCardId: cardId, lineupSlot });
}

describe("draftPlayer", () => {
  beforeEach(async () => {
    repository = createInMemoryGameRepository(testCards());
    const state = await startGame(repository);
    sessionId = state.sessionId;
  });

  it("requires a spin before a pick", async () => {
    await expect(
      draftPlayer(repository, { sessionId, playerTeamEraCardId: 101, lineupSlot: "QB" }),
    ).rejects.toMatchObject({ code: "NO_ACTIVE_SPIN" });
  });

  it("locks a slot after it is filled", async () => {
    const result = await spinAndDraft(101, "QB");

    expect(result.state.lineup.QB?.playerName).toBe("Dev QB");
    expect(result.state.openSlots).toEqual(["RB", "FB", "WR1", "WR2", "TE"]);

    await spinGame(repository, sessionId, () => 0);
    await expect(
      draftPlayer(repository, { sessionId, playerTeamEraCardId: 107, lineupSlot: "QB" }),
    ).rejects.toMatchObject({ code: "SLOT_ALREADY_FILLED" });
  });

  it("clears the spin after a successful pick", async () => {
    await spinAndDraft(101, "QB");
    const session = await repository.findSession(sessionId);

    expect(session?.currentFranchiseId).toBeNull();
    expect(session?.currentEraId).toBeNull();
  });

  it("fills both receiver slots with two different wide receivers", async () => {
    await spinAndDraft(104, "WR1");
    const result = await spinAndDraft(105, "WR2");

    expect(result.state.lineup.WR1?.playerId).toBe(104);
    expect(result.state.lineup.WR2?.playerId).toBe(105);
    expect(result.state.usefulPositions).toEqual(["QB", "RB", "FB", "TE"]);
  });

  it("rejects a tight end in the running back slot", async () => {
    await spinGame(repository, sessionId, () => 0);
    await expect(
      draftPlayer(repository, { sessionId, playerTeamEraCardId: 106, lineupSlot: "RB" }),
    ).rejects.toMatchObject({ code: "POSITION_NOT_ELIGIBLE" });
  });

  it("lets a multi-position RB/FB fill either slot", async () => {
    const asFullback = await spinAndDraft(108, "FB");
    expect(asFullback.state.lineup.FB?.playerId).toBe(108);

    const other = createInMemoryGameRepository(testCards());
    const fresh = await startGame(other);
    await spinGame(other, fresh.sessionId, () => 0);
    const asRunningBack = await draftPlayer(other, {
      sessionId: fresh.sessionId,
      playerTeamEraCardId: 108,
      lineupSlot: "RB",
    });

    expect(asRunningBack.state.lineup.RB?.playerId).toBe(108);
  });

  it("refuses to draft the same player twice", async () => {
    await spinAndDraft(108, "RB");

    await spinGame(repository, sessionId, () => 0);
    await expect(
      draftPlayer(repository, { sessionId, playerTeamEraCardId: 108, lineupSlot: "FB" }),
    ).rejects.toMatchObject({ code: "PLAYER_ALREADY_DRAFTED" });

    await spinAndDraft(104, "WR1");
    // Card 109 is the same player in a different era.
    await repository.setCurrentSpin(sessionId, { franchiseId: 1, eraId: 2 });
    await expect(
      draftPlayer(repository, { sessionId, playerTeamEraCardId: 109, lineupSlot: "WR2" }),
    ).rejects.toMatchObject({ code: "PLAYER_ALREADY_DRAFTED" });
  });

  it("only accepts players from the current franchise and era spin", async () => {
    await spinGame(repository, sessionId, () => 0);
    await expect(
      draftPlayer(repository, { sessionId, playerTeamEraCardId: 110, lineupSlot: "TE" }),
    ).rejects.toMatchObject({ code: "SPIN_MISMATCH" });
  });

  it("reports unknown cards and sessions", async () => {
    await spinGame(repository, sessionId, () => 0);
    await expect(
      draftPlayer(repository, { sessionId, playerTeamEraCardId: 9999, lineupSlot: "QB" }),
    ).rejects.toMatchObject({ code: "CARD_NOT_FOUND" });

    await expect(
      draftPlayer(repository, {
        sessionId: "11111111-1111-4111-8111-111111111111",
        playerTeamEraCardId: 101,
        lineupSlot: "QB",
      }),
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  });

  it("completes the game after all six slots are filled", async () => {
    const plan: [number, LineupSlot][] = [
      [101, "QB"],
      [102, "RB"],
      [103, "FB"],
      [104, "WR1"],
      [105, "WR2"],
      [106, "TE"],
    ];

    let completed = false;
    for (const [cardId, slot] of plan) {
      const result = await spinAndDraft(cardId, slot);
      completed = result.completed;
    }

    expect(completed).toBe(true);

    const state = await loadGameState(repository, sessionId);
    expect(state.status).toBe("COMPLETE");
    expect(state.isComplete).toBe(true);
    expect(state.openSlots).toEqual([]);
    expect(state.filledSlots).toEqual([...LINEUP_SLOTS]);
    expect(state.picks).toHaveLength(6);
    expect(state.picks.map((pick) => pick.roundNumber)).toEqual([1, 2, 3, 4, 5, 6]);

    await expect(
      draftPlayer(repository, { sessionId, playerTeamEraCardId: 107, lineupSlot: "QB" }),
    ).rejects.toMatchObject({ code: "GAME_NOT_ACTIVE" });
  });
});
