/** Short SHA shown in the landing footer. Local/dev builds use this label. */
export const LOCAL_APP_VERSION = "dev";

/**
 * Deployed version from Vercel’s git SHA (build time), shortened to 7 chars.
 * Empty or missing SHA falls back so `next dev` still renders.
 */
export function deployedAppVersion(
  sha: string | undefined = process.env.VERCEL_GIT_COMMIT_SHA,
): string {
  const normalized = sha?.trim() ?? "";
  if (!normalized) return LOCAL_APP_VERSION;
  return normalized.slice(0, 7);
}

export function copyrightYear(now: Date = new Date()): number {
  return now.getFullYear();
}
