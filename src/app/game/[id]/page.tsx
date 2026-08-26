import type { Metadata } from "next";

import { CompletedGamePageClient } from "@/components/game/CompletedGamePageClient";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Offense Complete · ${PRODUCT_NAME}`,
};

export default async function CompletedGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompletedGamePageClient sessionId={id} />;
}
