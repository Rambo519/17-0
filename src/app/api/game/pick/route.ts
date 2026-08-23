import { NextResponse } from "next/server";

import { draftPlayer } from "@/lib/game/draftPlayer";
import { toGameStateView } from "@/lib/game/view";
import { pickRequestSchema } from "@/lib/validation/game";
import { getGameRepository } from "@/server/gameService";
import { readJson, toErrorResponse } from "@/server/http";

export async function POST(request: Request) {
  try {
    const input = pickRequestSchema.parse(await readJson(request));
    const result = await draftPlayer(await getGameRepository(), input);

    return NextResponse.json({
      pick: result.pick,
      completed: result.completed,
      game: toGameStateView(result.state),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
