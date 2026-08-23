import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createEmptyHistoricalManifest,
  MARCLINDER_CSV_URL,
  MARCLINDER_END_SEASON,
  MARCLINDER_SOURCE_NAME,
  MARCLINDER_START_SEASON,
  type HistoricalStatsManifest,
} from "@/data/sources/historicalStats/config";
import { parseMarcLinderCategoryCsv } from "@/data/sources/historicalStats/parse";
import {
  hasAnyProduction,
  mergeHistoricalSeasonStats,
  type HistoricalSeasonStats,
  type HistoricalStatCategory,
} from "@/data/sources/historicalStats/types";
import {
  HISTORICAL_STATS_END_SEASON,
  HISTORICAL_STATS_START_SEASON,
} from "@/data/sources/statsBoundary";

export const HISTORICAL_STATS_CACHE_DIR = path.join(process.cwd(), ".cache", "historical-stats");
export const MARCLINDER_CACHE_DIR = path.join(HISTORICAL_STATS_CACHE_DIR, "marclinder");
export const HISTORICAL_STATS_MANIFEST_PATH = path.join(
  process.cwd(),
  "data",
  "manifests",
  "historical-stats.json",
);

const CATEGORIES: HistoricalStatCategory[] = ["passing", "rushing", "receiving"];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "sixteen-and-oh-historical-stats/1.0 (local data enrichment)",
      Accept: "text/csv,*/*",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

export interface HistoricalDownloadOptions {
  startSeason?: number;
  endSeason?: number;
  force?: boolean;
}

export interface HistoricalDownloadResult {
  manifest: HistoricalStatsManifest;
}

export async function downloadHistoricalStats(
  options: HistoricalDownloadOptions = {},
): Promise<HistoricalDownloadResult> {
  const startSeason = Math.max(
    options.startSeason ?? HISTORICAL_STATS_START_SEASON,
    HISTORICAL_STATS_START_SEASON,
  );
  const endSeason = Math.min(
    options.endSeason ?? HISTORICAL_STATS_END_SEASON,
    HISTORICAL_STATS_END_SEASON,
  );
  const force = options.force ?? false;

  await mkdir(MARCLINDER_CACHE_DIR, { recursive: true });
  await mkdir(path.dirname(HISTORICAL_STATS_MANIFEST_PATH), { recursive: true });

  const seasonsDownloaded: number[] = [];

  for (let season = startSeason; season <= endSeason; season += 1) {
    if (season >= MARCLINDER_START_SEASON && season <= MARCLINDER_END_SEASON) {
      await downloadMarcLinderSeason(season, force);
      seasonsDownloaded.push(season);
    }
  }

  const manifest = createEmptyHistoricalManifest();
  manifest.downloadedAt = new Date().toISOString();
  manifest.seasonsDownloaded = seasonsDownloaded;
  await writeFile(
    HISTORICAL_STATS_MANIFEST_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return { manifest };
}

async function downloadMarcLinderSeason(season: number, force: boolean): Promise<void> {
  const seasonDir = path.join(MARCLINDER_CACHE_DIR, String(season));
  await mkdir(seasonDir, { recursive: true });

  for (const category of CATEGORIES) {
    const destination = path.join(seasonDir, `${category}.csv`);
    if (!force && (await fileExists(destination))) continue;
    process.stdout.write(`Downloading MarcLinder ${season} ${category}...\n`);
    const text = await downloadText(MARCLINDER_CSV_URL(season, category));
    await writeFile(destination, text, "utf8");
  }
}

/** Load and merge all cached historical season rows for enrichment. */
export async function loadCachedHistoricalSeasonStats(
  options: { startSeason?: number; endSeason?: number } = {},
): Promise<HistoricalSeasonStats[]> {
  const startSeason = options.startSeason ?? HISTORICAL_STATS_START_SEASON;
  const endSeason = options.endSeason ?? HISTORICAL_STATS_END_SEASON;
  const byKey = new Map<string, HistoricalSeasonStats>();

  for (let season = startSeason; season <= endSeason; season += 1) {
    const seasonRows = await loadMarcLinderSeason(season);

    for (const row of seasonRows) {
      if (!hasAnyProduction(row)) continue;
      const key = `${row.season}|${row.normalizedName}`;
      const existing = byKey.get(key);
      byKey.set(key, existing ? mergeHistoricalSeasonStats(existing, row) : row);
    }
  }

  return [...byKey.values()];
}

async function loadMarcLinderSeason(season: number): Promise<HistoricalSeasonStats[]> {
  const seasonDir = path.join(MARCLINDER_CACHE_DIR, String(season));
  const rows: HistoricalSeasonStats[] = [];
  for (const category of CATEGORIES) {
    const filePath = path.join(seasonDir, `${category}.csv`);
    if (!(await fileExists(filePath))) continue;
    const text = await readFile(filePath, "utf8");
    rows.push(...parseMarcLinderCategoryCsv(text, season, category, MARCLINDER_SOURCE_NAME));
  }
  return rows;
}

export async function loadHistoricalManifest(): Promise<HistoricalStatsManifest> {
  const raw = await readFile(HISTORICAL_STATS_MANIFEST_PATH, "utf8");
  return JSON.parse(raw) as HistoricalStatsManifest;
}
