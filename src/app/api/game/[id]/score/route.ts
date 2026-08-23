import { NextResponse } from "next/server";

import { evaluateCompletedGame } from "@/lib/scoring/evaluateGame";
import { toScoringResultView } from "@/lib/scoring/view";
import { sessionIdSchema } from "@/lib/validation/game";
import { getScoringRepository } from "@/server/scoringService";
import { toErrorResponse } from "@/server/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sessionId = sessionIdSchema.parse(id);
    const repository = await getScoringRepository();
    const result = await evaluateCompletedGame(repository, sessionId);
    return NextResponse.json(toScoringResultView(result));
  } catch (error) {
    return toErrorResponse(error);
  }
}
