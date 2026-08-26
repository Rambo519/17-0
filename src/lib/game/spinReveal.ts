import type { SpinResult } from "./spin";
import { pickVisualEra, pickVisualFranchise } from "./spinVisualPool";

export type SpinRevealKind = "full" | "team" | "era";

export interface SpinRevealFrame {
  abbreviation: string;
  franchiseName: string;
  eraLabel: string;
  teamLocked: boolean;
  eraLocked: boolean;
  showCandidates: boolean;
  cycling: boolean;
}

export const SPIN_REVEAL_TIMING = {
  /** Fast-API full spin: ~960 + 240 team lock, +280 era lock, +40 candidates ≈ 1.52s. */
  minCycleMs: 960,
  decelerateMs: 240,
  eraContinueMs: 280,
  candidateRevealDelayMs: 40,
  reducedMotionMs: 180,
  skipMinCycleMs: 280,
  skipDecelerateMs: 140,
  tickStartMs: 52,
  tickEndMs: 125,
} as const;

export interface HeldSpinDisplay {
  abbreviation: string;
  franchiseName: string;
  eraLabel: string;
}

export interface SpinRevealHooks {
  wait: (ms: number) => Promise<void>;
  now: () => number;
  rng: () => number;
  onFrame: (frame: SpinRevealFrame) => void;
  onTick?: () => void;
  onTeamLock?: () => void;
  onEraLock?: () => void;
  isCancelled?: () => boolean;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function frameFromResult(
  result: SpinResult,
  overrides: Partial<SpinRevealFrame> = {},
): SpinRevealFrame {
  return {
    abbreviation: result.franchise.abbreviation,
    franchiseName: result.franchise.name,
    eraLabel: result.era.label,
    teamLocked: true,
    eraLocked: true,
    showCandidates: false,
    cycling: false,
    ...overrides,
  };
}

function nextVisual(
  kind: SpinRevealKind,
  current: HeldSpinDisplay,
  rng: () => number,
): HeldSpinDisplay {
  let next = { ...current };
  if (kind !== "era") {
    const franchise = pickVisualFranchise(rng, current.abbreviation);
    next = { ...next, abbreviation: franchise.abbreviation, franchiseName: franchise.name };
  }
  if (kind !== "team") {
    next = { ...next, eraLabel: pickVisualEra(rng, current.eraLabel) };
  }
  return next;
}

function cyclingFrame(kind: SpinRevealKind, current: HeldSpinDisplay): SpinRevealFrame {
  return {
    ...current,
    teamLocked: kind === "era",
    eraLocked: kind === "team",
    showCandidates: false,
    cycling: true,
  };
}

async function cycleUntil(
  options: {
    kind: SpinRevealKind;
    durationMs: number;
    tickMs: number;
    held: HeldSpinDisplay;
  } & SpinRevealHooks,
): Promise<HeldSpinDisplay> {
  const started = options.now();
  let current = { ...options.held };
  let tickGap: number = options.tickMs;

  while (options.now() - started < options.durationMs) {
    if (options.isCancelled?.()) return current;

    current = nextVisual(options.kind, current, options.rng);
    options.onFrame(cyclingFrame(options.kind, current));
    options.onTick?.();

    const elapsed = options.now() - started;
    const remaining = options.durationMs - elapsed;
    await options.wait(Math.min(tickGap, Math.max(16, remaining)));
    tickGap = Math.min(
      SPIN_REVEAL_TIMING.tickEndMs,
      options.tickMs + (elapsed / options.durationMs) * (SPIN_REVEAL_TIMING.tickEndMs - options.tickMs),
    );
  }

  return current;
}

/**
 * Visual-only reveal. Does not call the backend; the caller starts the request
 * and passes the in-flight promise.
 */
export async function runSpinReveal(
  kind: SpinRevealKind,
  pendingResult: Promise<SpinResult>,
  hooks: SpinRevealHooks,
  options: { reducedMotion?: boolean; held?: HeldSpinDisplay } = {},
): Promise<SpinResult> {
  const held = options.held ?? {
    abbreviation: "DAL",
    franchiseName: "Dallas Cowboys",
    eraLabel: "1970s",
  };

  if (options.reducedMotion) {
    hooks.onFrame({
      ...held,
      teamLocked: false,
      eraLocked: false,
      showCandidates: false,
      cycling: false,
    });
    const result = await pendingResult;
    if (hooks.isCancelled?.()) return result;
    await hooks.wait(SPIN_REVEAL_TIMING.reducedMotionMs);
    hooks.onFrame(frameFromResult(result, { showCandidates: true }));
    if (kind !== "era") hooks.onTeamLock?.();
    if (kind !== "team") hooks.onEraLock?.();
    return result;
  }

  const minCycle =
    kind === "full" ? SPIN_REVEAL_TIMING.minCycleMs : SPIN_REVEAL_TIMING.skipMinCycleMs;
  const decelerate =
    kind === "full" ? SPIN_REVEAL_TIMING.decelerateMs : SPIN_REVEAL_TIMING.skipDecelerateMs;

  let result: SpinResult | undefined;
  let failure: unknown;
  const settled = pendingResult.then(
    (value) => {
      result = value;
      return value;
    },
    (err: unknown) => {
      failure = err;
    },
  );

  const started = hooks.now();
  let current = { ...held };
  let tickGap: number = SPIN_REVEAL_TIMING.tickStartMs;

  while (!hooks.isCancelled?.()) {
    if (failure) throw failure;
    const elapsed = hooks.now() - started;
    if (result && elapsed >= minCycle) break;

    current = nextVisual(kind, current, hooks.rng);
    hooks.onFrame(cyclingFrame(kind, current));
    hooks.onTick?.();

    await hooks.wait(tickGap);
    const progressed = hooks.now() - started;
    tickGap = Math.min(
      SPIN_REVEAL_TIMING.tickEndMs,
      SPIN_REVEAL_TIMING.tickStartMs +
        (progressed / minCycle) * (SPIN_REVEAL_TIMING.tickEndMs - SPIN_REVEAL_TIMING.tickStartMs),
    );
  }

  await settled;
  if (failure) throw failure;
  if (!result) {
    throw new Error("Spin reveal settled without a result.");
  }
  if (hooks.isCancelled?.()) return result;

  current = await cycleUntil({
    kind,
    durationMs: decelerate,
    tickMs: 78,
    held: current,
    ...hooks,
  });
  if (hooks.isCancelled?.()) return result;

  if (kind !== "era") {
    hooks.onFrame({
      abbreviation: result.franchise.abbreviation,
      franchiseName: result.franchise.name,
      eraLabel: kind === "team" ? result.era.label : current.eraLabel,
      teamLocked: true,
      eraLocked: kind === "team",
      showCandidates: false,
      cycling: kind !== "team",
    });
    hooks.onTeamLock?.();
  }

  if (kind !== "team") {
    if (kind === "full") {
      current = await cycleUntil({
        kind: "era",
        durationMs: SPIN_REVEAL_TIMING.eraContinueMs,
        tickMs: 92,
        held: {
          abbreviation: result.franchise.abbreviation,
          franchiseName: result.franchise.name,
          eraLabel: current.eraLabel,
        },
        ...hooks,
      });
      if (hooks.isCancelled?.()) return result;
    } else {
      await hooks.wait(40);
    }
    hooks.onFrame(frameFromResult(result));
    hooks.onEraLock?.();
  } else {
    hooks.onFrame(frameFromResult(result));
  }

  await hooks.wait(SPIN_REVEAL_TIMING.candidateRevealDelayMs);
  hooks.onFrame(frameFromResult(result, { showCandidates: true }));
  return result;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
