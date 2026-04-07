"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { getSocket, getSessionId } from "@/lib/socket"

export type DraftState = {
  seatId: string
  participantId: string
  nama: string
  timestamp: number
  sessionId: string
}

type PresenceEntry = {
  drafts: Record<string, DraftState>
}

export function useSeatPresence(options?: {
  onDraftLost?: (seatId: string, participantId: string) => void
}) {
  const [globalDrafts, setGlobalDrafts] = useState<Record<string, DraftState>>(
    {},
  )
  const [localDrafts, setLocalDrafts] = useState<Record<string, DraftState>>({})
  const [isConnected, setIsConnected] = useState(false)

  const sessionId = useRef(getSessionId()).current

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)

    const onPresenceSync = (state: Record<string, PresenceEntry>) => {
      // 1. Flatten all drafts from all peers
      let flatDrafts: DraftState[] = []
      for (const entry of Object.values(state)) {
        if (entry.drafts) {
          flatDrafts.push(...Object.values(entry.drafts))
        }
      }

      // 2. Keep only the latest draft per participant
      const latestDraftPerParticipant = new Map<string, DraftState>()
      for (const draft of flatDrafts) {
        const existing = latestDraftPerParticipant.get(draft.participantId)
        if (!existing || draft.timestamp > existing.timestamp) {
          latestDraftPerParticipant.set(draft.participantId, draft)
        }
      }

      const validDrafts = Array.from(latestDraftPerParticipant.values())

      // 3. Conflict resolution: first-click-wins per seat
      const resolvedDrafts: Record<string, DraftState> = {}
      for (const draft of validDrafts) {
        const existing = resolvedDrafts[draft.seatId]
        if (!existing || draft.timestamp < existing.timestamp) {
          resolvedDrafts[draft.seatId] = draft
        }
      }

      setGlobalDrafts(resolvedDrafts)

      // Evaluate if we lost any race conditions locally
      setLocalDrafts((prev) => {
        let hasLoss = false
        const next = { ...prev }
        for (const [seatId, localDraft] of Object.entries(next)) {
          const winner = resolvedDrafts[seatId]
          if (winner && winner.sessionId !== localDraft.sessionId) {
            delete next[seatId]
            hasLoss = true

            if (options?.onDraftLost) {
              setTimeout(
                () => options.onDraftLost?.(seatId, localDraft.participantId),
                0,
              )
            }
          }
        }
        return hasLoss ? next : prev
      })
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("presence:sync", onPresenceSync)

    if (socket.connected) setIsConnected(true)

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("presence:sync", onPresenceSync)
    }
  }, [sessionId])

  // Emit local drafts to server when they change
  useEffect(() => {
    if (!isConnected) return
    const socket = getSocket()
    if (!socket) return
    socket.emit("presence:track", { drafts: localDrafts })
  }, [localDrafts, isConnected])

  const draftSeatLocal = useCallback(
    (
      seatId: string,
      participantId: string,
      nama: string,
      previousSeatId?: string | null,
    ) => {
      setLocalDrafts((prev) => {
        const next = { ...prev }

        if (
          previousSeatId &&
          next[previousSeatId]?.participantId === participantId
        ) {
          delete next[previousSeatId]
        }

        for (const [sId, draft] of Object.entries(next)) {
          if (draft.participantId === participantId) {
            delete next[sId]
          }
        }

        next[seatId] = {
          seatId,
          participantId,
          nama,
          timestamp: Date.now(),
          sessionId,
        }
        return next
      })
    },
    [sessionId],
  )

  const clearLocalDraftForParticipant = useCallback(
    (participantId: string) => {
      setLocalDrafts((prev) => {
        const next = { ...prev }
        let changed = false
        for (const [sId, draft] of Object.entries(next)) {
          if (draft.participantId === participantId) {
            delete next[sId]
            changed = true
          }
        }
        return changed ? next : prev
      })
    },
    [],
  )

  // Merge local over global, filtering out our own global entries to avoid ghosting
  const activeGlobalDrafts = { ...globalDrafts }
  for (const [key, draft] of Object.entries(activeGlobalDrafts)) {
    if (draft.sessionId === sessionId) {
      delete activeGlobalDrafts[key]
    }
  }
  Object.assign(activeGlobalDrafts, localDrafts)

  return {
    isConnected,
    globalDrafts: activeGlobalDrafts,
    localDrafts,
    draftSeatLocal,
    clearLocalDraftForParticipant,
    sessionId,
  }
}
