import styles from "./formationField.module.css";

import type { LineupSlot } from "@/lib/football/positions";
import type { LineupSlotView } from "@/lib/game/view";
import { FormationSlot } from "./FormationSlot";

interface FormationFieldProps {
  lineup: LineupSlotView[];
  highlightedSlots: readonly LineupSlot[];
  onSelectSlot: (slot: LineupSlot) => void;
}

function slotMap(lineup: LineupSlotView[]) {
  return Object.fromEntries(lineup.map((entry) => [entry.slot, entry])) as Record<
    LineupSlot,
    LineupSlotView
  >;
}

export function FormationField({
  lineup,
  highlightedSlots,
  onSelectSlot,
}: FormationFieldProps) {
  const bySlot = slotMap(lineup);
  const highlighted = new Set(highlightedSlots);

  function render(slot: LineupSlot) {
    const view = bySlot[slot];
    const isHighlighted = highlighted.has(slot);
    return (
      <FormationSlot
        key={slot}
        slotView={view}
        highlighted={isHighlighted}
        selectable={isHighlighted}
        onSelect={onSelectSlot}
      />
    );
  }

  return (
    <section className={styles.root} aria-label="Pro-set lineup">
      <div className={styles.field}>
        <div className={styles.yardLines} aria-hidden />
        <div className={styles.rowWide}>
          {render("WR1")}
          <div className={styles.spacer} />
          {render("WR2")}
        </div>
        <div className={styles.rowCenter}>{render("TE")}</div>
        <div className={styles.rowCenter}>{render("QB")}</div>
        <div className={styles.rowBackfield}>
          {render("RB1")}
          {render("RB2")}
        </div>
      </div>
    </section>
  );
}
