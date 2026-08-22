import styles from "./formationSlot.module.css";

import type { LineupSlot } from "@/lib/football/positions";
import type { LineupSlotView } from "@/lib/game/view";
import { slotDisplayLabel } from "@/lib/game/uiHelpers";

interface FormationSlotProps {
  slotView: LineupSlotView;
  highlighted: boolean;
  selectable: boolean;
  onSelect: (slot: LineupSlot) => void;
}

export function FormationSlot({
  slotView,
  highlighted,
  selectable,
  onSelect,
}: FormationSlotProps) {
  const label = slotDisplayLabel(slotView.slot);
  const player = slotView.player;

  if (slotView.filled && player) {
    return (
      <div className={styles.filled} aria-label={`${label} filled by ${player.playerName}`}>
        <span className={styles.pos}>{label}</span>
        <span className={styles.player}>{player.playerName}</span>
        <span className={styles.meta}>
          {player.franchiseAbbreviation}
          <span aria-hidden> · </span>
          {player.eraLabel}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={highlighted ? styles.highlight : styles.empty}
      disabled={!selectable}
      onClick={() => onSelect(slotView.slot)}
      aria-label={`${label} empty${highlighted ? ", eligible for selected player" : ""}`}
    >
      <span className={styles.pos}>{label}</span>
    </button>
  );
}
