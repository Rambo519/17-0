import { NextResponse } from "next/server";

import { startGame } from "@/lib/game/startGame";
import { toGameStateView } from "@/lib/game/view";
import { startGameRequestSchema } from "@/lib/validation/game";
import { getGameRepository } from "@/server/gameService";
import { readJson, toErrorResponse } from "@/server/http";

export async function POST(request: Request) {
  try {
    const body = startGameRequestSchema.parse(await readJson(request));
    const state = await startGame(getGameRepository(), { mode: body.mode });
    return NextResponse.json({ game: toGameStateView(state) }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
