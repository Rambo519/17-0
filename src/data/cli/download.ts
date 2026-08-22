import { downloadNflverseData } from "@/data/sources/nflverse/download";
import { NFLVERSE_DEFAULT_CUTOFF_SEASON } from "@/data/sources/nflverse/config";

async function main(): Promise<void> {
  const cutoff = Number(process.env.IMPORT_CUTOFF_SEASON ?? NFLVERSE_DEFAULT_CUTOFF_SEASON);
  const force = process.argv.includes("--force");
  const result = await downloadNflverseData({ cutoffSeason: cutoff, force });
  console.log(
    `Downloaded ${result.rosterFiles.length} roster files and ${result.statsFiles.length} stats files.`,
  );
  console.log(`Import cutoff season: ${result.manifest.importCutoffSeason}`);
  console.log(`Manifest written with downloadedAt=${result.manifest.downloadedAt}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
