"use client"

import * as React from "react"
import { toast } from "sonner"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import { useRealtimeSeats } from "@/lib/hooks/useRealtimeSeats"
import { ConnectionBanner } from "@/components/layout/connection-banner"
import { DualLayoutView } from "@/components/layout/dual-layout-view"
import { FilterChips } from "@/components/seat/filter-chips"
import { SeatInfoModal } from "@/components/seat/seat-info-modal"
import { Button } from "@/components/ui/button"
import { exportLayoutPNG } from "@/lib/export-png"
import type { Gender, SeatRow, SeatWithDim } from "@/types/db"
import { CameraIcon } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export default function ViewPage() {
  const config = useLayoutStore((s) => s.config)
  const isExporting = useLayoutStore((s) => s.isExporting)
  const maleL = useLayoutStore((s) => s.layouts.male)
  const femaleL = useLayoutStore((s) => s.layouts.female)
  const maleCats = useLayoutStore((s) => s.categories.male)
  const femaleCats = useLayoutStore((s) => s.categories.female)
  const maleSeats = useSeatStore(
    useShallow((s) => Object.values(s.seats.male ?? {}))
  )
  const femaleSeats = useSeatStore(
    useShallow((s) => Object.values(s.seats.female ?? {}))
  )

  const [viewGender, setViewGender] = React.useState<Gender>("male")
  const [filter, setFilter] = React.useState("all")
  const [selected, setSelected] = React.useState<
    (SeatRow & { gender: string; layoutLabel: string }) | null
  >(null)

  const ids = [maleL?.id, femaleL?.id].filter(Boolean) as string[]
  const { isConnected } = useRealtimeSeats(ids)

  const activeSeats = viewGender === "male" ? maleSeats : femaleSeats
  const activeCategories = viewGender === "male" ? maleCats : femaleCats

  const counts = React.useMemo(() => {
    const m: Record<string, number> = { all: 0 }
    for (const s of activeSeats) {
      if (s.is_empty) continue
      m.all = (m.all ?? 0) + 1
      if (s.category_id) {
        m[s.category_id] = (m[s.category_id] ?? 0) + 1
      }
    }
    return m
  }, [activeSeats])

  React.useEffect(() => {
    setFilter("all")
  }, [viewGender])

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4 pb-8">
      {isExporting && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="mt-4 font-medium text-foreground">Menyiapkan gambar...</p>
        </div>
      )}

      <ConnectionBanner isConnected={isConnected} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold">Tampilan denah</h1>
          <p className="text-sm text-muted-foreground">
            Pilih sisi — tap kursi untuk detail.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="shrink-0 rounded-full shadow-lg"
          onClick={() => {
            useLayoutStore.getState().setIsExporting(true);
            setTimeout(() => {
              exportLayoutPNG(config?.event_name ?? "event")
                .catch((err) => {
                  console.error(err);
                  toast.error("Export gagal")
                })
                .finally(() => {
                  useLayoutStore.getState().setIsExporting(false);
                });
            }, 100);
          }}
        >
          <CameraIcon className="size-5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-muted-foreground">Sisi</Label>
        <div className="inline-flex rounded-xl border border-border bg-background p-1">
          <Button
            type="button"
            variant={viewGender === "male" ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "rounded-lg px-4",
              viewGender === "male" && "text-blue-400"
            )}
            onClick={() => setViewGender("male")}
          >
            Pria
          </Button>
          <Button
            type="button"
            variant={viewGender === "female" ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "rounded-lg px-4",
              viewGender === "female" && "text-pink-400"
            )}
            onClick={() => setViewGender("female")}
          >
            Wanita
          </Button>
        </div>
      </div>

      <FilterChips
        categories={activeCategories}
        active={filter}
        onChange={setFilter}
        counts={counts}
      />

      <div
        id="export-layout"
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          isExporting && "h-max min-h-max w-max min-w-max bg-[#0c0c0f] p-8 -m-8"
        )}
      >
        <DualLayoutView
          stageLabel={config?.stage_label ?? "STAGE"}
          maleSeats={maleSeats as SeatWithDim[]}
          femaleSeats={femaleSeats as SeatWithDim[]}
          maleLayout={maleL}
          femaleLayout={femaleL}
          maleCategories={maleCats}
          femaleCategories={femaleCats}
          activeFilter={filter}
          visibleSide={viewGender}
          onSeatTap={(seat, side) => {
            setSelected({
              ...seat,
              gender: side,
              layoutLabel:
                side === "male" ? (maleL?.label ?? "") : (femaleL?.label ?? ""),
            })
          }}
        />
        
        {isExporting && activeCategories.length > 0 && (
          <div className="mt-8 flex flex-col items-center gap-4 border-t border-white/10 pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Keterangan Kategori — {viewGender === "male" ? "Pria" : "Wanita"}
            </h3>
            <div className="flex flex-wrap justify-center gap-6">
              {activeCategories.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <div
                    className="size-4 rounded-sm border border-white/20 shadow-sm"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-sm font-medium text-white/90">
                    {c.name} ({counts?.[c.id] ?? 0})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <SeatInfoModal
        open={!!selected}
        onClose={() => setSelected(null)}
        seat={selected}
        layoutLabel={selected?.layoutLabel ?? ""}
        category={activeCategories.find((c) => c.id === selected?.category_id)}
      />
    </div>
  )
}
