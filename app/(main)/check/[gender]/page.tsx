"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import type { Gender } from "@/types/db"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useShallow } from "zustand/react/shallow"
import { useRealtimeSeats } from "@/lib/hooks/useRealtimeSeats"
import { persistCheck, useSeatStore } from "@/store/useSeatStore"
import { ConnectionBanner } from "@/components/layout/connection-banner"
import { StageBar } from "@/components/layout/stage-bar"
import { SeatGrid } from "@/components/seat/seat-grid"
import { FilterChips } from "@/components/seat/filter-chips"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { XIcon, QrCodeIcon, CheckCircle2Icon } from "lucide-react"
export default function CheckGenderPage() {
  const params = useParams()
  const g = params.gender as string
  const gender = (g === "male" || g === "female" ? g : null) as Gender | null
  if (!gender) {
    return (
      <p className="text-sm text-muted-foreground">Layout tidak valid.</p>
    )
  }

  const layout = useLayoutStore((s) => s.layouts[gender])
  const categories = useLayoutStore((s) => s.categories[gender])
  const config = useLayoutStore((s) => s.config)
  const seats = useSeatStore(
    useShallow((s) => Object.values(s.seats[gender] ?? {}))
  )

  const { isConnected } = useRealtimeSeats(layout?.id)
  const scanQrUrl = config?.scan_qr_url ?? ""

  const [filter, setFilter] = React.useState("all")
  const [withScanQr, setWithScanQr] = React.useState(false)
  const [qrModalSeatId, setQrModalSeatId] = React.useState<string | null>(null)

  const stats = React.useMemo(() => {
    const active = seats.filter((s) => !s.is_empty)
    const checked = active.filter((s) => s.is_checked)
    const pct =
      active.length > 0
        ? Math.round((checked.length / active.length) * 100)
        : 0
    return { total: active.length, checked: checked.length, pct }
  }, [seats])

  const filteredSeats = React.useMemo(() => {
    if (filter === "all") return seats
    return seats.map((s) => ({
      ...s,
      _dimmed: s.category_id !== filter,
    }))
  }, [seats, filter])

  const counts = React.useMemo(() => {
    const m: Record<string, number> = { all: 0 }
    for (const s of seats) {
      if (s.is_empty) continue
      m.all += 1
      if (s.category_id) m[s.category_id] = (m[s.category_id] ?? 0) + 1
    }
    return m
  }, [seats])

  const handleSeatRef = React.useRef<(seatId: string, action: string) => void>(() => {})

  handleSeatRef.current = async (
    seatId: string,
    action: string,
  ) => {
    if (action !== "click") return
    const seat = useSeatStore.getState().seats[gender][seatId]
    if (!seat || seat.is_empty) return
    if (filter !== "all" && seat.category_id !== filter) return

    // If scan QR mode is enabled and seat is not yet checked, open modal
    if (withScanQr && scanQrUrl && !seat.is_checked) {
      setQrModalSeatId(seatId)
      return
    }

    const next = !seat.is_checked
    useSeatStore.getState().updateSeatLocal(seatId, gender, {
      is_checked: next,
      checked_at: next ? new Date().toISOString() : null,
    })
    try {
      await persistCheck(gender, seatId, next)
    } catch {
      toast.error("Gagal update kursi")
      useSeatStore.getState().updateSeatLocal(seatId, gender, {
        is_checked: !next,
        checked_at: null,
      })
    }
  }

  const handleSeat = React.useCallback(
    (seatId: string, action: "click" | "touchstart" | "touchend" | "longpress" | "touchpan") => {
      handleSeatRef.current(seatId, action)
    },
    []
  )

  const confirmScanAndCheck = async () => {
    if (!qrModalSeatId || !gender) return
    const seatId = qrModalSeatId
    setQrModalSeatId(null)
    useSeatStore.getState().updateSeatLocal(seatId, gender, {
      is_checked: true,
      checked_at: new Date().toISOString(),
    })
    try {
      await persistCheck(gender, seatId, true)
      toast.success("Kursi berhasil dicentang")
    } catch {
      toast.error("Gagal update kursi")
      useSeatStore.getState().updateSeatLocal(seatId, gender, {
        is_checked: false,
        checked_at: null,
      })
    }
  }

  if (!layout) return null

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4 pb-8">
      <ConnectionBanner isConnected={isConnected} />

      <div>
        <h1 className="font-display text-xl font-bold">
          Centang — {layout.label}
        </h1>
        <p className="text-sm text-muted-foreground">
          Tap kursi untuk hadir / batal hadir.
        </p>
      </div>

      <motion.div
        className="rounded-2xl border border-border/80 bg-card/50 p-4"
        initial={false}
        animate={{ opacity: 1 }}
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {stats.checked}{" "}
              <span className="text-muted-foreground">/ {stats.total}</span>
            </p>
            <p className="text-xs text-muted-foreground">Tercentang</p>
          </div>
          <span className="text-3xl font-bold tabular-nums text-primary">
            {stats.pct}%
          </span>
        </div>
        <Progress value={stats.pct} className="h-3" />
      </motion.div>

      <FilterChips
        categories={categories}
        active={filter}
        onChange={setFilter}
        counts={counts}
      />

      {scanQrUrl && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="with-scan-qr"
            checked={withScanQr}
            onCheckedChange={(v) => setWithScanQr(v === true)}
          />
          <Label
            htmlFor="with-scan-qr"
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm"
          >
            <QrCodeIcon className="size-3.5" />
            Dengan Scan QR
          </Label>
        </div>
      )}

      <StageBar label={config?.stage_label ?? "STAGE"} />

      <SeatGrid
        seats={filteredSeats}
        layout={layout}
        categories={categories}
        mode="check"
        onSeatAction={handleSeat}
      />

      {/* Fullscreen QR Scan Modal */}
      <AnimatePresence>
        {qrModalSeatId && scanQrUrl && (
          <motion.div
            key="qr-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col bg-background"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <QrCodeIcon className="size-4 text-primary" />
                Scan QR — {useSeatStore.getState().seats[gender][qrModalSeatId]?.label ?? qrModalSeatId}
              </div>
              <button
                onClick={() => setQrModalSeatId(null)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            {/* Iframe */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={scanQrUrl}
                className="h-full w-full border-0"
                allow="camera;microphone"
              />
            </div>

            {/* Footer action */}
            <div className="border-t border-border/60 p-4 space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                Klik tombol di bawah ini jika Anda sudah berhasil melakukan scan QR.
              </p>
              <Button
                onClick={confirmScanAndCheck}
                size="lg"
                className="w-full gap-2 rounded-xl"
              >
                <CheckCircle2Icon className="size-4" />
                Tutup & Centang Kursi
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
