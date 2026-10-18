/**
 * Collapses internal whitespace and trims, so a stored name never carries
 * ragged spacing ("  Alhaji   auwal  " -> "Alhaji auwal").
 */
export function normalizeFullName(fullName: string): string {
  return fullName.trim().replace(/\s+/g, ' ');
}

/**
 * The single, clean name used in greetings ("Hi {firstName}").
 *
 * Takes the first token of the normalized name. This is deliberately the ONLY
 * name ever rendered into an email or dashboard greeting, so a greeting can
 * never repeat a stored value (e.g. "Alhaji Alhaji") or expose the full name.
 */
export function firstNameFrom(fullName: string | null | undefined): string {
  const normalized = normalizeFullName(fullName ?? '');
  if (!normalized) return 'there';
  return normalized.split(' ')[0];
}
