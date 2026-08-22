import { and, eq, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { eras, franchises, players, playerTeamEraCards, playerTeamEraPositions } from "@/db/schema";

export interface SanityExpectation {
  label: string;
  franchiseSlug: string;
  eraLabel: string;
  playerNames: string[];
}

export const PHASE2_SANITY_EXPECTATIONS: readonly SanityExpectation[] = [
  {
    label: "San Francisco — 1980s",
    franchiseSlug: "san-francisco-49ers",
    eraLabel: "1980s",
    playerNames: ["Joe Montana", "Jerry Rice", "Roger Craig"],
  },
  {
    label: "Dallas — 1990s",
    franchiseSlug: "dallas-cowboys",
    eraLabel: "1990s",
    playerNames: ["Troy Aikman", "Emmitt Smith", "Michael Irvin", "Daryl Johnston", "Jay Novacek"],
  },
  {
    label: "Indianapolis — 2000s",
    franchiseSlug: "indianapolis-colts",
    eraLabel: "2000s",
    playerNames: ["Peyton Manning", "Edgerrin James", "Marvin Harrison", "Reggie Wayne", "Dallas Clark"],
  },
  {
    label: "New England — 2010s",
    franchiseSlug: "new-england-patriots",
    eraLabel: "2010s",
    playerNames: ["Tom Brady", "Rob Gronkowski", "Julian Edelman"],
  },
];

export interface SanityCheckResult {
  label: string;
  expected: string[];
  found: string[];
  missing: string[];
  ok: boolean;
}

function nameMatches(cardName: string, expected: string): boolean {
  const left = cardName.trim().toLowerCase();
  const right = expected.trim().toLowerCase();
  return left === right || left.includes(right) || right.includes(left);
}

export async function runHistoricalSanityChecks(
  db: Database,
  expectations: readonly SanityExpectation[] = PHASE2_SANITY_EXPECTATIONS,
): Promise<SanityCheckResult[]> {
  const results: SanityCheckResult[] = [];

  for (const expectation of expectations) {
    const [franchise] = await db
      .select()
      .from(franchises)
      .where(eq(franchises.slug, expectation.franchiseSlug));
    const [era] = await db.select().from(eras).where(eq(eras.label, expectation.eraLabel));

    if (!franchise || !era) {
      results.push({
        label: expectation.label,
        expected: [...expectation.playerNames],
        found: [],
        missing: [...expectation.playerNames],
        ok: false,
      });
      continue;
    }

    const cards = await db
      .select({
        displayName: players.displayName,
      })
      .from(playerTeamEraCards)
      .innerJoin(players, eq(players.id, playerTeamEraCards.playerId))
      .where(
        and(
          eq(playerTeamEraCards.franchiseId, franchise.id),
          eq(playerTeamEraCards.eraId, era.id),
          eq(playerTeamEraCards.draftable, true),
        ),
      );

    const foundNames = cards.map((card) => card.displayName);
    const found: string[] = [];
    const missing: string[] = [];
    for (const expected of expectation.playerNames) {
      if (foundNames.some((name) => nameMatches(name, expected))) found.push(expected);
      else missing.push(expected);
    }

    results.push({
      label: expectation.label,
      expected: [...expectation.playerNames],
      found,
      missing,
      ok: missing.length === 0,
    });
  }

  return results;
}

/** Confirms Daryl Johnston carries FB eligibility when present. */
export async function assertJohnstonHasFb(db: Database): Promise<boolean> {
  const rows = await db
    .select({
      displayName: players.displayName,
      position: playerTeamEraPositions.position,
    })
    .from(playerTeamEraCards)
    .innerJoin(players, eq(players.id, playerTeamEraCards.playerId))
    .innerJoin(
      playerTeamEraPositions,
      eq(playerTeamEraPositions.playerTeamEraCardId, playerTeamEraCards.id),
    )
    .where(sql`lower(${players.displayName}) like '%johnston%'`);

  const johnston = rows.filter((row) => nameMatches(row.displayName, "Daryl Johnston"));
  return johnston.some((row) => row.position === "FB");
}
