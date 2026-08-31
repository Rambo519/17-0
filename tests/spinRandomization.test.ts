import { describe, expect, it } from "vitest";

import type { LineupSlot } from "@/lib/football/positions";
import { loadGameState } from "@/lib/game/gameState";
import { buildSpinCombinations, chooseSpinCombination, type SpinCombination } from "@/lib/game/spin";
import type { DraftableCard } from "@/lib/game/types";

import { card, createInMemoryGameRepository } from "./helpers/inMemoryGameRepository";
import {
  mulberry32,
  simulateSpinSelection,
  spinCombinationKey,
  summarizeCounts,
} from "./helpers/spinSelectionSimulation";

const DRAWS = 100_000;

async function occupySlots(
  repo: ReturnType<typeof createInMemoryGameRepository>,
  sessionId: string,
  slots: readonly LineupSlot[],
): Promise<void> {
  for (const [index, slot] of slots.entries()) {
    await repo.commitPick({
      sessionId,
      pick: {
        roundNumber: index + 1,
        lineupSlot: slot,
        playerId: 9000 + index,
        playerTeamEraCardId: 9000 + index,
        franchiseId: 99,
        eraId: 99,
      },
      complete: false,
    });
  }
}

function labeledCombo(
  abbreviation: string,
  eraLabel: string,
  franchiseId: number,
  eraId: number,
  candidateCount: number,
): SpinCombination {
  return {
    franchiseId,
    franchiseName: abbreviation,
    franchiseAbbreviation: abbreviation,
    eraId,
    eraLabel,
    candidates: Array.from({ length: candidateCount }, (_, index) => ({
      eligibleSlots: ["QB"] as LineupSlot[],
      card: card({
        cardId: franchiseId * 1000 + eraId * 100 + index,
        playerId: franchiseId * 1000 + eraId * 100 + index,
        franchiseId,
        eraId,
        franchiseAbbreviation: abbreviation,
        eraLabel,
        positions: ["QB"],
      }),
    })),
  };
}

function laterRoundCards(): DraftableCard[] {
  const cards: DraftableCard[] = [];
  // Huge WR-only pool (should not become more likely than a 1-card TE combo).
  for (let index = 0; index < 80; index += 1) {
    cards.push(
      card({
        franchiseId: 1,
        eraId: 1,
        franchiseAbbreviation: "WRS",
        eraLabel: "2000s",
        positions: ["WR"],
      }),
    );
  }
  cards.push(
    card({
      franchiseId: 2,
      eraId: 1,
      franchiseAbbreviation: "TES",
      eraLabel: "2000s",
      positions: ["TE"],
    }),
  );
  cards.push(
    card({
      franchiseId: 3,
      eraId: 1,
      franchiseAbbreviation: "QBS",
      eraLabel: "2000s",
      positions: ["QB"],
    }),
  );
  cards.push(
    card({
      franchiseId: 4,
      eraId: 1,
      franchiseAbbreviation: "FBS",
      eraLabel: "2000s",
      positions: ["FB"],
    }),
  );
  cards.push(
    card({
      franchiseId: 5,
      eraId: 1,
      franchiseAbbreviation: "RBS",
      eraLabel: "2000s",
      positions: ["RB"],
    }),
  );
  return cards;
}

