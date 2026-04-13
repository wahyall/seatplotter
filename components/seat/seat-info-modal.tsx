"use client"

import type { CategoryRow, SeatRow } from "@/types/db"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2Icon } from "lucide-react"

export function SeatInfoModal({
  open,
  onClose,
  seat,
  layoutLabel,
  category,
}: {
  open: boolean
  onClose: () => void
  seat: (SeatRow & { gender: string }) | null
  layoutLabel: string
  category?: CategoryRow
}) {
  if (!seat) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Kursi {seat.label}</DialogTitle>
        </DialogHeader>
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Layout</dt>
            <dd className="font-medium">{layoutLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Kategori</dt>
            <dd>
              {category ? (
                <Badge
                  className="text-white"
                  style={{ backgroundColor: category.color }}
                >
                  {category.name}
                </Badge>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="inline-flex items-center gap-1">
              {seat.is_checked ? (
                <>
                  <CheckCircle2Icon className="size-4 text-emerald-500" />
                  Sudah hadir
                </>
              ) : (
                "Belum"
              )}
            </dd>
          </div>
          {seat.checked_at && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Dicatat</dt>
              <dd className="font-mono text-xs">
                {new Date(seat.checked_at).toLocaleTimeString("id-ID")}
              </dd>
            </div>
          )}
        </dl>
        <DialogFooter>
          <Button className="rounded-md" onClick={onClose}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
