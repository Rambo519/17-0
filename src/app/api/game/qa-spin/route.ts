import { NextResponse } from "next/server";

import { loadGameState } from "@/lib/game/gameState";
import { isDevelopmentQaEnabled } from "@/lib/game/qaAccess";
import { qaForceSpin, qaInspectSpinPool, qaRerollSpin } from "@/lib/game/qaSpin";
import { toGameStateView } from "@/lib/game/view";
import { orderSpinResult } from "@/lib/scoring/rankSpinCandidates";
import { qaSpinRequestSchema } from "@/lib/validation/game";
import { readJson, toErrorResponse } from "@/server/http";
import { getScoringRepository } from "@/server/scoringService";

function notFound() {
  return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found." } }, { status: 404 });
}

export async function POST(request: Request) {
  if (!isDevelopmentQaEnabled()) {
    return notFound();
  }

  try {
    const body = qaSpinRequestSchema.parse(await readJson(request));
    const repository = await getScoringRepository();

    if (body.action === "inspect") {
      const pool = await qaInspectSpinPool(repository, body.sessionId);
      const state = await loadGameState(repository, body.sessionId);
      return NextResponse.json({
        game: toGameStateView(state),
        qa: { action: "inspect", ...pool },
      });
    }

    const result =
      body.action === "reroll"
        ? await qaRerollSpin(repository, body.sessionId)
        : await qaForceSpin(repository, body.sessionId, {
            franchiseAbbreviation: body.franchiseAbbreviation,
            eraLabel: body.eraLabel,
          });

    const state = await loadGameState(repository, body.sessionId);
    return NextResponse.json({
      spin: await orderSpinResult(repository, state.mode, result.spin),
      game: toGameStateView(state),
      qa: {
        action: body.action,
        combinationCount: result.combinationCount,
        franchiseAbbreviation: result.spin.franchise.abbreviation,
        eraLabel: result.spin.era.label,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
