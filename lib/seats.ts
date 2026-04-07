import { supabase } from "@/lib/supabase"
import type { SeatRow } from "@/types/db"

/** PostgREST defaults to 1000 rows per request — paginate so large grids load every seat. */
export async function fetchSeats(layoutId: string): Promise<SeatRow[]> {
  const pageSize = 1000
  const all: SeatRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from("seats")
      .select("*, participants!seats_participant_id_fkey(*)")
      .eq("layout_id", layoutId)
      .order("row", { ascending: true })
      .order("col", { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const chunk = data ?? []
    all.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }
  return all
}

const ALLOWED = ["label", "category_id", "is_empty"] as const

export async function updateSeat(
  id: string,
  updates: Partial<Pick<SeatRow, "label" | "category_id" | "is_empty">>
): Promise<void> {
  const safe = Object.fromEntries(
    Object.entries(updates).filter(
      ([k, v]) =>
        ALLOWED.includes(k as (typeof ALLOWED)[number]) && v !== undefined
    )
  ) as Partial<Pick<SeatRow, "label" | "category_id" | "is_empty">>

  const { error } = await supabase
    .from("seats")
    .update({ ...safe, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function bulkAssignCategory(
  seatIds: string[],
  categoryId: string | null
): Promise<void> {
  if (!seatIds.length) return
  const payload: {
    category_id: string | null
    updated_at: string
    is_empty?: boolean
  } = {
    category_id: categoryId,
    updated_at: new Date().toISOString(),
  }
  if (categoryId !== null) {
    payload.is_empty = false
  }
  const { error } = await supabase.from("seats").update(payload).in("id", seatIds)
  if (error) throw error
}

export async function checkSeat(id: string, isChecked: boolean): Promise<void> {
  const { error } = await supabase
    .from("seats")
    .update({
      is_checked: isChecked,
      checked_at: isChecked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (error) throw error
}
