"use client"

import * as React from "react"
import type { CategoryRow, LayoutRow, SeatWithDim } from "@/types/db"
import { SeatGrid } from "@/components/seat/seat-grid"
import { StageBar } from "@/components/layout/stage-bar"
import { useZoomPan } from "@/lib/hooks/useZoomPan"
import { cn } from "@/lib/utils"
import { useLayoutStore } from "@/store/useLayoutStore"

export function DualLayoutView({
  stageLabel,
  maleSeats,
  femaleSeats,
  maleLayout,
  femaleLayout,
  maleCategories,
  femaleCategories,
  activeFilter,
  onSeatTap,
  /** When set, only this side is shown (full width). Omit to show both columns. */
  visibleSide,
}: {
  stageLabel: string
  maleSeats: SeatWithDim[]
  femaleSeats: SeatWithDim[]
  maleLayout: LayoutRow | null
  femaleLayout: LayoutRow | null
  maleCategories: CategoryRow[]
  femaleCategories: CategoryRow[]
  activeFilter: string
  onSeatTap: (
    seat: SeatWithDim,
    side: "male" | "female"
  ) => void
  visibleSide?: "male" | "female"
}) {
  const zoomRef = React.useRef<HTMLDivElement>(null)
  const { onTouchStart, onTouchMove, reset } = useZoomPan()
  const isExporting = useLayoutStore((s) => s.isExporting)

  const filterSeats = React.useCallback(
    (list: SeatWithDim[], cats: CategoryRow[]) => {
      if (activeFilter === "all") return list
      return list.map((s) => ({
        ...s,
        _dimmed: s.category_id !== activeFilter,
      }))
    },
    [activeFilter]
  )

  const showMale =
    maleLayout && (!visibleSide || visibleSide === "male")
  const showFemale =
    femaleLayout && (!visibleSide || visibleSide === "female")
  const singleColumn = visibleSide != null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <StageBar label={stageLabel} />
      <div
        ref={zoomRef}
        className={cn(
          "flex min-h-0 flex-1 touch-none gap-3 overflow-x-auto pb-2",
          singleColumn && "justify-center",
          isExporting && "h-max min-h-max w-max min-w-max overflow-visible"
        )}
        onTouchStart={onTouchStart}
        // onTouchMove={(e) => onTouchMove(e, zoomRef.current)}
        onDoubleClick={() => reset(zoomRef.current)}
      >
        {showMale && (
          <section
            className={cn(
              "flex flex-col rounded-md border border-blue-500/20 p-3",
              singleColumn
                ? "w-full max-w-2xl flex-1"
                : "min-w-[min(100%,380px)] flex-1"
            )}
          >
            <h3 className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-blue-400">
              Pria
            </h3>
            <SeatGrid
              seats={filterSeats(maleSeats, maleCategories)}
              layout={maleLayout!}
              categories={maleCategories}
              mode="view"
              compact
              onSeatAction={(id, action) => {
                if (action !== "click") return
                const s = maleSeats.find((x) => x.id === id)
                if (s) onSeatTap({ ...s, _dimmed: undefined }, "male")
              }}
              className="min-h-0"
            />
          </section>
        )}
        {showFemale && (
          <section
            className={cn(
              "flex flex-col rounded-md border border-pink-500/20 p-3",
              singleColumn
                ? "w-full max-w-2xl flex-1"
                : "min-w-[min(100%,380px)] flex-1"
            )}
          >
            <h3 className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-pink-400">
              Wanita
            </h3>
            <SeatGrid
              seats={filterSeats(femaleSeats, femaleCategories)}
              layout={femaleLayout!}
              categories={femaleCategories}
              mode="view"
              compact
              onSeatAction={(id, action) => {
                if (action !== "click") return
                const s = femaleSeats.find((x) => x.id === id)
                if (s) onSeatTap({ ...s, _dimmed: undefined }, "female")
              }}
              className="min-h-0"
            />
          </section>
        )}
      </div>
    </div>
  )
}
