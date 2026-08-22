import styles from "./completedLineup.module.css";
import shell from "./game.module.css";

import type { LineupSlotView } from "@/lib/game/view";
import { FormationField } from "./FormationField";

interface CompletedLineupProps {
  lineup: LineupSlotView[];
  onNewGame: () => void;
  onViewResults: () => void;
  showResultsTeaser: boolean;
}

export function CompletedLineup({
  lineup,
  onNewGame,
  onViewResults,
  showResultsTeaser,
}: CompletedLineupProps) {
  return (
    <section className={styles.root} aria-labelledby="complete-heading">
      <div className={styles.banner}>
        <p className={styles.kicker}>Lineup locked</p>
        <h2 id="complete-heading" className={styles.title}>
          Offense Complete
        </h2>
        <p className={styles.copy}>Six historical pieces. Results scoring arrives in Phase 5.</p>
        <div className={styles.actions}>
          <button type="button" className={shell.btnPrimary} onClick={onViewResults}>
            View Results
          </button>
          <button type="button" className={shell.btnGhost} onClick={onNewGame}>
            New Game
          </button>
        </div>
        {showResultsTeaser ? (
          <p className={styles.teaser} role="status">
            Results coming in Phase 5.
          </p>
        ) : null}
      </div>
      <FormationField lineup={lineup} highlightedSlots={[]} onSelectSlot={() => undefined} />
    </section>
  );
}
