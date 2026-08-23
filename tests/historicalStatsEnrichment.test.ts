import { describe, expect, it } from "vitest";

import {
  HISTORICAL_STATS_END_SEASON,
  HISTORICAL_STATS_START_SEASON,
  NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON,
} from "@/data/sources/statsBoundary";
import { NFLVERSE_PLAYER_STATS_START_SEASON } from "@/data/sources/nflverse/config";
import { normalizePlayerName } from "@/data/sources/historicalStats/normalizeName";
import {
  indexPlayerSeasonsForIdentity,
  resolveHistoricalIdentity,
  type PlayerSeasonIdentity,
} from "@/data/sources/historicalStats/identity";
import {
  parseMarcLinderCategoryCsv,
} from "@/data/sources/historicalStats/parse";
import { parseOptionalInt } from "@/data/sources/historicalStats/parseNumbers";
import {
  emptyHistoricalSeasonStats,
  mergeHistoricalSeasonStats,
} from "@/data/sources/historicalStats/types";

describe("stats boundary", () => {
  it("keeps historical enrichment at 1970+ below nflverse player_stats start", () => {
    expect(HISTORICAL_STATS_START_SEASON).toBe(1970);
    expect(HISTORICAL_STATS_END_SEASON).toBe(1998);
    expect(NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON).toBe(1999);
    expect(NFLVERSE_PLAYER_STATS_START_SEASON).toBe(1999);
    expect(HISTORICAL_STATS_END_SEASON + 1).toBe(NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON);
  });
});

describe("normalizePlayerName", () => {
  it("strips punctuation and generational suffixes", () => {
    expect(normalizePlayerName("Jim Brown")).toBe("jim brown");
    expect(normalizePlayerName("Barry Sanders")).toBe("barry sanders");
    expect(normalizePlayerName("Roger Staubach")).toBe("roger staubach");
    expect(normalizePlayerName("Steve Young")).toBe("steve young");
    expect(normalizePlayerName("Junior Seau")).toBe("junior seau");
    expect(normalizePlayerName("Chris Carter Jr.")).toBe("chris carter");
  });
});

describe("NULL handling", () => {
  it("never converts blank cells to zero", () => {
    expect(parseOptionalInt("")).toBeNull();
    expect(parseOptionalInt("-")).toBeNull();
    expect(parseOptionalInt("n/a")).toBeNull();
    expect(parseOptionalInt(undefined)).toBeNull();
    expect(parseOptionalInt("0")).toBe(0);
    expect(parseOptionalInt("1,544")).toBe(1544);
  });
});

describe("MarcLinder CSV parse", () => {
  it("parses rushing production without inventing games", () => {
    const csv = [
      "Player,Rush Yds,Att,TD,20+,40+,Lng,Rush 1st,Rush 1st%,Rush FUM",
      "Walter Payton,1551,324,9,7,1,40,81,25,5",
    ].join("\n");
    const rows = parseMarcLinderCategoryCsv(csv, 1985, "rushing", "marclinder-nfl-stats");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rushingYards).toBe(1551);
    expect(rows[0]?.rushingAttempts).toBe(324);
    expect(rows[0]?.rushingTouchdowns).toBe(9);
    expect(rows[0]?.games).toBeNull();
    expect(rows[0]?.gamesStarted).toBeNull();
  });

  it("parses passing and receiving category fields", () => {
    const passing = parseMarcLinderCategoryCsv(
      ["Player,Pass Yds,Yds/Att,Att,Cmp,Cmp %,TD,INT,Rate", "Joe Montana,3653,8.0,386,303,78.5,27,13,102.1"].join(
        "\n",
      ),
      1989,
      "passing",
      "marclinder-nfl-stats",
    );
    expect(passing[0]?.passingYards).toBe(3653);
    expect(passing[0]?.passingTouchdowns).toBe(27);
    expect(passing[0]?.interceptions).toBe(13);
    expect(passing[0]?.passingAttempts).toBe(386);
    expect(passing[0]?.completions).toBe(303);

    const receiving = parseMarcLinderCategoryCsv(
      ["Player,Rec,Yds,TD,20+,40+,LNG", "Jerry Rice,82,1483,17,0,0,0"].join("\n"),
      1989,
      "receiving",
      "marclinder-nfl-stats",
    );
    expect(receiving[0]?.receptions).toBe(82);
    expect(receiving[0]?.receivingYards).toBe(1483);
    expect(receiving[0]?.receivingTouchdowns).toBe(17);
  });
});

describe("identity resolution", () => {
  const montana: PlayerSeasonIdentity = {
    playerSeasonId: 1,
    playerId: 10,
    franchiseId: 5,
    season: 1989,
    displayName: "Joe Montana",
    franchiseSlug: "san-francisco-49ers",
  };

  it("matches unique name + season", () => {
    const index = indexPlayerSeasonsForIdentity([montana]);
    const stats = emptyHistoricalSeasonStats(
      "Joe Montana",
      normalizePlayerName("Joe Montana"),
      1989,
      "test",
    );
    stats.passingYards = 3653;
    const result = resolveHistoricalIdentity(stats, index);
    expect(result.status).toBe("matched");
    expect(result.matched?.playerSeasonId).toBe(1);
  });

  it("marks ambiguous when multiple players share a name", () => {
    const other: PlayerSeasonIdentity = {
      ...montana,
      playerSeasonId: 2,
      playerId: 11,
      displayName: "Joe Montana",
      franchiseSlug: "kansas-city-chiefs",
    };
    const index = indexPlayerSeasonsForIdentity([montana, other]);
    const stats = emptyHistoricalSeasonStats(
      "Joe Montana",
      normalizePlayerName("Joe Montana"),
      1989,
      "test",
    );
    const result = resolveHistoricalIdentity(stats, index);
    expect(result.status).toBe("ambiguous");
  });

  it("uses franchise slug when provided", () => {
    const other: PlayerSeasonIdentity = {
      ...montana,
      playerSeasonId: 2,
      playerId: 11,
      franchiseSlug: "kansas-city-chiefs",
    };
    const index = indexPlayerSeasonsForIdentity([montana, other]);
    const stats = emptyHistoricalSeasonStats(
      "Joe Montana",
      normalizePlayerName("Joe Montana"),
      1989,
      "test",
    );
    stats.franchiseSlug = "san-francisco-49ers";
    const result = resolveHistoricalIdentity(stats, index);
    expect(result.status).toBe("matched");
    expect(result.matched?.franchiseSlug).toBe("san-francisco-49ers");
  });

  it("leaves unresolved when no roster season exists", () => {
    const index = indexPlayerSeasonsForIdentity([montana]);
    const stats = emptyHistoricalSeasonStats(
      "Nobody Here",
      normalizePlayerName("Nobody Here"),
      1989,
      "test",
    );
    expect(resolveHistoricalIdentity(stats, index).status).toBe("unresolved");
  });
});

describe("mergeHistoricalSeasonStats", () => {
  it("fills nulls across categories without zeroing", () => {
    const pass = emptyHistoricalSeasonStats("A", "a", 1985, "x");
    pass.passingYards = 3000;
    const rush = emptyHistoricalSeasonStats("A", "a", 1985, "y");
    rush.rushingYards = 200;
    const merged = mergeHistoricalSeasonStats(pass, rush);
    expect(merged.passingYards).toBe(3000);
    expect(merged.rushingYards).toBe(200);
    expect(merged.receptions).toBeNull();
  });
});
