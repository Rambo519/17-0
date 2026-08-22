import type { NormalizedPosition } from "@/lib/football/positions";

import type {
  DraftableCard,
  DraftPickRecord,
  GameMode,
  GameSessionRecord,
  NewPick,
} from "./types";

export interface DraftableCardFilter {
  /** Only cards eligible at one of these normalized positions. */
  positions: readonly NormalizedPosition[];
  /** Players already used in this session. */
  excludePlayerIds: readonly number[];
  franchiseId?: number;
  eraId?: number;
}

export interface CreateSessionInput {
  mode: GameMode;
}

export type SkipKind = "TEAM" | "ERA";

/**
 * The only data access the game engine knows about. Implemented by Drizzle in
 * `src/server/repository/drizzleGameRepository.ts` and by an in-memory fake in
 * tests, which is why the engine never imports the database directly.
 */
export interface GameRepository {
  createSession(input: CreateSessionInput): Promise<GameSessionRecord>;
  findSession(sessionId: string): Promise<GameSessionRecord | null>;
  listPicks(sessionId: string): Promise<DraftPickRecord[]>;
  findCard(cardId: number): Promise<DraftableCard | null>;
  listDraftableCards(filter: DraftableCardFilter): Promise<DraftableCard[]>;
  setCurrentSpin(sessionId: string, target: { franchiseId: number; eraId: number } | null): Promise<void>;
  /**
   * Atomically replaces the outstanding spin and consumes one Team or Era skip.
   * Callers must validate remaining count and alternate validity first.
   */
  applySkipSpin(input: {
    sessionId: string;
    kind: SkipKind;
    franchiseId: number;
    eraId: number;
  }): Promise<void>;
  /** Records the pick, clears the outstanding spin, and completes the game when asked. */
  commitPick(input: { sessionId: string; pick: NewPick; complete: boolean }): Promise<void>;
}
