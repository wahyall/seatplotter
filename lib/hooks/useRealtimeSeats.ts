"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { fetchSeats } from "@/lib/seats"
import { useSeatStore } from "@/store/useSeatStore"

/**
 * Subscribes to seat row updates. Effect deps are only layout ids so we never
 * tear down channels just because zustand action references changed (which
 * would cause subscribe loops and "Maximum update depth exceeded").
 */
export function useRealtimeSeats(layoutIds: string | string[] | undefined) {
  const [isConnected, setIsConnected] = useState(false)
  const subscribedLayouts = useRef(new Set<string>())

  const ids = Array.isArray(layoutIds)
    ? layoutIds.filter(Boolean)
    : layoutIds
      ? [layoutIds]
      : []

  const key = ids.join(",")

  useEffect(() => {
    if (!ids.length) return
    subscribedLayouts.current = new Set()

    const channels = ids.map((layoutId) =>
      supabase
        .channel(`seats-${layoutId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "seats",
            filter: `layout_id=eq.${layoutId}`,
          },
          (payload) => {
            useSeatStore.getState().applyRealtimeUpdate(payload.new as never)
          }
        )
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            subscribedLayouts.current.add(layoutId)
            if (subscribedLayouts.current.size >= ids.length) {
              setIsConnected(true)
            }
            const data = await fetchSeats(layoutId)
            const gender = useSeatStore.getState().layoutIdMap[layoutId]
            if (gender) {
              useSeatStore.getState().setSeats(gender, data, layoutId)
            }
          } else {
            setIsConnected(false)
          }
        })
    )

    return () => {
      subscribedLayouts.current.clear()
      channels.forEach((ch) => {
        void supabase.removeChannel(ch)
      })
    }
  }, [key])

  return { isConnected }
}
