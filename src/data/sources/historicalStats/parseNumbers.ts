/** Parse a numeric CSV/HTML cell; empty / dash / N/A → null. Never invent zero. */
export function parseOptionalInt(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "n/a") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return Math.trunc(value);
}

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      fields.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

export function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]!).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c += 1) {
      const header = headers[c];
      if (!header) continue;
      row[header] = fields[c] ?? "";
    }
    rows.push(row);
  }
  return rows;
}
