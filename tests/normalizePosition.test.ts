import { describe, expect, it } from "vitest";

import { decadeLabel, decadeStartYear, eraDefinitionForSeason } from "@/lib/football/eras";
import {
  needsManualPositionReview,
  normalizePosition,
  normalizePositions,
} from "@/lib/football/normalizePosition";

describe("normalizePosition", () => {
  it("maps unambiguous historical labels", () => {
    expect(normalizePosition("QB")).toBe("QB");
    expect(normalizePosition("RB")).toBe("RB");
    expect(normalizePosition("HB")).toBe("RB");
    expect(normalizePosition("TB")).toBe("RB");
    expect(normalizePosition("FB")).toBe("FB");
    expect(normalizePosition("WR")).toBe("WR");
    expect(normalizePosition("FL")).toBe("WR");
    expect(normalizePosition("SE")).toBe("WR");
    expect(normalizePosition("TE")).toBe("TE");
  });

  it("is tolerant of casing and whitespace", () => {
    expect(normalizePosition(" hb ")).toBe("RB");
  });

  it("refuses to guess ambiguous labels", () => {
    for (const raw of ["H-BACK", "E", "WB", "B", "", null, undefined, "LB"]) {
      expect(normalizePosition(raw)).toBeNull();
      expect(needsManualPositionReview(raw)).toBe(true);
    }
  });

  it("de-duplicates and drops unmappable labels", () => {
    expect(normalizePositions(["HB", "RB", "FB", "H-BACK"])).toEqual(["RB", "FB"]);
  });
});

describe("eras", () => {
  it("derives decades in one place", () => {
    expect(decadeStartYear(1985)).toBe(1980);
    expect(decadeLabel(1979)).toBe("1970s");
    expect(eraDefinitionForSeason(1994)?.label).toBe("1990s");
    expect(eraDefinitionForSeason(1965)).toBeNull();
    expect(eraDefinitionForSeason(1959)).toBeNull();
  });
});
