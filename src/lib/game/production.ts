import type { CardProduction } from "./types";

export const EMPTY_PRODUCTION: CardProduction = {
  games: null,
  passingYards: null,
  passingTouchdowns: null,
  rushingYards: null,
  rushingTouchdowns: null,
  receptions: null,
  receivingYards: null,
  receivingTouchdowns: null,
};

/** Coerce Postgres numeric/string sums into number | null. */
export function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
