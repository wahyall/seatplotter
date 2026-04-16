import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/booking/validate
 * Validates kode_tiket values from QR scan against participants for a single event.
 * Requires event_id so tickets from another event are never returned.
 */
export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return Response.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 }
    )
  }

  const body = await req.json().catch(() => null)
  if (
    !body ||
    !Array.isArray(body.kode_tikets) ||
    body.kode_tikets.length === 0
  ) {
    return Response.json(
      { success: false, error: "kode_tikets array required" },
      { status: 400 }
    )
  }

  const eventId =
    typeof body.event_id === "string" ? body.event_id.trim() : ""
  if (!eventId) {
    return Response.json(
      { success: false, error: "event_id is required" },
      { status: 400 }
    )
  }

  const { data: eventRow, error: evErr } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle()

  if (evErr) {
    return Response.json(
      { success: false, error: evErr.message },
      { status: 500 }
    )
  }
  if (!eventRow) {
    return Response.json(
      { success: false, error: "Event tidak ditemukan" },
      { status: 404 }
    )
  }

  const kodeTikets: string[] = body.kode_tikets
    .map((k: unknown) => String(k).trim())
    .filter(Boolean)

  if (kodeTikets.length === 0) {
    return Response.json({ success: true, tickets: [] })
  }

  const { data: participants, error } = await supabaseAdmin
    .from("participants")
    .select("*")
    .eq("event_id", eventId)
    .in("kode_tiket", kodeTikets)

  if (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  const tickets = (participants ?? []).map((p) => ({
    ...p,
    already_booked: !!p.seat_id,
  }))

  return Response.json({ success: true, tickets })
}
