import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { THEME_COLOR } from "../src/lib/brand";

const MASTER_ICON = path.join(
  process.cwd(),
  "assets",
  "brand",
  "gold_football_17_emblem.png",
);

function pngToIco(images: { width: number; height: number; png: Buffer }[]): Buffer {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = Buffer.alloc(16 * count);
  const bodies: Buffer[] = [];
  let offset = 6 + 16 * count;

  for (const [index, image] of images.entries()) {
    const entry = entries.subarray(index * 16, index * 16 + 16);
    entry[0] = image.width >= 256 ? 0 : image.width;
    entry[1] = image.height >= 256 ? 0 : image.height;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    bodies.push(image.png);
    offset += image.png.length;
  }

  return Buffer.concat([header, entries, ...bodies]);
}

async function resizeIcon(source: Buffer, size: number): Promise<Buffer> {
  return sharp(source)
    .flatten({ background: THEME_COLOR })
    .resize(size, size, { fit: "cover" })
    .ensureAlpha()
    .png()
    .toBuffer();
}

async function resizeMaskable(source: Buffer, size: number): Promise<Buffer> {
  const inner = Math.round(size * 0.8);
  const emblem = await sharp(source)
    .flatten({ background: THEME_COLOR })
    .resize(inner, inner, { fit: "contain", background: THEME_COLOR })
    .ensureAlpha()
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: THEME_COLOR,
    },
  })
    .composite([{ input: emblem, gravity: "center" }])
    .ensureAlpha()
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const source = await readFile(MASTER_ICON);
  const publicIcons = path.join(process.cwd(), "public", "icons");
  const appDir = path.join(process.cwd(), "src", "app");
  await mkdir(publicIcons, { recursive: true });

  const png16 = await resizeIcon(source, 16);
  const png32 = await resizeIcon(source, 32);
  const png180 = await resizeIcon(source, 180);
  const png192 = await resizeIcon(source, 192);
  const png512 = await resizeIcon(source, 512);
  const pngMaskable = await resizeMaskable(source, 512);

  await writeFile(path.join(publicIcons, "icon-32.png"), png32);
  await writeFile(path.join(publicIcons, "icon-180.png"), png180);
  await writeFile(path.join(publicIcons, "icon-192.png"), png192);
  await writeFile(path.join(publicIcons, "icon-512.png"), png512);
  await writeFile(path.join(publicIcons, "icon-512-maskable.png"), pngMaskable);
  await writeFile(path.join(appDir, "icon.png"), png32);
  await writeFile(path.join(appDir, "apple-icon.png"), png180);
  await writeFile(
    path.join(appDir, "favicon.ico"),
    pngToIco([
      { width: 16, height: 16, png: png16 },
      { width: 32, height: 32, png: png32 },
    ]),
  );

  try {
    await unlink(path.join(publicIcons, "icon.svg"));
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
