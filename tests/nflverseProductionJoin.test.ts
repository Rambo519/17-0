import { describe, expect, it } from "vitest";

import { nflverseProductionJoinKey } from "@/data/sources/nflverse/productionJoin";

describe("nflverse roster ↔ player_stats production join", () => {
  it("joins Ravens roster BLT with player_stats BAL in the 2000s", () => {
    const gsisId = "00-0020516";
    expect(nflverseProductionJoinKey(gsisId, "BLT", 2005)).toBe(
      nflverseProductionJoinKey(gsisId, "BAL", 2005),
    );
    expect(nflverseProductionJoinKey(gsisId, "BLT", 2005)).toBe(
      `${gsisId}|baltimore-ravens|2005`,
    );
  });

  it("joins Texans roster HST with player_stats HOU in the 2000s", () => {
    const gsisId = "00-0021377";
    expect(nflverseProductionJoinKey(gsisId, "HST", 2005)).toBe(
      nflverseProductionJoinKey(gsisId, "HOU", 2005),
    );
    expect(nflverseProductionJoinKey(gsisId, "HST", 2005)).toBe(
      `${gsisId}|houston-texans|2005`,
    );
  });

  it("keeps Oilers HOU on the Titans lineage and does not join 1999 HOU", () => {
    expect(nflverseProductionJoinKey("x", "HOU", 1980)).toBe("x|tennessee-titans|1980");
    expect(nflverseProductionJoinKey("x", "HOU", 1999)).toBeNull();
    expect(nflverseProductionJoinKey("x", "HST", 2002)).toBe("x|houston-texans|2002");
  });

  it("joins other source-code pairs through franchise aliases, not raw abbreviations", () => {
    expect(nflverseProductionJoinKey("x", "GB", 2010)).toBe(
      nflverseProductionJoinKey("x", "GNB", 2010),
    );
    expect(nflverseProductionJoinKey("x", "WAS", 2012)).toBe(
      nflverseProductionJoinKey("x", "WSH", 2012),
    );
    expect(nflverseProductionJoinKey("x", "SD", 2005)).toBe(
      nflverseProductionJoinKey("x", "SDG", 2005),
    );
  });
});
