import { useMemo, useState } from "react";

import styles from "./candidateList.module.css";

import type { GameMode } from "@/lib/game/types";
import type { SpinCandidate } from "@/lib/game/spin";
import { formatPlayerDisplayName } from "@/lib/game/playerName";
import { CandidateCard } from "./CandidateCard";

interface CandidateListProps {
  candidates: SpinCandidate[];
  mode: GameMode;
  selectedCardId: number | null;
  reveal?: boolean;
  onSelect: (cardId: number) => void;
}

export function CandidateList({
  candidates,
  mode,
  selectedCardId,
  reveal = false,
  onSelect,
}: CandidateListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((candidate) => {
      const stored = candidate.card.playerName.toLowerCase();
      const displayed = formatPlayerDisplayName(candidate.card.playerName).toLowerCase();
      return stored.includes(q) || displayed.includes(q);
    });
  }, [candidates, query]);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <label className={styles.searchLabel} htmlFor="candidate-search">
          Find player
        </label>
        <input
          id="candidate-search"
          className={styles.search}
          type="search"
          placeholder="Filter by name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className={styles.count}>
          {filtered.length} of {candidates.length}
        </p>
      </div>
      <ul className={styles.list}>
        {filtered.map((candidate, index) => (
          <li
            key={candidate.card.cardId}
            className={reveal ? styles.stagger : undefined}
            style={reveal ? { animationDelay: `${Math.min(index, 8) * 55}ms` } : undefined}
          >
            <CandidateCard
              candidate={candidate}
              mode={mode}
              selected={selectedCardId === candidate.card.cardId}
              onSelect={() => onSelect(candidate.card.cardId)}
            />
          </li>
        ))}
      </ul>
      {filtered.length === 0 ? <p className={styles.empty}>No players match that name.</p> : null}
    </div>
  );
}
