import styles from "./fieldDecor.module.css";

interface FieldDecorProps {
  variant: "start" | "ready";
}

export function FieldDecor({ variant }: FieldDecorProps) {
  return (
    <div className={variant === "start" ? styles.start : styles.ready} aria-hidden>
      <div className={styles.grid} />
      <div className={styles.hashes} />
      <div className={styles.goalpost}>
        <span className={styles.upright} />
        <span className={styles.crossbar} />
        <span className={styles.upright} />
      </div>
      <div className={styles.laces} />
    </div>
  );
}
