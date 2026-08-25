import styles from "./resultsView.module.css";
import shell from "./game.module.css";

import { LINEUP_SLOTS } from "@/lib/football/positions";
import type { GameMode } from "@/lib/game/types";
import type { GameStateView, LineupSlotView } from "@/lib/game/view";
import {
  formatConfidence,
  formatExpectedWins,
  formatMetricValue,
  formatOffenseRating,
  formatPercentile,
  formatPlayerRating,
  formatProbability,
  formatProjectedRecord,
  formatScoringSeason,
  metricLabel,
} from "@/lib/results/format";
import { isPerfectProjectedSeason, resultTierFromProjectedWins } from "@/lib/results/tiers";
import type { ScoringResultView } from "@/lib/scoring/view";
import { FormationField } from "./FormationField";

interface ResultsViewProps {
  game: GameStateView;
  score: ScoringResultView | null;
  scoreStatus: "loading" | "error" | "ready";
  errorMessage: string | null;
  onRetry: () => void;
  onPlayAgain: () => void;
  onBackToLineup: () => void;
  retryDisabled?: boolean;
}

function scoredPlayerForSlot(score: ScoringResultView, slot: LineupSlotView["slot"]) {
  return score.players.find((player) => player.lineupSlot === slot) ?? null;
}

function PlayerBreakdown({
  lineup,
  score,
  mode,
}: {
  lineup: LineupSlotView[];
  score: ScoringResultView;
  mode: GameMode;
}) {
  const bySlot = new Map(lineup.map((entry) => [entry.slot, entry]));

  return (
    <section className={styles.breakdown} aria-labelledby="breakdown-heading">
      <h3 id="breakdown-heading" className={styles.breakdownTitle}>
        Lineup
      </h3>
      <ol className={styles.playerList}>
        {LINEUP_SLOTS.map((slot) => {
          const view = bySlot.get(slot);
          const scored = scoredPlayerForSlot(score, slot);
          const player = view?.player;
          if (!player || !scored) return null;

          return (
            <li key={slot} className={styles.player}>
              <div className={styles.playerTop}>
                <span className={styles.playerName}>
                  {slot === "WR1" || slot === "WR2" ? "WR" : slot} {scored.playerName}
                </span>
                <span className={styles.playerRating}>{formatPlayerRating(scored.overall)}</span>
              </div>
              <p className={styles.playerMeta}>
                {player.franchiseName}
                <span aria-hidden> · </span>
                {player.eraLabel}
                <span aria-hidden> · </span>
                Season {formatScoringSeason(scored.scoringSeason)}
                <span aria-hidden> · </span>
                {formatConfidence(scored.dataConfidence)} confidence
              </p>
              {mode === "CLASSIC" && scored.metrics.length > 0 ? (
                <details className={styles.details}>
                  <summary>Season production</summary>
                  <div className={styles.metricRows}>
                    {scored.metrics.map((metric) => (
                      <div key={metric.key} className={styles.metricRow}>
                        <span>{metricLabel(metric.key)}</span>
                        <span>
                          {formatMetricValue(metric.rawValue)}
                          {metric.percentile != null ? ` · ${formatPercentile(metric.percentile)}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function ResultsView({
  game,
  score,
  scoreStatus,
  errorMessage,
  onRetry,
  onPlayAgain,
  onBackToLineup,
  retryDisabled = false,
}: ResultsViewProps) {
  const perfect = score ? isPerfectProjectedSeason(score.projectedWins) : false;
  const tier = score ? resultTierFromProjectedWins(score.projectedWins) : null;

  return (
    <div className={styles.root}>
      {scoreStatus === "ready" && score ? (
        <section
          className={perfect ? styles.heroJackpot : styles.hero}
          aria-labelledby="projected-record-heading"
        >
          <p className={styles.kicker}>{game.mode === "IQ" ? "IQ results" : "Classic results"}</p>
          <p className={styles.tier}>{tier?.label}</p>
          <h1 id="projected-record-heading" className={styles.recordLabel}>
            Projected Record
          </h1>
          <p className={perfect ? `${styles.record} ${styles.recordJackpot}` : styles.record}>
            {formatProjectedRecord(score.projectedWins, score.projectedLosses)}
          </p>
          {perfect ? <p className={styles.jackpotMark}>16 &amp; 0</p> : null}
        </section>
      ) : (
        <section className={styles.statusCard} aria-live="polite">
          {scoreStatus === "loading" ? (
            <p className={styles.statusCopy}>Calculating season...</p>
          ) : (
            <>
              <p className={styles.errorCopy}>{errorMessage ?? "Could not calculate this season."}</p>
              <div className={styles.retry}>
                <button
                  type="button"
                  className={shell.btnPrimary}
                  onClick={onRetry}
                  disabled={retryDisabled}
                >
                  Try Again
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {scoreStatus === "ready" && score ? (
        <dl className={styles.metrics}>
          <div className={styles.metric}>
            <dt>Offense Rating</dt>
            <dd>{formatOffenseRating(score.offenseRating)}</dd>
          </div>
          <div className={styles.metric}>
            <dt>Expected Wins</dt>
            <dd>{formatExpectedWins(score.expectedWins)}</dd>
          </div>
          <div className={styles.metric}>
            <dt>Win Probability</dt>
            <dd>{formatProbability(score.perGameWinProbability)}</dd>
          </div>
          <div className={styles.metric}>
            <dt>16–0 Chance</dt>
            <dd>{formatProbability(score.perfectSeasonProbability)}</dd>
          </div>
          <div className={styles.metric}>
            <dt>Team Data Confidence</dt>
            <dd>{formatConfidence(score.dataConfidence)}</dd>
          </div>
        </dl>
      ) : null}

      <FormationField lineup={game.lineup} highlightedSlots={[]} onSelectSlot={() => undefined} />

      {scoreStatus === "ready" && score ? (
        <PlayerBreakdown lineup={game.lineup} score={score} mode={game.mode} />
      ) : null}

      <div className={styles.actions}>
        <button type="button" className={shell.btnPrimary} onClick={onPlayAgain}>
          Play Again
        </button>
        <button type="button" className={shell.btnGhost} onClick={onBackToLineup}>
          Back to Lineup
        </button>
      </div>
    </div>
  );
}
