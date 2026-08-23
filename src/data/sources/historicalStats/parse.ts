import { normalizePlayerName } from "@/data/sources/historicalStats/normalizeName";
import { parseOptionalInt, parseCsvText } from "@/data/sources/historicalStats/parseNumbers";
import {
  emptyHistoricalSeasonStats,
  type HistoricalSeasonStats,
  type HistoricalStatCategory,
} from "@/data/sources/historicalStats/types";

function cell(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (key in row) return row[key] ?? "";
    const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
    if (found) return row[found] ?? "";
  }
  return "";
}

export function parseMarcLinderCategoryCsv(
  csvText: string,
  season: number,
  category: HistoricalStatCategory,
  sourceAdapter: string,
): HistoricalSeasonStats[] {
  const rows = parseCsvText(csvText);
  const out: HistoricalSeasonStats[] = [];

  for (const row of rows) {
    const playerName = cell(row, "Player").trim();
    if (!playerName) continue;
    const normalizedName = normalizePlayerName(playerName);
    if (!normalizedName) continue;

    const stats = emptyHistoricalSeasonStats(playerName, normalizedName, season, sourceAdapter);

    if (category === "passing") {
      stats.passingYards = parseOptionalInt(cell(row, "Pass Yds"));
      stats.passingAttempts = parseOptionalInt(cell(row, "Att"));
      stats.completions = parseOptionalInt(cell(row, "Cmp"));
      stats.passingTouchdowns = parseOptionalInt(cell(row, "TD"));
      stats.interceptions = parseOptionalInt(cell(row, "INT"));
    } else if (category === "rushing") {
      stats.rushingYards = parseOptionalInt(cell(row, "Rush Yds"));
      stats.rushingAttempts = parseOptionalInt(cell(row, "Att"));
      stats.rushingTouchdowns = parseOptionalInt(cell(row, "TD"));
    } else {
      stats.receptions = parseOptionalInt(cell(row, "Rec"));
      stats.receivingYards = parseOptionalInt(cell(row, "Yds"));
      stats.receivingTouchdowns = parseOptionalInt(cell(row, "TD"));
    }

    out.push(stats);
  }

  return out;
}
