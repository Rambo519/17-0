import { comparePlayerNames } from "@/lib/game/playerName";
import type { SpinCandidate } from "@/lib/game/spin";

/** Stable IQ ordering: first name, then last name, then card id. */
export function sortCandidatesAlphabetically(
  candidates: readonly SpinCandidate[],
): SpinCandidate[] {
  return [...candidates].sort((left, right) => {
    const byName = comparePlayerNames(left.card.playerName, right.card.playerName);
    if (byName !== 0) return byName;
    return left.card.cardId - right.card.cardId;
  });
}
