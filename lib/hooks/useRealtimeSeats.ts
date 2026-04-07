"use client"

import { useEffect, useRef, useState } from "react"
import { getSocket } from "@/lib/socket"
import { fetchSeats } from "@/lib/seats"
import { useSeatStore } from "@/store/useSeatStore"
import type { SeatRow } from "@/types/db"

export function useRealtimeSeats(layoutIds: string | string[] | undefined) {
  const [isConnected, setIsConnected] = useState(false)
  const joinedLayouts = useRef(new Set<string>())

  const ids = Array.isArray(layoutIds)
    ? layoutIds.filter(Boolean)
    : layoutIds
      ? [layoutIds]
      : []

  const key = ids.join(",")

  useEffect(() => {
    if (!ids.length) return

    const socket = getSocket()
    if (!socket) return

    joinedLayouts.current = new Set()

    const onConnect = () => {
      setIsConnected(true)
      for (const layoutId of ids) {
        socket.emit("join-layout", layoutId)
      }
      // Refetch seats on (re)connect to ensure we have the latest state
      for (const layoutId of ids) {
        fetchSeats(layoutId).then((data) => {
          const gender = useSeatStore.getState().layoutIdMap[layoutId]
          if (gender) {
            useSeatStore.getState().setSeats(gender, data, layoutId)
          }
        })
      }
    }

    const onDisconnect = () => {
      setIsConnected(false)
    }

    const onSeatUpdated = (data: { layoutId: string; seat: SeatRow }) => {
      useSeatStore.getState().applyRealtimeUpdate(data.seat)
    }

    const onSeatBulkUpdated = (data: {
      layoutId: string
      seats: SeatRow[]
    }) => {
      for (const seat of data.seats) {
        useSeatStore.getState().applyRealtimeUpdate(seat)
      }
    }

    // Join rooms for each layout
    for (const layoutId of ids) {
      socket.emit("join-layout", layoutId)
      joinedLayouts.current.add(layoutId)
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("seat:updated", onSeatUpdated)
    socket.on("seat:bulk-updated", onSeatBulkUpdated)

    // Set initial connection state
    if (socket.connected) {
      setIsConnected(true)
      // Refetch on initial mount when already connected
      for (const layoutId of ids) {
        fetchSeats(layoutId).then((data) => {
          const gender = useSeatStore.getState().layoutIdMap[layoutId]
          if (gender) {
            useSeatStore.getState().setSeats(gender, data, layoutId)
          }
        })
      }
    }

    return () => {
      for (const layoutId of joinedLayouts.current) {
        socket.emit("leave-layout", layoutId)
      }
      joinedLayouts.current.clear()

      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("seat:updated", onSeatUpdated)
      socket.off("seat:bulk-updated", onSeatBulkUpdated)
    }
  }, [key])

  return { isConnected }
}