describe("production SPIN randomization (audit only — no behavior change)", () => {
  it("selects uniformly among combinations, not among candidates", () => {
    const combinations = [
      labeledCombo("TINY", "2000s", 1, 1, 1),
      labeledCombo("HUGE", "2000s", 2, 1, 400),
    ];
    const counts = simulateSpinSelection(combinations, DRAWS, mulberry32(1));
    const tiny = counts.get("TINY:2000s") ?? 0;
    const huge = counts.get("HUGE:2000s") ?? 0;
    expect(tiny + huge).toBe(DRAWS);
    expect(Math.abs(tiny - huge) / DRAWS).toBeLessThan(0.02);
  });

  it("uses floor(rng * n) and can repeat the same Team+Era immediately", () => {
    const combinations = [
      labeledCombo("AAA", "1990s", 1, 1, 3),
      labeledCombo("BBB", "2000s", 2, 2, 3),
    ];
    const first = chooseSpinCombination(combinations, () => 0);
    const second = chooseSpinCombination(combinations, () => 0);
    expect(spinCombinationKey(first)).toBe("AAA:1990s");
    expect(spinCombinationKey(second)).toBe("AAA:1990s");
    expect(Math.min(Math.floor(0.999 * 2), 1)).toBe(1);
  });

  it("keeps later-round draws uniform after illegal combinations drop out", async () => {
    const repository = createInMemoryGameRepository(laterRoundCards());
    const scenarios: Array<{ name: string; filled: LineupSlot[]; expected: string[] }> = [
      { name: "all slots open", filled: [], expected: ["WRS:2000s", "TES:2000s", "QBS:2000s", "RBS:2000s"] },
      { name: "QB filled", filled: ["QB"], expected: ["WRS:2000s", "TES:2000s", "RBS:2000s"] },
      { name: "WR1/WR2 filled", filled: ["WR1", "WR2"], expected: ["TES:2000s", "QBS:2000s", "RBS:2000s"] },
      { name: "only RB2 open", filled: ["QB", "RB1", "WR1", "WR2", "TE"], expected: ["RBS:2000s"] },
      { name: "only TE open", filled: ["QB", "RB1", "RB2", "WR1", "WR2"], expected: ["TES:2000s"] },
    ];

    for (const scenario of scenarios) {
      const { id } = await repository.createSession({ mode: "CLASSIC" });
      if (scenario.filled.length > 0) {
        await occupySlots(repository, id, scenario.filled);
      }
      const state = await loadGameState(repository, id);
      const combinations = buildSpinCombinations(repository.cards, state);
      expect(combinations.map(spinCombinationKey).sort()).toEqual([...scenario.expected].sort());

      const counts = simulateSpinSelection(combinations, DRAWS, mulberry32(7));
      const expectedEach = DRAWS / combinations.length;
      for (const key of scenario.expected) {
        const observed = counts.get(key) ?? 0;
        expect(Math.abs(observed - expectedEach) / DRAWS).toBeLessThan(0.02);
      }
    }
  });

  it("100k draws over a 32×6 franchise/era grid stay near 1/N", () => {
    const franchises = Array.from({ length: 32 }, (_, index) => `T${String(index + 1).padStart(2, "0")}`);
    const eras = ["1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];
    const combinations: SpinCombination[] = [];
    let franchiseId = 1;
    for (const abbreviation of franchises) {
      let eraId = 1;
      for (const eraLabel of eras) {
        combinations.push(
          labeledCombo(abbreviation, eraLabel, franchiseId, eraId, eraLabel === "2000s" ? 64 : 8),
        );
        eraId += 1;
      }
      franchiseId += 1;
    }

    const counts = simulateSpinSelection(combinations, DRAWS, mulberry32(17));
    const summary = summarizeCounts(counts);
    const expected = DRAWS / combinations.length;
    expect(combinations).toHaveLength(192);
    expect(summary.mean).toBeCloseTo(expected, 5);
    expect(summary.max - summary.min).toBeLessThan(expected * 0.4);

    const bal = counts.get("T01:2000s") ?? 0;
    expect(Math.abs(bal - expected) / expected).toBeLessThan(0.12);

    const byFranchise = new Map<string, number>();
    const byEra = new Map<string, number>();
    for (const [key, count] of counts) {
      const [franchise, era] = key.split(":");
      byFranchise.set(franchise!, (byFranchise.get(franchise!) ?? 0) + count);
      byEra.set(era!, (byEra.get(era!) ?? 0) + count);
    }
    const franchiseExpected = DRAWS / franchises.length;
    const eraExpected = DRAWS / eras.length;
    for (const count of byFranchise.values()) {
      expect(Math.abs(count - franchiseExpected) / franchiseExpected).toBeLessThan(0.08);
    }
    for (const count of byEra.values()) {
      expect(Math.abs(count - eraExpected) / eraExpected).toBeLessThan(0.08);
    }
  });
});
