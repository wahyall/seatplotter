"use client"

import { cn } from "@/lib/utils"

export function StageBar({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/80 bg-gradient-to-b from-muted/80 to-muted/40 px-4 py-2.5 text-center",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(263_40%_25%/0.35),transparent_60%)]" />
      <span className="relative text-xs font-semibold tracking-[0.35em] text-muted-foreground">
        {label}
      </span>
    </div>
  )
}
