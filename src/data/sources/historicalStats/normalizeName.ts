/**
 * Deterministic display-name normalization for historical identity matching.
 * Does not invent nicknames or fuzzy phonetic matches.
 */
export function normalizePlayerName(name: string): string {
  let value = name.normalize("NFKD").replace(/\p{M}/gu, "");
  value = value.toLowerCase();
  value = value.replace(/['’.]/g, "");
  value = value.replace(/\*/g, "");
  value = value.replace(/\s+/g, " ").trim();
  value = value.replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "").replace(/\s+/g, " ").trim();
  return value;
}
