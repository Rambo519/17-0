import { describe, expect, it } from "vitest";

import { resolveAppDatabaseBackend } from "@/db/client";

describe("resolveAppDatabaseBackend", () => {
  it("uses Postgres when DATABASE_URL is set", () => {
    expect(
      resolveAppDatabaseBackend({
        DATABASE_URL: "postgres://localhost/db",
        NODE_ENV: "development",
      }),
    ).toBe("postgres");
    expect(
      resolveAppDatabaseBackend({
        DATABASE_URL: "postgres://localhost/db",
        NODE_ENV: "production",
      }),
    ).toBe("postgres");
  });

  it("uses durable local PGlite in non-production when DATABASE_URL is absent", () => {
    expect(resolveAppDatabaseBackend({ NODE_ENV: "development" })).toBe("pglite");
    expect(resolveAppDatabaseBackend({ NODE_ENV: "test" })).toBe("pglite");
  });

  it("requires DATABASE_URL in production", () => {
    expect(() => resolveAppDatabaseBackend({ NODE_ENV: "production" })).toThrow(
      /DATABASE_URL is not set/,
    );
  });
});
