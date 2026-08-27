import { describe, expect, it } from "vitest";

import { isDevelopmentQaEnabled } from "@/lib/game/qaAccess";

describe("isDevelopmentQaEnabled", () => {
  it("is available in development and test", () => {
    expect(isDevelopmentQaEnabled("development")).toBe(true);
    expect(isDevelopmentQaEnabled("test")).toBe(true);
    expect(isDevelopmentQaEnabled(undefined)).toBe(true);
  });

  it("is unavailable in production", () => {
    expect(isDevelopmentQaEnabled("production")).toBe(false);
  });
});
