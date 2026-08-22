/**
 * Destructive historical import wipes game sessions, picks, players,
 * franchises, eras, and related tables before rebuilding them.
 *
 * Local PGlite is allowed to reset freely. Any DATABASE_URL / Postgres target
 * requires an explicit opt-in so shared or production databases are not wiped
 * by accident.
 */

export type DataDatabaseKind = "postgres" | "pglite";

export const ALLOW_DESTRUCTIVE_DATA_IMPORT_ENV = "ALLOW_DESTRUCTIVE_DATA_IMPORT";

export function isDestructiveImportAllowed(
  kind: DataDatabaseKind,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (kind === "pglite") return true;
  return env[ALLOW_DESTRUCTIVE_DATA_IMPORT_ENV] === "1";
}

export function assertDestructiveImportAllowed(
  kind: DataDatabaseKind,
  env: Record<string, string | undefined> = process.env,
): void {
  if (isDestructiveImportAllowed(kind, env)) return;

  throw new Error(
    [
      "Refusing destructive historical import against DATABASE_URL / Postgres.",
      "This command deletes game sessions, picks, players, franchises, eras, and related tables before reloading.",
      `Local PGlite imports are allowed automatically; Postgres requires ${ALLOW_DESTRUCTIVE_DATA_IMPORT_ENV}=1.`,
      `Example: ${ALLOW_DESTRUCTIVE_DATA_IMPORT_ENV}=1 npm run data:import`,
    ].join("\n"),
  );
}
