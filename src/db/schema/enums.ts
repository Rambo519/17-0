import { pgEnum } from "drizzle-orm/pg-core";

import { LINEUP_SLOTS, NORMALIZED_POSITIONS } from "@/lib/football/positions";

/** Database enums are derived from the domain constants, never re-typed. */
export const normalizedPositionEnum = pgEnum("normalized_position", NORMALIZED_POSITIONS);

export const lineupSlotEnum = pgEnum("lineup_slot", LINEUP_SLOTS);

export const GAME_STATUSES = ["ACTIVE", "COMPLETE"] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

export const gameStatusEnum = pgEnum("game_status", GAME_STATUSES);
