"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import { useRealtimeSeats } from "@/lib/hooks/useRealtimeSeats"
import { ConnectionBanner } from "@/components/layout/connection-banner"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArmchairIcon,
  CalendarIcon,
  MapPinIcon,
  RadioIcon,
  SettingsIcon,
  CheckCircle2Icon,
  QrCodeIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

function statsForGender(
  gender: "male" | "female",
  seats: Record<string, import("@/types/db").SeatRow>
) {
  const list = Object.values(seats)
  const active = list.filter((s) => !s.is_empty)
  const checked = active.filter((s) => s.is_checked)
  const pct =
    active.length > 0 ? Math.round((checked.length / active.length) * 100) : 0
  return {
    total: active.length,
    checked: checked.length,
    pct,
  }
}

export default function DashboardPage() {
  const hydrated = useLayoutStore((s) => s.hydrated)
  const config = useLayoutStore((s) => s.config)
  const maleL = useLayoutStore((s) => s.layouts.male)
  const femaleL = useLayoutStore((s) => s.layouts.female)
  const maleSeats = useSeatStore((s) => s.seats.male)
  const femaleSeats = useSeatStore((s) => s.seats.female)
  const patchConfig = useLayoutStore((s) => s.patchConfig)

  const scanQrUrl = config?.scan_qr_url ?? ""

  const ids = [maleL?.id, femaleL?.id].filter(Boolean) as string[]
  const { isConnected } = useRealtimeSeats(ids)

  const maleStats = React.useMemo(
    () => statsForGender("male", maleSeats),
    [maleSeats]
  )
  const femaleStats = React.useMemo(
    () => statsForGender("female", femaleSeats),
    [femaleSeats]
  )

  // Debounced persist to Supabase
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScanQrUrlChange = React.useCallback(
    (value: string) => {
      patchConfig({ scan_qr_url: value })

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        if (!config?.id) return
        const { error } = await supabase
          .from("config")
          .update({ scan_qr_url: value, updated_at: new Date().toISOString() })
          .eq("id", config.id)
        if (error) toast.error("Gagal menyimpan Scan QR Url")
      }, 600)
    },
    [config?.id, patchConfig]
  )

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-2/3 max-w-md rounded-xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-8">
      <ConnectionBanner isConnected={isConnected} />

      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <ArmchairIcon className="size-8" />
          <span className="font-display text-lg font-semibold tracking-tight">
            SeatPlotter
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
          {config?.event_name ?? "Event"}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {config?.event_date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" />
              {config.event_date}
            </span>
          )}
          {config?.event_venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="size-3.5" />
              {config.event_venue}
            </span>
          )}
        </div>
      </header>

      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
          isConnected
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            : "border-amber-500/40 bg-amber-500/10 text-amber-400"
        )}
      >
        <RadioIcon
          className={cn("size-3", isConnected && "animate-pulse")}
        />
        {isConnected ? "Live — sinkron realtime" : "Menyambungkan…"}
      </div>

      <Card className="overflow-hidden border-border/60">
        <CardContent className="p-4">
          <Label
            htmlFor="scan-qr-url"
            className="mb-2 inline-flex items-center gap-2 text-sm font-medium"
          >
            <QrCodeIcon className="size-4 text-primary" />
            Scan QR Url
          </Label>
          <Input
            id="scan-qr-url"
            type="url"
            placeholder="https://example.com/scan"
            value={scanQrUrl}
            onChange={(e) => handleScanQrUrlChange(e.target.value)}
            className="rounded-lg"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            URL yang digunakan untuk iframe scan QR di halaman centang.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="overflow-hidden border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Pria</CardTitle>
              <CardDescription>
                {maleStats.checked} / {maleStats.total} hadir
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={maleStats.pct} className="h-2" />
              <p className="text-2xl font-bold tabular-nums">{maleStats.pct}%</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          <Card className="overflow-hidden border-pink-500/20 bg-gradient-to-br from-pink-500/10 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Wanita</CardTitle>
              <CardDescription>
                {femaleStats.checked} / {femaleStats.total} hadir
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={femaleStats.pct} className="h-2" />
              <p className="text-2xl font-bold tabular-nums">{femaleStats.pct}%</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/editor"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "inline-flex gap-2 rounded-xl"
          )}
        >
          <SettingsIcon className="size-4" />
          Edit layout
        </Link>
        <Link
          href="/check"
          className={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            "inline-flex gap-2 rounded-xl"
          )}
        >
          <CheckCircle2Icon className="size-4" />
          Mulai centang
        </Link>
      </div>
    </div>
  )
}
