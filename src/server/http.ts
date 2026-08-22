import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isGameRuleError } from "@/lib/game/errors";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (isGameRuleError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.httpStatus },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid request body.", details: error.issues } },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
