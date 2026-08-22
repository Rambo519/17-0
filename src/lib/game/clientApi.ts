import type { LineupSlot } from "@/lib/football/positions";
import type { GameMode } from "@/lib/game/types";
import type { SpinResult } from "@/lib/game/spin";
import type { GameStateView } from "@/lib/game/view";
import { userFacingError } from "@/lib/game/uiHelpers";

export interface GameApiError {
  code: string;
  message: string;
}

export interface GameApiPayload {
  game?: GameStateView;
  spin?: SpinResult | null;
  error?: GameApiError;
}

export class GameClientError extends Error {
  readonly code: string;
  readonly userMessage: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GameClientError";
    this.code = code;
    this.userMessage = userFacingError(code, message);
  }
}

async function post(path: string, body: unknown): Promise<GameApiPayload> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as GameApiPayload;
  if (!response.ok) {
    throw new GameClientError(
      payload.error?.code ?? "INTERNAL_ERROR",
      payload.error?.message ?? "Request failed",
    );
  }
  return payload;
}

export async function startGame(mode: GameMode): Promise<GameApiPayload> {
  return post("/api/game/start", { mode });
}

export async function spinGame(sessionId: string): Promise<GameApiPayload> {
  return post("/api/game/spin", { sessionId });
}

export async function teamSkip(sessionId: string): Promise<GameApiPayload> {
  return post("/api/game/team-skip", { sessionId });
}

export async function eraSkip(sessionId: string): Promise<GameApiPayload> {
  return post("/api/game/era-skip", { sessionId });
}

export async function pickPlayer(
  sessionId: string,
  playerTeamEraCardId: number,
  lineupSlot: LineupSlot,
): Promise<GameApiPayload> {
  return post("/api/game/pick", { sessionId, playerTeamEraCardId, lineupSlot });
}
