import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "16&0",
  description: "Historical NFL team-building draft game",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#f7f7f8",
          color: "#111",
        }}
      >
        {children}
      </body>
    </html>
  );
}
