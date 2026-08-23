import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { franchises, players, playerSeasons } from "@/db/schema";
import {
  HISTORICAL_ENRICHMENT_PROVENANCE,
} from "@/data/sources/historicalStats/config";
import { loadCachedHistoricalSeasonStats } from "@/data/sources/historicalStats/download";
import {
  indexPlayerSeasonsForIdentity,
  resolveHistoricalIdentity,
  type IdentityMatchResult,
  type PlayerSeasonIdentity,
} from "@/data/sources/historicalStats/identity";
import type { HistoricalSeasonStats } from "@/data/sources/historicalStats/types";
import {
  HISTORICAL_STATS_END_SEASON,
  HISTORICAL_STATS_START_SEASON,
  NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON,
} from "@/data/sources/statsBoundary";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

export interface EnrichmentSummary {
  seasonsConsidered: { start: number; end: number };
  nflverseAuthoritativeFrom: number;
  historicalRowsLoaded: number;
  matched: number;
  enrichedSeasons: number;
  fieldsWritten: number;
  ambiguous: number;
  unresolved: number;
  skippedModernBoundary: number;
}

export interface EnrichmentResult {
  summary: EnrichmentSummary;
  ambiguous: IdentityMatchResult[];
  unresolved: IdentityMatchResult[];
  reportPaths: {
    unresolvedPath: string;
    ambiguousPath: string;
    summaryPath: string;
  };
}

export async function enrichPlayerSeasonsWithHistoricalStats(
  db: Database,
  options: { startSeason?: number; endSeason?: number } = {},
): Promise<EnrichmentResult> {
  const startSeason = options.startSeason ?? HISTORICAL_STATS_START_SEASON;
  const endSeason = Math.min(
    options.endSeason ?? HISTORICAL_STATS_END_SEASON,
    HISTORICAL_STATS_END_SEASON,
  );

  const historicalRows = await loadCachedHistoricalSeasonStats({ startSeason, endSeason });
  const identityRows = await loadPlayerSeasonIdentities(db, startSeason, endSeason);
  const index = indexPlayerSeasonsForIdentity(identityRows);

  const ambiguous: IdentityMatchResult[] = [];
  const unresolved: IdentityMatchResult[] = [];
  let matched = 0;
  let enrichedSeasons = 0;
  let fieldsWritten = 0;
  let skippedModernBoundary = 0;

  for (const stats of historicalRows) {
    if (stats.season >= NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON) {
      skippedModernBoundary += 1;
      continue;
    }

    const result = resolveHistoricalIdentity(stats, index);
    if (result.status === "ambiguous") {
      ambiguous.push(result);
      continue;
    }
    if (result.status === "unresolved" || !result.matched) {
      unresolved.push(result);
      continue;
    }

    matched += 1;
    const written = await enrichOneSeason(db, result.matched.playerSeasonId, stats);
    if (written > 0) {
      enrichedSeasons += 1;
      fieldsWritten += written;
    }
  }

  const summary: EnrichmentSummary = {
    seasonsConsidered: { start: startSeason, end: endSeason },
    nflverseAuthoritativeFrom: NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON,
    historicalRowsLoaded: historicalRows.length,
    matched,
    enrichedSeasons,
    fieldsWritten,
    ambiguous: ambiguous.length,
    unresolved: unresolved.length,
    skippedModernBoundary,
  };

  const reportPaths = await writeIdentityReports(summary, ambiguous, unresolved);
  return { summary, ambiguous, unresolved, reportPaths };
}

async function loadPlayerSeasonIdentities(
  db: Database,
  startSeason: number,
  endSeason: number,
): Promise<PlayerSeasonIdentity[]> {
  const rows = await db
    .select({
      playerSeasonId: playerSeasons.id,
      playerId: playerSeasons.playerId,
      franchiseId: playerSeasons.franchiseId,
      season: playerSeasons.season,
      displayName: players.displayName,
      franchiseSlug: franchises.slug,
    })
    .from(playerSeasons)
    .innerJoin(players, eq(players.id, playerSeasons.playerId))
    .innerJoin(franchises, eq(franchises.id, playerSeasons.franchiseId));

  return rows.filter((row) => row.season >= startSeason && row.season <= endSeason);
}

