import { NextResponse } from "next/server";

import { startGame } from "@/lib/game/startGame";
import { toGameStateView } from "@/lib/game/view";
import { getGameRepository } from "@/server/gameService";
import { toErrorResponse } from "@/server/http";

export async function POST() {
  try {
    const state = await startGame(getGameRepository());
    return NextResponse.json({ game: toGameStateView(state) }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
