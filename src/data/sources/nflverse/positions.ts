import { normalizePosition } from "@/lib/football/normalizePosition";
import type { NormalizedPosition } from "@/lib/football/positions";

/**
 * Resolve skill-position eligibility from a roster row.
 *
 * `position` is preserved as the raw historical label.
 * `depth_chart_position` is an additional source signal (critical for FB,
 * which nflverse often encodes as position=RB, depth_chart_position=FB).
 */

export function collectRawPositionLabels(input: {
  position: string | null | undefined;
  depthChartPosition: string | null | undefined;
}): string[] {
  const labels: string[] = [];
  const position = input.position?.trim();
  const depth = input.depthChartPosition?.trim();
  if (position) labels.push(position);
  if (depth && depth.toUpperCase() !== position?.toUpperCase()) labels.push(depth);
  return labels;
}

export function normalizeRosterPositions(input: {
  position: string | null | undefined;
  depthChartPosition: string | null | undefined;
}): {
  rawPosition: string;
  automatic: NormalizedPosition[];
  primary: NormalizedPosition | null;
  unmappedLabels: string[];
} {
  const labels = collectRawPositionLabels(input);
  const rawPosition = (input.position?.trim() || input.depthChartPosition?.trim() || "").toUpperCase();
  const automatic: NormalizedPosition[] = [];
  const unmappedLabels: string[] = [];

  for (const label of labels) {
    const normalized = normalizePosition(label);
    if (normalized) {
      if (!automatic.includes(normalized)) automatic.push(normalized);
    } else if (label.trim()) {
      unmappedLabels.push(label.trim().toUpperCase());
    }
  }

  const primary =
    normalizePosition(input.position) ??
    normalizePosition(input.depthChartPosition) ??
    automatic[0] ??
    null;

  return { rawPosition, automatic, primary, unmappedLabels };
}

export function isSkillEligibleRosterRow(input: {
  position: string | null | undefined;
  depthChartPosition: string | null | undefined;
}): boolean {
  return normalizeRosterPositions(input).automatic.length > 0;
}
