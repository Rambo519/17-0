import styles from "./spinPanel.module.css";
import shell from "./game.module.css";

import type { GameMode } from "@/lib/game/types";
import type { SpinResult } from "@/lib/game/spin";
import { CandidateList } from "./CandidateList";
import { FranchiseEraReveal } from "./FranchiseEraReveal";
import { SkipControls } from "./SkipControls";

interface SpinPanelProps {
  mode: GameMode;
  spin: SpinResult | null;
  selectedCardId: number | null;
  teamSkipRemaining: number;
  eraSkipRemaining: number;
  busy: boolean;
  revealing: boolean;
  isComplete: boolean;
  onSpin: () => void;
  onTeamSkip: () => void;
  onEraSkip: () => void;
  onSelectCandidate: (cardId: number) => void;
}

export function SpinPanel({
  mode,
  spin,
  selectedCardId,
  teamSkipRemaining,
  eraSkipRemaining,
  busy,
  revealing,
  isComplete,
  onSpin,
  onTeamSkip,
  onEraSkip,
  onSelectCandidate,
}: SpinPanelProps) {
  const hasSpin = Boolean(spin);

  return (
    <section className={`${shell.panel} ${styles.root}`} aria-label="Draft draw">
      <div className={styles.controls}>
        {!hasSpin && !isComplete ? (
          <button
            type="button"
            className={shell.btnSpin}
            onClick={onSpin}
            disabled={busy || isComplete}
          >
            {busy ? "Spinning…" : "Spin"}
          </button>
        ) : null}

        {hasSpin && spin ? (
          <>
            <FranchiseEraReveal
              franchiseName={spin.franchise.name}
              franchiseAbbreviation={spin.franchise.abbreviation}
              eraLabel={spin.era.label}
              revealing={revealing}
            />
            <SkipControls
              teamSkipRemaining={teamSkipRemaining}
              eraSkipRemaining={eraSkipRemaining}
              disabled={!hasSpin || isComplete}
              busy={busy}
              onTeamSkip={onTeamSkip}
              onEraSkip={onEraSkip}
            />
          </>
        ) : null}

        {!hasSpin && !isComplete ? (
          <p className={styles.hint}>Spin a franchise and era, then draft one eligible player.</p>
        ) : null}
      </div>

      {hasSpin && spin ? (
        <CandidateList
          candidates={spin.candidates}
          mode={mode}
          selectedCardId={selectedCardId}
          onSelect={onSelectCandidate}
        />
      ) : null}
    </section>
  );
}
