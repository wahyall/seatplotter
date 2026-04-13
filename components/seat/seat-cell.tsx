"use client"

import * as React from "react"
import { CheckIcon, UserIcon, GiftIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CategoryRow, SeatRow, SeatWithDim } from "@/types/db"
import { useSeatStore } from "@/store/useSeatStore"

export type SeatMode = "editor" | "view" | "check" | "booking" | "goodie_bag"

export type SeatBookingState = {
  /** Seat is booked by someone (has participant_id) */
  _booked?: boolean
  /** Seat is booked by the current user (mine) */
  _mine?: boolean
  /** Initial of the participant for internal UI rendering */
  _mineInitial?: string
}

type SeatCellProps = {
  seat: SeatWithDim & SeatBookingState
  category?: CategoryRow
  mode: SeatMode
  onAction: (
    seatId: string,
    action:
      | "click"
      | "touchstart"
      | "touchend"
      | "longpress"
      | "touchpan"
  ) => void
  compact?: boolean
}

const PAN_CANCEL_PX = 14

function attachEditorPanGuard(
  seatId: string,
  startX: number,
  startY: number,
  onAction: SeatCellProps["onAction"]
) {
  const onMove = (ev: TouchEvent) => {
    if (ev.touches.length === 0) return
    const t = ev.touches[0]
    if (
      Math.abs(t.clientX - startX) > PAN_CANCEL_PX ||
      Math.abs(t.clientY - startY) > PAN_CANCEL_PX
    ) {
      onAction(seatId, "touchpan")
      cleanup()
    }
  }
  const cleanup = () => {
    window.removeEventListener("touchmove", onMove, true)
    window.removeEventListener("touchend", cleanup, true)
    window.removeEventListener("touchcancel", cleanup, true)
  }
  window.addEventListener("touchmove", onMove, { capture: true, passive: true })
  window.addEventListener("touchend", cleanup, { capture: true })
  window.addEventListener("touchcancel", cleanup, { capture: true })
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
  const isBookingMode = mode === "booking"
  const isCheckMode = mode === "check"
  const isGoodieBagMode = mode === "goodie_bag"
  
  const booked = isBookingMode && seat._booked
  const mine = isBookingMode && seat._mine

  const checkedStyle =
    (isCheckMode && seat.is_checked) || (isGoodieBagMode && seat.is_goodie_bag) ? "opacity-[0.4]" : ""

  return (
    <button
      type="button"
      data-seat-id={seat.id}
      style={{
        backgroundColor: booked && !mine
          ? "hsl(240 5% 28%)"
          : category?.color ?? "hsl(240 5% 22%)",
        width: "var(--seat-size, 34px)",
        height: "var(--seat-size, 34px)",
      }}
      className={cn(
        "relative shrink-0 rounded-md text-left font-mono text-[8px] font-bold text-white/90 shadow-sm transition-transform select-none",
        compact && "text-[9px]",
        "active:scale-90",
        dim,
        checkedStyle,
        animating && "animate-seat-pulse",
        booked && !mine && "cursor-not-allowed opacity-40",
        mine && "ring-2 ring-blue-500 ring-offset-1 ring-offset-background"
      )}
      onClick={() => onAction(seat.id, "click")}
      onTouchStart={(e) => {
        onAction(seat.id, "touchstart")
        if (mode === "editor" && e.touches[0]) {
          attachEditorPanGuard(
            seat.id,
            e.touches[0].clientX,
            e.touches[0].clientY,
            onAction
          )
        }
      }}
      onTouchEnd={() => onAction(seat.id, "touchend")}
    >
      <span className="absolute inset-0 flex items-center justify-center px-0.5 text-center leading-none">
        {seat.label}
      </span>
      {/* Booking mode: booked by others */}
      {booked && !mine && (
        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40">
          {/* {seat._mineInitial ? (
            <span className="text-[12px] font-black text-white/60 drop-shadow-md tracking-tighter" style={{ lineHeight: 1 }}>
              {seat._mineInitial?.substring(0, 2)}
            </span>
          ) : (
          )} */}
          <UserIcon className="size-3 text-white/80" strokeWidth={2.5} />
        </span>
      )}
      {/* Booking mode: my seat */}
      {mine && (
        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-blue-200/80 ring-2 ring-blue-400 ring-offset-1 ring-offset-background">
          <span className="text-[12px] font-black text-slate-800 drop-shadow-md tracking-tighter" style={{ lineHeight: 1 }}>
            {seat._mineInitial?.substring(0, 2) ?? "✓"}
          </span>
        </span>
      )}
      {/* Check/GoodieBag mode overrides: booked (selected) or checked-in */}
      {(isCheckMode || isGoodieBagMode) && seat.participant_id && !seat.is_checked && !seat.is_goodie_bag && (
        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50">
          <UserIcon className="size-3.5 text-white/90 drop-shadow-sm" strokeWidth={2.5} />
        </span>
      )}
      {seat.is_checked && !seat.participant_id && !isBookingMode && mode !== "editor" && !isGoodieBagMode && (
        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 ring-2 ring-emerald-400 saturate-50">
          <CheckIcon className="size-5 text-white/90 drop-shadow-lg" strokeWidth={3} />
        </span>
      )}
      {seat.is_goodie_bag && isGoodieBagMode && (
        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 ring-2 ring-purple-400 saturate-50">
          <GiftIcon className="size-5 text-white/90 drop-shadow-lg" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

export const SeatCell = React.memo(SeatCellInner, areEqual)

function areEqual(prev: SeatCellProps, next: SeatCellProps) {
  return (
    prev.seat.is_checked === next.seat.is_checked &&
    prev.seat.is_goodie_bag === next.seat.is_goodie_bag &&
    prev.seat.category_id === next.seat.category_id &&
    prev.seat.participant_id === next.seat.participant_id &&
    prev.seat.is_empty === next.seat.is_empty &&
    prev.seat.label === next.seat.label &&
    prev.seat._dimmed === next.seat._dimmed &&
    prev.seat._booked === next.seat._booked &&
    prev.seat._mine === next.seat._mine &&
    prev.seat._mineInitial === next.seat._mineInitial &&
    prev.mode === next.mode &&
    prev.category?.color === next.category?.color &&
    prev.compact === next.compact
  )
}
