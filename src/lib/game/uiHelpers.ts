import type { LineupSlot, NormalizedPosition } from "@/lib/football/positions";
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

export function formatStat(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US");
}

export interface DisplayStat {
  label: string;
  value: string;
}

/** Position-aware Classic production rows; omits nothing — uses dashes for missing. */
export function classicProductionStats(
  positions: readonly NormalizedPosition[],
  production: CardProduction,
): DisplayStat[] {
  const primary = positions[0] ?? "WR";
  const rows: DisplayStat[] = [{ label: "G", value: formatStat(production.games) }];

  if (primary === "QB") {
    rows.push(
      { label: "Pass Yds", value: formatStat(production.passingYards) },
      { label: "Pass TD", value: formatStat(production.passingTouchdowns) },
      { label: "Rush Yds", value: formatStat(production.rushingYards) },
    );
    return rows;
  }

  if (primary === "RB" || primary === "FB") {
    rows.push(
      { label: "Rush Yds", value: formatStat(production.rushingYards) },
      { label: "Rush TD", value: formatStat(production.rushingTouchdowns) },
      { label: "Rec", value: formatStat(production.receptions) },
      { label: "Rec Yds", value: formatStat(production.receivingYards) },
    );
    return rows;
  }

  rows.push(
    { label: "Rec", value: formatStat(production.receptions) },
    { label: "Rec Yds", value: formatStat(production.receivingYards) },
    { label: "Rec TD", value: formatStat(production.receivingTouchdowns) },
  );
  return rows;
}

export function shouldShowClassicStats(mode: GameMode): boolean {
  return mode === "CLASSIC";
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
