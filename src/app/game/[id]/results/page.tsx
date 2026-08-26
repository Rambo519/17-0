import type { Metadata } from "next";

import { ResultsPageClient } from "@/components/game/ResultsPageClient";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Results · ${PRODUCT_NAME}`,
};

export default async function GameResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResultsPageClient sessionId={id} />;
}
