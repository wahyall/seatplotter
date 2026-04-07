import { createServer } from "node:http"
import next from "next"
import { Server as SocketIOServer } from "socket.io"

const dev = process.env.NODE_ENV !== "production"
const port = parseInt(process.env.PORT ?? "3000", 10)

const app = next({ dev })
const handler = app.getRequestHandler()

type DraftState = {
  seatId: string
  participantId: string
  nama: string
  timestamp: number
  sessionId: string
}

type PresenceEntry = {
  drafts: Record<string, DraftState>
}

app.prepare().then(() => {
  const httpServer = createServer(handler)

  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    addTrailingSlash: false,
    cors: { origin: "*", methods: ["GET", "POST"] },
  })

  // Expose io globally so Next.js API routes can emit events
  ;(globalThis as Record<string, unknown>).__io = io

  // In-memory presence keyed by sessionId
  const presenceMap = new Map<string, PresenceEntry>()
  // Track which socket belongs to which session (for cleanup on disconnect)
  const socketSessionMap = new Map<string, string>()

  io.on("connection", (socket) => {
    const sessionId =
      (socket.handshake.auth?.sessionId as string) ?? socket.id

    socketSessionMap.set(socket.id, sessionId)

    // ── Layout rooms (for seat updates) ──────────────────────────────
    socket.on("join-layout", (layoutId: string) => {
      socket.join(`seats:${layoutId}`)
    })

    socket.on("leave-layout", (layoutId: string) => {
      socket.leave(`seats:${layoutId}`)
    })

    // ── Seat update relay ────────────────────────────────────────────
    socket.on(
      "seat:updated",
      (data: { layoutId: string; seat: Record<string, unknown> }) => {
        socket
          .to(`seats:${data.layoutId}`)
          .emit("seat:updated", data)
      },
    )

    socket.on(
      "seat:bulk-updated",
      (data: { layoutId: string; seats: Record<string, unknown>[] }) => {
        socket
          .to(`seats:${data.layoutId}`)
          .emit("seat:bulk-updated", data)
      },
    )

    // ── Presence ─────────────────────────────────────────────────────
    socket.join("seat-presence")

    socket.on(
      "presence:track",
      (data: { drafts: Record<string, DraftState> }) => {
        presenceMap.set(sessionId, { drafts: data.drafts })
        broadcastPresence()
      },
    )

    socket.on("disconnect", () => {
      const sid = socketSessionMap.get(socket.id)
      socketSessionMap.delete(socket.id)

      if (sid) {
        // Only remove presence if no other sockets share this sessionId
        const hasOtherSocket = [...socketSessionMap.values()].includes(sid)
        if (!hasOtherSocket) {
          presenceMap.delete(sid)
          broadcastPresence()
        }
      }
    })
  })

  function broadcastPresence() {
    const state: Record<string, PresenceEntry> = Object.fromEntries(
      presenceMap,
    )
    io.to("seat-presence").emit("presence:sync", state)
  }

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (${dev ? "dev" : "production"})`)
    console.log(`> Socket.IO attached at /socket.io`)
  })
})
