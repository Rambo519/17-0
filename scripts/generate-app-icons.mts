import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createElement, type ReactElement } from "react";

import { ImageResponse } from "next/og";

import { HIGHLIGHT_COLOR, THEME_COLOR } from "../src/lib/brand";

function iconElement(size: number, maskable: boolean): ReactElement {
  const inset = maskable ? 0.2 : 0.1;
  const inner = Math.round(size * (1 - inset * 2));
  const stroke = Math.max(3, Math.round(inner * 0.09));
  const fontSize = Math.round(inner * (size <= 32 ? 0.5 : 0.4));

  return createElement(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: THEME_COLOR,
      },
    },
    createElement(
      "div",
      {
        style: {
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          border: `${stroke}px solid ${HIGHLIGHT_COLOR}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: HIGHLIGHT_COLOR,
          fontSize,
          fontWeight: 700,
          letterSpacing: size <= 32 ? "-0.06em" : "-0.04em",
          fontFamily: "Arial Black, Impact, Arial, sans-serif",
          lineHeight: 1,
        },
      },
      "17",
    ),
  );
}

function pngToIco(png: Buffer): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = 32;
  entry[1] = 32;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, png]);
}

async function renderPng(size: number, maskable = false): Promise<Buffer> {
  const response = new ImageResponse(iconElement(size, maskable), {
    width: size,
    height: size,
  });
  return Buffer.from(await response.arrayBuffer());
}

async function main(): Promise<void> {
  const publicIcons = path.join(process.cwd(), "public", "icons");
  const appDir = path.join(process.cwd(), "src", "app");
  await mkdir(publicIcons, { recursive: true });

  const png32 = await renderPng(32);
  const png180 = await renderPng(180);
  const png192 = await renderPng(192);
  const png512 = await renderPng(512);
  const pngMaskable = await renderPng(512, true);

  await writeFile(path.join(publicIcons, "icon-32.png"), png32);
  await writeFile(path.join(publicIcons, "icon-180.png"), png180);
  await writeFile(path.join(publicIcons, "icon-192.png"), png192);
  await writeFile(path.join(publicIcons, "icon-512.png"), png512);
  await writeFile(path.join(publicIcons, "icon-512-maskable.png"), pngMaskable);
  await writeFile(path.join(appDir, "icon.png"), png32);
  await writeFile(path.join(appDir, "apple-icon.png"), png180);
  await writeFile(path.join(appDir, "favicon.ico"), pngToIco(png32));

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="17-0">
  <rect width="512" height="512" fill="${THEME_COLOR}"/>
  <circle cx="256" cy="256" r="188" fill="none" stroke="${HIGHLIGHT_COLOR}" stroke-width="42"/>
  <text x="256" y="256" fill="${HIGHLIGHT_COLOR}" font-family="Arial Black, Impact, Arial, sans-serif" font-size="200" font-weight="700" text-anchor="middle" dominant-baseline="central" letter-spacing="-8">17</text>
</svg>
`;
  await writeFile(path.join(publicIcons, "icon.svg"), svg);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
