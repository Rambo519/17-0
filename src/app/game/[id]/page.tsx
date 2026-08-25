import type { Metadata } from "next";

import { CompletedGamePageClient } from "@/components/game/CompletedGamePageClient";

export const metadata: Metadata = {
  title: "Offense Complete · 16&0",
};

export default async function CompletedGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompletedGamePageClient sessionId={id} />;
}
