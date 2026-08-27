import { z } from "zod";

import { LINEUP_SLOTS } from "@/lib/football/positions";
import { GAME_MODES } from "@/lib/game/types";

export const lineupSlotSchema = z.enum(LINEUP_SLOTS);

export const gameModeSchema = z.enum(GAME_MODES);

export const sessionIdSchema = z.uuid();

export const startGameRequestSchema = z.object({
  mode: gameModeSchema,
});

export const spinRequestSchema = z.object({
  sessionId: sessionIdSchema,
});

export const skipRequestSchema = z.object({
  sessionId: sessionIdSchema,
});

export const pickRequestSchema = z.object({
  sessionId: sessionIdSchema,
  playerTeamEraCardId: z.number().int().positive(),
  lineupSlot: lineupSlotSchema,
});

export type StartGameRequest = z.infer<typeof startGameRequestSchema>;
export type SpinRequest = z.infer<typeof spinRequestSchema>;
export type SkipRequest = z.infer<typeof skipRequestSchema>;
export type PickRequest = z.infer<typeof pickRequestSchema>;
