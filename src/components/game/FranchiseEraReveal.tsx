import styles from "./franchiseEraReveal.module.css";

interface FranchiseEraRevealProps {
  franchiseName: string;
  franchiseAbbreviation: string;
  eraLabel: string;
  revealing?: boolean;
}

export function FranchiseEraReveal({
  franchiseName,
  franchiseAbbreviation,
  eraLabel,
  revealing = false,
}: FranchiseEraRevealProps) {
  return (
    <div className={revealing ? styles.rootReveal : styles.root} aria-live="polite">
      <p className={styles.abbr}>{franchiseAbbreviation}</p>
      <h2 className={styles.name}>{franchiseName}</h2>
      <p className={styles.era}>{eraLabel}</p>
    </div>
  );
}
