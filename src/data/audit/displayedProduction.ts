import { and, eq, sql } from "drizzle-orm";

import { hasRoleConsistentProduction, isPositiveKnown } from "@/data/draftable";
import { NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON } from "@/data/sources/statsBoundary";
import type { Database } from "@/db/client";
import {
  eras,
  playerSeasons,
  playerTeamEraCards,
  playerTeamEraPositions,
} from "@/db/schema";
import type { NormalizedPosition } from "@/lib/football/positions";
import { asNullableNumber } from "@/lib/game/production";
import type { CardProduction } from "@/lib/game/types";
import { classicProductionStats } from "@/lib/game/uiHelpers";
import { PLAYABLE_ERA_LABELS } from "@/lib/football/eras";

/**
 * CLASSIC cards show summed franchise/era-window production, not the scoring
 * season. These helpers grade whether that displayed total is position-relevant.
 */

export function classicDisplayIsAllDashes(
  positions: readonly NormalizedPosition[],
  production: CardProduction,
): boolean {
  return classicProductionStats(positions, production).every((row) => row.value === "—");
}

export function hasPositionRelevantProduction(
  positions: readonly NormalizedPosition[],
  production: Pick<
    CardProduction,
    | "passingYards"
    | "passingTouchdowns"
    | "rushingYards"
    | "rushingTouchdowns"
    | "receptions"
    | "receivingYards"
    | "receivingTouchdowns"
  >,
): boolean {
  return hasRoleConsistentProduction(positions, production);
}

/** Production exists, but not in the fields CLASSIC shows for these positions. */
export function hasUnrelatedProductionOnly(
  positions: readonly NormalizedPosition[],
  production: CardProduction,
): boolean {
  if (hasPositionRelevantProduction(positions, production)) return false;
  return (
    isPositiveKnown(production.passingYards) ||
    isPositiveKnown(production.passingTouchdowns) ||
    isPositiveKnown(production.rushingYards) ||
    isPositiveKnown(production.rushingTouchdowns) ||
    isPositiveKnown(production.receptions) ||
    isPositiveKnown(production.receivingYards) ||
    isPositiveKnown(production.receivingTouchdowns)
  );
}

const POSITIONS: readonly NormalizedPosition[] = ["QB", "RB", "FB", "WR", "TE"];

export interface DisplayedProductionPositionRow {
  era: string;
  position: NormalizedPosition | "ALL";
  draftableCards: number;
  positionRelevant: number;
  classicAllDashes: number;
  unrelatedOnly: number;
  partialModernSpan: number;
  fbExceptionOnly: number;
}

export interface DisplayedProductionCoverage {
  byEraAndPosition: DisplayedProductionPositionRow[];
  totals: DisplayedProductionPositionRow;
}

function emptyTally(
  era: string,
  position: DisplayedProductionPositionRow["position"],
): DisplayedProductionPositionRow {
  return {
    era,
    position,
    draftableCards: 0,
    positionRelevant: 0,
    classicAllDashes: 0,
    unrelatedOnly: 0,
    partialModernSpan: 0,
    fbExceptionOnly: 0,
  };
}

function seasonHasAnyStoredProduction(row: {
  passingYards: number | null;
  passingTouchdowns: number | null;
  rushingYards: number | null;
  rushingTouchdowns: number | null;
  receptions: number | null;
  receivingYards: number | null;
  receivingTouchdowns: number | null;
}): boolean {
  return (
    isPositiveKnown(row.passingYards) ||
    isPositiveKnown(row.passingTouchdowns) ||
    isPositiveKnown(row.rushingYards) ||
    isPositiveKnown(row.rushingTouchdowns) ||
    isPositiveKnown(row.receptions) ||
    isPositiveKnown(row.receivingYards) ||
    isPositiveKnown(row.receivingTouchdowns)
  );
}

/**
 * CLASSIC display coverage: position-relevant totals, not merely "any field".
 * Partial modern span flags era windows where several 1999+ seasons stored no
 * production beside seasons that did — the BAL BLT/BAL join-hole pattern.
 */
