/**
 * DEVELOPMENT / TESTING DATA ONLY.
 *
 * The franchises and eras are real because the schema models them, but every
 * player below is fictional and every statistic is invented. Nothing here is a
 * historical claim; this dataset exists purely to exercise the draft engine
 * until the real historical import lands.
 *
 * Raw positions deliberately include legacy labels (HB, TB, FL, SE) so the
 * normalization layer is exercised by the seed itself.
 */

export interface DevStats {
  games?: number;
  gamesStarted?: number;
  passingYards?: number;
  passingTouchdowns?: number;
  interceptions?: number;
  rushingAttempts?: number;
  rushingYards?: number;
  rushingTouchdowns?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTouchdowns?: number;
}

export interface DevPlayerSeason {
  season: number;
  rawPosition: string;
  /** Raw labels this player was also eligible at that season. */
  alsoEligible: string[];
  stats: DevStats | null;
}

export interface DevStint {
  franchiseSlug: string;
  seasons: DevPlayerSeason[];
}

export interface DevPlayer {
  firstName: string;
  lastName: string;
  stints: DevStint[];
}

export interface DevFranchise {
  slug: string;
  canonicalName: string;
  canonicalAbbreviation: string;
  /** Season-specific naming, used when a franchise relocated or rebranded. */
  history: { throughSeason: number; displayName: string; abbreviation: string }[];
}

export const DEV_FRANCHISES: readonly DevFranchise[] = [
  {
    slug: "san-francisco-49ers",
    canonicalName: "San Francisco 49ers",
    canonicalAbbreviation: "SF",
    history: [],
  },
  {
    slug: "pittsburgh-steelers",
    canonicalName: "Pittsburgh Steelers",
    canonicalAbbreviation: "PIT",
    history: [],
  },
  {
    slug: "chicago-bears",
    canonicalName: "Chicago Bears",
    canonicalAbbreviation: "CHI",
    history: [],
  },
  {
    // Relocation example: the same organization, two names.
    slug: "indianapolis-colts",
    canonicalName: "Indianapolis Colts",
    canonicalAbbreviation: "IND",
    history: [{ throughSeason: 1983, displayName: "Baltimore Colts", abbreviation: "BAL" }],
  },
];

function stint(
  franchiseSlug: string,
  from: number,
  to: number,
  rawPosition: string,
  options: { alsoEligible?: string[]; stats?: DevStats } = {},
): DevStint {
  const seasons: DevPlayerSeason[] = [];
  for (let season = from; season <= to; season += 1) {
    seasons.push({
      season,
      rawPosition,
      alsoEligible: options.alsoEligible ?? [],
      // Missing statistics stay null on purpose: unknown is not zero.
      stats: options.stats ?? null,
    });
  }
  return { franchiseSlug, seasons };
}

const SF = "san-francisco-49ers";
const PIT = "pittsburgh-steelers";
const CHI = "chicago-bears";
const IND = "indianapolis-colts";

