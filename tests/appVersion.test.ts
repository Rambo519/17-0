import { describe, expect, it } from "vitest";

import {
  APP_RELEASE_VERSION,
  LOCAL_BUILD_ID,
  copyrightYear,
  deployedAppVersion,
  formatReleaseLabel,
} from "@/lib/appVersion";
import { version as packageVersion } from "../package.json";

describe("deployedAppVersion", () => {
  it("shortens a Vercel git SHA to 7 characters", () => {
    expect(deployedAppVersion("b3b447bf9c2a1d0e")).toBe("b3b447b");
  });

  it("falls back locally when the SHA is missing", () => {
    expect(deployedAppVersion(undefined)).toBe(LOCAL_BUILD_ID);
    expect(deployedAppVersion("")).toBe(LOCAL_BUILD_ID);
    expect(deployedAppVersion("   ")).toBe(LOCAL_BUILD_ID);
  });

  it("keeps a SHA that is already 7 characters or shorter", () => {
    expect(deployedAppVersion("abc1234")).toBe("abc1234");
    expect(deployedAppVersion("abc")).toBe("abc");
  });
});

describe("release label", () => {
  it("mirrors package.json so a version bump updates the footer", () => {
    expect(APP_RELEASE_VERSION).toBe(packageVersion);
    expect(APP_RELEASE_VERSION).toBe("1.0.0");
    expect(formatReleaseLabel()).toBe("v1.0.0");
    expect(formatReleaseLabel("2.3.4")).toBe("v2.3.4");
  });
});

describe("copyrightYear", () => {
  it("uses the calendar year of the provided date", () => {
    expect(copyrightYear(new Date(2026, 8, 4))).toBe(2026);
  });
});
