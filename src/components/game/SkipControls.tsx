import styles from "./skipControls.module.css";

interface SkipControlsProps {
  teamSkipRemaining: number;
  eraSkipRemaining: number;
  disabled: boolean;
  busy: boolean;
  onTeamSkip: () => void;
  onEraSkip: () => void;
}

export function SkipControls({
  teamSkipRemaining,
  eraSkipRemaining,
  disabled,
  busy,
  onTeamSkip,
  onEraSkip,
}: SkipControlsProps) {
  return (
    <div className={styles.root}>
      <SkipButton
        title="Team Skip"
        detail="Keep the era. Draw a different franchise."
        remaining={teamSkipRemaining}
        disabled={disabled || busy || teamSkipRemaining <= 0}
        onClick={onTeamSkip}
      />
      <SkipButton
        title="Era Skip"
        detail="Keep the franchise. Draw a different decade."
        remaining={eraSkipRemaining}
        disabled={disabled || busy || eraSkipRemaining <= 0}
        onClick={onEraSkip}
      />
    </div>
  );
}

function SkipButton({
  title,
  detail,
  remaining,
  disabled,
  onClick,
}: {
  title: string;
  detail: string;
  remaining: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const used = remaining <= 0;
  return (
    <button type="button" className={used ? styles.used : styles.btn} disabled={disabled} onClick={onClick}>
      <span className={styles.title}>{title}</span>
      <span className={styles.detail}>{detail}</span>
      <span className={styles.remaining}>{used ? "Used" : `${remaining} remaining`}</span>
    </button>
  );
}
