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

  const { error: deleteErr } = await supabaseAdmin
    .from("seats")
    .delete()
    .eq("layout_id", layoutId)

  if (deleteErr) {
    return Response.json(
      { success: false, error: deleteErr.message },
      { status: 500 }
    )
  }

  const seats = generateSeatsForLayout(
    layoutId,
    layout.rows,
    layout.cols,
    layout.col_start_char,
    layout.reverse_col
  )

  const CHUNK = 200
  for (let i = 0; i < seats.length; i += CHUNK) {
    const chunk = seats.slice(i, i + CHUNK)
    const { error: insertErr } = await supabaseAdmin.from("seats").insert(chunk)
    if (insertErr) {
      return Response.json(
        { success: false, error: insertErr.message },
        { status: 500 }
      )
    }
  }

  return Response.json({
    success: true,
    data: { count: seats.length },
  })
}