export const DEV_PLAYERS: readonly DevPlayer[] = [
  // --- San Francisco, 1970s ---
  { firstName: "Marty", lastName: "Kessler", stints: [stint(SF, 1972, 1976, "QB")] },
  { firstName: "Dale", lastName: "Bowman", stints: [stint(SF, 1973, 1977, "HB")] },
  { firstName: "Ray", lastName: "Fontaine", stints: [stint(SF, 1971, 1975, "FL")] },
  { firstName: "Owen", lastName: "Traeger", stints: [stint(SF, 1974, 1978, "TE")] },
  { firstName: "Buddy", lastName: "Nash", stints: [stint(SF, 1975, 1978, "FB")] },

  // --- San Francisco, 1980s ---
  {
    firstName: "Cole",
    lastName: "Bannister",
    stints: [
      stint(SF, 1982, 1988, "QB", {
        stats: {
          games: 16,
          gamesStarted: 16,
          passingYards: 3810,
          passingTouchdowns: 27,
          interceptions: 11,
        },
      }),
    ],
  },
  {
    firstName: "Trent",
    lastName: "Whitlock",
    stints: [
      stint(SF, 1984, 1989, "WR", {
        stats: { games: 16, gamesStarted: 15, receptions: 84, receivingYards: 1310, receivingTouchdowns: 12 },
      }),
    ],
  },
  { firstName: "Gus", lastName: "Pelletier", stints: [stint(SF, 1985, 1989, "FB")] },
  { firstName: "Lester", lastName: "Vance", stints: [stint(SF, 1981, 1986, "TE")] },
  // Same franchise, two decades -> one card per era.
  {
    firstName: "Rudy",
    lastName: "Calder",
    stints: [stint(SF, 1978, 1983, "HB", { stats: { games: 15, rushingAttempts: 244, rushingYards: 1103, rushingTouchdowns: 9 } })],
  },

  // --- Pittsburgh, 1970s ---
  { firstName: "Hal", lastName: "Brunner", stints: [stint(PIT, 1971, 1978, "QB")] },
  // Multi-position: RB + FB.
  { firstName: "Ike", lastName: "Sandoval", stints: [stint(PIT, 1973, 1979, "HB", { alsoEligible: ["FB"] })] },
  { firstName: "Wendell", lastName: "Pryor", stints: [stint(PIT, 1972, 1977, "FL")] },
  { firstName: "Cliff", lastName: "Rutherford", stints: [stint(PIT, 1974, 1979, "SE")] },
  { firstName: "Dean", lastName: "Ostrowski", stints: [stint(PIT, 1970, 1976, "TE")] },

  // --- Pittsburgh, 2010s ---
  { firstName: "Xavier", lastName: "Lund", stints: [stint(PIT, 2013, 2019, "QB")] },
  { firstName: "Marcus", lastName: "Trippe", stints: [stint(PIT, 2015, 2019, "RB")] },
  { firstName: "Deon", lastName: "Falkner", stints: [stint(PIT, 2012, 2018, "WR")] },
  { firstName: "Kyle", lastName: "Merriweather", stints: [stint(PIT, 2014, 2019, "TE", { alsoEligible: ["FB"] })] },

  // --- Chicago, 1980s ---
  { firstName: "Nate", lastName: "Ferrone", stints: [stint(CHI, 1981, 1987, "QB")] },
  {
    firstName: "Duke",
    lastName: "Halloran",
    stints: [
      stint(CHI, 1982, 1989, "RB", {
        stats: { games: 16, gamesStarted: 16, rushingAttempts: 331, rushingYards: 1642, rushingTouchdowns: 14 },
      }),
    ],
  },
  { firstName: "Bruno", lastName: "Kaczmarek", stints: [stint(CHI, 1983, 1988, "FB")] },
  { firstName: "Sonny", lastName: "Delgado", stints: [stint(CHI, 1984, 1989, "SE")] },
  { firstName: "Frank", lastName: "Osgood", stints: [stint(CHI, 1980, 1986, "TE", { alsoEligible: ["FB"] })] },
  // Two franchises inside one decade -> one card per franchise.
  {
    firstName: "Jesse",
    lastName: "Ruskin",
    stints: [stint(SF, 1983, 1985, "WR"), stint(CHI, 1986, 1989, "WR")],
  },

  // --- Chicago, 2010s ---
  { firstName: "Griff", lastName: "Malone", stints: [stint(CHI, 2011, 2017, "QB")] },
  // Multi-position: RB + WR.
  { firstName: "Tyree", lastName: "Boykins", stints: [stint(CHI, 2014, 2019, "RB", { alsoEligible: ["WR"] })] },
  { firstName: "Emmett", lastName: "Sarkisian", stints: [stint(CHI, 2013, 2019, "WR")] },
  { firstName: "Lonnie", lastName: "Achebe", stints: [stint(CHI, 2012, 2016, "TE")] },
  { firstName: "Pete", lastName: "Vandermolen", stints: [stint(CHI, 2015, 2018, "FB")] },

  // --- Colts, 1970s (played as the Baltimore Colts) ---
  { firstName: "Roland", lastName: "Kiefer", stints: [stint(IND, 1970, 1975, "QB")] },
  { firstName: "Junior", lastName: "Mabry", stints: [stint(IND, 1972, 1978, "TB")] },
  { firstName: "Alvin", lastName: "Grier", stints: [stint(IND, 1971, 1977, "FL")] },
  { firstName: "Sam", lastName: "Whitcomb", stints: [stint(IND, 1974, 1979, "TE")] },
  { firstName: "Ollie", lastName: "Barbieri", stints: [stint(IND, 1973, 1978, "FB", { alsoEligible: ["HB"] })] },

  // --- Colts, 2010s ---
  { firstName: "Devin", lastName: "Halsey", stints: [stint(IND, 2012, 2019, "QB")] },
  { firstName: "Rico", lastName: "Santangelo", stints: [stint(IND, 2013, 2018, "RB", { alsoEligible: ["FB"] })] },
  { firstName: "Chase", lastName: "Ohlman", stints: [stint(IND, 2011, 2017, "WR")] },
  { firstName: "Amari", lastName: "Kingsley", stints: [stint(IND, 2014, 2019, "WR")] },
  { firstName: "Bo", lastName: "Trevino", stints: [stint(IND, 2010, 2016, "TE")] },
];

export const DEV_SEED_SOURCE = "dev-seed";
