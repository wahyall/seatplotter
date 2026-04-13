import crypto from "crypto"

export interface TicketSignPayload {
  id: string
  k: string // kode_tiket
  n: string // nama
  s: string // seatLabel
}

export function signTicket(payload: TicketSignPayload): string {
  const secret = process.env.TICKET_SECRET!
  const msg = `${payload.id}|${payload.k}|${payload.n}|${payload.s}`
  return crypto.createHmac("sha256", secret).update(msg).digest("hex")
}
