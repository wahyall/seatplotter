import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/booking
 * Book a seat for a participant. Uses DB constraints to prevent race conditions:
 * - seats.participant_id UNIQUE prevents two people booking same seat
 * - participants.seat_id UNIQUE prevents one person booking two seats
 *
 * Flow:
 * 1. Verify participant exists and isn't already booked
 * 2. Verify seat exists, isn't empty, and isn't already booked
 * 3. Verify ticket category matches seat category (case-insensitive)
 * 4. Atomically update both tables
 */
export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return Response.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.seat_id || !body?.participant_id) {
    return Response.json(
      { success: false, error: "seat_id and participant_id are required" },
      { status: 400 },
    );
  }

  const { seat_id, participant_id } = body;

  // 1. Fetch participant
  const { data: participant, error: pErr } = await supabaseAdmin
    .from("participants")
    .select("*")
    .eq("id", participant_id)
    .single();

  if (pErr || !participant) {
    return Response.json(
      { success: false, error: "Peserta tidak ditemukan" },
      { status: 404 },
    );
  }

  const old_seat_id = participant.seat_id;
  if (old_seat_id === seat_id) {
    return Response.json({ success: true });
  }

  // 2. Fetch seat with category info
  const { data: seat, error: sErr } = await supabaseAdmin
    .from("seats")
    .select("*, categories!seats_category_id_fkey(name)")
    .eq("id", seat_id)
    .single();

  if (sErr || !seat) {
    return Response.json(
      { success: false, error: "Kursi tidak ditemukan" },
      { status: 404 },
    );
  }

  const { data: layoutRow, error: layoutErr } = await supabaseAdmin
    .from("layouts")
    .select("event_id")
    .eq("id", seat.layout_id)
    .single();

  if (layoutErr || !layoutRow) {
    return Response.json(
      { success: false, error: "Layout kursi tidak ditemukan" },
      { status: 500 },
    );
  }

  if (layoutRow.event_id !== participant.event_id) {
    return Response.json(
      {
        success: false,
        error: "Tiket tidak berlaku untuk event ini — kursi milik event lain",
      },
      { status: 403 },
    );
  }

  if (seat.is_empty) {
    return Response.json(
      { success: false, error: "Kursi ini tidak tersedia" },
      { status: 400 },
    );
  }

  if (seat.participant_id) {
    return Response.json(
      { success: false, error: "Kursi sudah diambil peserta lain" },
      { status: 409 },
    );
  }

  // 3. Category matching (case-insensitive)
  const categoryName: string =
    (seat.categories as { name: string } | null)?.name ?? "";
  const ticketType = (participant.tiket ?? "").trim();

  if (
    categoryName &&
    ticketType &&
    categoryName.toLowerCase() !== ticketType.toLowerCase()
  ) {
    return Response.json(
      {
        success: false,
        error: `Tiket "${ticketType}" tidak bisa memilih kursi kategori "${categoryName}"`,
      },
      { status: 403 },
    );
  }

  // 4. If swapping, we MUST free the old seat first to satisfy the unique constraint on seats.
  if (old_seat_id) {
    const { error: freeErr } = await supabaseAdmin
      .from("seats")
      .update({
        participant_id: null,
        is_checked: false,
        checked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", old_seat_id)
      .eq("participant_id", participant_id);

    if (freeErr) {
      return Response.json(
        { success: false, error: "Gagal membebaskan kursi lama" },
        { status: 500 },
      );
    }
  }

  // 5. Atomic booking — update new seat
  const { error: bookErr } = await supabaseAdmin
    .from("seats")
    .update({
      participant_id,
      // is_checked: true,
      // checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", seat_id)
    .is("participant_id", null); // optimistic lock

  if (bookErr) {
    // If we freed the old seat but failed to book the new one, try to rollback
    if (old_seat_id) {
      await supabaseAdmin
        .from("seats")
        .update({
          participant_id,
          // is_checked: true,
          // checked_at: new Date().toISOString(),
        })
        .eq("id", old_seat_id)
        .is("participant_id", null);
    }

    if (bookErr.code === "23505") {
      return Response.json(
        { success: false, error: "Kursi sudah diambil peserta lain" },
        { status: 409 },
      );
    }
    return Response.json(
      { success: false, error: bookErr.message },
      { status: 500 },
    );
  }

  // Verify the update actually happened
  const { data: updated } = await supabaseAdmin
    .from("seats")
    .select("participant_id")
    .eq("id", seat_id)
    .single();

  if (updated?.participant_id !== participant_id) {
    if (old_seat_id) {
      await supabaseAdmin
        .from("seats")
        .update({
          participant_id,
          // is_checked: true,
          // checked_at: new Date().toISOString(),
        })
        .eq("id", old_seat_id)
        .is("participant_id", null);
    }
    return Response.json(
      { success: false, error: "Kursi sudah diambil peserta lain" },
      { status: 409 },
    );
  }

  // 6. Update participant's seat_id
  let pQuery = supabaseAdmin
    .from("participants")
    .update({ seat_id })
    .eq("id", participant_id)

  if (old_seat_id) {
    pQuery = pQuery.eq("seat_id", old_seat_id)
  } else {
    pQuery = pQuery.is("seat_id", null)
  }

  const { error: pUpdateErr } = await pQuery

  if (pUpdateErr) {
    // Rollback BOTH sides
    await supabaseAdmin
      .from("seats")
      .update({
        participant_id: null,
        is_checked: false,
        checked_at: null,
      })
      .eq("id", seat_id);

    if (old_seat_id) {
      await supabaseAdmin
        .from("seats")
        .update({
          participant_id,
          // is_checked: true,
          // checked_at: new Date().toISOString(),
        })
        .eq("id", old_seat_id)
        .is("participant_id", null);
    }

    return Response.json(
      { success: false, error: "Gagal update peserta" },
      { status: 409 },
    );
  }

  return Response.json({ success: true });
}
