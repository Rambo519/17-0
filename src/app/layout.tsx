import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Oswald, Source_Sans_3 } from "next/font/google";

import { PRODUCT_NAME } from "@/lib/brand";

import "./globals.css";

const display = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-face",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-body-face",
});

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Build the perfect historical NFL offense.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
