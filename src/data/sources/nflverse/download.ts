import { createReadStream } from "node:fs";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

import {
  NFLVERSE_DEFAULT_CUTOFF_SEASON,
  NFLVERSE_IMPORT_START_SEASON,
  NFLVERSE_PLAYER_STATS_START_SEASON,
  NFLVERSE_PLAYER_STATS_URL,
  NFLVERSE_ROSTER_URL,
  createEmptyManifest,
  type NflverseManifest,
} from "./config";

export const NFLVERSE_CACHE_DIR = path.join(process.cwd(), ".cache", "nflverse");
export const NFLVERSE_ROSTERS_DIR = path.join(NFLVERSE_CACHE_DIR, "rosters");
export const NFLVERSE_STATS_DIR = path.join(NFLVERSE_CACHE_DIR, "player_stats");
export const NFLVERSE_MANIFEST_PATH = path.join(
  process.cwd(),
  "data",
  "manifests",
  "nflverse.json",
);

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, buffer);
}

export interface DownloadOptions {
  startSeason?: number;
  cutoffSeason?: number;
  force?: boolean;
}

export interface DownloadResult {
  manifest: NflverseManifest;
  rosterFiles: string[];
  statsFiles: string[];
}

export async function downloadNflverseData(
  options: DownloadOptions = {},
): Promise<DownloadResult> {
  const startSeason = options.startSeason ?? NFLVERSE_IMPORT_START_SEASON;
  const cutoffSeason = options.cutoffSeason ?? NFLVERSE_DEFAULT_CUTOFF_SEASON;
  const force = options.force ?? false;

  await mkdir(NFLVERSE_ROSTERS_DIR, { recursive: true });
  await mkdir(NFLVERSE_STATS_DIR, { recursive: true });
  await mkdir(path.dirname(NFLVERSE_MANIFEST_PATH), { recursive: true });

  const rosterFiles: string[] = [];
  const statsFiles: string[] = [];
  const seasonsDownloaded: number[] = [];

  for (let season = startSeason; season <= cutoffSeason; season += 1) {
    const rosterPath = path.join(NFLVERSE_ROSTERS_DIR, `roster_${season}.csv`);
    if (force || !(await fileExists(rosterPath))) {
      process.stdout.write(`Downloading roster ${season}...\n`);
      await downloadFile(NFLVERSE_ROSTER_URL(season), rosterPath);
    }
    rosterFiles.push(rosterPath);
    seasonsDownloaded.push(season);

    if (season >= NFLVERSE_PLAYER_STATS_START_SEASON) {
      const statsPath = path.join(NFLVERSE_STATS_DIR, `player_stats_${season}.csv`);
      if (force || !(await fileExists(statsPath))) {
        process.stdout.write(`Downloading player_stats ${season}...\n`);
        try {
          await downloadFile(NFLVERSE_PLAYER_STATS_URL(season), statsPath);
        } catch (error) {
          // Stats lag the roster release for the newest season; roster-only
          // participation (ACT status) still covers draftable decisions.
          process.stdout.write(
            `Skipping player_stats ${season}: ${(error as Error).message}\n`,
          );
          continue;
        }
      }
      if (await fileExists(statsPath)) statsFiles.push(statsPath);
    }
  }

  const manifest = createEmptyManifest(cutoffSeason);
  manifest.downloadedAt = new Date().toISOString();
  manifest.seasonsDownloaded = seasonsDownloaded;
  await writeFile(NFLVERSE_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { manifest, rosterFiles, statsFiles };
}

export async function loadManifest(): Promise<NflverseManifest> {
  const raw = await readFile(NFLVERSE_MANIFEST_PATH, "utf8");
  return JSON.parse(raw) as NflverseManifest;
}

/** Minimal CSV reader for nflverse flat files (quoted fields supported). */
export async function* readCsvRows(
  filePath: string,
): AsyncGenerator<Record<string, string>> {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers: string[] | null = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    if (!headers) {
      headers = fields;
      continue;
    }
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      const header = headers[i];
      if (!header) continue;
      row[header] = fields[i] ?? "";
    }
    yield row;
  }
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      fields.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}
