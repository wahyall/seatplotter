import { cn } from "@/lib/utils"
import { DEFAULT_EVENT_PRIMARY } from "@/lib/event-color"

export type BookingThemeId = "reconnect" | "disconnect" | "default"

const SLUG_RECONNECT = "ittiba-reconnect-sby"
const SLUG_DISCONNECT = "ittiba-disconnect-sby"

export function getBookingThemeId(slug: string): BookingThemeId {
  if (slug === SLUG_RECONNECT) return "reconnect"
  if (slug === SLUG_DISCONNECT) return "disconnect"
  return "default"
}

/** When event has no DB color, themed routes get a banner-aligned primary. */
export function bookingThemePrimaryFallback(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return "#10b981"
    case "disconnect":
      return "#b20000"
    default:
      return DEFAULT_EVENT_PRIMARY
  }
}

/** Outer shell on booking layout (under AppErrorBoundary). */
export function bookingThemeShellClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return cn(
        "booking-shell bg-zinc-950 text-foreground",
        "bg-[radial-gradient(ellipse_90%_60%_at_50%_-15%,rgba(16,185,129,0.14),transparent_55%),linear-gradient(to_bottom,hsl(150_25%_6%),hsl(0_0%_4%)_45%)]"
      )
    case "disconnect":
      return "booking-shell bg-zinc-950 text-foreground"
    default:
      return "bg-background"
  }
}

export function bookingThemePageRootClass(themeId: BookingThemeId): string {
  if (themeId === "default") return "relative flex min-h-screen flex-col"
  return "relative z-[1] flex min-h-screen flex-col"
}

export function bookingBannerShellClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return "relative z-0 h-[220px] w-full shrink-0 overflow-hidden border-b border-emerald-900/35 bg-zinc-950"
    case "disconnect":
      return "relative z-0 h-[220px] w-full shrink-0 overflow-hidden border-b border-zinc-800 bg-zinc-950"
    default:
      return "relative z-0 h-[220px] w-full shrink-0 overflow-hidden border-b border-border bg-card"
  }
}

export function bookingBannerOverlayClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return cn(
        "pointer-events-none absolute inset-0",
        "bg-[radial-gradient(ellipse_65%_50%_at_50%_8%,rgba(52,211,153,0.22),transparent_60%)]",
        "bg-gradient-to-b from-emerald-950/30 via-zinc-950/75 to-zinc-950"
      )
    case "disconnect":
      return cn(
        "pointer-events-none absolute inset-0",
        "bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.75)_100%)]",
        "bg-gradient-to-b from-amber-950/15 via-zinc-950/70 to-zinc-950"
      )
    default:
      return "pointer-events-none absolute inset-0 bg-gradient-to-b from-background/20 via-background/35 to-background/80"
  }
}

export function bookingHeaderClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return cn(
        "sticky top-0 z-30 border-b backdrop-blur-md",
        "border-emerald-900/45 bg-green-950/55"
      )
    case "disconnect":
      return cn(
        "sticky top-0 z-30 border-b backdrop-blur-md",
        "border-zinc-700/80 bg-zinc-950/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
      )
    default:
      return "sticky top-0 z-30 border-b border-border bg-background"
  }
}

export function bookingTitleClass(themeId: BookingThemeId): string {
  const base = "truncate font-display text-sm font-bold sm:text-base"
  switch (themeId) {
    case "reconnect":
      return cn(base, "text-emerald-50 [text-shadow:0_1px_0_rgba(0,0,0,0.5)]")
    case "disconnect":
      return cn(base, "text-zinc-100 tracking-tight")
    default:
      return base
  }
}

export function bookingBottomPanelClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return cn(
        "sticky bottom-0 z-40 border-t backdrop-blur-md",
        "border-emerald-900/45 bg-green-950/70"
      )
    case "disconnect":
      return cn(
        "sticky bottom-0 z-40 border-t backdrop-blur-md",
        "border-zinc-700/80 bg-zinc-950/95 shadow-[0_-8px_30px_rgba(0,0,0,0.45)]"
      )
    default:
      return "sticky bottom-0 z-40 border-t border-border bg-background"
  }
}

export function bookingTabShellClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return "inline-flex items-center rounded-md border border-emerald-800/50 bg-green-950/60 p-0.5 shadow-[0_0_24px_-8px_rgba(16,185,129,0.35)]"
    case "disconnect":
      return "inline-flex items-center rounded-md border border-zinc-600/70 bg-zinc-900/80 p-0.5"
    default:
      return "inline-flex items-center rounded-md border border-border bg-secondary p-0.5"
  }
}

export function bookingModalBackdropClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return "fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm"
    case "disconnect":
      return "fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
    default:
      return "fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
  }
}

export function bookingModalCardClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return cn(
        "w-full max-w-2xl rounded-lg border p-5 max-h-[90vh] overflow-y-auto",
        "border-emerald-800/50 bg-green-950/90 shadow-[0_0_40px_-12px_rgba(16,185,129,0.25)]"
      )
    case "disconnect":
      return cn(
        "w-full max-w-2xl rounded-lg border p-5 max-h-[90vh] overflow-y-auto",
        "border-zinc-600/80 bg-zinc-900/95 shadow-[0_12px_48px_rgba(0,0,0,0.55)]"
      )
    default:
      return "w-full max-w-2xl rounded-lg border border-border bg-card p-5 max-h-[90vh] overflow-y-auto"
  }
}

