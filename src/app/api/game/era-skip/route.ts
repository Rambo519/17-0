import { NextResponse } from "next/server";

import { loadGameState } from "@/lib/game/gameState";
import { eraSkipGame } from "@/lib/game/skip";
import { toGameStateView } from "@/lib/game/view";
import { skipRequestSchema } from "@/lib/validation/game";
import { getGameRepository } from "@/server/gameService";
import { readJson, toErrorResponse } from "@/server/http";

export async function POST(request: Request) {
  try {
    const { sessionId } = skipRequestSchema.parse(await readJson(request));
    const repository = await getGameRepository();

    const spin = await eraSkipGame(repository, sessionId);
    const state = await loadGameState(repository, sessionId);

    return NextResponse.json({ spin, game: toGameStateView(state) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
