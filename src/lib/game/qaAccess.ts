/**
 * Temporary development-only QA controls (REROLL / BAL 2000s).
 * Unavailable whenever NODE_ENV is production — not a CSS hide.
 */
export function isDevelopmentQaEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== "production";
}
