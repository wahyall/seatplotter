"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { v4 as uuidv4 } from "uuid"

export type DraftState = {
  seatId: string
  participantId: string
  nama: string
  timestamp: number
  sessionId: string // Unique ID for the browser session to distinguish our own drafts
}

export function useSeatPresence(options?: { onDraftLost?: (seatId: string, participantId: string) => void }) {
  const [globalDrafts, setGlobalDrafts] = useState<Record<string, DraftState>>({})
  const [localDrafts, setLocalDrafts] = useState<Record<string, DraftState>>({})
  const [isConnected, setIsConnected] = useState(false)
  
  const sessionId = useRef(uuidv4()).current
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Subscribe to presence
  useEffect(() => {
    const channel = supabase.channel("seat-presence-v1", {
      config: { presence: { key: sessionId } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ drafts?: Record<string, DraftState> }>()
        
        // 1. Flatten all drafts from all peers and connections
        let flatDrafts: DraftState[] = []
        for (const presenceItems of Object.values(state)) {
          for (const item of presenceItems) {
            if (item.drafts) {
              flatDrafts.push(...Object.values(item.drafts))
            }
          }
        }

        // 2. Enforce 1-Seat-Per-Participant globally (prevent multi-tab/ghost connection duplication).
        // If a participant has multiple drafts across different presence endpoints, keep only their LATEST click.
        const latestDraftPerParticipant = new Map<string, DraftState>()
        for (const draft of flatDrafts) {
          const existing = latestDraftPerParticipant.get(draft.participantId)
          if (!existing || draft.timestamp > existing.timestamp) {
            latestDraftPerParticipant.set(draft.participantId, draft)
          }
        }
        
        const validDrafts = Array.from(latestDraftPerParticipant.values())

        // 3. Conflict Resolution across multiple distinct participants fighting for the SAME seat.
        // "First click wins" based on earliest timestamp for the given seatId
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
              // We lost the race to a different connection with an earlier timestamp!
              delete next[seatId]
              hasLoss = true
              
              if (options?.onDraftLost) {
                // Defer callback to avoid React render queue clashing
                setTimeout(() => options.onDraftLost?.(seatId, localDraft.participantId), 0)
              }
            }
          }
          return hasLoss ? next : prev
        })
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true)
        } else {
          setIsConnected(false)
        }
      })

    channelRef.current = channel

    return () => {
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [sessionId])

  // Broadcast local drafts when they change
  useEffect(() => {
    if (isConnected && channelRef.current) {
      channelRef.current.track({ drafts: localDrafts })
    }
  }, [localDrafts, isConnected])

  const draftSeatLocal = useCallback((seatId: string, participantId: string, nama: string, previousSeatId?: string | null) => {
    setLocalDrafts((prev) => {
      const next = { ...prev }
      
      // If we are swapping, clear the previously drafted seat for this participant
      if (previousSeatId && next[previousSeatId]?.participantId === participantId) {
        delete next[previousSeatId]
      }
      
      // Or if the participant drafted something else, clear that too (ensure 1 seat per participant draft max)
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
  }, [sessionId])

  const clearLocalDraftForParticipant = useCallback((participantId: string) => {
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
  }, [])

  // Merge local heavily over global to avoid ghosting before sync arrives
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
