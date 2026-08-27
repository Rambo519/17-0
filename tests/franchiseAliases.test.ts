import { describe, expect, it } from "vitest";

import { resolveFranchiseAlias, assertLineageCount } from "@/data/franchises/aliases";
import {
  FRANCHISE_LINEAGES,
  isFranchiseActiveInSeason,
  seasonsForFranchise,
} from "@/data/franchises/lineages";

describe("franchise alias mapping", () => {
  it("registers exactly 32 lineages", () => {
    expect(assertLineageCount()).toBe(32);
    expect(FRANCHISE_LINEAGES).toHaveLength(32);
  });

  it("joins Ravens roster BLT with player_stats BAL for the same season", () => {
    expect(resolveFranchiseAlias("BLT", 2005)).toEqual({ ok: true, slug: "baltimore-ravens" });
    expect(resolveFranchiseAlias("BAL", 2005)).toEqual({ ok: true, slug: "baltimore-ravens" });
  });

  it("joins Texans roster HST with player_stats HOU for the same season", () => {
    expect(resolveFranchiseAlias("HST", 2005)).toEqual({ ok: true, slug: "houston-texans" });
    expect(resolveFranchiseAlias("HOU", 2005)).toEqual({ ok: true, slug: "houston-texans" });
    expect(resolveFranchiseAlias("HOU", 1999).ok).toBe(false);
  });

  it("maps relocation aliases to permanent lineages", () => {
    expect(resolveFranchiseAlias("OAK", 1976)).toEqual({ ok: true, slug: "las-vegas-raiders" });
    expect(resolveFranchiseAlias("SD", 2005)).toEqual({ ok: true, slug: "los-angeles-chargers" });
    expect(resolveFranchiseAlias("BOS", 1965)).toEqual({ ok: true, slug: "new-england-patriots" });
    expect(resolveFranchiseAlias("PHO", 1990)).toEqual({ ok: true, slug: "arizona-cardinals" });
    expect(resolveFranchiseAlias("NYT", 1961)).toEqual({ ok: true, slug: "new-york-jets" });
    expect(resolveFranchiseAlias("TEX", 1961)).toEqual({ ok: true, slug: "kansas-city-chiefs" });
    expect(resolveFranchiseAlias("CHR", 1960)).toEqual({ ok: true, slug: "los-angeles-chargers" });
    expect(resolveFranchiseAlias("RAM", 1965)).toEqual({ ok: true, slug: "los-angeles-rams" });
    expect(resolveFranchiseAlias("ARZ", 2005)).toEqual({ ok: true, slug: "arizona-cardinals" });
    expect(resolveFranchiseAlias("HST", 2005)).toEqual({ ok: true, slug: "houston-texans" });
  });

  it("handles Baltimore Colts vs Ravens by season", () => {
    expect(resolveFranchiseAlias("BAL", 1970)).toEqual({ ok: true, slug: "indianapolis-colts" });
    expect(resolveFranchiseAlias("BAL", 1996)).toEqual({ ok: true, slug: "baltimore-ravens" });
    expect(resolveFranchiseAlias("BAL", 1990).ok).toBe(false);
  });

  it("handles Houston Oilers vs Texans by season", () => {
    expect(resolveFranchiseAlias("HOU", 1980)).toEqual({ ok: true, slug: "tennessee-titans" });
    expect(resolveFranchiseAlias("HOU", 2002)).toEqual({ ok: true, slug: "houston-texans" });
    expect(resolveFranchiseAlias("HOU", 1999).ok).toBe(false);
  });

  it("handles St. Louis Cardinals vs Rams by season", () => {
    expect(resolveFranchiseAlias("STL", 1975)).toEqual({ ok: true, slug: "arizona-cardinals" });
    expect(resolveFranchiseAlias("STL", 2000)).toEqual({ ok: true, slug: "los-angeles-rams" });
    expect(resolveFranchiseAlias("STL", 1990).ok).toBe(false);
  });

  it("keeps Browns identity separate from Ravens", () => {
    expect(resolveFranchiseAlias("CLE", 1995)).toEqual({ ok: true, slug: "cleveland-browns" });
    expect(resolveFranchiseAlias("CLE", 1996).ok).toBe(false);
    expect(resolveFranchiseAlias("BAL", 1996)).toEqual({ ok: true, slug: "baltimore-ravens" });
    expect(resolveFranchiseAlias("CLE", 1999)).toEqual({ ok: true, slug: "cleveland-browns" });
  });
});

describe("expansion-year filtering", () => {
  it("does not invent franchise-seasons before a franchise existed", () => {
    const jaguars = FRANCHISE_LINEAGES.find((row) => row.slug === "jacksonville-jaguars");
    const panthers = FRANCHISE_LINEAGES.find((row) => row.slug === "carolina-panthers");
    const texans = FRANCHISE_LINEAGES.find((row) => row.slug === "houston-texans");
    expect(jaguars && seasonsForFranchise(jaguars, 1960, 2000)[0]).toBe(1995);
    expect(panthers && seasonsForFranchise(panthers, 1960, 2000)[0]).toBe(1995);
    expect(texans && seasonsForFranchise(texans, 1960, 2010)[0]).toBe(2002);
  });

  it("marks expansion franchises inactive before their debut", () => {
    const jaguars = FRANCHISE_LINEAGES.find((row) => row.slug === "jacksonville-jaguars");
    expect(jaguars && isFranchiseActiveInSeason(jaguars, 1994)).toBe(false);
    expect(jaguars && isFranchiseActiveInSeason(jaguars, 1995)).toBe(true);
  });
});
