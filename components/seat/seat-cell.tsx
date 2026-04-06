"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CategoryRow, SeatRow, SeatWithDim } from "@/types/db"
import { useSeatStore } from "@/store/useSeatStore"

export type SeatMode = "editor" | "view" | "check"

type SeatCellProps = {
  seat: SeatWithDim
  category?: CategoryRow
  mode: SeatMode
  onAction: (
    seatId: string,
    action: "click" | "touchstart" | "touchend" | "longpress"
  ) => void
  compact?: boolean
}

function SeatCellInner({
  seat,
  category,
  mode,
  onAction,
  compact,
}: SeatCellProps) {
  const animating = useSeatStore(
    (s) => s.animatingIds[seat.id] === true
  )

  if (seat.is_empty) {
    if (mode === "editor") {
      return (
        <button
          type="button"
          data-seat-id={seat.id}
          className={cn(
            "shrink-0 rounded-md border border-dashed border-border/50 bg-muted/20 transition-transform select-none",
            "active:scale-90",
            compact ? "h-10 w-10" : "h-[34px] w-[34px]"
          )}
          style={{
            width: "var(--seat-size, 34px)",
            height: "var(--seat-size, 34px)",
          }}
          onClick={() => onAction(seat.id, "click")}
          onTouchStart={() => onAction(seat.id, "touchstart")}
          onTouchEnd={() => onAction(seat.id, "touchend")}
        />
      )
    }
    return (
      <div
        className={cn(
          "shrink-0 rounded-md border border-dashed border-border/50 bg-muted/20",
          compact ? "h-10 w-10" : "h-[34px] w-[34px]"
        )}
        style={{ width: "var(--seat-size, 34px)", height: "var(--seat-size, 34px)" }}
      />
    )
  }

  const dim = seat._dimmed ? "opacity-[0.2]" : ""
  const checkedStyle =
    mode !== "editor" && seat.is_checked ? "opacity-50" : ""

  return (
    <button
      type="button"
      data-seat-id={seat.id}
      style={{
        backgroundColor: category?.color ?? "hsl(240 5% 22%)",
        width: "var(--seat-size, 34px)",
        height: "var(--seat-size, 34px)",
      }}
      className={cn(
        "relative shrink-0 rounded-md text-left font-mono text-[8px] font-bold text-white/90 shadow-sm transition-transform select-none",
        compact && "text-[9px]",
        "active:scale-90",
        dim,
        checkedStyle,
        animating && "animate-seat-pulse"
      )}
      onClick={() => onAction(seat.id, "click")}
      onTouchStart={() => onAction(seat.id, "touchstart")}
      onTouchEnd={() => onAction(seat.id, "touchend")}
    >
      <span className="absolute inset-0 flex items-center justify-center px-0.5 text-center leading-none">
        {seat.label}
      </span>
      {seat.is_checked && mode !== "editor" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
          <CheckIcon className="size-4 text-white drop-shadow-md" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

export const SeatCell = React.memo(SeatCellInner, areEqual)

function areEqual(prev: SeatCellProps, next: SeatCellProps) {
  return (
    prev.seat.is_checked === next.seat.is_checked &&
    prev.seat.category_id === next.seat.category_id &&
    prev.seat.is_empty === next.seat.is_empty &&
    prev.seat.label === next.seat.label &&
    prev.seat._dimmed === next.seat._dimmed &&
    prev.mode === next.mode &&
    prev.category?.color === next.category?.color &&
    prev.compact === next.compact
  )
}
