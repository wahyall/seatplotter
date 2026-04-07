import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/booking/validate
 * Validates kode_tiket values from QR scan against participants table.
 * Returns matching participants with their booking status.
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

  const kodeTikets: string[] = body.kode_tikets
    .map((k: unknown) => String(k).trim())
    .filter(Boolean)

  if (kodeTikets.length === 0) {
    return Response.json({ success: true, tickets: [] })
  }

  // Fetch participants matching the kode_tikets
  const { data: participants, error } = await supabaseAdmin
    .from("participants")
    .select("*")
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
