import { and, eq, inArray } from "drizzle-orm";

import { openDataDatabase } from "@/data/cli/db";
import { isCardDraftable, type SeasonParticipation } from "@/data/draftable";
import {
  FB_PEER_FALLBACK_POSITIONS,
  LINEUP_SLOT_WEIGHTS,
  MIN_PEER_SAMPLE,
  WIN_PROJECTION_MODEL,
} from "@/lib/scoring/config";
import { evaluateLineup } from "@/lib/scoring/evaluateLineup";
import { evaluateLineupPick } from "@/lib/scoring/playerEvaluation";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import {
  perGameWinProbabilityFromRating,
  projectWinsFromRating,
  ratingThresholdForProjectedWins,
} from "@/lib/scoring/winProjection";
import type { LineupPickInput } from "@/lib/scoring/types";
import { PLAYABLE_ERA_DEFINITIONS } from "@/lib/football/eras";
import type { NormalizedPosition } from "@/lib/football/positions";
import { createDrizzleScoringRepository } from "@/server/repository/drizzleScoringRepository";
import {
  eras,
  franchises,
  players,
  playerSeasonPositions,
  playerSeasons,
  playerTeamEraCards,
  playerTeamEraPositions,
} from "@/db/schema";

const BAL_BLT_MISMATCH_START = 2002;
const BAL_BLT_MISMATCH_END = 2015;

function maskBltHole(season: SeasonParticipation & { season: number }): SeasonParticipation & {
  season: number;
} {
  if (season.season < BAL_BLT_MISMATCH_START || season.season > BAL_BLT_MISMATCH_END) {
    return season;
  }
  return {
    ...season,
    games: null,
    passingYards: null,
    passingTouchdowns: null,
    rushingYards: null,
    rushingTouchdowns: null,
    receptions: null,
    receivingYards: null,
    receivingTouchdowns: null,
  };
}

