import { describe, expect, it } from "vitest";

import { PRODUCT_NAME, SHARE_INVITE } from "@/lib/brand";
import { appSharePayload, appShareUrl } from "@/lib/share/appShare";

describe("app share payload", () => {
  it("uses the current origin home URL, not a hardcoded host or game path", () => {
    expect(appShareUrl("https://example.vercel.app")).toBe("https://example.vercel.app/");
    expect(appShareUrl("https://example.vercel.app/")).toBe("https://example.vercel.app/");
    const payload = appSharePayload("https://seventeen-and-oh.example");
    expect(payload.url).toBe("https://seventeen-and-oh.example/");
    expect(payload.url).not.toMatch(/vercel\.app/);
    expect(payload.url).not.toMatch(/game\//);
    expect(payload.url).not.toMatch(/results/);
  });

  it("invites someone to play without a record or stats", () => {
    const payload = appSharePayload("https://play.example");
    expect(payload.title).toBe(PRODUCT_NAME);
    expect(payload.text).toBe(SHARE_INVITE);
    expect(payload.text).toContain("17–0");
    expect(JSON.stringify(payload)).not.toMatch(/14–3|16–1|15–2|87\.4|expected wins/i);
  });
});
