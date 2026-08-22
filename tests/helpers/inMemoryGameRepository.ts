import { randomUUID } from "node:crypto";

import type { NormalizedPosition } from "@/lib/football/positions";
import type { DraftableCardFilter, GameRepository } from "@/lib/game/ports";
import type {
  DraftableCard,
  DraftPickRecord,
  GameSessionRecord,
  NewPick,
} from "@/lib/game/types";

/**
 * In-memory stand-in for the Drizzle repository so the rules can be tested
 * without a Postgres instance. It is deliberately dumb storage: every rule
 * lives in the engine.
 */
export interface InMemoryGameRepository extends GameRepository {
  sessions: Map<string, GameSessionRecord>;
  picks: Map<string, NewPick[]>;
  cards: DraftableCard[];
}

let nextCardId = 1;

export function card(
  overrides: Partial<DraftableCard> & { positions: NormalizedPosition[] },
): DraftableCard {
  const cardId = overrides.cardId ?? nextCardId++;
  return {
    cardId,
    playerId: overrides.playerId ?? cardId,
    playerName: overrides.playerName ?? `Player ${cardId}`,
    franchiseId: overrides.franchiseId ?? 1,
    franchiseName: overrides.franchiseName ?? `Franchise ${overrides.franchiseId ?? 1}`,
    eraId: overrides.eraId ?? 1,
    eraLabel: overrides.eraLabel ?? `Era ${overrides.eraId ?? 1}`,
    firstSeason: overrides.firstSeason ?? 1980,
    lastSeason: overrides.lastSeason ?? 1985,
    representativeSeason: overrides.representativeSeason ?? null,
    draftable: overrides.draftable ?? true,
    positions: overrides.positions,
  };
}

export function createInMemoryGameRepository(cards: DraftableCard[]): InMemoryGameRepository {
  const sessions = new Map<string, GameSessionRecord>();
  const picks = new Map<string, NewPick[]>();

  const cardById = new Map(cards.map((entry) => [entry.cardId, entry]));

  function toPickRecord(pick: NewPick): DraftPickRecord {
    const source = cardById.get(pick.playerTeamEraCardId);
    return {
      ...pick,
      playerName: source?.playerName ?? `Player ${pick.playerId}`,
      franchiseName: source?.franchiseName ?? `Franchise ${pick.franchiseId}`,
      eraLabel: source?.eraLabel ?? `Era ${pick.eraId}`,
    };
  }

  return {
    sessions,
    picks,
    cards,

    async createSession(): Promise<GameSessionRecord> {
      const session: GameSessionRecord = {
        id: randomUUID(),
        status: "ACTIVE",
        currentFranchiseId: null,
        currentEraId: null,
        createdAt: new Date(),
        completedAt: null,
      };
      sessions.set(session.id, session);
      picks.set(session.id, []);
      return session;
    },

    async findSession(sessionId: string): Promise<GameSessionRecord | null> {
      const session = sessions.get(sessionId);
      return session ? { ...session } : null;
    },

    async listPicks(sessionId: string): Promise<DraftPickRecord[]> {
      return (picks.get(sessionId) ?? []).map(toPickRecord);
    },

    async findCard(cardId: number): Promise<DraftableCard | null> {
      return cardById.get(cardId) ?? null;
    },

    async listDraftableCards(filter: DraftableCardFilter): Promise<DraftableCard[]> {
      return cards.filter((entry) => {
        if (!entry.draftable) return false;
        if (!entry.positions.some((position) => filter.positions.includes(position))) return false;
        if (filter.excludePlayerIds.includes(entry.playerId)) return false;
        if (filter.franchiseId !== undefined && entry.franchiseId !== filter.franchiseId) return false;
        if (filter.eraId !== undefined && entry.eraId !== filter.eraId) return false;
        return true;
      });
    },

    async setCurrentSpin(sessionId, target): Promise<void> {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Unknown session ${sessionId}`);
      session.currentFranchiseId = target?.franchiseId ?? null;
      session.currentEraId = target?.eraId ?? null;
    },

    async commitPick({ sessionId, pick, complete }): Promise<void> {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Unknown session ${sessionId}`);

      picks.set(sessionId, [...(picks.get(sessionId) ?? []), pick]);
      session.currentFranchiseId = null;
      session.currentEraId = null;

      if (complete) {
        session.status = "COMPLETE";
        session.completedAt = new Date();
      }
    },
  };
}

/** One franchise/era holding every position needed to finish a lineup. */
export function singleTeamCards(): DraftableCard[] {
  return [
    card({ cardId: 101, playerId: 101, playerName: "Dev QB", positions: ["QB"] }),
    card({ cardId: 102, playerId: 102, playerName: "Dev RB", positions: ["RB"] }),
    card({ cardId: 103, playerId: 103, playerName: "Dev FB", positions: ["FB"] }),
    card({ cardId: 104, playerId: 104, playerName: "Dev WR A", positions: ["WR"] }),
    card({ cardId: 105, playerId: 105, playerName: "Dev WR B", positions: ["WR"] }),
    card({ cardId: 106, playerId: 106, playerName: "Dev TE", positions: ["TE"] }),
  ];
}

/** Several franchise/era combinations with uneven position coverage. */
export function multiTeamCards(): DraftableCard[] {
  return [
    // Franchise 1 / Era 1: WR only.
    card({ cardId: 201, playerId: 201, positions: ["WR"], franchiseId: 1, eraId: 1 }),
    card({ cardId: 202, playerId: 202, positions: ["WR"], franchiseId: 1, eraId: 1 }),
    // Franchise 2 / Era 1: TE only.
    card({ cardId: 203, playerId: 203, positions: ["TE"], franchiseId: 2, eraId: 1 }),
    // Franchise 2 / Era 2: QB + RB/FB.
    card({ cardId: 204, playerId: 204, positions: ["QB"], franchiseId: 2, eraId: 2 }),
    card({ cardId: 205, playerId: 205, positions: ["RB", "FB"], franchiseId: 2, eraId: 2 }),
    // Franchise 3 / Era 2: RB only.
    card({ cardId: 206, playerId: 206, positions: ["RB"], franchiseId: 3, eraId: 2 }),
  ];
}
