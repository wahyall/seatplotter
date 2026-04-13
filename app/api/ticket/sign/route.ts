import { supabaseAdmin } from "@/lib/supabase-admin"
import { signTicket } from "@/lib/ticket-auth"

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 })
  }

  if (!process.env.TICKET_SECRET) {
    return Response.json({ error: "TICKET_SECRET not set" }, { status: 500 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.participantId || !body?.kodeTiket || !body?.nama || !body?.seatLabel) {
    return Response.json(
      { error: "participantId, kodeTiket, nama, and seatLabel are required" },
      { status: 400 },
    )
  }

  const { participantId, kodeTiket, nama, seatLabel } = body

  const { data: participant } = await supabaseAdmin
    .from("participants")
    .select("id, kode_tiket, nama, seat_id")
    .eq("id", participantId)
    .eq("kode_tiket", kodeTiket)
    .not("seat_id", "is", null)
    .single()

  if (!participant) {
    return Response.json(
      { error: "Participant with active booking not found" },
      { status: 404 },
    )
  }

  const hash = signTicket({
    id: participant.id,
    k: participant.kode_tiket,
    n: participant.nama,
    s: seatLabel,
  })

  return Response.json({ hash })
}
