import { beforeEach, describe, expect, it } from "vitest";

import { GameRuleError } from "@/lib/game/errors";
import { loadGameState } from "@/lib/game/gameState";
import { EMPTY_PRODUCTION } from "@/lib/game/production";
import { qaForceSpin, qaInspectSpinPool, qaRerollSpin, QA_BALTIMORE_2000S } from "@/lib/game/qaSpin";
import { buildSpinCombinations, spinGame } from "@/lib/game/spin";
import { classicProductionStats } from "@/lib/game/uiHelpers";
import type { CardProduction, DraftableCard } from "@/lib/game/types";

import {
  card,
  createInMemoryGameRepository,
  multiTeamCards,
  type InMemoryGameRepository,
} from "./helpers/inMemoryGameRepository";

function production(overrides: Partial<CardProduction>): CardProduction {
  return { ...EMPTY_PRODUCTION, ...overrides };
}

function baltimoreCard(
  overrides: Partial<DraftableCard> & { positions: DraftableCard["positions"] },
): DraftableCard {
  return card({
    franchiseId: 10,
    franchiseName: "Baltimore Ravens",
    franchiseAbbreviation: "BAL",
    eraId: 4,
    eraLabel: "2000s",
    ...overrides,
  });
}

function baltimore2000sCards(): DraftableCard[] {
  const named: DraftableCard[] = [
    baltimoreCard({
      playerName: "Todd Heap",
      positions: ["TE"],
      firstSeason: 2001,
      lastSeason: 2009,
      production: production({ receptions: 446, receivingYards: 5127, receivingTouchdowns: 37 }),
    }),
    baltimoreCard({
      playerName: "Daniel Wilcox",
      positions: ["TE"],
      firstSeason: 2004,
      lastSeason: 2008,
      production: production({ receptions: 78, receivingYards: 595, receivingTouchdowns: 8 }),
    }),
    baltimoreCard({
      playerName: "Chester Taylor",
      positions: ["RB"],
      firstSeason: 2002,
      lastSeason: 2005,
      production: production({ rushingYards: 1599, receptions: 107, receivingYards: 756 }),
    }),
    baltimoreCard({
      playerName: "Anthony Wright",
      positions: ["QB"],
      firstSeason: 2002,
      lastSeason: 2005,
      production: production({ passingYards: 2995 }),
    }),
    baltimoreCard({
      playerName: "Demetrius Williams",
      positions: ["WR"],
      firstSeason: 2006,
      lastSeason: 2009,
      production: production({ receptions: 64, receivingYards: 1020 }),
    }),
  ];

  const extras = Array.from({ length: 59 }, (_, index) =>
    baltimoreCard({
      playerName: `Raven Extra ${index + 1}`,
      positions: ["WR"],
      firstSeason: 2000 + (index % 10),
      lastSeason: 2000 + (index % 10),
    }),
  );

  return [...named, ...extras];
}

describe("qaForceSpin BAL 2000s", () => {
  let repository: InMemoryGameRepository;

  beforeEach(() => {
    repository = createInMemoryGameRepository([...baltimore2000sCards(), ...multiTeamCards()]);
  });

  it("uses the real combination pool, production, and draftability — not hardcoded players", async () => {
    const { id } = await repository.createSession({ mode: "CLASSIC" });
    const state = await loadGameState(repository, id);
    const combinations = buildSpinCombinations(repository.cards, state);
    const balIndex = combinations.findIndex(
      (combination) =>
        combination.franchiseAbbreviation === "BAL" && combination.eraLabel === "2000s",
    );
    expect(balIndex).toBeGreaterThanOrEqual(0);

    const { id: spinSessionId } = await repository.createSession({ mode: "CLASSIC" });
    const viaSpin = await spinGame(repository, spinSessionId, () => balIndex / combinations.length);
    const forced = await qaForceSpin(repository, id, QA_BALTIMORE_2000S);

    expect(forced.spin.franchise.abbreviation).toBe("BAL");
    expect(forced.spin.era.label).toBe("2000s");
    expect(forced.spin.candidates).toHaveLength(64);
    expect(new Set(forced.spin.candidates.map((candidate) => candidate.card.cardId)).size).toBe(64);

    expect(forced.spin.candidates.map((candidate) => candidate.card.cardId)).toEqual(
      viaSpin.candidates.map((candidate) => candidate.card.cardId),
    );

    const byName = new Map(
      forced.spin.candidates.map((candidate) => [candidate.card.playerName, candidate.card] as const),
    );
    const heap = byName.get("Todd Heap");
    expect(heap?.production).toEqual(
      production({ receptions: 446, receivingYards: 5127, receivingTouchdowns: 37 }),
    );
    expect(classicProductionStats(heap!.positions, heap!.production)).toEqual([
      { label: "Rec", value: "446" },
      { label: "Rec Yds", value: "5,127" },
      { label: "Rec TD", value: "37" },
    ]);
    expect(byName.get("Daniel Wilcox")?.production).toEqual(
      production({ receptions: 78, receivingYards: 595, receivingTouchdowns: 8 }),
    );
    expect(byName.get("Chester Taylor")?.production).toEqual(
      production({ rushingYards: 1599, receptions: 107, receivingYards: 756 }),
    );
    expect(byName.get("Anthony Wright")?.production).toEqual(production({ passingYards: 2995 }));
    expect(byName.get("Demetrius Williams")?.production).toEqual(
      production({ receptions: 64, receivingYards: 1020 }),
    );
  });

  it("rejects a Team+Era that is not in the remaining legal pool", async () => {
    const { id } = await repository.createSession({ mode: "CLASSIC" });
    await expect(
      qaForceSpin(repository, id, { franchiseAbbreviation: "ZZZ", eraLabel: "2000s" }),
    ).rejects.toMatchObject({ code: "NO_VALID_SPIN" });
  });
});

