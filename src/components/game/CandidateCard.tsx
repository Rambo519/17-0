import styles from "./candidateCard.module.css";

import type { SpinCandidate } from "@/lib/game/spin";
import { formatPlayerDisplayName } from "@/lib/game/playerName";
import type { GameMode } from "@/lib/game/types";
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
  const years = yearsWithFranchiseLabel(card.firstSeason, card.lastSeason);

  return (
    <button
      type="button"
      className={`${selected ? styles.selected : styles.root}${stats ? ` ${styles.withStats}` : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={styles.player}>
        <span className={styles.name}>{formatPlayerDisplayName(card.playerName)}</span>
        <span className={styles.meta}>
          <span className={styles.identity}>
            {card.positions.join(" · ")}
            <span aria-hidden> | </span>
            {years}
          </span>
          <span className={styles.slots}> - Can Fill: {eligibleSlots.join(", ")}</span>
        </span>
      </span>
      {stats ? (
        <span className={styles.statZone}>
          <dl className={styles.stats}>
            {stats.map((stat) => (
              <div key={stat.label} className={styles.stat}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </span>
      ) : null}
    </button>
  );
}
