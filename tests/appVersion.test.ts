import { describe, expect, it } from "vitest";

import { LOCAL_APP_VERSION, copyrightYear, deployedAppVersion } from "@/lib/appVersion";

describe("deployedAppVersion", () => {
  it("shortens a Vercel git SHA to 7 characters", () => {
    expect(deployedAppVersion("b3b447bf9c2a1d0e")).toBe("b3b447b");
  });

  it("falls back locally when the SHA is missing", () => {
    expect(deployedAppVersion(undefined)).toBe(LOCAL_APP_VERSION);
    expect(deployedAppVersion("")).toBe(LOCAL_APP_VERSION);
    expect(deployedAppVersion("   ")).toBe(LOCAL_APP_VERSION);
  });

  it("keeps a SHA that is already 7 characters or shorter", () => {
    expect(deployedAppVersion("abc1234")).toBe("abc1234");
    expect(deployedAppVersion("abc")).toBe("abc");
  });
});

describe("copyrightYear", () => {
  it("uses the calendar year of the provided date", () => {
    expect(copyrightYear(new Date(2026, 8, 4))).toBe(2026);
  });
});
