import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const MASTER = path.join(
  process.cwd(),
  "assets",
  "brand",
  "gold_football_17-0_landing_emblem.png",
);
const OUTPUT = path.join(process.cwd(), "public", "brand", "gold-football-17-0-landing.png");

const TARGET_WIDTH = 440;
const MARGIN_RATIO = 0.035;
const MATTE_LIMIT = 14;

function dist(r: number, g: number, b: number, c: readonly [number, number, number]): number {
  const dr = r - c[0];
  const dg = g - c[1];
  const db = b - c[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isGold(r: number, g: number, b: number): boolean {
  return r > 70 && g > 35 && r - b > 35;
}

function isDarkBevel(r: number, g: number, b: number): boolean {
  return r <= 12 && g <= 18 && b <= 36;
}

function floodOutside(keep: Uint8Array, w: number, h: number): Uint8Array {
  const outside = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;

  const push = (x: number, y: number): void => {
    const i = y * w + x;
    if (outside[i] || keep[i]) return;
    outside[i] = 1;
    queue[qt++] = i;
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (qh < qt) {
    const i = queue[qh++]!;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) push(x - 1, y);
    if (x + 1 < w) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < h) push(x, y + 1);
  }

  return outside;
}

async function main(): Promise<void> {
  const source = await readFile(MASTER);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const matte = [data[0]!, data[1]!, data[2]!] as [number, number, number];
  console.log(`Isolating 17-0 landing badge from ${w}x${h} (matte ${matte.join(",")})`);

  const keep = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const pi = i * 4;
    if (isGold(data[pi]!, data[pi + 1]!, data[pi + 2]!)) keep[i] = 1;
  }

  const withRim = new Uint8Array(keep);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (keep[i]) continue;
      const pi = i * 4;
      const r = data[pi]!;
      const g = data[pi + 1]!;
      const b = data[pi + 2]!;
      if (dist(r, g, b, matte) <= MATTE_LIMIT) continue;
      if (!isDarkBevel(r, g, b)) continue;
      let nextToGold = false;
      for (let dy = -1; dy <= 1 && !nextToGold; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (keep[ny * w + nx]) {
            nextToGold = true;
            break;
          }
        }
      }
      if (nextToGold) withRim[i] = 1;
    }
  }

  const outside = floodOutside(withRim, w, h);

  let removed = 0;
  let defringed = 0;
  for (let i = 0; i < w * h; i++) {
    if (!outside[i]) continue;
    data[i * 4 + 3] = 0;
    removed += 1;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const pi = i * 4;
      if (data[pi + 3] === 0) continue;
      let nextToHole = false;
      for (let dy = -1; dy <= 1 && !nextToHole; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (data[(ny * w + nx) * 4 + 3] === 0) {
            nextToHole = true;
            break;
          }
        }
      }
      if (!nextToHole) continue;

      const r = data[pi]!;
      const g = data[pi + 1]!;
      const b = data[pi + 2]!;
      if (isGold(r, g, b) || isDarkBevel(r, g, b)) continue;

      const dMatte = dist(r, g, b, matte);
      if (dMatte > 36) continue;
      const alpha = Math.max(0, Math.min(1, (dMatte - MATTE_LIMIT) / 22));
      if (alpha <= 0.05) {
        data[pi + 3] = 0;
        defringed += 1;
        continue;
      }
      const ia = 1 - alpha;
      data[pi] = Math.max(0, Math.min(255, Math.round((r - ia * matte[0]) / alpha)));
      data[pi + 1] = Math.max(0, Math.min(255, Math.round((g - ia * matte[1]) / alpha)));
      data[pi + 2] = Math.max(0, Math.min(255, Math.round((b - ia * matte[2]) / alpha)));
      data[pi + 3] = Math.round(alpha * 255);
      defringed += 1;
    }
  }

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) {
    throw new Error("Knockout removed every pixel — aborting.");
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const margin = Math.max(6, Math.round(Math.max(bw, bh) * MARGIN_RATIO));
  const cropLeft = Math.max(0, minX - margin);
  const cropTop = Math.max(0, minY - margin);
  const cropWidth = Math.min(w - cropLeft, bw + (minX - cropLeft) + margin);
  const cropHeight = Math.min(h - cropTop, bh + (minY - cropTop) + margin);

  let fringe = 0;
  let silhouette = 0;
  for (let y = cropTop; y < cropTop + cropHeight; y++) {
    for (let x = cropLeft; x < cropLeft + cropWidth; x++) {
      const pi = (y * w + x) * 4;
      if (data[pi + 3]! < 128) continue;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || data[(ny * w + nx) * 4 + 3]! < 16) {
            edge = true;
            break;
          }
        }
      }
      if (!edge) continue;
      silhouette += 1;
      const r = data[pi]!;
      const g = data[pi + 1]!;
      const b = data[pi + 2]!;
      if (dist(r, g, b, matte) <= MATTE_LIMIT && !isDarkBevel(r, g, b)) fringe += 1;
    }
  }

  const fringeRate = silhouette === 0 ? 1 : fringe / silhouette;
  console.log({
    removed,
    defringed,
    badge: `${bw}x${bh} at ${minX},${minY}`,
    crop: `${cropWidth}x${cropHeight} +${margin}px margin`,
    silhouette,
    fringe,
    fringeRate: Number(fringeRate.toFixed(4)),
  });

  if (fringeRate > 0.01 || fringe > 40) {
    throw new Error(
      `Background cannot be removed cleanly (${fringe} fringe pixels, ${(fringeRate * 100).toFixed(2)}% of silhouette). Not writing.`,
    );
  }

  const knocked = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .png()
    .toBuffer();

  const outMeta = await sharp(knocked).metadata();
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, knocked);
  console.log(`Wrote ${OUTPUT} (${outMeta.width}x${outMeta.height})`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
