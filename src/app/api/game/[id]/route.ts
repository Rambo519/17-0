import { NextResponse } from "next/server";

import { loadGameState } from "@/lib/game/gameState";
import { loadCurrentSpin } from "@/lib/game/spin";
import { toGameStateView } from "@/lib/game/view";
import { orderSpinResult } from "@/lib/scoring/rankSpinCandidates";
import { sessionIdSchema } from "@/lib/validation/game";
import { toErrorResponse } from "@/server/http";
import { getScoringRepository } from "@/server/scoringService";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sessionId = sessionIdSchema.parse(id);

    const repository = await getScoringRepository();
    const state = await loadGameState(repository, sessionId);
    const spin = await orderSpinResult(
      repository,
      state.mode,
      await loadCurrentSpin(repository, state),
    );

    return NextResponse.json({ game: toGameStateView(state), spin });
  } catch (error) {
    return toErrorResponse(error);
  }
}
