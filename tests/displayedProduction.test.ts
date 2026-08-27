import { describe, expect, it } from "vitest";

import {
  classicDisplayIsAllDashes,
  hasPositionRelevantProduction,
  hasUnrelatedProductionOnly,
} from "@/data/audit/displayedProduction";
import { EMPTY_PRODUCTION } from "@/lib/game/production";
import type { CardProduction } from "@/lib/game/types";

const teTotals: CardProduction = {
  ...EMPTY_PRODUCTION,
  games: 39,
  receptions: 78,
  receivingYards: 595,
  receivingTouchdowns: 8,
  passingYards: 0,
  rushingYards: 0,
};

describe("CLASSIC displayed production grading", () => {
  it("treats null CLASSIC fields as dashes and filled receiving totals as relevant for TE", () => {
    expect(classicDisplayIsAllDashes(["TE"], EMPTY_PRODUCTION)).toBe(true);
    expect(classicDisplayIsAllDashes(["TE"], teTotals)).toBe(false);
    expect(hasPositionRelevantProduction(["TE"], teTotals)).toBe(true);
    expect(hasUnrelatedProductionOnly(["TE"], teTotals)).toBe(false);
  });

  it("flags a WR whose only stored production is rushing as unrelated", () => {
    const rushingOnly: CardProduction = {
      ...EMPTY_PRODUCTION,
      rushingYards: 120,
    };
    expect(classicDisplayIsAllDashes(["WR"], rushingOnly)).toBe(true);
    expect(hasPositionRelevantProduction(["WR"], rushingOnly)).toBe(false);
    expect(hasUnrelatedProductionOnly(["WR"], rushingOnly)).toBe(true);
  });

  it("treats QB rushing as position-relevant CLASSIC production", () => {
    const rushQb: CardProduction = {
      ...EMPTY_PRODUCTION,
      rushingYards: 81,
    };
    expect(classicDisplayIsAllDashes(["QB"], rushQb)).toBe(false);
    expect(hasPositionRelevantProduction(["QB"], rushQb)).toBe(true);
    expect(hasUnrelatedProductionOnly(["QB"], rushQb)).toBe(false);
  });

  it("shows games for a blocking FB so CLASSIC is not all dashes", () => {
    const blocking: CardProduction = {
      ...EMPTY_PRODUCTION,
      games: 16,
    };
    expect(classicDisplayIsAllDashes(["FB"], blocking)).toBe(false);
    expect(hasPositionRelevantProduction(["FB"], blocking)).toBe(false);
  });

  it("never treats a role-consistent draftable card as CLASSIC all-dashes", () => {
    const wr: CardProduction = { ...EMPTY_PRODUCTION, receptions: 12, receivingYards: 140 };
    expect(classicDisplayIsAllDashes(["WR"], wr)).toBe(false);
    const qb: CardProduction = { ...EMPTY_PRODUCTION, rushingYards: 81 };
    expect(classicDisplayIsAllDashes(["QB"], qb)).toBe(false);
  });
});
