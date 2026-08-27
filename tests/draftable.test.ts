import { describe, expect, it } from "vitest";

import {
  DRAFTABLE_RULE_SUMMARY,
  hasOffensiveProductionEvidence,
  isCardDraftable,
  seasonCountsAsParticipation,
} from "@/data/draftable";
import { derivePlayerTeamEraCards } from "@/data/cards/buildCards";
import { scorePlayerSeason } from "@/lib/scoring/playerSeasonScore";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import type { SeasonStatRecord } from "@/lib/scoring/types";
import { selectableCards } from "@/lib/game/eligibility";
import { deriveGameState } from "@/lib/game/gameState";
import { buildSpinCombinations } from "@/lib/game/spin";
import { card } from "./helpers/inMemoryGameRepository";
import type { GameSessionRecord } from "@/lib/game/types";

function seasonStat(overrides: Partial<SeasonStatRecord> = {}): SeasonStatRecord {
  return {
    season: 2005,
    playerId: 1,
    franchiseId: 1,
    positions: ["WR"],
    games: null,
    gamesStarted: null,
    passingYards: null,
    passingTouchdowns: null,
    interceptions: null,
    rushingYards: null,
    rushingAttempts: null,
    rushingTouchdowns: null,
    receptions: null,
    receivingYards: null,
    receivingTouchdowns: null,
    ...overrides,
  };
}

