import {
  NORMALIZED_POSITIONS,
  positionForSlot,
  type LineupSlot,
  type NormalizedPosition,
} from "@/lib/football/positions";
import { formatPlayerDisplayName } from "@/lib/game/playerName";
import type { CardProduction, GameMode } from "@/lib/game/types";
import type { SpinCandidate } from "@/lib/game/spin";
import type { GameStateView } from "@/lib/game/view";

/** Slots that should highlight for a selected candidate (server eligibility ∩ empty). */
export function highlightedSlotsForCandidate(
  candidate: SpinCandidate | null | undefined,
  openSlots: readonly LineupSlot[],
): LineupSlot[] {
  if (!candidate) return [];
  const open = new Set(openSlots);
  return candidate.eligibleSlots.filter((slot) => open.has(slot));
}

export function slotDisplayLabel(slot: LineupSlot): string {
  if (slot === "WR1" || slot === "WR2") return "WR";
  return slot;
}

/** Player-facing position labels; FB is historical data only. */
export function playableDisplayPositions(
  positions: readonly NormalizedPosition[],
): NormalizedPosition[] {
  return positions.filter((position) => position !== "FB");
}

export function formatStat(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US");
}

export interface DisplayStat {
  label: string;
  value: string;
}

function isPositiveKnown(value: number | null | undefined): boolean {
  return value != null && value > 0;
}

function classicDisplayPosition(
  positions: readonly NormalizedPosition[],
  production: CardProduction,
): NormalizedPosition {
  for (const position of positions) {
    if (position === "QB") {
      if (
        isPositiveKnown(production.passingYards) ||
        isPositiveKnown(production.passingTouchdowns) ||
        isPositiveKnown(production.rushingYards) ||
        isPositiveKnown(production.rushingTouchdowns)
      ) {
        return position;
      }
    } else if (position === "RB" || position === "FB") {
      if (
        isPositiveKnown(production.rushingYards) ||
        isPositiveKnown(production.rushingTouchdowns) ||
        isPositiveKnown(production.receptions) ||
        isPositiveKnown(production.receivingYards) ||
        isPositiveKnown(production.receivingTouchdowns)
      ) {
        return position;
      }
    } else if (
      isPositiveKnown(production.receptions) ||
      isPositiveKnown(production.receivingYards) ||
      isPositiveKnown(production.receivingTouchdowns)
    ) {
      return position;
    }
  }
  if (positions.includes("FB") && production.games != null && production.games > 0) {
    return "FB";
  }
  return positions[0] ?? "WR";
}

/** Position-aware Classic production rows for candidate cards; dashes for missing values. */
export function classicProductionStats(
  positions: readonly NormalizedPosition[],
  production: CardProduction,
): DisplayStat[] {
  const primary = classicDisplayPosition(positions, production);

  if (primary === "QB") {
    return [
      { label: "Pass Yds", value: formatStat(production.passingYards) },
      { label: "Pass TD", value: formatStat(production.passingTouchdowns) },
      { label: "Rush Yds", value: formatStat(production.rushingYards) },
    ];
  }

  if (primary === "RB" || primary === "FB") {
    const hasRushOrRec =
      isPositiveKnown(production.rushingYards) ||
      isPositiveKnown(production.rushingTouchdowns) ||
      isPositiveKnown(production.receptions) ||
      isPositiveKnown(production.receivingYards) ||
      isPositiveKnown(production.receivingTouchdowns);
    if (primary === "FB" && !hasRushOrRec && production.games != null && production.games > 0) {
      return [
        { label: "G", value: formatStat(production.games) },
        { label: "Rush Yds", value: formatStat(production.rushingYards) },
        { label: "Rec", value: formatStat(production.receptions) },
        { label: "Rec Yds", value: formatStat(production.receivingYards) },
      ];
    }
    return [
      { label: "Rush Yds", value: formatStat(production.rushingYards) },
      { label: "Rush TD", value: formatStat(production.rushingTouchdowns) },
      { label: "Rec", value: formatStat(production.receptions) },
      { label: "Rec Yds", value: formatStat(production.receivingYards) },
    ];
  }

  return [
    { label: "Rec", value: formatStat(production.receptions) },
    { label: "Rec Yds", value: formatStat(production.receivingYards) },
    { label: "Rec TD", value: formatStat(production.receivingTouchdowns) },
  ];
}

export function shouldShowClassicStats(mode: GameMode): boolean {
  return mode === "CLASSIC";
}

export type CandidatePositionFilter = "ALL" | NormalizedPosition;

export function availableCandidatePositions(
  candidates: readonly SpinCandidate[],
): NormalizedPosition[] {
  const present = new Set<NormalizedPosition>();
  for (const candidate of candidates) {
    for (const slot of candidate.eligibleSlots) {
      present.add(positionForSlot(slot));
    }
  }
  return NORMALIZED_POSITIONS.filter((position) => present.has(position));
}

export function filterSpinCandidates(
  candidates: readonly SpinCandidate[],
  options: { query?: string; position?: CandidatePositionFilter } = {},
): SpinCandidate[] {
  const query = options.query?.trim().toLowerCase() ?? "";
  const position = options.position ?? "ALL";

  return candidates.filter((candidate) => {
    if (position !== "ALL" && !candidate.card.positions.includes(position)) {
      return false;
    }
    if (!query) return true;
    const stored = candidate.card.playerName.toLowerCase();
    const displayed = formatPlayerDisplayName(candidate.card.playerName).toLowerCase();
    return stored.includes(query) || displayed.includes(query);
  });
}

export function filledPickCount(game: GameStateView): number {
  return game.lineup.filter((slot) => slot.filled).length;
}

export function userFacingError(code: string | undefined, message: string | undefined): string {
  switch (code) {
    case "NO_VALID_TEAM_SKIP":
      return "No valid alternate team is available.";
    case "NO_VALID_ERA_SKIP":
      return "No valid alternate era is available.";
    case "SLOT_ALREADY_FILLED":
      return "That position has already been filled.";
    case "PLAYER_ALREADY_DRAFTED":
    case "SPIN_MISMATCH":
    case "CARD_NOT_DRAFTABLE":
    case "CARD_NOT_FOUND":
      return "This player is no longer available.";
    case "NO_ACTIVE_SPIN":
      return "Spin for a franchise and era first.";
    case "NO_TEAM_SKIP_REMAINING":
      return "Team Skip has already been used.";
    case "NO_ERA_SKIP_REMAINING":
      return "Era Skip has already been used.";
    case "POSITION_NOT_ELIGIBLE":
      return "That player cannot fill the selected position.";
    case "GAME_NOT_ACTIVE":
    case "LINEUP_ALREADY_FULL":
      return "This game is already complete.";
    case "NO_VALID_SPIN":
      return "No legal franchise and era combination remains.";
    case "SCORING_ERROR":
      return "Could not calculate this season. Try again.";
    default:
      return message?.trim() || "Something went wrong. Try again.";
  }
}

export function yearsWithFranchiseLabel(firstSeason: number, lastSeason: number): string {
  if (firstSeason === lastSeason) return String(firstSeason);
  return `${firstSeason}–${lastSeason}`;
}
