export const GAME_ERROR_CODES = [
  "SESSION_NOT_FOUND",
  "GAME_NOT_ACTIVE",
  "NO_ACTIVE_SPIN",
  "SPIN_MISMATCH",
  "CARD_NOT_FOUND",
  "CARD_NOT_DRAFTABLE",
  "SLOT_ALREADY_FILLED",
  "PLAYER_ALREADY_DRAFTED",
  "POSITION_NOT_ELIGIBLE",
  "NO_VALID_SPIN",
  "LINEUP_ALREADY_FULL",
  "NO_TEAM_SKIP_REMAINING",
  "NO_ERA_SKIP_REMAINING",
  "NO_VALID_TEAM_SKIP",
  "NO_VALID_ERA_SKIP",
] as const;

export type GameErrorCode = (typeof GAME_ERROR_CODES)[number];

const HTTP_STATUS: Readonly<Record<GameErrorCode, number>> = {
  SESSION_NOT_FOUND: 404,
  GAME_NOT_ACTIVE: 409,
  NO_ACTIVE_SPIN: 409,
  SPIN_MISMATCH: 409,
  CARD_NOT_FOUND: 404,
  CARD_NOT_DRAFTABLE: 409,
  SLOT_ALREADY_FILLED: 409,
  PLAYER_ALREADY_DRAFTED: 409,
  POSITION_NOT_ELIGIBLE: 422,
  NO_VALID_SPIN: 409,
  LINEUP_ALREADY_FULL: 409,
  NO_TEAM_SKIP_REMAINING: 409,
  NO_ERA_SKIP_REMAINING: 409,
  NO_VALID_TEAM_SKIP: 409,
  NO_VALID_ERA_SKIP: 409,
};

export class GameRuleError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = "GameRuleError";
    this.code = code;
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }
}

export function isGameRuleError(error: unknown): error is GameRuleError {
  return error instanceof GameRuleError;
}
