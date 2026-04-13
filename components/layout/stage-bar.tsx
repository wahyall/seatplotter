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
        "rounded-md border border-border bg-secondary px-4 py-2 text-center",
        className
      )}
    >
      <span className="text-xs font-semibold tracking-[0.3em] uppercase text-muted-foreground">
        {label}
      </span>
    </div>
  )
}
