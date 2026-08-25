import type { Metadata } from "next";

import { ResultsPageClient } from "@/components/game/ResultsPageClient";

export const metadata: Metadata = {
  title: "Results · 16&0",
};

export default async function GameResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResultsPageClient sessionId={id} />;
}
