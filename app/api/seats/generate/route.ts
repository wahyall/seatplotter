import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { generateSeatsForLayout } from "@/lib/seat-label"

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return Response.json(
      { success: false, error: "Server misconfigured (service role)" },
      { status: 500 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const layoutId = body.layoutId as string | undefined
  if (!layoutId) {
    return Response.json(
      { success: false, error: "layoutId required" },
      { status: 400 }
    )
  }

  const { data: layout, error: layoutErr } = await supabase
    .from("layouts")
    .select("*")
    .eq("id", layoutId)
    .single()

  if (layoutErr || !layout) {
    return Response.json(
      { success: false, error: "Layout not found" },
      { status: 404 }
    )
  }

  const existingSeats: Array<{
    id: string
    row: number
    col: number
    label: string
  }> = []
  const PAGE_SIZE = 1000
  let from = 0

  for (;;) {
    const { data, error: fetchErr } = await supabaseAdmin
      .from("seats")
      .select("id, row, col, label")
      .eq("layout_id", layoutId)
      .order("row", { ascending: true })
      .order("col", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (fetchErr) {
      return Response.json(
        { success: false, error: fetchErr.message },
        { status: 500 }
      )
    }

    const chunk = data ?? []
    existingSeats.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  const existingMap = new Map<string, typeof existingSeats[0]>()
  for (const seat of existingSeats) {
    existingMap.set(`${seat.row}-${seat.col}`, seat)
  }

  const idealSeats = generateSeatsForLayout(
    layoutId,
    layout.rows,
    layout.cols,
    layout.col_start_char,
    layout.reverse_col
  )

  const toInsert = []
  const toUpdate: { id: string; label: string }[] = []
  const validIds = new Set<string>()

  for (const idealSeat of idealSeats) {
    const key = `${idealSeat.row}-${idealSeat.col}`
    const existing = existingMap.get(key)
    if (existing) {
      validIds.add(existing.id)
      if (existing.label !== idealSeat.label) {
        toUpdate.push({ id: existing.id, label: idealSeat.label })
      }
    } else {
      toInsert.push(idealSeat)
    }
  }

  const toDeleteIds = existingSeats
    .filter((s) => !validIds.has(s.id))
    .map((s) => s.id)

  if (toDeleteIds.length > 0) {
    const CHUNK = 200
    for (let i = 0; i < toDeleteIds.length; i += CHUNK) {
      const { error: delErr } = await supabaseAdmin
        .from("seats")
        .delete()
        .in("id", toDeleteIds.slice(i, i + CHUNK))
      if (delErr) {
        return Response.json(
          { success: false, error: delErr.message },
          { status: 500 }
        )
      }
    }
  }

  if (toUpdate.length > 0) {
    const CHUNK = 50
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const chunk = toUpdate.slice(i, i + CHUNK)
      await Promise.all(
        chunk.map((u) =>
          supabaseAdmin!.from("seats").update({ label: u.label }).eq("id", u.id)
        )
      )
    }
  }

  if (toInsert.length > 0) {
    const CHUNK = 200
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK)
      const { error: insertErr } = await supabaseAdmin.from("seats").insert(chunk)
      if (insertErr) {
        return Response.json(
          { success: false, error: insertErr.message },
          { status: 500 }
        )
      }
    }
  }

  return Response.json({
    success: true,
    data: { count: idealSeats.length },
  })
}