async function main(): Promise<void> {
  const { db, kind, close } = await openDataDatabase();
  console.log(`Integrity / FB audit on ${kind}`);
  console.log("Playable eras:", PLAYABLE_ERA_DEFINITIONS.map((era) => `${era.label}=${era.startYear}-${era.endYear}`).join("; "));

  try {
    const [bal] = await db.select().from(franchises).where(eq(franchises.slug, "baltimore-ravens"));
    const eraRows = await db.select().from(eras);
    const era2000s = eraRows.find((row) => row.label === "2000s");
    if (!bal || !era2000s) throw new Error("missing BAL/2000s");

    const cards = await db
      .select()
      .from(playerTeamEraCards)
      .where(and(eq(playerTeamEraCards.franchiseId, bal.id), eq(playerTeamEraCards.eraId, era2000s.id)));
    const cardIds = cards.map((card) => card.id);
    const posRows = await db
      .select()
      .from(playerTeamEraPositions)
      .where(inArray(playerTeamEraPositions.playerTeamEraCardId, cardIds));
    const positionsByCard = new Map<number, NormalizedPosition[]>();
    for (const row of posRows) {
      const list = positionsByCard.get(row.playerTeamEraCardId) ?? [];
      list.push(row.position);
      positionsByCard.set(row.playerTeamEraCardId, list);
    }

    const playerRows = await db.select().from(players);
    const playerById = new Map(playerRows.map((row) => [row.id, row]));
    const seasonRows = await db.select().from(playerSeasons).where(eq(playerSeasons.franchiseId, bal.id));
    const seasonPos = await db.select().from(playerSeasonPositions);
    const positionsBySeasonId = new Map<number, NormalizedPosition[]>();
    for (const row of seasonPos) {
      const list = positionsBySeasonId.get(row.playerSeasonId) ?? [];
      list.push(row.position);
      positionsBySeasonId.set(row.playerSeasonId, list);
    }

    const afterCounts = { QB: 0, RB: 0, FB: 0, WR: 0, TE: 0, total: 0 };
    const beforeCounts = { QB: 0, RB: 0, FB: 0, WR: 0, TE: 0, total: 0 };
    const afterByPosition: Record<string, string[]> = { QB: [], RB: [], FB: [], WR: [], TE: [] };

    for (const card of cards) {
      const positions = positionsByCard.get(card.id) ?? [];
      const seasons = seasonRows
        .filter(
          (row) =>
            row.playerId === card.playerId &&
            row.season >= card.firstSeason &&
            row.season <= card.lastSeason,
        )
        .map((row) => ({
          season: row.season,
          games: row.games,
          rosterStatus: row.rosterStatus,
          hasRosterEvidence: row.rosterStatus != null,
          positions: positionsBySeasonId.get(row.id) ?? positions,
          passingYards: row.passingYards,
          passingTouchdowns: row.passingTouchdowns,
          rushingYards: row.rushingYards,
          rushingTouchdowns: row.rushingTouchdowns,
          receptions: row.receptions,
          receivingYards: row.receivingYards,
          receivingTouchdowns: row.receivingTouchdowns,
        }));

      const after = isCardDraftable({ positions, seasons });
      const before = isCardDraftable({ positions, seasons: seasons.map(maskBltHole) });
      const name = playerById.get(card.playerId)?.displayName ?? `#${card.playerId}`;

      if (after) {
        afterCounts.total += 1;
        for (const position of ["QB", "RB", "FB", "WR", "TE"] as const) {
          if (positions.includes(position)) {
            afterCounts[position] += 1;
            afterByPosition[position]?.push(`${name} (${card.firstSeason}–${card.lastSeason})`);
          }
        }
      }
      if (before) {
        beforeCounts.total += 1;
        for (const position of ["QB", "RB", "FB", "WR", "TE"] as const) {
          if (positions.includes(position)) beforeCounts[position] += 1;
        }
      }
    }

    console.log("\n=== BAL 2000s draftable counts ===");
    console.log("before BLT/BAL join (simulated):", beforeCounts);
    console.log("after repair:", afterCounts);
    const maxLast = Math.max(0, ...cards.map((card) => card.lastSeason));
    const minFirst = Math.min(...cards.map((card) => card.firstSeason));
    console.log(`BAL 2000s card season span: ${minFirst}–${maxLast} (must stay inside 2000–2009)`);
    for (const position of ["QB", "RB", "FB", "WR", "TE"] as const) {
      console.log(`\n${position}:`);
      for (const name of (afterByPosition[position] ?? []).sort()) console.log("  ", name);
    }

    const scoring = createDrizzleScoringRepository(db);
    console.log("\n=== BAL 2000s CLASSIC summed production (diagnostic five) ===");
    for (const name of [
      "Todd Heap",
      "Daniel Wilcox",
      "Chester Taylor",
      "Anthony Wright",
      "Demetrius Williams",
    ]) {
      const player = playerRows.find((row) => row.displayName === name);
      const card = cards.find((row) => row.playerId === player?.id && row.draftable);
      if (!player || !card) {
        console.log(`  ${name}: missing draftable card`);
        continue;
      }
      const production = (await scoring.getProductionForCards([card.id])).get(card.id);
      const seasons = seasonRows
        .filter(
          (row) =>
            row.playerId === player.id &&
            row.season >= card.firstSeason &&
            row.season <= card.lastSeason,
        )
        .sort((left, right) => left.season - right.season);
      console.log(
        `  ${name} ${card.firstSeason}–${card.lastSeason} games=${production?.games ?? "null"}` +
          ` passY=${production?.passingYards ?? "null"} rushY=${production?.rushingYards ?? "null"}` +
          ` rec=${production?.receptions ?? "null"} recY=${production?.receivingYards ?? "null"} recTD=${production?.receivingTouchdowns ?? "null"}`,
      );
      for (const season of seasons) {
        console.log(
          `    ${season.season} games=${season.games ?? "null"} passY=${season.passingYards ?? "null"}` +
            ` rushY=${season.rushingYards ?? "null"} rec=${season.receptions ?? "null"} recY=${season.receivingYards ?? "null"}`,
        );
      }
    }

    const peerSeasons = await scoring.loadAllSeasonStatsForPeers();
    const baselines = buildPeerBaselineIndex(peerSeasons);
    const seasonsByPlayerFranchise = new Map<string, typeof peerSeasons>();
    for (const season of peerSeasons) {
      const key = `${season.playerId}|${season.franchiseId}`;
      const list = seasonsByPlayerFranchise.get(key) ?? [];
      list.push(season);
      seasonsByPlayerFranchise.set(key, list);
    }
    const allCards = await db
      .select()
      .from(playerTeamEraCards)
      .where(eq(playerTeamEraCards.draftable, true));
    const allPos = await db.select().from(playerTeamEraPositions);
    const allPosByCard = new Map<number, NormalizedPosition[]>();
    for (const row of allPos) {
      const list = allPosByCard.get(row.playerTeamEraCardId) ?? [];
      list.push(row.position);
      allPosByCard.set(row.playerTeamEraCardId, list);
    }

    const fbCards = allCards.filter((card) => (allPosByCard.get(card.id) ?? []).includes("FB"));
    const seasonsByCard = new Map<number, typeof peerSeasons>();
    for (const card of fbCards) {
      const seasons = (
        seasonsByPlayerFranchise.get(`${card.playerId}|${card.franchiseId}`) ?? []
      ).filter((row) => row.season >= card.firstSeason && row.season <= card.lastSeason);
      seasonsByCard.set(card.id, seasons);
    }

    const rbEligibleFbCards = fbCards.filter((card) =>
      (allPosByCard.get(card.id) ?? []).includes("RB"),
    );
    const fbEvals = rbEligibleFbCards.map((card) => {
      const seasons = seasonsByCard.get(card.id) ?? [];
      const pick: LineupPickInput = {
        lineupSlot: "RB1",
        playerId: card.playerId,
        playerName: playerById.get(card.playerId)?.displayName ?? "",
        franchiseId: card.franchiseId,
        eraId: card.eraId,
        cardId: card.id,
        firstSeason: card.firstSeason,
        lastSeason: card.lastSeason,
        positions: allPosByCard.get(card.id) ?? ["FB"],
        seasons,
      };
      const evaluation = evaluateLineupPick(pick, baselines);
      const scoringSeason = seasons.find((row) => row.season === evaluation.scoringSeason);
      const eraLabel = eraRows.find((row) => row.id === card.eraId)?.label ?? "";
      return { pick, evaluation, scoringSeason, eraLabel };
    });

    fbEvals.sort((left, right) => right.evaluation.overall - left.evaluation.overall);
    const byEra = new Map<string, number>();
    for (const row of fbEvals) byEra.set(row.eraLabel, (byEra.get(row.eraLabel) ?? 0) + 1);

    const weightSum = Object.values(LINEUP_SLOT_WEIGHTS).reduce((sum, value) => sum + value, 0);
    console.log("\n=== Historical FB coverage (FB is not a playable slot) ===");
    console.log(
      `RB1 weight=${LINEUP_SLOT_WEIGHTS.RB1} RB2 weight=${LINEUP_SLOT_WEIGHTS.RB2} / ${weightSum}` +
        ` = ${((LINEUP_SLOT_WEIGHTS.RB1 + LINEUP_SLOT_WEIGHTS.RB2) / weightSum).toFixed(4)} combined`,
    );
    console.log(`FB-only draftable cards=${fbCards.length - rbEligibleFbCards.length} dual RB/FB=${rbEligibleFbCards.length}`);
    console.log("FB draftable cards by era:", Object.fromEntries([...byEra.entries()].sort()));
    console.log(`MIN_PEER_SAMPLE=${MIN_PEER_SAMPLE} FB_PEER_FALLBACK=${FB_PEER_FALLBACK_POSITIONS.join(",")}`);
    console.log("FB vs RB peer-season counts (rushing_yards sample proxy = seasons with that position):");
    for (const year of [1970, 1980, 1990, 1995, 2000, 2005, 2010, 2016, 2020, 2024]) {
      const fbCount = peerSeasons.filter((row) => row.season === year && row.positions.includes("FB")).length;
      const rbCount = peerSeasons.filter((row) => row.season === year && row.positions.includes("RB")).length;
      const fbRushPeers = baselines.peerValues(year, "FB", "rushing_yards").length;
      const fallback = fbCount < MIN_PEER_SAMPLE ? "likely-RB-fallback" : "FB-pool";
      console.log(
        `  ${year}: FB seasons=${fbCount} RB seasons=${rbCount} FB rushing_yards peerValues=${fbRushPeers} (${fallback})`,
      );
    }
    console.log("Top 25 FBs:");
    for (const row of fbEvals.slice(0, 25)) {
      const stat = row.scoringSeason;
      const rbLike =
        (stat?.rushingYards ?? 0) >= 600 ||
        (stat?.positions ?? []).includes("RB") ||
        row.pick.positions.includes("RB");
      console.log(
        `  ${row.evaluation.overall.toFixed(1)} ${row.pick.playerName} ${row.eraLabel} season=${row.evaluation.scoringSeason}` +
          ` rel=${row.evaluation.reliability.toFixed(2)} rushY=${stat?.rushingYards ?? "null"} rec=${stat?.receptions ?? "null"} recY=${stat?.receivingYards ?? "null"}` +
          ` cardPos=${row.pick.positions.join("/")}` +
          (rbLike ? " RB-LIKE" : ""),
      );
    }

    function findFb(name: string, season?: number) {
      return fbEvals.filter(
        (row) =>
          row.pick.playerName.toLowerCase().includes(name.toLowerCase()) &&
          (season == null || row.evaluation.scoringSeason === season),
      );
    }
    console.log("\nNamed FBs:");
    for (const row of [
      ...findFb("Spencer Ware"),
      ...findFb("Michael Burton"),
      ...findFb("Daryl Johnston"),
    ]) {
      const stat = row.scoringSeason;
      console.log(
        `  ${row.pick.playerName} ${row.eraLabel} overall=${row.evaluation.overall.toFixed(1)} season=${row.evaluation.scoringSeason}` +
          ` rushY=${stat?.rushingYards ?? "null"} recY=${stat?.receivingYards ?? "null"} rel=${row.evaluation.reliability.toFixed(2)}`,
      );
    }

    const supportNames = [
      { slot: "QB" as const, name: "Al Woodall", era: "1970s" },
      { slot: "RB1" as const, name: "Johnny Hector", era: "1990s" },
      { slot: "RB2" as const, name: "Earnest Byner", era: "1980s" },
      { slot: "WR1" as const, name: "Jim Beirne", era: "1970s" },
      { slot: "WR2" as const, name: "Paul Flatley", era: "1970s" },
      { slot: "TE" as const, name: "Rich Kotite", era: "1970s" },
    ];
    const supportPicks: LineupPickInput[] = [];
    for (const spec of supportNames) {
      const era = eraRows.find((row) => row.label === spec.era);
      if (!era) throw new Error(`missing support era ${spec.era}`);
      const player = playerRows.find((row) => row.displayName === spec.name);
      const [card] = player
        ? await db
            .select()
            .from(playerTeamEraCards)
            .where(
              and(
                eq(playerTeamEraCards.playerId, player.id),
                eq(playerTeamEraCards.eraId, era.id),
                eq(playerTeamEraCards.draftable, true),
              ),
            )
        : [];
      if (!player || !card) {
        const position =
          spec.slot === "WR1" || spec.slot === "WR2"
            ? "WR"
            : spec.slot === "RB1" || spec.slot === "RB2"
              ? "RB"
              : spec.slot;
        const fallback = allCards.find(
          (row) =>
            row.draftable &&
            row.eraId === era.id &&
            (allPosByCard.get(row.id) ?? []).includes(position),
        );
        if (!fallback) throw new Error(`missing support card ${spec.name}`);
        const fallbackPlayer = playerById.get(fallback.playerId);
        supportPicks.push({
          lineupSlot: spec.slot,
          playerId: fallback.playerId,
          playerName: fallbackPlayer?.displayName ?? spec.name,
          franchiseId: fallback.franchiseId,
          eraId: fallback.eraId,
          cardId: fallback.id,
          firstSeason: fallback.firstSeason,
          lastSeason: fallback.lastSeason,
          positions: allPosByCard.get(fallback.id) ?? [],
          seasons: [],
        });
        continue;
      }
      supportPicks.push({
        lineupSlot: spec.slot,
        playerId: player.id,
        playerName: player.displayName,
        franchiseId: card.franchiseId,
        eraId: card.eraId,
        cardId: card.id,
        firstSeason: card.firstSeason,
        lastSeason: card.lastSeason,
        positions: allPosByCard.get(card.id) ?? [],
        seasons: [],
      });
    }

    const ranked = fbEvals.filter((row) => Number.isFinite(row.evaluation.overall));
    const replacement = ranked[ranked.length - 1]!;
    const average = ranked[Math.floor(ranked.length / 2)]!;
    const strong = ranked[Math.floor(ranked.length * 0.1)]!;
    const top = ranked[0]!;

    function seasonsForCard(cardId: number, playerId: number, franchiseId: number, first: number, last: number) {
      const cached = seasonsByCard.get(cardId);
      if (cached) return cached;
      return (seasonsByPlayerFranchise.get(`${playerId}|${franchiseId}`) ?? []).filter(
        (row) => row.season >= first && row.season <= last,
      );
    }

    function lineupWithSecondRb(rb: (typeof ranked)[number]) {
      const picks: LineupPickInput[] = [
        ...supportPicks
          .filter((row) => row.lineupSlot !== "RB2")
          .map((row) => ({
            ...row,
            seasons: seasonsForCard(row.cardId, row.playerId, row.franchiseId, row.firstSeason, row.lastSeason),
          })),
        { ...rb.pick, lineupSlot: "RB2" as const, seasons: seasonsByCard.get(rb.pick.cardId) ?? [] },
      ];
      return evaluateLineup(picks, baselines);
    }

    console.log("\n=== Dual RB/FB sensitivity at RB2 (identical other five) ===");
    const variants = [
      ["replacement", replacement],
      ["average", average],
      ["strong", strong],
      ["top", top],
    ] as const;
    const results = [];
    for (const [label, fb] of variants) {
      const scored = lineupWithSecondRb(fb);
      results.push({ label, fb: fb.pick.playerName, scored });
      console.log(
        `  ${label} RB2=${fb.pick.playerName} overall=${fb.evaluation.overall.toFixed(1)}` +
          ` offense=${scored.offense.overallRating.toFixed(2)} p=${scored.projection.perGameWinProbability.toFixed(4)}` +
          ` xW=${scored.projection.expectedWins.toFixed(2)} rec=${scored.projection.projectedWins}-${scored.projection.projectedLosses}`,
      );
    }
    const twice = lineupWithSecondRb(top);
    const replacementScored = results[0]?.scored;
    const topScored = results[3]?.scored;
    if (replacementScored && topScored) {
      console.log(
        "delta top-vs-replacement:" +
          ` offense=${(topScored.offense.overallRating - replacementScored.offense.overallRating).toFixed(2)}` +
          ` p=${(topScored.projection.perGameWinProbability - replacementScored.projection.perGameWinProbability).toFixed(4)}` +
          ` xW=${(topScored.projection.expectedWins - replacementScored.projection.expectedWins).toFixed(2)}` +
          ` rec=${topScored.projection.projectedWins - replacementScored.projection.projectedWins} wins`,
      );
    }
    console.log(
      "deterministic top lineup repeat:",
      twice.offense.overallRating === results[3]?.scored.offense.overallRating &&
        twice.projection.expectedWins === results[3]?.scored.projection.expectedWins,
    );

    console.log("\n=== Win curve ===");
    console.log("seasonLength", WIN_PROJECTION_MODEL.seasonLength);
    console.log("maxWinProbability", WIN_PROJECTION_MODEL.maxWinProbability);
    console.log("17-0 rating threshold", ratingThresholdForProjectedWins(17).toFixed(2));
    console.log("16-win rating threshold", ratingThresholdForProjectedWins(16).toFixed(2));
    const t17 = ratingThresholdForProjectedWins(17);
    const p17 = perGameWinProbabilityFromRating(t17);
    console.log("p at 17-0 threshold", p17.toFixed(4), "perfect p^17", (p17 ** 17).toFixed(6));
    console.log("rating 100 projection", projectWinsFromRating(100));
    console.log("evaluateCompletedGame does not take mode; CLASSIC and IQ share evaluateLineup.");
  } finally {
    await close?.();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
