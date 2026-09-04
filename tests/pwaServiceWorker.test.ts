import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

const swSource = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");

describe("service worker update flow", () => {
  it("takes control immediately and clears other caches on activate", () => {
    expect(swSource).toMatch(/skipWaiting\(/);
    expect(swSource).toMatch(/clients\.claim\(/);
    expect(swSource).toMatch(/caches\.keys\(/);
    expect(swSource).toMatch(/caches\.delete\(/);
    expect(swSource).toMatch(/SKIP_WAITING/);
  });

  it("uses network-first for same-origin GETs so online users are not stuck on a stale cache", () => {
    expect(swSource).toMatch(/networkFirst/);
    expect(swSource).toMatch(/cache:\s*["']no-cache["']/);
    expect(swSource).toMatch(/cache\.match\(/);
    expect(swSource).toMatch(/pathname\.startsWith\(["']\/api\/["']\)/);
    expect(swSource).not.toMatch(/fetch",\s*\(\)\s*=>\s*\{\s*\}/);
  });

  it("sends Cache-Control so CDNs do not pin an old sw.js", async () => {
    if (typeof nextConfig.headers !== "function") {
      throw new Error("next.config.ts must export a headers() function");
    }
    const headers = await nextConfig.headers();
    const swHeaders = headers.find((entry) => entry.source === "/sw.js");
    expect(swHeaders?.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        }),
      ]),
    );
  });
});
