import { LINEUP_SLOTS, type LineupSlot } from "@/lib/football/positions";

import type { DraftPickRecord } from "./types";

export type Lineup = Record<LineupSlot, DraftPickRecord | null>;

export function createEmptyLineup(): Lineup {
  return {
    QB: null,
    RB: null,
    FB: null,
    WR1: null,
    WR2: null,
    TE: null,
  };
}

export function buildLineup(picks: readonly DraftPickRecord[]): Lineup {
  const lineup = createEmptyLineup();
  for (const pick of picks) {
    lineup[pick.lineupSlot] = pick;
  }
  return lineup;
}

export function isSlotOpen(lineup: Lineup, slot: LineupSlot): boolean {
  return lineup[slot] === null;
}

export function openSlots(lineup: Lineup): LineupSlot[] {
  return LINEUP_SLOTS.filter((slot) => lineup[slot] === null);
}

export function filledSlots(lineup: Lineup): LineupSlot[] {
  return LINEUP_SLOTS.filter((slot) => lineup[slot] !== null);
}

export function isLineupComplete(lineup: Lineup): boolean {
  return openSlots(lineup).length === 0;
}
