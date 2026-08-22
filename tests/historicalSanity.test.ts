import { access } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { openDataDatabase } from "@/data/cli/db";
import { runHistoricalSanityChecks, assertJohnstonHasFb } from "@/data/sanity/historicalExamples";

const rosterProbe = path.join(process.cwd(), ".cache", "nflverse", "rosters", "roster_1987.csv");

async function cacheReady(): Promise<boolean> {
  try {
    await access(rosterProbe);
    return true;
  } catch {
    return false;
  }
}

describe("real-data sanity checks", () => {
  it("verifies landmark players when a historical database is available", async () => {
    if (!(await cacheReady()) || process.env.RUN_HISTORICAL_SANITY !== "1") {
      // Keep the default unit suite deterministic and offline.
      expect(true).toBe(true);
      return;
    }

    const { db, close } = await openDataDatabase();
    try {
      const results = await runHistoricalSanityChecks(db);
      for (const result of results) {
        expect(result.missing, result.label).toEqual([]);
        expect(result.ok, result.label).toBe(true);
      }
      expect(await assertJohnstonHasFb(db)).toBe(true);
    } finally {
      await close?.();
    }
  }, 120_000);
});
