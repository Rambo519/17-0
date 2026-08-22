/**
 * The 32 current NFL franchise lineages used by the game.
 *
 * Abbreviations and city names move; the slug is the permanent identity.
 * Season naming history is consulted when writing `franchise_seasons`.
 */

export interface FranchiseNamingPeriod {
  /** Inclusive upper bound for this naming. Use a large year for "current". */
  throughSeason: number;
  displayName: string;
  abbreviation: string;
}

export interface FranchiseLineage {
  slug: string;
  canonicalName: string;
  canonicalAbbreviation: string;
  /** First NFL/AFL season this lineage existed in our playable window. */
  firstSeason: number;
  /**
   * Inclusive last season of continuous existence. Null means still active.
   * Used for the Browns 1996–1998 hiatus (two ranges via `activeRanges`).
   */
  activeRanges: readonly { from: number; to: number | null }[];
  history: readonly FranchiseNamingPeriod[];
}

const ONGOING = 9999;

/**
 * Central registry of the 32 lineages. Expansion years and Browns/Ravens
 * separation are explicit here so importers never guess.
 */
export const FRANCHISE_LINEAGES: readonly FranchiseLineage[] = [
  {
    slug: "arizona-cardinals",
    canonicalName: "Arizona Cardinals",
    canonicalAbbreviation: "ARI",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [
      { throughSeason: 1987, displayName: "St. Louis Cardinals", abbreviation: "STL" },
      { throughSeason: 1993, displayName: "Phoenix Cardinals", abbreviation: "PHO" },
      { throughSeason: ONGOING, displayName: "Arizona Cardinals", abbreviation: "ARI" },
    ],
  },
  {
    slug: "atlanta-falcons",
    canonicalName: "Atlanta Falcons",
    canonicalAbbreviation: "ATL",
    firstSeason: 1966,
    activeRanges: [{ from: 1966, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Atlanta Falcons", abbreviation: "ATL" }],
  },
  {
    slug: "baltimore-ravens",
    canonicalName: "Baltimore Ravens",
    canonicalAbbreviation: "BAL",
    firstSeason: 1996,
    activeRanges: [{ from: 1996, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Baltimore Ravens", abbreviation: "BAL" }],
  },
  {
    slug: "buffalo-bills",
    canonicalName: "Buffalo Bills",
    canonicalAbbreviation: "BUF",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Buffalo Bills", abbreviation: "BUF" }],
  },
  {
    slug: "carolina-panthers",
    canonicalName: "Carolina Panthers",
    canonicalAbbreviation: "CAR",
    firstSeason: 1995,
    activeRanges: [{ from: 1995, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Carolina Panthers", abbreviation: "CAR" }],
  },
  {
    slug: "chicago-bears",
    canonicalName: "Chicago Bears",
    canonicalAbbreviation: "CHI",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Chicago Bears", abbreviation: "CHI" }],
  },
  {
    slug: "cincinnati-bengals",
    canonicalName: "Cincinnati Bengals",
    canonicalAbbreviation: "CIN",
    firstSeason: 1968,
    activeRanges: [{ from: 1968, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Cincinnati Bengals", abbreviation: "CIN" }],
  },
  {
    slug: "cleveland-browns",
    canonicalName: "Cleveland Browns",
    canonicalAbbreviation: "CLE",
    firstSeason: 1960,
    // Browns identity suspended 1996–1998; Ravens are a separate lineage.
    activeRanges: [
      { from: 1960, to: 1995 },
      { from: 1999, to: null },
    ],
    history: [{ throughSeason: ONGOING, displayName: "Cleveland Browns", abbreviation: "CLE" }],
  },
  {
    slug: "dallas-cowboys",
    canonicalName: "Dallas Cowboys",
    canonicalAbbreviation: "DAL",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Dallas Cowboys", abbreviation: "DAL" }],
  },
  {
    slug: "denver-broncos",
    canonicalName: "Denver Broncos",
    canonicalAbbreviation: "DEN",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Denver Broncos", abbreviation: "DEN" }],
  },
  {
    slug: "detroit-lions",
    canonicalName: "Detroit Lions",
    canonicalAbbreviation: "DET",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Detroit Lions", abbreviation: "DET" }],
  },
  {
    slug: "green-bay-packers",
    canonicalName: "Green Bay Packers",
    canonicalAbbreviation: "GB",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Green Bay Packers", abbreviation: "GB" }],
  },
  {
    slug: "houston-texans",
    canonicalName: "Houston Texans",
    canonicalAbbreviation: "HOU",
    firstSeason: 2002,
    activeRanges: [{ from: 2002, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Houston Texans", abbreviation: "HOU" }],
  },
  {
    slug: "indianapolis-colts",
    canonicalName: "Indianapolis Colts",
    canonicalAbbreviation: "IND",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [
      { throughSeason: 1983, displayName: "Baltimore Colts", abbreviation: "BAL" },
      { throughSeason: ONGOING, displayName: "Indianapolis Colts", abbreviation: "IND" },
    ],
  },
  {
    slug: "jacksonville-jaguars",
    canonicalName: "Jacksonville Jaguars",
    canonicalAbbreviation: "JAX",
    firstSeason: 1995,
    activeRanges: [{ from: 1995, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Jacksonville Jaguars", abbreviation: "JAX" }],
  },
  {
    slug: "kansas-city-chiefs",
    canonicalName: "Kansas City Chiefs",
    canonicalAbbreviation: "KC",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [
      { throughSeason: 1962, displayName: "Dallas Texans", abbreviation: "TEX" },
      { throughSeason: ONGOING, displayName: "Kansas City Chiefs", abbreviation: "KC" },
    ],
  },
  {
    slug: "las-vegas-raiders",
    canonicalName: "Las Vegas Raiders",
    canonicalAbbreviation: "LV",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [
      { throughSeason: 1981, displayName: "Oakland Raiders", abbreviation: "OAK" },
      { throughSeason: 1994, displayName: "Los Angeles Raiders", abbreviation: "RAI" },
      { throughSeason: 2019, displayName: "Oakland Raiders", abbreviation: "OAK" },
      { throughSeason: ONGOING, displayName: "Las Vegas Raiders", abbreviation: "LV" },
    ],
  },
  {
    slug: "los-angeles-chargers",
    canonicalName: "Los Angeles Chargers",
    canonicalAbbreviation: "LAC",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [
      { throughSeason: 1960, displayName: "Los Angeles Chargers", abbreviation: "LAC" },
      { throughSeason: 2016, displayName: "San Diego Chargers", abbreviation: "SD" },
      { throughSeason: ONGOING, displayName: "Los Angeles Chargers", abbreviation: "LAC" },
    ],
  },
  {
    slug: "los-angeles-rams",
    canonicalName: "Los Angeles Rams",
    canonicalAbbreviation: "LA",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [
      { throughSeason: 1994, displayName: "Los Angeles Rams", abbreviation: "LA" },
      { throughSeason: 2015, displayName: "St. Louis Rams", abbreviation: "STL" },
      { throughSeason: ONGOING, displayName: "Los Angeles Rams", abbreviation: "LA" },
    ],
  },
  {
    slug: "miami-dolphins",
    canonicalName: "Miami Dolphins",
    canonicalAbbreviation: "MIA",
    firstSeason: 1966,
    activeRanges: [{ from: 1966, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Miami Dolphins", abbreviation: "MIA" }],
  },
  {
    slug: "minnesota-vikings",
    canonicalName: "Minnesota Vikings",
    canonicalAbbreviation: "MIN",
    firstSeason: 1961,
    activeRanges: [{ from: 1961, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Minnesota Vikings", abbreviation: "MIN" }],
  },
  {
    slug: "new-england-patriots",
    canonicalName: "New England Patriots",
    canonicalAbbreviation: "NE",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [
      { throughSeason: 1970, displayName: "Boston Patriots", abbreviation: "BOS" },
      { throughSeason: ONGOING, displayName: "New England Patriots", abbreviation: "NE" },
    ],
  },
  {
    slug: "new-orleans-saints",
    canonicalName: "New Orleans Saints",
    canonicalAbbreviation: "NO",
    firstSeason: 1967,
    activeRanges: [{ from: 1967, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "New Orleans Saints", abbreviation: "NO" }],
  },
  {
    slug: "new-york-giants",
    canonicalName: "New York Giants",
    canonicalAbbreviation: "NYG",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "New York Giants", abbreviation: "NYG" }],
  },
  {
    slug: "new-york-jets",
    canonicalName: "New York Jets",
    canonicalAbbreviation: "NYJ",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [
      { throughSeason: 1962, displayName: "New York Titans", abbreviation: "NYT" },
      { throughSeason: ONGOING, displayName: "New York Jets", abbreviation: "NYJ" },
    ],
  },
  {
    slug: "philadelphia-eagles",
    canonicalName: "Philadelphia Eagles",
    canonicalAbbreviation: "PHI",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Philadelphia Eagles", abbreviation: "PHI" }],
  },
  {
    slug: "pittsburgh-steelers",
    canonicalName: "Pittsburgh Steelers",
    canonicalAbbreviation: "PIT",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Pittsburgh Steelers", abbreviation: "PIT" }],
  },
  {
    slug: "san-francisco-49ers",
    canonicalName: "San Francisco 49ers",
    canonicalAbbreviation: "SF",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "San Francisco 49ers", abbreviation: "SF" }],
  },
  {
    slug: "seattle-seahawks",
    canonicalName: "Seattle Seahawks",
    canonicalAbbreviation: "SEA",
    firstSeason: 1976,
    activeRanges: [{ from: 1976, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Seattle Seahawks", abbreviation: "SEA" }],
  },
  {
    slug: "tampa-bay-buccaneers",
    canonicalName: "Tampa Bay Buccaneers",
    canonicalAbbreviation: "TB",
    firstSeason: 1976,
    activeRanges: [{ from: 1976, to: null }],
    history: [{ throughSeason: ONGOING, displayName: "Tampa Bay Buccaneers", abbreviation: "TB" }],
  },
  {
    slug: "tennessee-titans",
    canonicalName: "Tennessee Titans",
    canonicalAbbreviation: "TEN",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [
      { throughSeason: 1996, displayName: "Houston Oilers", abbreviation: "HOU" },
      { throughSeason: 1998, displayName: "Tennessee Oilers", abbreviation: "TEN" },
      { throughSeason: ONGOING, displayName: "Tennessee Titans", abbreviation: "TEN" },
    ],
  },
  {
    slug: "washington-commanders",
    canonicalName: "Washington Commanders",
    canonicalAbbreviation: "WAS",
    firstSeason: 1960,
    activeRanges: [{ from: 1960, to: null }],
    history: [
      { throughSeason: 2019, displayName: "Washington Redskins", abbreviation: "WAS" },
      { throughSeason: 2021, displayName: "Washington Football Team", abbreviation: "WAS" },
      { throughSeason: ONGOING, displayName: "Washington Commanders", abbreviation: "WAS" },
    ],
  },
];

export function franchiseLineageBySlug(slug: string): FranchiseLineage | undefined {
  return FRANCHISE_LINEAGES.find((franchise) => franchise.slug === slug);
}

export function isFranchiseActiveInSeason(lineage: FranchiseLineage, season: number): boolean {
  return lineage.activeRanges.some((range) => {
    const to = range.to ?? ONGOING;
    return season >= range.from && season <= to;
  });
}

export function namingForSeason(
  lineage: FranchiseLineage,
  season: number,
): { displayName: string; abbreviation: string } {
  const period = lineage.history.find((entry) => season <= entry.throughSeason);
  if (period) {
    return { displayName: period.displayName, abbreviation: period.abbreviation };
  }
  return {
    displayName: lineage.canonicalName,
    abbreviation: lineage.canonicalAbbreviation,
  };
}

/** Every season a franchise should have a `franchise_seasons` row. */
export function seasonsForFranchise(
  lineage: FranchiseLineage,
  fromSeason: number,
  toSeason: number,
): number[] {
  const seasons: number[] = [];
  for (let season = fromSeason; season <= toSeason; season += 1) {
    if (isFranchiseActiveInSeason(lineage, season)) seasons.push(season);
  }
  return seasons;
}
