"use client"

import * as React from "react"
import { toast } from "sonner"
import { bulkAssignCategory } from "@/lib/seats"
import type { Gender, LayoutRow } from "@/types/db"
import { useLayoutStore } from "@/store/useLayoutStore"
import {
  persistAssignUndoable,
  persistEmptyUndoable,
  persistLabelUndoable,
  useSeatStore,
} from "@/store/useSeatStore"
import { SeatGrid } from "@/components/seat/seat-grid"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { EraserIcon, PaintbrushIcon, Redo2Icon, Undo2Icon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useShallow } from "zustand/react/shallow"

export function AssignPanel({
  layout,
  gender,
}: {
  layout: LayoutRow
  gender: Gender
}) {
  const categories = useLayoutStore((s) => s.categories[gender])
  const seats = useSeatStore(
    useShallow((s) => Object.values(s.seats[gender] ?? {}))
  )
  const [mode, setMode] = React.useState<"assign" | "empty">("assign")
  const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(
    null
  )
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [labelDraft, setLabelDraft] = React.useState("")

  /** Latest assign target + mode for handlers — state can lag one frame after button tap */
  const activeCategoryIdRef = React.useRef<string | null>(null)
  const modeRef = React.useRef<"assign" | "empty">("assign")

  const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const draggedSeats = React.useRef(new Set<string>())
  const dragBefore = React.useRef<
    Record<string, { category_id: string | null; is_empty: boolean }>
  >({})
  const suppressClick = React.useRef(false)
  const longPressTriggered = React.useRef(false)
  const didInitCategory = React.useRef(false)

  React.useEffect(() => {
    if (categories.length === 0) {
      didInitCategory.current = false
      activeCategoryIdRef.current = null
      setActiveCategoryId(null)
      return
    }
    const firstId = categories[0]?.id
    if (!firstId || didInitCategory.current) return
    didInitCategory.current = true
    activeCategoryIdRef.current = firstId
    setActiveCategoryId(firstId)
  }, [categories])

  const undo = useSeatStore((s) => s.undo)
  const redo = useSeatStore((s) => s.redo)
  const canUndo = useSeatStore((s) => s.canUndo)
  const canRedo = useSeatStore((s) => s.canRedo)

  const paintSeat = (seatId: string) => {
    const catId = activeCategoryIdRef.current
    if (!catId) return
    const st = useSeatStore.getState()
    const seat = st.seats[gender][seatId]
    if (!seat) return
    if (!(seatId in dragBefore.current)) {
      dragBefore.current[seatId] = {
        category_id: seat.category_id,
        is_empty: seat.is_empty,
      }
    }
    st.updateSeatLocal(seatId, gender, {
      category_id: catId,
      is_empty: false,
    })
    draggedSeats.current.add(seatId)
  }

  const handleSeatAction = async (
    seatId: string,
    action: "click" | "touchstart" | "touchend" | "longpress"
  ) => {
    const seat = useSeatStore.getState().seats[gender][seatId]
    if (!seat) return

    const currentMode = modeRef.current
    const currentCat = activeCategoryIdRef.current

    if (action === "touchstart") {
      draggedSeats.current = new Set([seatId])
      dragBefore.current = {}
      longPressRef.current = setTimeout(() => {
        longPressTriggered.current = true
        setEditingId(seatId)
        setLabelDraft(seat.label)
        longPressRef.current = null
      }, 550)
      return
    }

    if (action === "touchend") {
      if (longPressRef.current) {
        clearTimeout(longPressRef.current)
        longPressRef.current = null
      }
      if (longPressTriggered.current) {
        longPressTriggered.current = false
        draggedSeats.current.clear()
        dragBefore.current = {}
        return
      }

      const ids = [...draggedSeats.current]
      draggedSeats.current.clear()

      if (currentMode === "empty" && ids.length > 0) {
        const id = ids[0]
        const s = useSeatStore.getState().seats[gender][id]
        if (s && !longPressTriggered.current) {
          suppressClick.current = true
          window.setTimeout(() => {
            suppressClick.current = false
          }, 450)
          try {
            await persistEmptyUndoable(gender, id, !s.is_empty)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Gagal")
          }
        }
        dragBefore.current = {}
        return
      }

      if (
        currentMode === "assign" &&
        currentCat &&
        ids.length > 0
      ) {
        suppressClick.current = true
        window.setTimeout(() => {
          suppressClick.current = false
        }, 450)
        try {
          type Patch = { category_id: string | null; is_empty: boolean }
          const before: Record<string, Patch> = {}
          for (const id of ids) {
            const snap = dragBefore.current[id]
            const s = useSeatStore.getState().seats[gender][id]
            if (!s) continue
            if (snap) {
              before[id] = {
                category_id: snap.category_id,
                is_empty: snap.is_empty,
              }
            } else {
              before[id] = {
                category_id: s.category_id,
                is_empty: s.is_empty,
              }
            }
          }
          await bulkAssignCategory(ids, currentCat)
          useSeatStore.getState().bulkUpdateLocal(ids, gender, {
            category_id: currentCat,
            is_empty: false,
          })
          useSeatStore.getState().pushHistory({
            gender,
            seatIds: ids,
            before,
            after: Object.fromEntries(
              ids.map((id) => [id, { category_id: currentCat, is_empty: false }])
            ),
          })
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Bulk gagal")
        }
      }
      dragBefore.current = {}
      return
    }

    if (action === "longpress") return

    if (action === "click" && suppressClick.current) return

    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }

    if (currentMode === "empty") {
      try {
        await persistEmptyUndoable(gender, seatId, !seat.is_empty)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal")
      }
      return
    }

    if (!currentCat) {
      toast.message("Pilih kategori dulu")
      return
    }

    const newCategoryId =
      seat.category_id === currentCat ? null : currentCat
    try {
      await persistAssignUndoable(gender, [seatId], newCategoryId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal")
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (modeRef.current !== "assign" || !activeCategoryIdRef.current) return
    const touch = e.touches[0]
    if (!touch) return
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const id = el?.closest("[data-seat-id]")?.getAttribute("data-seat-id")
    if (id) paintSeat(id)
  }

  const saveLabel = async () => {
    if (!editingId) return
    const t = labelDraft.trim().slice(0, 10)
    if (!t) return
    try {
      await persistLabelUndoable(gender, editingId, t)
      setEditingId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal simpan")
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/80 bg-muted/20">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-muted-foreground">Mode</Label>
            <div className="inline-flex rounded-xl border border-border bg-background p-1">
              <Button
                type="button"
                variant={mode === "assign" ? "secondary" : "ghost"}
                size="sm"
                className="gap-2 rounded-lg px-4"
                onClick={() => {
                  modeRef.current = "assign"
                  setMode("assign")
                }}
              >
                <PaintbrushIcon className="size-4" />
                Assign
              </Button>
              <Button
                type="button"
                variant={mode === "empty" ? "secondary" : "ghost"}
                size="sm"
                className="gap-2 rounded-lg px-4"
                onClick={() => {
                  modeRef.current = "empty"
                  setMode("empty")
                }}
              >
                <EraserIcon className="size-4" />
                Kosong
              </Button>
            </div>
          </div>

          {mode === "assign" && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Kategori aktif</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    size="sm"
                    variant={
                      activeCategoryId === c.id ? "default" : "outline"
                    }
                    className={cn(
                      "rounded-full border-transparent text-white shadow-sm",
                      activeCategoryId === c.id &&
                        "ring-2 ring-ring ring-offset-2 ring-offset-background"
                    )}
                    style={{ backgroundColor: c.color }}
                    onClick={() => {
                      activeCategoryIdRef.current = c.id
                      setActiveCategoryId(c.id)
                    }}
                  >
                    {c.name}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => {
                    activeCategoryIdRef.current = null
                    setActiveCategoryId(null)
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={!canUndo()}
              onClick={() => void undo()}
            >
              <Undo2Icon className="size-4" />
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={!canRedo()}
              onClick={() => void redo()}
            >
              <Redo2Icon className="size-4" />
              Redo
            </Button>
          </div>
        </CardContent>
      </Card>

      <div onTouchMove={onTouchMove}>
        <SeatGrid
          seats={seats}
          layout={layout}
          categories={categories}
          mode="editor"
          onSeatAction={handleSeatAction}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Long-press kursi untuk edit label. Drag untuk assign massal.
      </p>

      <Dialog
        open={!!editingId}
        onOpenChange={(open) => {
          if (!open) setEditingId(null)
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit label kursi</DialogTitle>
          </DialogHeader>
          <Input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            className="rounded-xl"
            maxLength={10}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Batal
            </Button>
            <Button onClick={() => void saveLabel()}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
