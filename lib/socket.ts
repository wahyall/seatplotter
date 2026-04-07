"use client"

import { io, Socket } from "socket.io-client"
import { v4 as uuidv4 } from "uuid"

let socket: Socket | null = null
let sessionId: string | null = null

function getSessionId(): string {
  if (sessionId) return sessionId

  if (typeof window !== "undefined") {
    const stored = sessionStorage.getItem("socket_session_id")
    if (stored) {
      sessionId = stored
      return sessionId
    }
    sessionId = uuidv4()
    sessionStorage.setItem("socket_session_id", sessionId)
    return sessionId
  }

  sessionId = uuidv4()
  return sessionId
}

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null

  if (!socket) {
    const url =
      process.env.NEXT_PUBLIC_SOCKET_URL ?? window.location.origin

    socket = io(url, {
      path: "/socket.io",
      auth: { sessionId: getSessionId() },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
  }

  return socket
}

export { getSessionId }
