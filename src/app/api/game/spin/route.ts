import { NextResponse } from "next/server";

import { loadGameState } from "@/lib/game/gameState";
import { spinGame } from "@/lib/game/spin";
import { toGameStateView } from "@/lib/game/view";
import { spinRequestSchema } from "@/lib/validation/game";
import { getGameRepository } from "@/server/gameService";
import { readJson, toErrorResponse } from "@/server/http";

export async function POST(request: Request) {
  try {
    const { sessionId } = spinRequestSchema.parse(await readJson(request));
    const repository = getGameRepository();

    const spin = await spinGame(repository, sessionId);
    const state = await loadGameState(repository, sessionId);

    return NextResponse.json({ spin, game: toGameStateView(state) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
