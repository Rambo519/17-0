import { version as packageVersion } from "../../package.json";

/** Semver from package.json. Bump that field to update the landing footer. */
export const APP_RELEASE_VERSION: string = packageVersion;

/** Short SHA shown in the landing footer. Local/dev builds use this label. */
export const LOCAL_BUILD_ID = "dev";

export function formatReleaseLabel(version: string = APP_RELEASE_VERSION): string {
  return `v${version}`;
}

/**
 * Deployed build id from Vercel’s git SHA (build time), shortened to 7 chars.
 * Empty or missing SHA falls back so `next dev` still renders.
 */
export function deployedAppVersion(
  sha: string | undefined = process.env.VERCEL_GIT_COMMIT_SHA,
): string {
  const normalized = sha?.trim() ?? "";
  if (!normalized) return LOCAL_BUILD_ID;
  return normalized.slice(0, 7);
}

export function copyrightYear(now: Date = new Date()): number {
  return now.getFullYear();
}
