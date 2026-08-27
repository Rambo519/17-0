import { chooseSpinCombination, type Rng, type SpinCombination } from "@/lib/game/spin";

export function spinCombinationKey(combination: {
  franchiseAbbreviation: string;
  eraLabel: string;
}): string {
  return `${combination.franchiseAbbreviation}:${combination.eraLabel}`;
}

export function simulateSpinSelection(
  combinations: readonly SpinCombination[],
  draws: number,
  rng: Rng = Math.random,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const combination of combinations) {
    counts.set(spinCombinationKey(combination), 0);
  }

  for (let index = 0; index < draws; index += 1) {
    const chosen = chooseSpinCombination(combinations, rng);
    const key = spinCombinationKey(chosen);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

export function summarizeCounts(counts: ReadonlyMap<string, number>): {
  min: number;
  max: number;
  mean: number;
  top: Array<[string, number]>;
  bottom: Array<[string, number]>;
} {
  const entries = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const values = entries.map((entry) => entry[1]);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.length === 0 ? 0 : total / values.length,
    top: entries.slice(0, 10),
    bottom: [...entries].reverse().slice(0, 10),
  };
}

/** Deterministic RNG for audit reproducibility. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
