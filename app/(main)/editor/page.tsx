"use client"

import Link from "next/link"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MarsIcon, VenusIcon } from "lucide-react"

export default function EditorLandingPage() {
  const maleL = useLayoutStore((s) => s.layouts.male)
  const femaleL = useLayoutStore((s) => s.layouts.female)
  const maleN = useSeatStore((s) => Object.keys(s.seats.male).length)
  const femaleN = useSeatStore((s) => Object.keys(s.seats.female).length)

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Editor layout</h1>
        <p className="text-sm text-muted-foreground">
          Pilih layout untuk mengatur grid, kategori, dan assign kursi.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/editor/male">
          <Card className="h-full border-blue-500/25 transition hover:border-blue-500/50 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MarsIcon className="size-7 text-blue-400" />
                Pria
              </CardTitle>
              <CardDescription>
                {maleL
                  ? `${maleL.cols} kolom × ${maleL.rows} baris`
                  : "Belum ada data"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{maleN}</p>
              <p className="text-xs text-muted-foreground">kursi di database</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/editor/female">
          <Card className="h-full border-pink-500/25 transition hover:border-pink-500/50 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <VenusIcon className="size-7 text-pink-400" />
                Wanita
              </CardTitle>
              <CardDescription>
                {femaleL
                  ? `${femaleL.cols} kolom × ${femaleL.rows} baris`
                  : "Belum ada data"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{femaleN}</p>
              <p className="text-xs text-muted-foreground">kursi di database</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
