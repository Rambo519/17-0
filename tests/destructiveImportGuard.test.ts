import { describe, expect, it } from "vitest";

import {
  ALLOW_DESTRUCTIVE_DATA_IMPORT_ENV,
  assertDestructiveImportAllowed,
  isDestructiveImportAllowed,
} from "@/data/safety/destructiveImport";

describe("destructive import guard", () => {
  it("allows PGlite without an opt-in flag", () => {
    expect(isDestructiveImportAllowed("pglite", {})).toBe(true);
    expect(() => assertDestructiveImportAllowed("pglite", {})).not.toThrow();
  });

  it("blocks Postgres/DATABASE_URL without explicit opt-in", () => {
    expect(isDestructiveImportAllowed("postgres", {})).toBe(false);
    expect(() => assertDestructiveImportAllowed("postgres", {})).toThrow(
      /ALLOW_DESTRUCTIVE_DATA_IMPORT=1/,
    );
  });

  it("allows Postgres when ALLOW_DESTRUCTIVE_DATA_IMPORT=1", () => {
    const env = { [ALLOW_DESTRUCTIVE_DATA_IMPORT_ENV]: "1" };
    expect(isDestructiveImportAllowed("postgres", env)).toBe(true);
    expect(() => assertDestructiveImportAllowed("postgres", env)).not.toThrow();
  });

  it("does not treat other truthy values as opt-in", () => {
    expect(isDestructiveImportAllowed("postgres", { [ALLOW_DESTRUCTIVE_DATA_IMPORT_ENV]: "true" })).toBe(
      false,
    );
    expect(isDestructiveImportAllowed("postgres", { [ALLOW_DESTRUCTIVE_DATA_IMPORT_ENV]: "yes" })).toBe(
      false,
    );
  });
});
