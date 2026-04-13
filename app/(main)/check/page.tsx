"use client"

import * as React from "react"
import Link from "next/link"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import { useShallow } from "zustand/react/shallow"
import { useRealtimeSeats } from "@/lib/hooks/useRealtimeSeats"
import { ConnectionBanner } from "@/components/layout/connection-banner"
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
        <Link href="/check/male">
          <div className="cursor-pointer rounded-md border border-blue-500/20 bg-card p-4 transition-colors duration-150 hover:border-blue-500/40">
            <div className="flex items-center gap-2 text-base font-semibold">
              <MarsIcon className="size-5 text-blue-400" />
              Pria
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Hadir: {maleStats.checked} / {maleStats.total} &middot; Goodie: {maleStats.goodieBag} / {maleStats.total}
            </p>
            <div className="mt-3 space-y-2">
              <StatBar label="Hadir" pct={maleStats.checkPct} />
              <StatBar label="Goodie Bag" pct={maleStats.goodiePct} />
            </div>
          </div>
        </Link>

        <Link href="/check/female">
          <div className="cursor-pointer rounded-md border border-pink-500/20 bg-card p-4 transition-colors duration-150 hover:border-pink-500/40">
            <div className="flex items-center gap-2 text-base font-semibold">
              <VenusIcon className="size-5 text-pink-400" />
              Wanita
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Hadir: {femaleStats.checked} / {femaleStats.total} &middot; Goodie: {femaleStats.goodieBag} / {femaleStats.total}
            </p>
            <div className="mt-3 space-y-2">
              <StatBar label="Hadir" pct={femaleStats.checkPct} />
              <StatBar label="Goodie Bag" pct={femaleStats.goodiePct} />
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}

function StatBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  )
}
