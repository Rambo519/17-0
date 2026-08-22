import { beforeEach, describe, expect, it } from "vitest";

import type { LineupSlot } from "@/lib/football/positions";
import { GameRuleError } from "@/lib/game/errors";
import { spinGame } from "@/lib/game/spin";

import {
  createInMemoryGameRepository,
  multiTeamCards,
  type InMemoryGameRepository,
} from "./helpers/inMemoryGameRepository";

let repository: InMemoryGameRepository;

/** Fills slots directly, bypassing draft validation, to reach a given state. */
async function occupySlots(
  repo: InMemoryGameRepository,
  sessionId: string,
  slots: readonly LineupSlot[],
  playerIds?: readonly number[],
): Promise<void> {
  for (const [index, slot] of slots.entries()) {
    const playerId = playerIds?.[index] ?? 700 + index;
    await repo.commitPick({
      sessionId,
      pick: {
        roundNumber: index + 1,
        lineupSlot: slot,
        playerId,
        playerTeamEraCardId: playerId,
        franchiseId: 9,
        eraId: 9,
      },
      complete: slots.length === 6 && index === slots.length - 1,
    });
  }
}

const RNG_SAMPLES = [0, 0.17, 0.33, 0.5, 0.66, 0.83, 0.999];

describe("spinGame", () => {
  beforeEach(() => {
    repository = createInMemoryGameRepository(multiTeamCards());
  });

  it("always returns at least one legally selectable player", async () => {
    for (const value of RNG_SAMPLES) {
      const { id } = await repository.createSession({ mode: "CLASSIC" });
      const spin = await spinGame(repository, id, () => value);

      expect(spin.candidates.length).toBeGreaterThan(0);
      for (const candidate of spin.candidates) {
        expect(candidate.eligibleSlots.length).toBeGreaterThan(0);
        expect(candidate.card.franchiseId).toBe(spin.franchise.id);
        expect(candidate.card.eraId).toBe(spin.era.id);
      }
    }
  });

  it("stores the rolled franchise and era on the session", async () => {
    const { id } = await repository.createSession({ mode: "CLASSIC" });
    const spin = await spinGame(repository, id, () => 0);
    const session = await repository.findSession(id);

    expect(session?.currentFranchiseId).toBe(spin.franchise.id);
    expect(session?.currentEraId).toBe(spin.era.id);
  });

  it("only rolls combinations that contain the last open position", async () => {
    for (const value of RNG_SAMPLES) {
      const { id } = await repository.createSession({ mode: "CLASSIC" });
      await occupySlots(repository, id, ["QB", "RB", "FB", "WR1", "WR2"]);

      const spin = await spinGame(repository, id, () => value);

      expect(spin.openSlots).toEqual(["TE"]);
      // Franchise 2 / era 1 is the only combination with a tight end.
      expect(spin.franchise.id).toBe(2);
      expect(spin.era.id).toBe(1);
      expect(spin.candidates.every((candidate) => candidate.card.positions.includes("TE"))).toBe(
        true,
      );
    }
  });

  it("stops offering WR-only combinations once both receiver slots are filled", async () => {
    for (const value of RNG_SAMPLES) {
      const { id } = await repository.createSession({ mode: "CLASSIC" });
      await occupySlots(repository, id, ["WR1", "WR2"]);

      const spin = await spinGame(repository, id, () => value);

      expect(spin.openSlots).toEqual(["QB", "RB", "FB", "TE"]);
      // Franchise 1 / era 1 only has wide receivers, so it is out of the pool.
      expect(`${spin.franchise.id}:${spin.era.id}`).not.toBe("1:1");
      for (const candidate of spin.candidates) {
        expect(candidate.eligibleSlots).not.toContain("WR1");
        expect(candidate.eligibleSlots).not.toContain("WR2");
      }
    }
  });

  it("never offers a player who is already on the roster", async () => {
    const { id } = await repository.createSession({ mode: "CLASSIC" });
    // Player 205 (RB/FB) is already used, leaving franchise 3 as the only
    // remaining source of a running back.
    await occupySlots(repository, id, ["QB", "FB", "WR1", "WR2", "TE"], [204, 205, 201, 202, 203]);

    const spin = await spinGame(repository, id, () => 0);

    expect(spin.openSlots).toEqual(["RB"]);
    expect(spin.candidates.map((candidate) => candidate.card.playerId)).toEqual([206]);
  });

  it("reports NO_VALID_SPIN instead of rolling a dead combination", async () => {
    const withoutTightEnds = createInMemoryGameRepository(
      multiTeamCards().filter((entry) => !entry.positions.includes("TE")),
    );
    const { id } = await withoutTightEnds.createSession({ mode: "CLASSIC" });
    await occupySlots(withoutTightEnds, id, ["QB", "RB", "FB", "WR1", "WR2"]);

    await expect(spinGame(withoutTightEnds, id, () => 0)).rejects.toMatchObject({
      code: "NO_VALID_SPIN",
    });
  });

  it("refuses to spin a finished or unknown game", async () => {
    const { id } = await repository.createSession({ mode: "CLASSIC" });
    await occupySlots(repository, id, ["QB", "RB", "FB", "WR1", "WR2", "TE"]);

    await expect(spinGame(repository, id, () => 0)).rejects.toBeInstanceOf(GameRuleError);
    await expect(
      spinGame(repository, "11111111-1111-4111-8111-111111111111", () => 0),
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  });
});