async function enrichOneSeason(
  db: Database,
  playerSeasonId: number,
  stats: HistoricalSeasonStats,
): Promise<number> {
  const [existing] = await db
    .select()
    .from(playerSeasons)
    .where(eq(playerSeasons.id, playerSeasonId))
    .limit(1);
  if (!existing) return 0;

  const patch: Partial<typeof playerSeasons.$inferInsert> = {};
  let fields = 0;

  const setIfNull = <K extends keyof typeof existing>(
    column: K,
    value: number | null,
  ): void => {
    if (value == null) return;
    if (existing[column] != null) return;
    (patch as Record<string, unknown>)[column] = value;
    fields += 1;
  };

  setIfNull("games", stats.games);
  setIfNull("gamesStarted", stats.gamesStarted);
  setIfNull("passingYards", stats.passingYards);
  setIfNull("passingTouchdowns", stats.passingTouchdowns);
  setIfNull("interceptions", stats.interceptions);
  setIfNull("rushingAttempts", stats.rushingAttempts);
  setIfNull("rushingYards", stats.rushingYards);
  setIfNull("rushingTouchdowns", stats.rushingTouchdowns);
  setIfNull("receptions", stats.receptions);
  setIfNull("receivingYards", stats.receivingYards);
  setIfNull("receivingTouchdowns", stats.receivingTouchdowns);

  if (fields === 0) return 0;

  const currentSource = existing.source ?? "nflverse";
  const nextSource = currentSource.includes("historical-stats")
    ? currentSource
    : currentSource === HISTORICAL_ENRICHMENT_PROVENANCE
      ? currentSource
      : `${currentSource}+historical-stats`;

  await db
    .update(playerSeasons)
    .set({
      ...patch,
      source: nextSource,
      updatedAt: new Date(),
    })
    .where(eq(playerSeasons.id, playerSeasonId));

  return fields;
}

async function writeIdentityReports(
  summary: EnrichmentSummary,
  ambiguous: IdentityMatchResult[],
  unresolved: IdentityMatchResult[],
): Promise<EnrichmentResult["reportPaths"]> {
  await mkdir(REPORTS_DIR, { recursive: true });

  const unresolvedPath = path.join(REPORTS_DIR, "historical-stats-unresolved.json");
  const ambiguousPath = path.join(REPORTS_DIR, "historical-stats-ambiguous.json");
  const summaryPath = path.join(REPORTS_DIR, "historical-stats-enrichment-summary.txt");

  const serialize = (rows: IdentityMatchResult[]) =>
    rows.map((row) => ({
      status: row.status,
      reason: row.reason,
      season: row.stats.season,
      playerName: row.stats.playerName,
      normalizedName: row.stats.normalizedName,
      sourceAdapter: row.stats.sourceAdapter,
      franchiseSlug: row.stats.franchiseSlug,
      candidates: row.candidates.map((c) => ({
        playerSeasonId: c.playerSeasonId,
        playerId: c.playerId,
        displayName: c.displayName,
        franchiseSlug: c.franchiseSlug,
        season: c.season,
      })),
    }));

  await writeFile(unresolvedPath, `${JSON.stringify(serialize(unresolved), null, 2)}\n`, "utf8");
  await writeFile(ambiguousPath, `${JSON.stringify(serialize(ambiguous), null, 2)}\n`, "utf8");

  const summaryText = [
    `Historical stats enrichment @ ${new Date().toISOString()}`,
    "",
    `Seasons: ${summary.seasonsConsidered.start}–${summary.seasonsConsidered.end}`,
    `nflverse authoritative from: ${summary.nflverseAuthoritativeFrom}`,
    `Historical rows loaded: ${summary.historicalRowsLoaded}`,
    `Matched: ${summary.matched}`,
    `Player-seasons enriched: ${summary.enrichedSeasons}`,
    `Fields written: ${summary.fieldsWritten}`,
    `Ambiguous: ${summary.ambiguous}`,
    `Unresolved: ${summary.unresolved}`,
    `Skipped (modern boundary): ${summary.skippedModernBoundary}`,
    "",
    `Unresolved report: ${unresolvedPath}`,
    `Ambiguous report: ${ambiguousPath}`,
  ].join("\n");

  await writeFile(summaryPath, `${summaryText}\n`, "utf8");
  return { unresolvedPath, ambiguousPath, summaryPath };
}
