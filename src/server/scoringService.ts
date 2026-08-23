import { getDb } from "@/db/client";
import type { ScoringRepository } from "@/lib/scoring/ports";

import { createDrizzleScoringRepository } from "./repository/drizzleScoringRepository";

export async function getScoringRepository(): Promise<ScoringRepository> {
  return createDrizzleScoringRepository(await getDb());
}
