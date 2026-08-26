import styles from "./spinPanel.module.css";
import shell from "./game.module.css";

import type { GameMode } from "@/lib/game/types";
import type { SpinResult } from "@/lib/game/spin";
import type { SpinRevealFrame } from "@/lib/game/spinReveal";
import { CandidateList } from "./CandidateList";
import { FranchiseEraReveal } from "./FranchiseEraReveal";
import { SkipControls } from "./SkipControls";

interface SpinPanelProps {
  mode: GameMode;
  spin: SpinResult | null;
  reveal: SpinRevealFrame | null;
  selectedCardId: number | null;
  teamSkipRemaining: number;
  eraSkipRemaining: number;
  busy: boolean;
  spinning: boolean;
  isComplete: boolean;
  onSpin: () => void;
  onTeamSkip: () => void;
  onEraSkip: () => void;
  onSelectCandidate: (cardId: number) => void;
}

export function SpinPanel({
  mode,
  spin,
  reveal,
  selectedCardId,
  teamSkipRemaining,
  eraSkipRemaining,
  busy,
  spinning,
  isComplete,
  onSpin,
  onTeamSkip,
  onEraSkip,
  onSelectCandidate,
}: SpinPanelProps) {
  const display = reveal
    ? {
        franchiseName: reveal.franchiseName,
        franchiseAbbreviation: reveal.abbreviation,
        eraLabel: reveal.eraLabel,
        cycling: reveal.cycling,
        teamLocked: reveal.teamLocked,
        eraLocked: reveal.eraLocked,
      }
    : spin
      ? {
          franchiseName: spin.franchise.name,
          franchiseAbbreviation: spin.franchise.abbreviation,
          eraLabel: spin.era.label,
          cycling: false,
          teamLocked: true,
          eraLocked: true,
        }
      : null;

  const showSpinButton = !isComplete && (!spin || spinning);
  const showCandidates = Boolean(spin && (reveal?.showCandidates ?? true) && !spinning);
  const showSkips = Boolean(spin && display && !isComplete);

  return (
    <section className={`${shell.panel} ${styles.root}`} aria-label="Draft draw">
      <div className={styles.controls}>
        {showSpinButton ? (
          <button
            type="button"
            className={spinning ? `${shell.btnSpin} ${shell.btnSpinBusy}` : shell.btnSpin}
            onClick={onSpin}
            disabled={busy || spinning || isComplete}
            aria-busy={spinning}
          >
            {spinning ? "Spinning..." : "Spin"}
          </button>
        ) : null}

        {display ? (
          <>
            <FranchiseEraReveal
              franchiseName={display.franchiseName}
              franchiseAbbreviation={display.franchiseAbbreviation}
              eraLabel={display.eraLabel}
              cycling={display.cycling}
              teamLocked={display.teamLocked}
              eraLocked={display.eraLocked}
            />
            {showSkips ? (
              <SkipControls
                teamSkipRemaining={teamSkipRemaining}
                eraSkipRemaining={eraSkipRemaining}
                disabled={!spin || isComplete || spinning}
                busy={busy || spinning}
                onTeamSkip={onTeamSkip}
                onEraSkip={onEraSkip}
              />
            ) : null}
          </>
        ) : null}

        {!display && !isComplete ? (
          <p className={styles.hint}>Spin a franchise and era, then draft one eligible player.</p>
        ) : null}
      </div>

      {showCandidates && spin ? (
        <CandidateList
          candidates={spin.candidates}
          mode={mode}
          selectedCardId={selectedCardId}
          reveal
          onSelect={onSelectCandidate}
        />
      ) : spinning ? (
        <p className={styles.pending} role="status">
          Locking the draw...
        </p>
      ) : null}
    </section>
  );
}
