import { useMemo, useState } from "react";

import styles from "./candidateList.module.css";

import type { GameMode } from "@/lib/game/types";
import type { SpinCandidate } from "@/lib/game/spin";
import {
  availableCandidatePositions,
  filterSpinCandidates,
  type CandidatePositionFilter,
} from "@/lib/game/uiHelpers";
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
  const candidateKey = candidates.map((candidate) => candidate.card.cardId).join(",");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<CandidatePositionFilter>("ALL");
  const [seenKey, setSeenKey] = useState(candidateKey);

  if (seenKey !== candidateKey) {
    setSeenKey(candidateKey);
    setQuery("");
    setPosition("ALL");
  }

  const availablePositions = useMemo(
    () => availableCandidatePositions(candidates),
    [candidates],
  );
  const activePosition =
    position !== "ALL" && !availablePositions.includes(position) ? "ALL" : position;

  const filtered = useMemo(
    () => filterSpinCandidates(candidates, { query, position: activePosition }),
    [candidates, query, activePosition],
  );

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="toolbar" aria-label="Position filter">
          <button
            type="button"
            className={activePosition === "ALL" ? styles.chipActive : styles.chip}
            aria-pressed={activePosition === "ALL"}
            onClick={() => setPosition("ALL")}
          >
            ALL
          </button>
          {availablePositions.map((value) => (
            <button
              key={value}
              type="button"
              className={activePosition === value ? styles.chipActive : styles.chip}
              aria-pressed={activePosition === value}
              onClick={() => setPosition(value)}
            >
              {value}
            </button>
          ))}
        </div>
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
      {filtered.length === 0 ? <p className={styles.empty}>No matching players.</p> : null}
    </div>
  );
}
