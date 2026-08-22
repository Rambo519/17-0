import { useMemo, useState } from "react";

import styles from "./candidateList.module.css";

import type { GameMode } from "@/lib/game/types";
import type { SpinCandidate } from "@/lib/game/spin";
import { CandidateCard } from "./CandidateCard";

interface CandidateListProps {
  candidates: SpinCandidate[];
  mode: GameMode;
  selectedCardId: number | null;
  onSelect: (cardId: number) => void;
}

export function CandidateList({
  candidates,
  mode,
  selectedCardId,
  onSelect,
}: CandidateListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((candidate) => candidate.card.playerName.toLowerCase().includes(q));
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
        {filtered.map((candidate) => (
          <li key={candidate.card.cardId}>
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
