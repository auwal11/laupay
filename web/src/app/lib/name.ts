/**
 * The single, clean name used in greetings ("Hi {firstName}").
 * Mirrors the backend rule so the dashboard and emails never disagree,
 * and a greeting can never repeat a stored value (e.g. "Hi Alhaji Alhaji").
 */
export function firstNameFrom(fullName?: string | null): string {
  const normalized = (fullName ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "there";
  return normalized.split(" ")[0];
}
