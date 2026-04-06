"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import { useShallow } from "zustand/react/shallow"
import { useRealtimeSeats } from "@/lib/hooks/useRealtimeSeats"
import { ConnectionBanner } from "@/components/layout/connection-banner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { MarsIcon, VenusIcon } from "lucide-react"

function useStats(gender: "male" | "female") {
  const seats = useSeatStore(
    useShallow((s) => Object.values(s.seats[gender] ?? {}))
  )
  return React.useMemo(() => {
    const active = seats.filter((s) => !s.is_empty)
    const checked = active.filter((s) => s.is_checked)
    const pct =
      active.length > 0
        ? Math.round((checked.length / active.length) * 100)
        : 0
    return { total: active.length, checked: checked.length, pct }
  }, [seats])
}

export default function CheckLandingPage() {
  const maleL = useLayoutStore((s) => s.layouts.male)
  const femaleL = useLayoutStore((s) => s.layouts.female)
  const ids = [maleL?.id, femaleL?.id].filter(Boolean) as string[]
  const { isConnected } = useRealtimeSeats(ids)

  const maleStats = useStats("male")
  const femaleStats = useStats("female")

  return (
    <div className="space-y-6 pb-8">
      <ConnectionBanner isConnected={isConnected} />
      <div>
        <h1 className="font-display text-xl font-bold">Mode centang</h1>
        <p className="text-sm text-muted-foreground">
          Pilih layout untuk check-in peserta.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link href="/check/male">
            <Card className="h-full border-blue-500/25 transition hover:border-blue-500/50 hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MarsIcon className="size-6 text-blue-400" />
                  Pria
                </CardTitle>
                <CardDescription>
                  {maleStats.checked} / {maleStats.total} tercentang
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={maleStats.pct} className="h-2" />
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Link href="/check/female">
            <Card className="h-full border-pink-500/25 transition hover:border-pink-500/50 hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <VenusIcon className="size-6 text-pink-400" />
                  Wanita
                </CardTitle>
                <CardDescription>
                  {femaleStats.checked} / {femaleStats.total} tercentang
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={femaleStats.pct} className="h-2" />
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
