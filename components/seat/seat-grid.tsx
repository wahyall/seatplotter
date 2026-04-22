"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { getColHeaders } from "@/lib/seat-label"
import type { CategoryRow, LayoutRow, SeatWithDim } from "@/types/db"
import { SeatColHeader } from "@/components/seat/seat-col-header"
import { SeatRowLabel } from "@/components/seat/seat-row-label"
import { SeatCell, type SeatMode, type SeatBookingState } from "@/components/seat/seat-cell"
import { cn } from "@/lib/utils"
import { useLayoutStore } from "@/store/useLayoutStore"

/** Virtualized grid; single-seat actions via `onSeatAction`. Bulk drag-assign is not used here (editor handles tap / long-press only). */
export function SeatGrid({
  seats,
  layout,
  categories,
  mode,
  onSeatAction,
  className,
  compact,
}: {
  seats: (SeatWithDim & SeatBookingState)[]
  layout: LayoutRow
  categories: CategoryRow[]
  mode: SeatMode
  onSeatAction: (
    seatId: string,
    action:
      | "click"
      | "touchstart"
      | "touchend"
      | "longpress"
      | "touchpan"
  ) => void | Promise<void>
  className?: string
  compact?: boolean
}) {
  const headers = React.useMemo(
    () =>
      getColHeaders(
        layout.col_start_char,
        layout.cols,
        layout.reverse_col
      ),
    [layout.col_start_char, layout.cols, layout.reverse_col]
  )

  const seatsByRow = React.useMemo(() => {
    const map: Record<number, Record<number, SeatWithDim>> = {}
    for (const s of seats) {
      const r = Number(s.row)
      const c = Number(s.col)
      if (!Number.isFinite(r) || !Number.isFinite(c)) continue
      if (!map[r]) map[r] = {}
      map[r][c] = s
    }
    return map
  }, [seats])

  const parentRef = React.useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: layout.rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (compact ? 50 : 44),
    overscan: 6,
  })

  const cat = React.useCallback(
    (id: string | null) => categories.find((c) => c.id === id),
    [categories]
  )

  const isExporting = useLayoutStore((s) => s.isExporting)

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col [--seat-size:34px] lg:[--seat-size:42px]",
        compact && "[--seat-size:34px]",
        className
      )}
    >
      <div
        ref={parentRef}
        className={cn(
          "h-[min(58vh,520px)] overflow-auto rounded-md border border-border bg-card p-2",
          isExporting && "h-auto overflow-visible"
        )}
      >
        <div className="min-w-max">
          <div className="sticky top-0 z-10 -mx-2 mb-1 border-b border-border bg-card px-2 py-1">
            <SeatColHeader headers={headers} compact={compact} />
          </div>
          <div
            className={cn("relative", isExporting && "static space-y-[3px]")}
            style={!isExporting ? { height: rowVirtualizer.getTotalSize() } : undefined}
          >
            {isExporting
              ? Array.from({ length: layout.rows }).map((_, i) => (
                  <div
                    key={i}
                    className="flex w-max min-w-full items-center gap-[3px] px-1"
                  >
                    <SeatRowLabel row={i} compact={compact} />
                    {Array.from({ length: layout.cols }, (_, c) => {
                      const seat = seatsByRow[i]?.[c]
                      if (!seat) {
                        return (
                          <div
                            key={c}
                            className="shrink-0 rounded-md bg-muted/30"
                            style={{
                              width: "var(--seat-size, 34px)",
                              height: "var(--seat-size, 34px)",
                            }}
                          />
                        )
                      }
                      return (
                        <SeatCell
                          key={seat.id}
                          seat={seat}
                          category={cat(seat.category_id)}
                          mode={mode}
                          onAction={onSeatAction}
                          compact={compact}
                        />
                      )
                    })}
                    <SeatRowLabel row={i} compact={compact} />
                  </div>
                ))
              : rowVirtualizer.getVirtualItems().map((vRow) => (
                  <div
                    key={vRow.index}
                    className="absolute left-0 flex w-max min-w-full items-center gap-[3px] px-1"
                    style={{ top: vRow.start, height: vRow.size }}
                  >
                    <SeatRowLabel row={vRow.index} compact={compact} />
                    {Array.from({ length: layout.cols }, (_, c) => {
                      const seat = seatsByRow[vRow.index]?.[c]
                      if (!seat) {
                        return (
                          <div
                            key={c}
                            className="shrink-0 rounded-md bg-muted/30"
                            style={{
                              width: "var(--seat-size, 34px)",
                              height: "var(--seat-size, 34px)",
                            }}
                          />
                        )
                      }
                      return (
                        <SeatCell
                          key={seat.id}
                          seat={seat}
                          category={cat(seat.category_id)}
                          mode={mode}
                          onAction={onSeatAction}
                          compact={compact}
                        />
                      )
                    })}
                    <SeatRowLabel row={vRow.index} compact={compact} />
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  )
}
