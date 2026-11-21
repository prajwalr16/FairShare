export function parseBulkMemberNames(rawInput: string): string[] {
  if (!rawInput) return [];
  const tokens = rawInput
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return Array.from(new Set(tokens));
}

export type CandidatePlaceholder = {
  id: string;
  display_name: string;
  email?: string | null;
};

export function findAutoMatchPlaceholder(
  candidates: CandidatePlaceholder[],
  userEmail?: string | null,
  userName?: string | null
): CandidatePlaceholder | null {
  if (!candidates || candidates.length === 0) return null;

  const cleanEmail = userEmail?.toLowerCase().trim();
  const cleanName = userName?.toLowerCase().trim();

  // Exact email match takes highest precedence
  if (cleanEmail) {
    const emailMatch = candidates.find(
      (c) => c.email && c.email.toLowerCase().trim() === cleanEmail
    );
    if (emailMatch) return emailMatch;
  }

  // Exact display name match (case-insensitive)
  if (cleanName) {
    const nameMatch = candidates.find(
      (c) => c.display_name.toLowerCase().trim() === cleanName
    );
    if (nameMatch) return nameMatch;
  }

  return null;
}