describe("qaRerollSpin", () => {
  let repository: InMemoryGameRepository;

  beforeEach(() => {
    repository = createInMemoryGameRepository([...baltimore2000sCards(), ...multiTeamCards()]);
  });

  it("does not consume Team Skip or Era Skip and preserves picks", async () => {
    const { id } = await repository.createSession({ mode: "CLASSIC" });
    await spinGame(repository, id, () => 0);
    await repository.commitPick({
      sessionId: id,
      pick: {
        roundNumber: 1,
        lineupSlot: "WR1",
        playerId: 201,
        playerTeamEraCardId: 201,
        franchiseId: 1,
        eraId: 1,
      },
      complete: false,
    });

    const before = await loadGameState(repository, id);
    expect(before.picks).toHaveLength(1);
    expect(before.roundNumber).toBe(2);
    expect(before.teamSkipRemaining).toBe(1);
    expect(before.eraSkipRemaining).toBe(1);

    const rerolled = await qaRerollSpin(repository, id, () => 0.5);
    const after = await loadGameState(repository, id);

    expect(after.teamSkipRemaining).toBe(1);
    expect(after.eraSkipRemaining).toBe(1);
    expect(after.picks).toEqual(before.picks);
    expect(after.roundNumber).toBe(2);
    expect(after.lineup.WR1?.playerId).toBe(201);
    expect(rerolled.spin.candidates.length).toBeGreaterThan(0);
    expect(after.currentSpin).not.toBeNull();
  });

  it("is unlimited across repeated rerolls", async () => {
    const { id } = await repository.createSession({ mode: "CLASSIC" });
    await qaRerollSpin(repository, id, () => 0);
    await qaRerollSpin(repository, id, () => 0.4);
    await qaRerollSpin(repository, id, () => 0.9);
    const after = await loadGameState(repository, id);
    expect(after.teamSkipRemaining).toBe(1);
    expect(after.eraSkipRemaining).toBe(1);
  });

  it("refuses a finished or unknown game", async () => {
    await expect(
      qaRerollSpin(repository, "11111111-1111-4111-8111-111111111111"),
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });

    const { id } = await repository.createSession({ mode: "CLASSIC" });
    const slots = ["QB", "RB", "FB", "WR1", "WR2", "TE"] as const;
    for (const [index, slot] of slots.entries()) {
      await repository.commitPick({
        sessionId: id,
        pick: {
          roundNumber: index + 1,
          lineupSlot: slot,
          playerId: 800 + index,
          playerTeamEraCardId: 800 + index,
          franchiseId: 9,
          eraId: 9,
        },
        complete: index === slots.length - 1,
      });
    }

    await expect(qaRerollSpin(repository, id)).rejects.toBeInstanceOf(GameRuleError);
  });
});

describe("qaInspectSpinPool", () => {
  it("lists BAL 2000s among real remaining combinations", async () => {
    const repository = createInMemoryGameRepository([...baltimore2000sCards(), ...multiTeamCards()]);
    const { id } = await repository.createSession({ mode: "CLASSIC" });
    const pool = await qaInspectSpinPool(repository, id);
    expect(pool.combinationCount).toBeGreaterThan(1);
    expect(
      pool.combinations.some(
        (combination) => combination.franchiseAbbreviation === "BAL" && combination.eraLabel === "2000s",
      ),
    ).toBe(true);
  });
});
