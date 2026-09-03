import { access } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { NFLVERSE_STATS_DIR, readCsvRows } from "@/data/sources/nflverse/download";
import {
  accumulateNflverseRegularSeasonWeek,
  isNflverseRegularSeasonType,
  type NflverseSeasonProduction,
} from "@/data/sources/nflverse/regularSeasonProduction";

describe("nflverse regular-season production", () => {
  it("treats only REG as regular season", () => {
    expect(isNflverseRegularSeasonType("REG")).toBe(true);
    expect(isNflverseRegularSeasonType("reg")).toBe(true);
    expect(isNflverseRegularSeasonType(" REG ")).toBe(true);
    expect(isNflverseRegularSeasonType("POST")).toBe(false);
    expect(isNflverseRegularSeasonType("PRE")).toBe(false);
    expect(isNflverseRegularSeasonType("")).toBe(false);
    expect(isNflverseRegularSeasonType(undefined)).toBe(false);
  });

  it("sums unique REG weeks and ignores POST and PRE", () => {
    const totals = new Map<string, NflverseSeasonProduction>();
    const seen = new Set<string>();
    const key = "moss|min|1999";

    const add = (week: string, seasonType: string, yards: string, interceptions?: string) =>
      accumulateNflverseRegularSeasonWeek(totals, seen, key, {
        week,
        season_type: seasonType,
        receiving_yards: yards,
        receptions: "1",
        receiving_tds: "1",
        interceptions,
      });

    expect(add("1", "REG", "100", "0")).toBe("added");
    expect(add("2", "REG", "80", "2")).toBe("added");
    expect(add("18", "POST", "200", "4")).toBe("skipped-non-regular");
    expect(add("0", "PRE", "50", "1")).toBe("skipped-non-regular");
    expect(add("1", "REG", "100", "0")).toBe("skipped-duplicate");

    const season = totals.get(key);
    expect(season?.games).toBe(2);
    expect(season?.receivingYards).toBe(180);
    expect(season?.receptions).toBe(2);
    expect(season?.receivingTouchdowns).toBe(2);
    expect(season?.interceptions).toBe(2);
  });

  it("keeps a true-zero interception total and leaves INT null when the field is absent", () => {
    const totals = new Map<string, NflverseSeasonProduction>();
    const seen = new Set<string>();
    accumulateNflverseRegularSeasonWeek(totals, seen, "zero", {
      week: "1",
      season_type: "REG",
      passing_yards: "250",
      passing_tds: "2",
      interceptions: "0",
    });
    accumulateNflverseRegularSeasonWeek(totals, seen, "missing", {
      week: "1",
      season_type: "REG",
      passing_yards: "250",
      passing_tds: "2",
    });
    expect(totals.get("zero")?.interceptions).toBe(0);
    expect(totals.get("missing")?.interceptions).toBeNull();
  });
});

const CACHE_EXAMPLES = [
  {
    label: "Randy Moss 1999",
    season: 1999,
    player: "Randy Moss",
    team: "MIN",
    expected: { games: 16, receptions: 79, receivingYards: 1392, receivingTouchdowns: 11 },
  },
  {
    label: "Calvin Johnson 2011",
    season: 2011,
    player: "Calvin Johnson",
    team: "DET",
    expected: { games: 16, receptions: 97, receivingYards: 1686, receivingTouchdowns: 16 },
  },
  {
    label: "Christian McCaffrey 2023",
    season: 2023,
    player: "Christian McCaffrey",
    team: "SF",
    expected: {
      games: 16,
      receptions: 67,
      receivingYards: 564,
      receivingTouchdowns: 7,
      rushingYards: 1459,
      rushingTouchdowns: 14,
    },
  },
  {
    label: "Steve Smith 2005",
    season: 2005,
    player: "Steve Smith",
    team: "CAR",
    expected: { games: 16, receptions: 103, receivingYards: 1563, receivingTouchdowns: 12 },
  },
  {
    label: "Peyton Manning 2013",
    season: 2013,
    player: "Peyton Manning",
    team: "DEN",
    expected: {
      games: 16,
      passingYards: 5477,
      passingTouchdowns: 55,
      interceptions: 10,
    },
  },
  {
    label: "Peyton Manning 2004",
    season: 2004,
    player: "Peyton Manning",
    team: "IND",
    expected: {
      games: 16,
      passingYards: 4557,
      passingTouchdowns: 49,
      interceptions: 10,
    },
  },
  {
    label: "Aaron Rodgers 2011",
    season: 2011,
    player: "Aaron Rodgers",
    team: "GB",
    expected: {
      games: 15,
      passingYards: 4636,
      passingTouchdowns: 45,
      interceptions: 6,
    },
  },
  {
    label: "Aaron Rodgers 2016",
    season: 2016,
    player: "Aaron Rodgers",
    team: "GB",
    expected: {
      games: 16,
      passingYards: 4428,
      passingTouchdowns: 40,
      interceptions: 7,
    },
  },
  {
    label: "Tom Brady 2007",
    season: 2007,
    player: "Tom Brady",
    team: "NE",
    expected: {
      games: 16,
      passingYards: 4806,
      passingTouchdowns: 50,
      interceptions: 8,
    },
  },
] as const;

async function cacheFileExists(season: number): Promise<boolean> {
  try {
    await access(path.join(NFLVERSE_STATS_DIR, `player_stats_${season}.csv`));
    return true;
  } catch {
    return false;
  }
}

describe("nflverse cache regular-season examples", () => {
  it("matches known regular-season totals when player_stats CSVs are cached", async () => {
    const missing: string[] = [];
    for (const example of CACHE_EXAMPLES) {
      if (!(await cacheFileExists(example.season))) missing.push(example.label);
    }
    if (missing.length > 0) {
      expect(missing).toEqual([]);
      return;
    }

    for (const example of CACHE_EXAMPLES) {
      const totals = new Map<string, NflverseSeasonProduction>();
      const seen = new Set<string>();
      const filePath = path.join(NFLVERSE_STATS_DIR, `player_stats_${example.season}.csv`);
      for await (const row of readCsvRows(filePath)) {
        const name = (row.player_display_name || row.player_name || "").trim();
        const team = (row.recent_team || "").trim().toUpperCase();
        if (name !== example.player || team !== example.team) continue;
        accumulateNflverseRegularSeasonWeek(totals, seen, example.label, row);
      }
      const season = totals.get(example.label);
      expect(season, example.label).toMatchObject(example.expected);
    }
  }, 120_000);
});
