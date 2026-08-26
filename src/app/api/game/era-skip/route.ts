import { NextResponse } from "next/server";

import { loadGameState } from "@/lib/game/gameState";
import { eraSkipGame } from "@/lib/game/skip";
import { toGameStateView } from "@/lib/game/view";
import { orderSpinResult } from "@/lib/scoring/rankSpinCandidates";
import { skipRequestSchema } from "@/lib/validation/game";
import { readJson, toErrorResponse } from "@/server/http";
import { getScoringRepository } from "@/server/scoringService";

export async function POST(request: Request) {
  try {
    const { sessionId } = skipRequestSchema.parse(await readJson(request));
    const repository = await getScoringRepository();

    const spin = await eraSkipGame(repository, sessionId);
    const state = await loadGameState(repository, sessionId);

    return NextResponse.json({
      spin: await orderSpinResult(repository, state.mode, spin),
      game: toGameStateView(state),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
