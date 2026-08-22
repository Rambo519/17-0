import styles from "./gameProgress.module.css";

interface GameProgressProps {
  filledCount: number;
}

export function GameProgress({ filledCount }: GameProgressProps) {
  return (
    <ol className={styles.root} aria-label={`${filledCount} of 6 picks filled`}>
      {Array.from({ length: 6 }, (_, index) => {
        const filled = index < filledCount;
        return (
          <li
            key={index}
            className={filled ? styles.filled : styles.empty}
            aria-label={filled ? `Pick ${index + 1} complete` : `Pick ${index + 1} open`}
          />
        );
      })}
    </ol>
  );
}
