import { describe, expect, it } from "vitest";

import { EMPTY_PRODUCTION } from "@/lib/game/production";
import { sortCandidatesAlphabetically } from "@/lib/game/candidateOrder";
import {
  comparePlayerNames,
  formatPlayerDisplayName,
  parsePlayerName,
} from "@/lib/game/playerName";
import type { SpinCandidate } from "@/lib/game/spin";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import {
  evaluateCandidateOverall,
  orderSpinCandidates,
  sortCandidatesByEvaluation,
} from "@/lib/scoring/rankSpinCandidates";
import type { SeasonStatRecord } from "@/lib/scoring/types";

import { card } from "./helpers/inMemoryGameRepository";
import { createInMemoryScoringRepository } from "./helpers/inMemoryScoringRepository";

function season(
  overrides: Partial<SeasonStatRecord> & Pick<SeasonStatRecord, "season" | "playerId">,
): SeasonStatRecord {
  return {
    franchiseId: overrides.franchiseId ?? 1,
    positions: overrides.positions ?? ["WR"],
    games: overrides.games ?? 16,
    gamesStarted: overrides.gamesStarted ?? 16,
    passingYards: overrides.passingYards ?? null,
    passingTouchdowns: overrides.passingTouchdowns ?? null,
    interceptions: overrides.interceptions ?? null,
    rushingYards: overrides.rushingYards ?? null,
    rushingAttempts: overrides.rushingAttempts ?? null,
    rushingTouchdowns: overrides.rushingTouchdowns ?? null,
    receptions: overrides.receptions ?? null,
    receivingYards: overrides.receivingYards ?? null,
    receivingTouchdowns: overrides.receivingTouchdowns ?? null,
    ...overrides,
  };
}

function wrCandidate(
  cardId: number,
  playerName: string,
  eligibleSlots: SpinCandidate["eligibleSlots"] = ["WR1", "WR2"],
): SpinCandidate {
  return {
    eligibleSlots,
    card: card({
      cardId,
      playerId: cardId,
      playerName,
      positions: ["WR"],
      production: EMPTY_PRODUCTION,
    }),
  };
}

function wrPeerCorpus(): SeasonStatRecord[] {
  const stats: SeasonStatRecord[] = [];
  for (let i = 0; i < 24; i += 1) {
    stats.push(
      season({
        season: 1990,
        playerId: 1000 + i,
        receivingYards: 400 + i * 70,
        receivingTouchdowns: 2 + Math.floor(i / 2),
        receptions: 25 + i * 3,
      }),
    );
  }
  return stats;
}

describe("player name presentation", () => {
  it("displays stored names as First Last", () => {
    expect(formatPlayerDisplayName("Jerry Rice")).toBe("Jerry Rice");
    expect(formatPlayerDisplayName("Rice, Jerry")).toBe("Jerry Rice");
    expect(formatPlayerDisplayName("Namath, Joe")).toBe("Joe Namath");
    expect(parsePlayerName("A.J. Brown")).toEqual({ firstName: "A.J.", lastName: "Brown" });
  });

  it("sorts by first name then last name", () => {
    expect(comparePlayerNames("Tom Brady", "Aaron Rodgers")).toBeGreaterThan(0);
    expect(comparePlayerNames("Joe Montana", "Joe Namath")).toBeLessThan(0);
    expect(comparePlayerNames("Rice, Jerry", "Montana, Joe")).toBeLessThan(0);
  });
});

describe("IQ candidate ordering", () => {
  it("sorts by first name, then last name, with a stable card-id tiebreak", () => {
    const ordered = sortCandidatesAlphabetically([
      wrCandidate(3, "Tom Brady"),
      wrCandidate(1, "Joe Namath"),
      wrCandidate(2, "Joe Montana"),
      wrCandidate(4, "Aaron Rodgers"),
      wrCandidate(5, "Rice, Jerry"),
    ]);

    expect(ordered.map((candidate) => formatPlayerDisplayName(candidate.card.playerName))).toEqual([
      "Aaron Rodgers",
      "Jerry Rice",
      "Joe Montana",
      "Joe Namath",
      "Tom Brady",
    ]);
  });
});

describe("CLASSIC candidate ordering", () => {
  const peers = wrPeerCorpus();
  const baselines = buildPeerBaselineIndex(peers);

  const highYards = wrCandidate(10, "Yards First");
  const highEval = wrCandidate(11, "Score First");
  const missing = wrCandidate(12, "No Stats");

  const highYardsSeason = season({
    season: 1990,
    playerId: 10,
    receivingYards: 2100,
    receivingTouchdowns: 2,
    receptions: 40,
  });
  const highEvalSeason = season({
    season: 1990,
    playerId: 11,
    receivingYards: 980,
    receivingTouchdowns: 16,
    receptions: 88,
  });

  it("orders highest evaluation first using the scoring engine, not raw yards", () => {
    const yardsOverall = evaluateCandidateOverall(highYards, [highYardsSeason], baselines);
    const evalOverall = evaluateCandidateOverall(highEval, [highEvalSeason], baselines);

    expect(highYardsSeason.receivingYards!).toBeGreaterThan(highEvalSeason.receivingYards!);
    expect(evalOverall).toBeGreaterThan(yardsOverall);

    const ordered = sortCandidatesByEvaluation(
      [highYards, missing, highEval],
      new Map([
        [10, yardsOverall],
        [11, evalOverall],
        [12, evaluateCandidateOverall(missing, [], baselines)],
      ]),
    );

    expect(ordered.map((candidate) => candidate.card.cardId)).toEqual([11, 10, 12]);
    expect(ordered[0]?.eligibleSlots).toEqual(["WR1", "WR2"]);
  });

  it("uses reliability fallback for missing production instead of assigning zero", async () => {
    const missingOverall = evaluateCandidateOverall(missing, [], baselines);
    const eliteOverall = evaluateCandidateOverall(highEval, [highEvalSeason], baselines);

    expect(missingOverall).toBeGreaterThan(0);
    expect(missingOverall).toBeLessThan(eliteOverall);

    const repository = createInMemoryScoringRepository(
      [highYards.card, highEval.card, missing.card],
      new Map([
        [10, [highYardsSeason]],
        [11, [highEvalSeason]],
        [12, []],
      ]),
      [...peers, highYardsSeason, highEvalSeason],
    );

    const ordered = await orderSpinCandidates(repository, "CLASSIC", [
      missing,
      highYards,
      highEval,
    ]);
    expect(ordered.map((candidate) => candidate.card.playerName)).toEqual([
      "Score First",
      "Yards First",
      "No Stats",
    ]);
    expect(ordered.every((candidate) => candidate.eligibleSlots.includes("WR1"))).toBe(true);
    expect(JSON.stringify(ordered[0])).not.toMatch(/"overall"|playerRating|hiddenRating/);
  });

  it("sorts IQ mode alphabetically even when evaluations would rank differently", async () => {
    const repository = createInMemoryScoringRepository(
      [highEval.card, wrCandidate(20, "Aaron Rodgers").card],
      new Map([[11, [highEvalSeason]]]),
      peers,
    );
    const aaron = wrCandidate(20, "Aaron Rodgers");
    const ordered = await orderSpinCandidates(repository, "IQ", [highEval, aaron]);
    expect(ordered.map((candidate) => candidate.card.playerName)).toEqual([
      "Aaron Rodgers",
      "Score First",
    ]);
  });
});
