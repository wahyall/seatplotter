import type { ParticipantRow } from "@/types/db"

export interface ValidatedTicket extends ParticipantRow {
  /** Whether the ticket already has a seat booked */
  already_booked: boolean
  /** Category name this ticket matches (for display) */
  matched_category?: string
}

/** Validate kode_tiket values against participants for this event only. */
export async function validateTickets(
  kodeTikets: string[],
  eventId: string
): Promise<{ success: boolean; tickets: ValidatedTicket[]; error?: string }> {
  const res = await fetch("/api/booking/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kode_tikets: kodeTikets, event_id: eventId }),
  })
  return res.json()
}

/** Book a seat for a participant. Returns error if race condition (seat already taken). */
export async function bookSeat(
  seatId: string,
  participantId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seat_id: seatId, participant_id: participantId }),
  })
  return res.json()
}
