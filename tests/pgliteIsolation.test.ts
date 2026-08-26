import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  LOCAL_PGLITE_DIR,
  isAutomatedTestProcess,
  isDurableLocalPgliteDir,
  openLocalPgliteDatabase,
} from "@/db/localPglite";

import { createIsolatedPgliteDataDir } from "./helpers/pgliteDatabase";

const TESTS_DIR = path.join(process.cwd(), "tests");

async function collectTestSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "helpers") {
        files.push(...(await collectTestSourceFiles(full)));
        continue;
      }
      continue;
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("PGlite database-path isolation", () => {
  it("points the app durable directory at .data/pglite", () => {
    expect(path.resolve(LOCAL_PGLITE_DIR)).toBe(path.resolve(process.cwd(), ".data", "pglite"));
    expect(isDurableLocalPgliteDir(LOCAL_PGLITE_DIR)).toBe(true);
    expect(isDurableLocalPgliteDir(undefined)).toBe(false);
    expect(isDurableLocalPgliteDir("memory://")).toBe(false);
  });

  it("runs under Vitest so the durable opener is blocked", () => {
    expect(isAutomatedTestProcess()).toBe(true);
    expect(process.env.VITEST).toBeTruthy();
  });

  it("refuses to open the durable .data/pglite directory from automated tests", async () => {
    await expect(openLocalPgliteDatabase()).rejects.toThrow(
      /Automated tests must not open the durable \.data\/pglite database/,
    );
  });

  it("creates test data directories that are not the durable app path", async () => {
    const dataDir = await createIsolatedPgliteDataDir();
    expect(isDurableLocalPgliteDir(dataDir)).toBe(false);
    expect(path.resolve(dataDir)).not.toBe(path.resolve(LOCAL_PGLITE_DIR));
    expect(dataDir).toContain(`seventeen-pglite-${process.pid}-`);
  });

  it("does not let unit/integration tests import the durable PGlite opener", async () => {
    const files = await collectTestSourceFiles(TESTS_DIR);
    const isolationFile = path.normalize(path.join(TESTS_DIR, "pgliteIsolation.test.ts"));
    const helperFile = path.normalize(path.join(TESTS_DIR, "helpers", "pgliteDatabase.ts"));

    const offenders: string[] = [];
    for (const file of files) {
      const normalized = path.normalize(file);
      if (normalized === isolationFile || normalized === helperFile) continue;
      const source = await readFile(file, "utf8");
      if (
        source.includes("openLocalPgliteDatabase") ||
        source.includes("openDataDatabase") ||
        source.includes("LOCAL_PGLITE_DIR")
      ) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
