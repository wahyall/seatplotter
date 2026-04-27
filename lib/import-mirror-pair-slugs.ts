/**
 * Events that should receive the same participant import when the UI option is on.
 * Must match `events.slug` in the database (no extra DB column).
 */
const SLUG_TO_PARTNER: Record<string, string> = {
  "ittiba-disconnect-sby": "ittiba-reconnect-sby",
  "ittiba-reconnect-sby": "ittiba-disconnect-sby",
}

export function getPartnerEventSlug(
  slug: string | null | undefined
): string | null {
  if (!slug) return null
  return SLUG_TO_PARTNER[slug] ?? null
}
