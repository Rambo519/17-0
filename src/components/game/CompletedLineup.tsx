import styles from "./completedLineup.module.css";
import shell from "./game.module.css";

import type { LineupSlotView } from "@/lib/game/view";
import { FormationField } from "./FormationField";

interface CompletedLineupProps {
  lineup: LineupSlotView[];
  onNewGame: () => void;
  onViewResults: () => void;
  viewResultsDisabled?: boolean;
}

export function CompletedLineup({
  lineup,
  onNewGame,
  onViewResults,
  viewResultsDisabled = false,
}: CompletedLineupProps) {
  return (
    <section className={styles.root} aria-labelledby="complete-heading">
      <div className={styles.banner}>
        <p className={styles.kicker}>Lineup locked</p>
        <h2 id="complete-heading" className={styles.title}>
          Offense Complete
        </h2>
        <p className={styles.copy}>Six historical pieces. See how the season projects.</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={shell.btnPrimary}
            onClick={onViewResults}
            disabled={viewResultsDisabled}
          >
            View Results
          </button>
          <button type="button" className={shell.btnGhost} onClick={onNewGame}>
            Play Again
          </button>
        </div>
      </div>
      <FormationField lineup={lineup} highlightedSlots={[]} onSelectSlot={() => undefined} />
    </section>
  );
}
