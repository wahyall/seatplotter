import type { EventRow } from "@/types/db"

/** Default primary when event has no color set */
export const DEFAULT_EVENT_PRIMARY = "#6366f1"

/** Resolved CSS color for UI (booking, ticket print). */
export function eventPrimaryColor(event: EventRow | null | undefined): string {
  const c = event?.color?.trim()
  if (c) return c
  return DEFAULT_EVENT_PRIMARY
}

/** Light wash of the primary for selected chips / legend (any valid CSS color). */
export function primaryMutedWash(primary: string, pct = 14): string {
  return `color-mix(in srgb, ${primary} ${pct}%, transparent)`
}
