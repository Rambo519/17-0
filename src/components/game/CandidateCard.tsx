import styles from "./candidateCard.module.css";

import type { GameMode } from "@/lib/game/types";
import type { SpinCandidate } from "@/lib/game/spin";
import {
  classicProductionStats,
  shouldShowClassicStats,
  yearsWithFranchiseLabel,
} from "@/lib/game/uiHelpers";

interface CandidateCardProps {
  candidate: SpinCandidate;
  mode: GameMode;
  selected: boolean;
  onSelect: () => void;
}

export function CandidateCard({ candidate, mode, selected, onSelect }: CandidateCardProps) {
  const { card, eligibleSlots } = candidate;
  const showStats = shouldShowClassicStats(mode);
  const stats = showStats ? classicProductionStats(card.positions, card.production) : null;

  return (
    <button
      type="button"
      className={selected ? styles.selected : styles.root}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className={styles.top}>
        <span className={styles.name}>{card.playerName}</span>
        <span className={styles.positions}>{card.positions.join(" · ")}</span>
      </div>
      <p className={styles.slots}>Can fill: {eligibleSlots.join(", ")}</p>
      <p className={styles.years}>{yearsWithFranchiseLabel(card.firstSeason, card.lastSeason)}</p>
      {stats ? (
        <dl className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </button>
  );
}
