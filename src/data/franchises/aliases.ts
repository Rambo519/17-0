/**
 * Season-aware mapping from source team abbreviations to franchise slugs.
 *
 * All abbreviation conversions for historical import must go through this
 * module. Importers never hard-code team codes inline.
 */

import {
  FRANCHISE_LINEAGES,
  franchiseLineageBySlug,
  isFranchiseActiveInSeason,
} from "./lineages";

export type FranchiseAliasResult =
  | { ok: true; slug: string }
  | { ok: false; reason: "unmapped" | "inactive" | "ambiguous" };

interface SeasonBoundAlias {
  abbr: string;
  /** Inclusive season bounds. Null bound means open-ended. */
  from: number | null;
  to: number | null;
  slug: string;
}

/**
 * Explicit (abbreviation, season-range) → lineage rules.
 * More specific ranges must be listed before catch-alls for the same abbr.
 */
const SEASON_BOUND_ALIASES: readonly SeasonBoundAlias[] = [
  // Baltimore: Colts through 1983, Ravens from 1996 (gap has no BAL franchise).
  { abbr: "BAL", from: null, to: 1983, slug: "indianapolis-colts" },
  { abbr: "BAL", from: 1996, to: null, slug: "baltimore-ravens" },
  { abbr: "BLT", from: 1996, to: null, slug: "baltimore-ravens" },

  // Houston: Oilers through 1996, Texans from 2002.
  { abbr: "HOU", from: null, to: 1996, slug: "tennessee-titans" },
  { abbr: "HOU", from: 2002, to: null, slug: "houston-texans" },

  // St. Louis: Cardinals through 1987, Rams 1995–2015.
  { abbr: "STL", from: null, to: 1987, slug: "arizona-cardinals" },
  { abbr: "STL", from: 1995, to: 2015, slug: "los-angeles-rams" },
  { abbr: "SL", from: 1995, to: 2015, slug: "los-angeles-rams" },

  // Phoenix Cardinals window.
  { abbr: "PHO", from: 1988, to: 1993, slug: "arizona-cardinals" },
  { abbr: "PHX", from: 1988, to: 1993, slug: "arizona-cardinals" },

  // Oilers / Titans transitional codes.
  { abbr: "OTI", from: 1997, to: 1998, slug: "tennessee-titans" },
  { abbr: "TEN", from: 1997, to: null, slug: "tennessee-titans" },
];

/** Abbreviations that always resolve to one lineage (no season split). */
const STATIC_ALIASES: Readonly<Record<string, string>> = {
  ARI: "arizona-cardinals",
  ARZ: "arizona-cardinals",
  AZ: "arizona-cardinals",
  CRD: "arizona-cardinals",

  ATL: "atlanta-falcons",

  BUF: "buffalo-bills",

  CAR: "carolina-panthers",

  CHI: "chicago-bears",

  CIN: "cincinnati-bengals",

  CLE: "cleveland-browns",
  CLV: "cleveland-browns",

  DAL: "dallas-cowboys",
  COW: "dallas-cowboys",

  DEN: "denver-broncos",

  DET: "detroit-lions",

  GB: "green-bay-packers",
  GNB: "green-bay-packers",
  GBP: "green-bay-packers",

  // HOU is season-bound (Oilers vs Texans). HST is the Texans-era alternate code.
  HST: "houston-texans",

  IND: "indianapolis-colts",

  JAX: "jacksonville-jaguars",
  JAC: "jacksonville-jaguars",

  KC: "kansas-city-chiefs",
  KAN: "kansas-city-chiefs",
  KCC: "kansas-city-chiefs",
  TEX: "kansas-city-chiefs",

  LV: "las-vegas-raiders",
  LVR: "las-vegas-raiders",
  OAK: "las-vegas-raiders",
  RAI: "las-vegas-raiders",

  LAC: "los-angeles-chargers",
  SD: "los-angeles-chargers",
  SDG: "los-angeles-chargers",
  SDC: "los-angeles-chargers",
  CHR: "los-angeles-chargers",

  LA: "los-angeles-rams",
  LAR: "los-angeles-rams",
  RAM: "los-angeles-rams",

  MIA: "miami-dolphins",

  MIN: "minnesota-vikings",

  NE: "new-england-patriots",
  NEP: "new-england-patriots",
  BOS: "new-england-patriots",

  NO: "new-orleans-saints",
  NOR: "new-orleans-saints",
  NOS: "new-orleans-saints",

  NYG: "new-york-giants",

  NYJ: "new-york-jets",
  NYT: "new-york-jets",

  PHI: "philadelphia-eagles",

  PIT: "pittsburgh-steelers",

  SF: "san-francisco-49ers",
  SFO: "san-francisco-49ers",

  SEA: "seattle-seahawks",

  TB: "tampa-bay-buccaneers",
  TAM: "tampa-bay-buccaneers",
  TBB: "tampa-bay-buccaneers",

  WAS: "washington-commanders",
  WSH: "washington-commanders",
  WFT: "washington-commanders",
};

function seasonInRange(season: number, from: number | null, to: number | null): boolean {
  if (from != null && season < from) return false;
  if (to != null && season > to) return false;
  return true;
}

/**
 * Resolve a source abbreviation for a given season to a franchise slug.
 */
export function resolveFranchiseAlias(rawAbbr: string, season: number): FranchiseAliasResult {
  const abbr = rawAbbr.trim().toUpperCase();
  if (!abbr) return { ok: false, reason: "unmapped" };

  const boundMatches = SEASON_BOUND_ALIASES.filter(
    (entry) => entry.abbr === abbr && seasonInRange(season, entry.from, entry.to),
  );

  if (boundMatches.length > 1) {
    return { ok: false, reason: "ambiguous" };
  }

  if (boundMatches.length === 1) {
    const match = boundMatches[0];
    if (!match) return { ok: false, reason: "unmapped" };
    return activateIfValid(match.slug, season);
  }

  // Season-sensitive abbreviations with no matching window stay unmapped
  // (e.g. BAL in 1990, HOU in 1999, STL in 1990).
  if (abbr === "BAL" || abbr === "HOU" || abbr === "STL" || abbr === "SL" || abbr === "BLT") {
    return { ok: false, reason: "unmapped" };
  }

  const staticSlug = STATIC_ALIASES[abbr];
  if (!staticSlug) return { ok: false, reason: "unmapped" };
  return activateIfValid(staticSlug, season);
}

function activateIfValid(slug: string, season: number): FranchiseAliasResult {
  const lineage = franchiseLineageBySlug(slug);
  if (!lineage) return { ok: false, reason: "unmapped" };
  if (!isFranchiseActiveInSeason(lineage, season)) {
    return { ok: false, reason: "inactive" };
  }
  return { ok: true, slug };
}

/** Every known source abbreviation (for tests / docs). */
export function knownFranchiseAbbreviations(): string[] {
  const set = new Set<string>([
    ...Object.keys(STATIC_ALIASES),
    ...SEASON_BOUND_ALIASES.map((entry) => entry.abbr),
  ]);
  return [...set].sort();
}

export function assertLineageCount(): number {
  return FRANCHISE_LINEAGES.length;
}
