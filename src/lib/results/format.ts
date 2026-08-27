import type { DataConfidence, MetricKey } from "@/lib/scoring/types";

const METRIC_LABELS: Readonly<Record<MetricKey, string>> = {
  passing_yards: "Pass Yds",
  passing_touchdowns: "Pass TD",
  interceptions: "INT",
  rushing_yards: "Rush Yds",
  rushing_touchdowns: "Rush TD",
  receptions: "Rec",
  receiving_yards: "Rec Yds",
  receiving_touchdowns: "Rec TD",
};

export function formatProjectedRecord(wins: number, losses: number): string {
  return `${wins}–${losses}`;
}

export function formatOffenseRating(rating: number): string {
  return rating.toFixed(1);
}

export function formatExpectedWins(expectedWins: number): string {
  return expectedWins.toFixed(1);
}

/**
 * Format a 0–1 probability as a percentage without collapsing tiny values to 0%.
 * Presentation only — never feed this rounded string back into win-curve math.
 */
export function formatProbability(probability: number): string {
  if (!Number.isFinite(probability) || probability <= 0) return "0%";
  if (probability >= 1) return "100%";

  const pct = probability * 100;
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct >= 0.1) return `${pct.toFixed(2)}%`;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  if (pct >= 0.001) return `${pct.toFixed(3)}%`;
  if (pct >= 0.0001) return `${pct.toFixed(4)}%`;
  return `${pct.toExponential(1)}%`;
}

/** Win probability on the results page (one decimal at typical values). */
export function formatWinProbability(perGameWinProbability: number): string {
  return formatProbability(perGameWinProbability);
}

/**
 * 17-0 chance. Pass the engine's perfectSeasonProbability, never a
 * display-rounded win probability such as 0.966 from "96.6%".
 */
export function formatPerfectSeasonChance(perfectSeasonProbability: number): string {
  return formatProbability(perfectSeasonProbability);
}

export function formatConfidence(confidence: DataConfidence): string {
  if (confidence === "HIGH") return "High";
  if (confidence === "MEDIUM") return "Medium";
  return "Low";
}

export function formatPlayerRating(rating: number): string {
  return rating.toFixed(1);
}

export function formatScoringSeason(season: number | null): string {
  return season == null ? "—" : String(season);
}

export function metricLabel(key: MetricKey): string {
  return METRIC_LABELS[key] ?? key;
}

export function formatMetricValue(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US");
}

export function formatPercentile(percentile: number | null): string {
  if (percentile == null) return "—";
  const rounded = Math.round(percentile);
  const rem = rounded % 100;
  if (rem >= 11 && rem <= 13) return `${rounded}th`;
  switch (rounded % 10) {
    case 1:
      return `${rounded}st`;
    case 2:
      return `${rounded}nd`;
    case 3:
      return `${rounded}rd`;
    default:
      return `${rounded}th`;
  }
}
