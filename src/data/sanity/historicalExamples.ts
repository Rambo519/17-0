import { and, eq, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  eras,
  franchises,
  players,
  playerSeasons,
  playerTeamEraCards,
  playerTeamEraPositions,
} from "@/db/schema";
import { createDrizzleGameRepository } from "@/server/repository/drizzleGameRepository";

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

export interface ProductionSanityExpectation {
  label: string;
  playerName: string;
  franchiseSlug: string;
  eraLabel: string;
  /** At least these fields must be non-null and > 0. */
  requirePositive: ReadonlyArray<
    | "passingYards"
    | "rushingYards"
    | "receivingYards"
    | "passingTouchdowns"
    | "rushingTouchdowns"
    | "receivingTouchdowns"
    | "receptions"
  >;
}

/** Landmark historical production checks for supported playable eras (1970s–2020s). */
export const HISTORICAL_PRODUCTION_SANITY: readonly ProductionSanityExpectation[] = [
  {
    label: "Terry Bradshaw — Pittsburgh — 1970s",
    playerName: "Terry Bradshaw",
    franchiseSlug: "pittsburgh-steelers",
    eraLabel: "1970s",
    requirePositive: ["passingYards", "passingTouchdowns"],
  },
  {
    label: "Walter Payton — Chicago — 1970s",
    playerName: "Walter Payton",
    franchiseSlug: "chicago-bears",
    eraLabel: "1970s",
    requirePositive: ["rushingYards", "rushingTouchdowns"],
  },
  {
    label: "Walter Payton — Chicago — 1980s",
    playerName: "Walter Payton",
    franchiseSlug: "chicago-bears",
    eraLabel: "1980s",
    requirePositive: ["rushingYards"],
  },
  {
    label: "Joe Montana — San Francisco — 1980s",
    playerName: "Joe Montana",
    franchiseSlug: "san-francisco-49ers",
    eraLabel: "1980s",
    requirePositive: ["passingYards", "passingTouchdowns"],
  },
  {
    label: "Jerry Rice — San Francisco — 1980s",
    playerName: "Jerry Rice",
    franchiseSlug: "san-francisco-49ers",
    eraLabel: "1980s",
    requirePositive: ["receivingYards", "receivingTouchdowns", "receptions"],
  },
  {
    label: "Jerry Rice — San Francisco — 1990s",
    playerName: "Jerry Rice",
    franchiseSlug: "san-francisco-49ers",
    eraLabel: "1990s",
    requirePositive: ["receivingYards", "receptions"],
  },
  {
    label: "Dan Marino — Miami — 1980s",
    playerName: "Dan Marino",
    franchiseSlug: "miami-dolphins",
    eraLabel: "1980s",
    requirePositive: ["passingYards", "passingTouchdowns"],
  },
  {
    label: "Dan Marino — Miami — 1990s",
    playerName: "Dan Marino",
    franchiseSlug: "miami-dolphins",
    eraLabel: "1990s",
    requirePositive: ["passingYards"],
  },
  {
    label: "Emmitt Smith — Dallas — 1990s",
    playerName: "Emmitt Smith",
    franchiseSlug: "dallas-cowboys",
    eraLabel: "1990s",
    requirePositive: ["rushingYards", "rushingTouchdowns"],
  },
  {
    label: "Brett Favre — Green Bay — 1990s",
    playerName: "Brett Favre",
    franchiseSlug: "green-bay-packers",
    eraLabel: "1990s",
    requirePositive: ["passingYards", "passingTouchdowns"],
  },
];

export interface SanityCheckResult {
  label: string;
  expected: string[];
  found: string[];
  missing: string[];
  ok: boolean;
}

export interface ProductionSanityResult {
  label: string;
  ok: boolean;
  detail: string;
  values: Record<string, number | null>;
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

export async function runHistoricalProductionSanityChecks(
  db: Database,
  expectations: readonly ProductionSanityExpectation[] = HISTORICAL_PRODUCTION_SANITY,
): Promise<ProductionSanityResult[]> {
  const repository = createDrizzleGameRepository(db);
  const results: ProductionSanityResult[] = [];

  for (const expectation of expectations) {
    const [franchise] = await db
      .select()
      .from(franchises)
      .where(eq(franchises.slug, expectation.franchiseSlug));
    const [era] = await db.select().from(eras).where(eq(eras.label, expectation.eraLabel));

    if (!franchise || !era) {
      results.push({
        label: expectation.label,
        ok: false,
        detail: "missing franchise or era",
        values: {},
      });
      continue;
    }

    const cards = await db
      .select({
        cardId: playerTeamEraCards.id,
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

    const card = cards.find((row) => nameMatches(row.displayName, expectation.playerName));
    if (!card) {
      results.push({
        label: expectation.label,
        ok: false,
        detail: "draftable card not found",
        values: {},
      });
      continue;
    }

    const productionMap = await repository.getProductionForCards([card.cardId]);
    const production = productionMap.get(card.cardId);
    if (!production) {
      results.push({
        label: expectation.label,
        ok: false,
        detail: "no production row",
        values: {},
      });
      continue;
    }

    const values: Record<string, number | null> = {
      games: production.games,
      passingYards: production.passingYards,
      passingTouchdowns: production.passingTouchdowns,
      rushingYards: production.rushingYards,
      rushingTouchdowns: production.rushingTouchdowns,
      receptions: production.receptions,
      receivingYards: production.receivingYards,
      receivingTouchdowns: production.receivingTouchdowns,
    };

    const ok = expectation.requirePositive.every((field) => {
      const value = production[field];
      return value != null && value > 0;
    });

    results.push({
      label: expectation.label,
      ok,
      detail: ok
        ? "production populated"
        : `missing/zero required fields: ${expectation.requirePositive.join(", ")}`,
      values,
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

/** Spot-check that a historical season row carries non-null yards. */
export async function assertPlayerSeasonHasYards(
  db: Database,
  playerName: string,
  season: number,
  field: "passingYards" | "rushingYards" | "receivingYards",
): Promise<boolean> {
  const rows = await db
    .select({
      displayName: players.displayName,
      season: playerSeasons.season,
      passingYards: playerSeasons.passingYards,
      rushingYards: playerSeasons.rushingYards,
      receivingYards: playerSeasons.receivingYards,
    })
    .from(playerSeasons)
    .innerJoin(players, eq(players.id, playerSeasons.playerId))
    .where(eq(playerSeasons.season, season));

  const match = rows.find((row) => nameMatches(row.displayName, playerName));
  if (!match) return false;
  const value = match[field];
  return value != null && value > 0;
}
