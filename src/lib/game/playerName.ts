export interface ParsedPlayerName {
  firstName: string;
  lastName: string;
}

const SORT_OPTIONS: Intl.CollatorOptions = {
  numeric: true,
  sensitivity: "base",
};

/**
 * Split a stored display name into first/last for presentation and IQ sorting.
 * Does not change how names are stored.
 */
export function parsePlayerName(displayName: string): ParsedPlayerName {
  const trimmed = displayName.trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", lastName: "" };

  const comma = trimmed.indexOf(",");
  if (comma >= 0) {
    const lastName = trimmed.slice(0, comma).trim();
    const firstName = trimmed.slice(comma + 1).trim();
    return {
      firstName: firstName || trimmed,
      lastName: lastName,
    };
  }

  const parts = trimmed.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: "" };
  }

  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

/** Player-facing "First Last" form of a stored display name. */
export function formatPlayerDisplayName(displayName: string): string {
  const { firstName, lastName } = parsePlayerName(displayName);
  return [firstName, lastName].filter(Boolean).join(" ");
}

export function comparePlayerNames(a: string, b: string): number {
  const left = parsePlayerName(a);
  const right = parsePlayerName(b);
  const first = left.firstName.localeCompare(right.firstName, "en", SORT_OPTIONS);
  if (first !== 0) return first;
  const last = left.lastName.localeCompare(right.lastName, "en", SORT_OPTIONS);
  if (last !== 0) return last;
  return formatPlayerDisplayName(a).localeCompare(formatPlayerDisplayName(b), "en", SORT_OPTIONS);
}
