import { downloadHistoricalStats } from "@/data/sources/historicalStats/download";
import {
  HISTORICAL_STATS_END_SEASON,
  HISTORICAL_STATS_START_SEASON,
} from "@/data/sources/statsBoundary";

async function main(): Promise<void> {
  const startSeason = Number(process.env.HISTORICAL_START_SEASON ?? HISTORICAL_STATS_START_SEASON);
  const endSeason = Number(process.env.HISTORICAL_END_SEASON ?? HISTORICAL_STATS_END_SEASON);
  const force = process.env.HISTORICAL_FORCE === "1";

  console.log(`Downloading historical stats ${startSeason}–${endSeason} (force=${force})`);
  const { manifest } = await downloadHistoricalStats({ startSeason, endSeason, force });
  console.log(`Seasons cached: ${manifest.seasonsDownloaded.join(", ")}`);
  console.log("Manifest: data/manifests/historical-stats.json");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
