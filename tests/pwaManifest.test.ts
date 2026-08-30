import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { PRODUCT_NAME, THEME_COLOR } from "@/lib/brand";

describe("PWA manifest and icons", () => {
  const webManifest = manifest();

  it("meets Chrome installability fields", () => {
    expect(webManifest.name).toBe(PRODUCT_NAME);
    expect(webManifest.short_name).toBe(PRODUCT_NAME);
    expect(webManifest.start_url).toBe("/");
    expect(webManifest.display).toBe("standalone");
    expect(webManifest.theme_color).toBe(THEME_COLOR);
    expect(webManifest.background_color).toBe(THEME_COLOR);
    expect(webManifest.prefer_related_applications).not.toBe(true);

    const sizes = new Set(webManifest.icons?.map((icon) => icon.sizes));
    expect(sizes.has("192x192")).toBe(true);
    expect(sizes.has("512x512")).toBe(true);
    expect(webManifest.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("ships the referenced icon files", () => {
    const files = [
      "src/app/favicon.ico",
      "src/app/icon.png",
      "src/app/apple-icon.png",
      "public/icons/icon-192.png",
      "public/icons/icon-512.png",
      "public/icons/icon-512-maskable.png",
      "public/sw.js",
    ];
    for (const file of files) {
      expect(existsSync(path.join(process.cwd(), file)), file).toBe(true);
    }
  });
});
