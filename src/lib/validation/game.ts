import { z } from "zod";

import { LINEUP_SLOTS } from "@/lib/football/positions";

export const lineupSlotSchema = z.enum(LINEUP_SLOTS);

export const sessionIdSchema = z.uuid();

export const spinRequestSchema = z.object({
  sessionId: sessionIdSchema,
});

export const pickRequestSchema = z.object({
  sessionId: sessionIdSchema,
  playerTeamEraCardId: z.number().int().positive(),
  lineupSlot: lineupSlotSchema,
});

export type SpinRequest = z.infer<typeof spinRequestSchema>;
export type PickRequest = z.infer<typeof pickRequestSchema>;
