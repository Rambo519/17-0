/**
 * Single source of truth for the positions the game understands and the
 * lineup slots a drafted player can occupy.
 */

export const NORMALIZED_POSITIONS = ["QB", "RB", "FB", "WR", "TE"] as const;

export type NormalizedPosition = (typeof NORMALIZED_POSITIONS)[number];

/**
 * The six draft slots of the I-formation offense. Order is the canonical
 * display order used by the UI and by round-by-round output.
 */
export const LINEUP_SLOTS = ["QB", "RB", "FB", "WR1", "WR2", "TE"] as const;

export type LineupSlot = (typeof LINEUP_SLOTS)[number];

export const LINEUP_SLOT_COUNT = LINEUP_SLOTS.length;

/**
 * The only place in the codebase that decides which normalized position a
 * lineup slot accepts. WR1 and WR2 are distinct slots backed by the same
 * normalized position.
 */
const SLOT_ELIGIBILITY: Readonly<Record<LineupSlot, NormalizedPosition>> = {
  QB: "QB",
  RB: "RB",
  FB: "FB",
  WR1: "WR",
  WR2: "WR",
  TE: "TE",
};

export function isNormalizedPosition(value: string): value is NormalizedPosition {
  return (NORMALIZED_POSITIONS as readonly string[]).includes(value);
}

export function isLineupSlot(value: string): value is LineupSlot {
  return (LINEUP_SLOTS as readonly string[]).includes(value);
}

export function positionForSlot(slot: LineupSlot): NormalizedPosition {
  return SLOT_ELIGIBILITY[slot];
}

export function slotsForPosition(position: NormalizedPosition): LineupSlot[] {
  return LINEUP_SLOTS.filter((slot) => SLOT_ELIGIBILITY[slot] === position);
}

export function isPositionEligibleForSlot(
  position: NormalizedPosition,
  slot: LineupSlot,
): boolean {
  return SLOT_ELIGIBILITY[slot] === position;
}

/**
 * Positions that can legally fill at least one of the given slots.
 */
export function positionsForSlots(slots: readonly LineupSlot[]): NormalizedPosition[] {
  const positions = new Set(slots.map(positionForSlot));
  return NORMALIZED_POSITIONS.filter((position) => positions.has(position));
}