export async function buildDisplayedProductionCoverage(
  db: Database,
): Promise<DisplayedProductionCoverage> {
  const cardRows = await db
    .select({
      cardId: playerTeamEraCards.id,
      era: eras.label,
      games: sql`sum(${playerSeasons.games})`,
      passingYards: sql`sum(${playerSeasons.passingYards})`,
      passingTouchdowns: sql`sum(${playerSeasons.passingTouchdowns})`,
      rushingYards: sql`sum(${playerSeasons.rushingYards})`,
      rushingTouchdowns: sql`sum(${playerSeasons.rushingTouchdowns})`,
      receptions: sql`sum(${playerSeasons.receptions})`,
      receivingYards: sql`sum(${playerSeasons.receivingYards})`,
      receivingTouchdowns: sql`sum(${playerSeasons.receivingTouchdowns})`,
    })
    .from(playerTeamEraCards)
    .innerJoin(eras, eq(eras.id, playerTeamEraCards.eraId))
    .leftJoin(
      playerSeasons,
      and(
        eq(playerSeasons.playerId, playerTeamEraCards.playerId),
        eq(playerSeasons.franchiseId, playerTeamEraCards.franchiseId),
        sql`${playerSeasons.season} between ${playerTeamEraCards.firstSeason} and ${playerTeamEraCards.lastSeason}`,
      ),
    )
    .where(eq(playerTeamEraCards.draftable, true))
    .groupBy(playerTeamEraCards.id, eras.label);

  const positionRows = await db.select().from(playerTeamEraPositions);
  const positionsByCard = new Map<number, NormalizedPosition[]>();
  for (const row of positionRows) {
    const list = positionsByCard.get(row.playerTeamEraCardId) ?? [];
    list.push(row.position);
    positionsByCard.set(row.playerTeamEraCardId, list);
  }

  const seasonRows = await db
    .select({
      cardId: playerTeamEraCards.id,
      season: playerSeasons.season,
      games: playerSeasons.games,
      passingYards: playerSeasons.passingYards,
      passingTouchdowns: playerSeasons.passingTouchdowns,
      rushingYards: playerSeasons.rushingYards,
      rushingTouchdowns: playerSeasons.rushingTouchdowns,
      receptions: playerSeasons.receptions,
      receivingYards: playerSeasons.receivingYards,
      receivingTouchdowns: playerSeasons.receivingTouchdowns,
    })
    .from(playerTeamEraCards)
    .innerJoin(
      playerSeasons,
      and(
        eq(playerSeasons.playerId, playerTeamEraCards.playerId),
        eq(playerSeasons.franchiseId, playerTeamEraCards.franchiseId),
        sql`${playerSeasons.season} between ${playerTeamEraCards.firstSeason} and ${playerTeamEraCards.lastSeason}`,
      ),
    )
    .where(eq(playerTeamEraCards.draftable, true));

  const seasonsByCard = new Map<number, typeof seasonRows>();
  for (const row of seasonRows) {
    const list = seasonsByCard.get(row.cardId) ?? [];
    list.push(row);
    seasonsByCard.set(row.cardId, list);
  }

  const buckets = new Map<string, DisplayedProductionPositionRow>();
  const totals = emptyTally("ALL", "ALL");

  function bump(era: string, position: NormalizedPosition | "ALL", mutate: (row: DisplayedProductionPositionRow) => void) {
    const key = `${era}|${position}`;
    const existing = buckets.get(key) ?? emptyTally(era, position);
    mutate(existing);
    buckets.set(key, existing);
  }

  for (const card of cardRows) {
    if (!(PLAYABLE_ERA_LABELS as readonly string[]).includes(card.era)) continue;
    const positions = positionsByCard.get(card.cardId) ?? [];
    const production: CardProduction = {
      games: asNullableNumber(card.games),
      passingYards: asNullableNumber(card.passingYards),
      passingTouchdowns: asNullableNumber(card.passingTouchdowns),
      rushingYards: asNullableNumber(card.rushingYards),
      rushingTouchdowns: asNullableNumber(card.rushingTouchdowns),
      receptions: asNullableNumber(card.receptions),
      receivingYards: asNullableNumber(card.receivingYards),
      receivingTouchdowns: asNullableNumber(card.receivingTouchdowns),
    };

    const dashes = classicDisplayIsAllDashes(positions, production);
    const relevant = hasPositionRelevantProduction(positions, production);
    const unrelated = hasUnrelatedProductionOnly(positions, production);
    const fbException =
      positions.includes("FB") &&
      production.games != null &&
      production.games > 0 &&
      !relevant;

    const seasons = seasonsByCard.get(card.cardId) ?? [];
    const modern = seasons.filter((row) => row.season >= NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON);
    const produced = modern.filter((row) => seasonHasAnyStoredProduction(row)).length;
    const emptyModern = modern.filter(
      (row) => !seasonHasAnyStoredProduction(row) && row.games == null,
    ).length;
    const partial = produced >= 1 && emptyModern >= 3;

    const apply = (row: DisplayedProductionPositionRow) => {
      row.draftableCards += 1;
      if (relevant) row.positionRelevant += 1;
      if (dashes) row.classicAllDashes += 1;
      if (unrelated) row.unrelatedOnly += 1;
      if (partial) row.partialModernSpan += 1;
      if (fbException) row.fbExceptionOnly += 1;
    };

    apply(totals);
    bump(card.era, "ALL", apply);
    for (const position of POSITIONS) {
      if (positions.includes(position)) bump(card.era, position, apply);
    }
  }

  const byEraAndPosition = [...buckets.values()].sort((left, right) =>
    left.era === right.era
      ? String(left.position).localeCompare(String(right.position))
      : left.era.localeCompare(right.era),
  );

  return { byEraAndPosition, totals };
}
