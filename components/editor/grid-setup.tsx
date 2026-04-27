"use client"

import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import {
  getColHeaders,
  validateColRange,
  charToIndex,
  indexToChar,
} from "@/lib/seat-label"
import { fetchSeats } from "@/lib/seats"
import type { Gender, LayoutRow } from "@/types/db"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangleIcon, SparklesIcon } from "lucide-react"

export function GridSetup({
  layout,
  gender,
  onDone,
}: {
  layout: LayoutRow
  gender: Gender
  onDone: () => void
}) {
  const [rows, setRows] = React.useState(layout.rows)
  const [cols, setCols] = React.useState(layout.cols)
  const [colStart, setColStart] = React.useState(layout.col_start_char)
  const [reverse, setReverse] = React.useState(layout.reverse_col)
  const [loading, setLoading] = React.useState(false)

  const seatCount = useSeatStore(
    (s) => Object.keys(s.seats[gender]).length
  )
  const setSeats = useSeatStore((s) => s.setSeats)
  const setLayouts = useLayoutStore((s) => s.setLayouts)

  const headers = React.useMemo(
    () => getColHeaders(colStart, cols, reverse),
    [colStart, cols, reverse]
  )

  const validation = React.useMemo(
    () => validateColRange(colStart, cols),
    [colStart, cols]
  )

  const availableStarts = React.useMemo(() => {
    return Array.from({ length: 26 }, (_, i) => indexToChar(i)).filter(
      (char) => validateColRange(char, cols).valid
    )
  }, [cols])
  const startColNumber = React.useMemo(
    () => Math.max(1, charToIndex(colStart) + 1),
    [colStart]
  )

  const handleGenerate = async () => {
    if (!validation.valid || loading) return
    // No more confirmation dialog needed since generate endpoint syncs instead of replace

    setLoading(true)
    try {
      await supabase
        .from("layouts")
        .update({
          rows,
          cols,
          col_start_char: colStart,
          reverse_col: reverse,
          updated_at: new Date().toISOString(),
        })
        .eq("id", layout.id)

      const res = await fetch("/api/seats/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutId: layout.id }),
      })
      const json = (await res.json()) as {
        success?: boolean
        error?: string
      }
      if (!json.success) throw new Error(json.error ?? "Generate failed")

      const list = await fetchSeats(layout.id)
      setSeats(gender, list, layout.id)

      const { data: layoutFresh } = await supabase
        .from("layouts")
        .select("*")
        .eq("id", layout.id)
        .single()
      if (layoutFresh) {
        const { layouts: L } = useLayoutStore.getState()
        setLayouts(
          gender === "male" ? layoutFresh : L.male,
          gender === "female" ? layoutFresh : L.female
        )
      }

      toast.success("Grid berhasil dibuat")
      onDone()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Gagal generate"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="min-w-0 border-border bg-card">
      <CardHeader className="space-y-2 px-4 pt-5 sm:px-6 sm:pt-6">
        <CardTitle className="flex items-start gap-2 font-display text-lg sm:items-center sm:text-xl">
          <SparklesIcon className="mt-0.5 size-5 shrink-0 text-primary sm:mt-0" />
          <span className="min-w-0 wrap-break-word leading-snug">
            Setup grid — {layout.label}
          </span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Atur baris (huruf), kolom (angka), kolom awal angka, dan opsi reverse kolom.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-4 pb-6 sm:space-y-8 sm:px-6 sm:pb-8">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm">Jumlah baris</Label>
            <span className="text-sm font-medium tabular-nums">{rows}</span>
          </div>
          <Slider
            min={1}
            max={100}
            step={1}
            value={[rows]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v
              setRows(typeof n === "number" ? n : 10)
            }}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm">Jumlah kolom</Label>
            <span className="text-sm font-medium tabular-nums">{cols}</span>
          </div>
          <Slider
            min={1}
            max={52}
            step={1}
            value={[cols]}
            onValueChange={(v) => {
              const n = Array.isArray(v) ? v[0] : v
              setCols(typeof n === "number" ? n : 10)
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Mulai dari kolom angka</Label>
          <Select
            value={colStart}
            onValueChange={(v) => v && setColStart(v)}
          >
            <SelectTrigger className="h-11 w-full rounded-xl sm:h-10 sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableStarts.map((char) => (
                <SelectItem key={char} value={char}>
                  {charToIndex(char) + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Saat ini mulai dari kolom{" "}
            <strong className="text-foreground">{startColNumber}</strong>.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="rev"
              checked={reverse}
              onCheckedChange={(v) => setReverse(v === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="rev" className="cursor-pointer font-medium">
                Reverse kolom
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Angka kolom terbesar di kiri, angka awal di kanan (mis. 5–14 → 14 13 … 5).
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Preview urutan kolom (angka)</Label>
          <div className="max-w-full overflow-x-auto rounded-xl border border-dashed border-border bg-background/80 p-3 [-webkit-overflow-scrolling:touch]">
            <p className="min-w-min whitespace-nowrap font-mono text-[10px] font-semibold tracking-wide text-foreground sm:text-xs">
              {headers.join("  ")}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Total:{" "}
          <strong className="text-foreground">{rows * cols}</strong> kursi
        </p>

        {!validation.valid && (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertDescription>{validation.errorMsg}</AlertDescription>
          </Alert>
        )}



        <Button
          className="h-12 w-full touch-manipulation rounded-xl text-base sm:h-10 sm:text-sm"
          size="lg"
          disabled={!validation.valid || loading}
          onClick={() => void handleGenerate()}
        >
          {loading ? "Memproses…" : "Generate & lanjut →"}
        </Button>
      </CardContent>
    </Card>
  )
}