describe("draftability participation evidence", () => {
  it("treats only strictly positive stored values as production evidence", () => {
    expect(hasOffensiveProductionEvidence({ receivingYards: null })).toBe(false);
    expect(hasOffensiveProductionEvidence({ receivingYards: 0 })).toBe(false);
    expect(hasOffensiveProductionEvidence({ receivingYards: 12 })).toBe(true);
    expect(hasOffensiveProductionEvidence({ rushingAttempts: 1 })).toBe(true);
  });

  it("keeps games > 0 with production draftable", () => {
    expect(
      isCardDraftable({
        positions: ["RB"],
        seasons: [
          {
            games: 8,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            rushingYards: 140,
          },
        ],
      }),
    ).toBe(true);
  });

  it("keeps games NULL with real production draftable", () => {
    expect(
      isCardDraftable({
        positions: ["QB"],
        seasons: [
          {
            games: null,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            passingYards: 2200,
          },
        ],
      }),
    ).toBe(true);
  });

  it("rejects games = 0 with no production", () => {
    expect(
      isCardDraftable({
        positions: ["WR"],
        seasons: [
          {
            games: 0,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
        ],
      }),
    ).toBe(false);
  });

  it("rejects games NULL with no production, even with ACT roster status", () => {
    expect(
      isCardDraftable({
        positions: ["WR"],
        seasons: [
          {
            games: null,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
        ],
      }),
    ).toBe(false);
  });

  it("rejects games > 0 with no production for non-FB skill positions", () => {
    expect(
      seasonCountsAsParticipation(
        {
          games: 4,
          rosterStatus: "ACT",
          hasRosterEvidence: true,
          positions: ["WR"],
        },
        ["WR"],
      ),
    ).toBe(false);
  });

  it("rejects a WR whose only production is gadget rushing", () => {
    expect(
      isCardDraftable({
        positions: ["WR"],
        seasons: [
          {
            games: 4,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            rushingYards: 24,
          },
        ],
      }),
    ).toBe(false);
  });

  it("keeps a QB whose only stored production is rushing", () => {
    expect(
      isCardDraftable({
        positions: ["QB"],
        seasons: [
          {
            games: 10,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            rushingYards: 81,
          },
        ],
      }),
    ).toBe(true);
  });

  it("keeps a blocking FB with known games played and no box-score production", () => {
    expect(
      isCardDraftable({
        positions: ["FB"],
        seasons: [
          {
            games: 16,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            positions: ["FB"],
          },
        ],
      }),
    ).toBe(true);
  });

  it("does not give roster-only FBs a loophole when games are unknown", () => {
    expect(
      isCardDraftable({
        positions: ["FB"],
        seasons: [
          {
            games: null,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            positions: ["FB"],
          },
        ],
      }),
    ).toBe(false);
  });

  it("does not let the scoring fallback make a roster-only player draftable", () => {
    const rosterOnly = seasonStat({ games: null, positions: ["WR"] });
    const peers = buildPeerBaselineIndex([
      seasonStat({ playerId: 2, games: 16, receptions: 40, receivingYards: 600 }),
      seasonStat({ playerId: 3, games: 16, receptions: 50, receivingYards: 700 }),
    ]);
    const scored = scorePlayerSeason(rosterOnly, "WR", peers);
    expect(scored.usedNeutralFallback).toBe(true);

    expect(
      isCardDraftable({
        positions: ["WR"],
        seasons: [
          {
            games: rosterOnly.games,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            receivingYards: rosterOnly.receivingYards,
          },
        ],
      }),
    ).toBe(false);
    expect(DRAFTABLE_RULE_SUMMARY.toLowerCase()).toContain("roster status is not enough");
  });

  it("keeps roster-only players out of spin candidates", () => {
    const session: GameSessionRecord = {
      id: "00000000-0000-4000-8000-000000000001",
      status: "ACTIVE",
      mode: "CLASSIC",
      teamSkipRemaining: 1,
      eraSkipRemaining: 1,
      currentFranchiseId: 1,
      currentEraId: 1,
      createdAt: new Date(),
      completedAt: null,
    };
    const state = deriveGameState(session, []);
    const producer = card({
      positions: ["WR"],
      draftable: true,
      playerName: "Real Producer",
    });
    const rosterOnly = card({
      cardId: 99,
      playerId: 99,
      positions: ["WR"],
      draftable: false,
      playerName: "Roster Only",
    });

    expect(selectableCards([producer, rosterOnly], state).map((item) => item.playerName)).toEqual([
      "Real Producer",
    ]);
    const combinations = buildSpinCombinations([producer, rosterOnly], state);
    expect(combinations[0]?.candidates.map((item) => item.card.playerName)).toEqual(["Real Producer"]);
  });

  it("keeps a historical card with missing games but real production draftable", () => {
    expect(
      isCardDraftable({
        positions: ["RB"],
        seasons: [
          {
            games: null,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            rushingAttempts: 180,
            rushingYards: 720,
          },
        ],
      }),
    ).toBe(true);
  });

  it("preserves formation viability while excluding a roster-only extra", () => {
    const eraId = 5;
    const franchiseId = 12;
    const cards = derivePlayerTeamEraCards([
      {
        playerId: 1,
        franchiseId,
        seasons: [
          {
            season: 2004,
            eraId,
            positions: ["QB"],
            games: 16,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            passingYards: 3000,
          },
        ],
      },
      {
        playerId: 2,
        franchiseId,
        seasons: [
          {
            season: 2004,
            eraId,
            positions: ["RB"],
            games: 16,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            rushingYards: 900,
          },
        ],
      },
      {
        playerId: 3,
        franchiseId,
        seasons: [
          {
            season: 2004,
            eraId,
            positions: ["FB"],
            games: 16,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
        ],
      },
      {
        playerId: 4,
        franchiseId,
        seasons: [
          {
            season: 2004,
            eraId,
            positions: ["WR"],
            games: 16,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            receivingYards: 800,
          },
        ],
      },
      {
        playerId: 5,
        franchiseId,
        seasons: [
          {
            season: 2004,
            eraId,
            positions: ["WR"],
            games: null,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            receivingYards: 600,
          },
        ],
      },
      {
        playerId: 6,
        franchiseId,
        seasons: [
          {
            season: 2004,
            eraId,
            positions: ["TE"],
            games: 16,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
            receivingYards: 400,
          },
        ],
      },
      {
        playerId: 7,
        franchiseId,
        seasons: [
          {
            season: 2004,
            eraId,
            positions: ["WR"],
            games: null,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
        ],
      },
    ]);

    const draftable = cards.filter((item) => item.draftable);
    expect(draftable.map((item) => item.playerId).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(draftable.some((item) => item.playerId === 7)).toBe(false);
    expect(draftable.some((item) => item.positions.includes("QB"))).toBe(true);
    expect(draftable.some((item) => item.positions.includes("RB"))).toBe(true);
    expect(draftable.some((item) => item.positions.includes("FB"))).toBe(true);
    expect(draftable.filter((item) => item.positions.includes("WR"))).toHaveLength(2);
    expect(draftable.some((item) => item.positions.includes("TE"))).toBe(true);
  });
});
