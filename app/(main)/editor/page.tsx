"use client"

import Link from "next/link"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import { MarsIcon, VenusIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export default function EditorLandingPage() {
  const maleL = useLayoutStore((s) => s.layouts.male)
  const femaleL = useLayoutStore((s) => s.layouts.female)
  const maleN = useSeatStore((s) => Object.keys(s.seats.male).length)
  const femaleN = useSeatStore((s) => Object.keys(s.seats.female).length)

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-display text-xl font-bold">Editor layout</h1>
        <p className="text-sm text-muted-foreground">
          Pilih layout untuk mengatur grid, kategori, dan assign kursi.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/editor/male">
          <div className="cursor-pointer rounded-md border border-primary/20 bg-card p-4 transition-colors duration-150 hover:border-primary/40">
            <div className="flex items-center gap-2">
              <MarsIcon className="size-5 text-primary" />
              <span className="text-base font-semibold">Pria</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {maleL
                ? `${maleL.cols} kolom \u00d7 ${maleL.rows} baris`
                : "Belum ada data"}
            </p>
            <p className="mt-3 text-2xl font-bold tabular-nums">{maleN}</p>
            <p className="text-xs text-muted-foreground">kursi di database</p>
          </div>
        </Link>

        <Link href="/editor/female">
          <div className="cursor-pointer rounded-md border border-rose-500/20 bg-card p-4 transition-colors duration-150 hover:border-rose-500/40">
            <div className="flex items-center gap-2">
              <VenusIcon className="size-5 text-rose-400" />
              <span className="text-base font-semibold">Wanita</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {femaleL
                ? `${femaleL.cols} kolom \u00d7 ${femaleL.rows} baris`
                : "Belum ada data"}
            </p>
            <p className="mt-3 text-2xl font-bold tabular-nums">{femaleN}</p>
            <p className="text-xs text-muted-foreground">kursi di database</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
