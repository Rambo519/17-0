import { GameClientError, type GameApiPayload } from "@/lib/game/clientApi";
import { QA_BALTIMORE_2000S, type QaSpinPoolEntry } from "@/lib/game/qaSpin";

export interface QaSpinApiPayload extends GameApiPayload {
  qa?: {
    action: "reroll" | "force" | "inspect";
    combinationCount: number;
    franchiseAbbreviation?: string;
    eraLabel?: string;
    combinations?: QaSpinPoolEntry[];
  };
}

async function postQa(body: unknown): Promise<QaSpinApiPayload> {
  const response = await fetch("/api/game/qa-spin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as QaSpinApiPayload;
  if (!response.ok) {
    throw new GameClientError(
      payload.error?.code ?? "INTERNAL_ERROR",
      payload.error?.message ?? "Request failed",
    );
  }
  return payload;
}

export async function qaRerollSpin(sessionId: string): Promise<QaSpinApiPayload> {
  return postQa({ action: "reroll", sessionId });
}

export async function qaForceBaltimore2000s(sessionId: string): Promise<QaSpinApiPayload> {
  return postQa({
    action: "force",
    sessionId,
    franchiseAbbreviation: QA_BALTIMORE_2000S.franchiseAbbreviation,
    eraLabel: QA_BALTIMORE_2000S.eraLabel,
  });
}
