"use client"

import { useEffect } from "react"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { fetchCategories } from "@/lib/categories"
import { fetchSeats } from "@/lib/seats"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangleIcon } from "lucide-react"

export function AppDataProvider({
  slug,
  children,
}: {
  slug: string
  children: React.ReactNode
}) {
  const setEvent = useLayoutStore((s) => s.setEvent)
  const setLayouts = useLayoutStore((s) => s.setLayouts)
  const setCategories = useLayoutStore((s) => s.setCategories)
  const setHydrated = useLayoutStore((s) => s.setHydrated)
  const setSeats = useSeatStore((s) => s.setSeats)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!isSupabaseConfigured) {
        setHydrated(true)
        return
      }
      try {
        const { data: eventRow } = await supabase
          .from("events")
          .select("*")
          .eq("slug", slug)
          .single()
        if (cancelled) return
        setEvent(eventRow)

        if (!eventRow) {
          return
        }

        const { data: layouts } = await supabase
          .from("layouts")
          .select("*")
          .eq("event_id", eventRow.id)
          .order("gender")
        if (cancelled) return
        const male = layouts?.find((l) => l.gender === "male") ?? null
        const female = layouts?.find((l) => l.gender === "female") ?? null
        setLayouts(male, female)

        if (male) {
          const [catsM, seatsM] = await Promise.all([
            fetchCategories(male.id),
            fetchSeats(male.id),
          ])
          if (cancelled) return
          setCategories("male", catsM)
          setSeats("male", seatsM, male.id)
        }
        if (female) {
          const [catsF, seatsF] = await Promise.all([
            fetchCategories(female.id),
            fetchSeats(female.id),
          ])
          if (cancelled) return
          setCategories("female", catsF)
          setSeats("female", seatsF, female.id)
        }
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [slug, setEvent, setLayouts, setCategories, setHydrated, setSeats])

  if (!isSupabaseConfigured) {
    return (
      <>
        <Alert variant="destructive" className="m-4 rounded-xl">
          <AlertTriangleIcon />
          <AlertTitle>Supabase belum dikonfigurasi</AlertTitle>
          <AlertDescription>
            Salin <code className="rounded bg-muted px-1">.env.example</code> ke{" "}
            <code className="rounded bg-muted px-1">.env.local</code> dan isi URL
            serta kunci dari dashboard Supabase.
          </AlertDescription>
        </Alert>
        {children}
      </>
    )
  }

  return <>{children}</>
}
