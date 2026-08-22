import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>16&amp;0</h1>
      <p>Phase 1: schema, draft engine, and API only.</p>
      <p>
        <Link href="/dev/game">Developer test screen</Link>
      </p>
    </main>
  );
}