export function bookingStageBarClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return cn(
        "border-emerald-800/45 bg-green-950/50",
        "shadow-[inset_0_1px_0_0_rgba(167,243,208,0.06)]"
      )
    case "disconnect":
      return cn(
        "border-zinc-600/90 bg-zinc-900/90",
        "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)]"
      )
    default:
      return ""
  }
}

export function bookingLoaderShellClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return "flex min-h-screen items-center justify-center bg-zinc-950 bg-[radial-gradient(ellipse_at_50%_20%,rgba(16,185,129,0.12),transparent_55%)]"
    case "disconnect":
      return "flex min-h-screen items-center justify-center bg-zinc-950"
    default:
      return "flex min-h-screen items-center justify-center"
  }
}

export function bookingBookedPillClass(themeId: BookingThemeId): string {
  const base =
    "inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-1 py-1 text-[10px] font-medium tabular-nums"
  switch (themeId) {
    case "disconnect":
      return cn(
        base,
        "border border-primary/30 bg-primary/10 text-primary"
      )
    case "reconnect":
      return cn(
        base,
        "border border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
      )
    default:
      return cn(base, "bg-emerald-500/10 text-emerald-400")
  }
}

export function bookingBookedPillBadgeClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "disconnect":
      return "bg-primary/20 px-1.5 py-0.5 rounded-md text-primary ml-1"
    case "reconnect":
      return "bg-emerald-500/20 px-1.5 py-0.5 rounded-md text-emerald-200 ml-1"
    default:
      return "bg-emerald-500/20 px-1.5 py-0.5 rounded-md text-emerald-300 ml-1"
  }
}

export function bookingBookedDownloadBtnClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "disconnect":
      return "ml-1 rounded-full p-1 bg-primary/20 hover:bg-primary/35 text-primary transition-colors"
    case "reconnect":
      return "ml-1 rounded-full p-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-200 transition-colors"
    default:
      return "ml-1 rounded-full p-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 transition-colors"
  }
}

export function bookingCompletionTextClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "disconnect":
      return "flex items-center gap-1.5 text-xs text-primary"
    case "reconnect":
      return "flex items-center gap-1.5 text-xs text-emerald-300"
    default:
      return "flex items-center gap-1.5 text-xs text-emerald-400"
  }
}

export function bookingTicketCardIdleClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return "border-emerald-900/50 bg-green-950/45 hover:border-[color:var(--event-primary)]"
    case "disconnect":
      return "border-zinc-600/85 bg-zinc-900/75 shadow-[2px_3px_0_rgba(0,0,0,0.35)] hover:border-[color:var(--event-primary)]"
    default:
      return "border-border bg-card hover:border-[color:var(--event-primary)]"
  }
}

export function bookingSecondaryButtonClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return "flex items-center gap-1.5 rounded-md border border-emerald-900/50 bg-green-950/50 px-3 py-1.5 text-xs text-emerald-100/80 transition-colors hover:bg-green-900/50"
    case "disconnect":
      return "flex items-center gap-1.5 rounded-md border border-zinc-600 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
    default:
      return "flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
  }
}

export function bookingOverlayBlockClass(themeId: BookingThemeId, bookingFull: boolean): string {
  const base = "fixed inset-0 z-50 flex items-center justify-center"
  if (themeId === "reconnect") {
    return cn(base, bookingFull ? "bg-zinc-950/80 backdrop-blur-sm" : "bg-transparent")
  }
  if (themeId === "disconnect") {
    return cn(base, bookingFull ? "bg-black/80 backdrop-blur-sm" : "bg-transparent")
  }
  return cn(base, bookingFull ? "bg-background/80 backdrop-blur-sm" : "bg-transparent")
}

export function bookingInsetPreviewClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return "mt-4 flex items-center justify-center overflow-hidden rounded-md border border-emerald-900/40 bg-green-950/35"
    case "disconnect":
      return "mt-4 flex items-center justify-center overflow-hidden rounded-md border border-zinc-700/80 bg-zinc-900/50"
    default:
      return "mt-4 flex items-center justify-center overflow-hidden rounded-md border border-border bg-secondary"
  }
}

export function bookingRingOffsetClass(themeId: BookingThemeId): string {
  if (themeId === "default") return "ring-offset-background"
  return "ring-offset-zinc-950"
}

export function bookingMicroLoadingCardClass(themeId: BookingThemeId): string {
  switch (themeId) {
    case "reconnect":
      return "rounded-2xl border border-emerald-800/40 bg-green-950/92 p-6 shadow-xl backdrop-blur-md"
    case "disconnect":
      return "rounded-2xl border border-zinc-600/60 bg-zinc-900/92 p-6 shadow-xl backdrop-blur-md"
    default:
      return "rounded-2xl border border-border/50 bg-background/90 p-6 shadow-xl backdrop-blur-md"
  }
}
