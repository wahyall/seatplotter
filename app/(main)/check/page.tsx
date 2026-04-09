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
    useShallow((s) => Object.values(s.seats[gender] ?? {})),
  );
  return React.useMemo(() => {
    const active = seats.filter((s) => !s.is_empty);
    const checked = active.filter((s) => s.is_checked);
    const goodieBag = active.filter((s) => s.is_goodie_bag);
    const checkPct =
      active.length > 0
        ? Math.round((checked.length / active.length) * 100)
        : 0;
    const goodiePct =
      active.length > 0
        ? Math.round((goodieBag.length / active.length) * 100)
        : 0;
    return {
      total: active.length,
      checked: checked.length,
      goodieBag: goodieBag.length,
      checkPct,
      goodiePct,
    };
  }, [seats]);
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
                <CardDescription className="text-xs">
                  Hadir: {maleStats.checked} / {maleStats.total}
                </CardDescription>
                <CardDescription className="text-xs">
                  Goodie: {maleStats.goodieBag} / {maleStats.total}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                    <span>Hadir</span>
                    <span>{maleStats.checkPct}%</span>
                  </div>
                  <Progress value={maleStats.checkPct} className="h-1.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                    <span>Goodie Bag</span>
                    <span>{maleStats.goodiePct}%</span>
                  </div>
                  <Progress value={maleStats.goodiePct} className="h-1.5 bg-purple-500/20">
                    <div 
                      className="h-full bg-purple-500 transition-all" 
                      style={{ width: `${maleStats.goodiePct}%` }}
                    />
                  </Progress>
                </div>
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
                <CardDescription className="text-xs">
                  Hadir: {femaleStats.checked} / {femaleStats.total}
                </CardDescription>
                <CardDescription className="text-xs">
                  Goodie: {femaleStats.goodieBag} / {femaleStats.total}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                    <span>Hadir</span>
                    <span>{femaleStats.checkPct}%</span>
                  </div>
                  <Progress value={femaleStats.checkPct} className="h-1.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                    <span>Goodie Bag</span>
                    <span>{femaleStats.goodiePct}%</span>
                  </div>
                  <Progress value={femaleStats.goodiePct} className="h-1.5 bg-purple-500/20">
                    <div 
                      className="h-full bg-purple-500 transition-all" 
                      style={{ width: `${femaleStats.goodiePct}%` }}
                    />
                  </Progress>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
