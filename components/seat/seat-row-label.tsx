"use client"

import { cn } from "@/lib/utils"

export function SeatRowLabel({
  row,
  compact,
}: {
  row: number
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex w-7 shrink-0 items-center justify-center font-mono text-[10px] font-medium text-muted-foreground",
        compact && "w-8 text-[11px]"
      )}
    >
      {row + 1}
    </div>
  )
}
