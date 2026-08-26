import styles from "./franchiseEraReveal.module.css";

interface FranchiseEraRevealProps {
  franchiseName: string;
  franchiseAbbreviation: string;
  eraLabel: string;
  cycling?: boolean;
  teamLocked?: boolean;
  eraLocked?: boolean;
}

export function FranchiseEraReveal({
  franchiseName,
  franchiseAbbreviation,
  eraLabel,
  cycling = false,
  teamLocked = false,
  eraLocked = false,
}: FranchiseEraRevealProps) {
  const teamClass = teamLocked ? styles.teamLocked : cycling ? styles.teamCycling : styles.team;
  const eraClass = eraLocked ? styles.eraLocked : cycling ? styles.eraCycling : styles.eraBox;

  return (
    <div className={styles.root}>
      <div className={teamClass}>
        <p className={styles.kicker}>Team</p>
        <p key={franchiseAbbreviation} className={styles.abbr}>
          {franchiseAbbreviation}
        </p>
      </div>
      <div className={eraClass}>
        <p className={styles.kicker}>Era</p>
        <p key={eraLabel} className={styles.era}>
          {eraLabel}
        </p>
      </div>
      {teamLocked && eraLocked ? (
        <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
          {franchiseName}, {eraLabel}
        </p>
      ) : null}
    </div>
  );
}
