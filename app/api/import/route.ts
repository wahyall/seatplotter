import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return Response.json({ success: false, error: "Server misconfigured" }, { status: 500 })
  }

  const body = await req.json().catch(() => null)
  if (
    !body?.config ||
    !Array.isArray(body.layouts) ||
    !Array.isArray(body.categories) ||
    !Array.isArray(body.seats)
  ) {
    return Response.json(
      { success: false, error: "Format tidak valid" },
      { status: 400 }
    )
  }

  const slug = body.slug as string | undefined
  if (!slug) {
    return Response.json(
      { success: false, error: "slug is required" },
      { status: 400 }
    )
  }

  const { data: eventRow, error: evErr } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("slug", slug)
    .single()

  if (evErr || !eventRow) {
    return Response.json(
      { success: false, error: "Event not found" },
      { status: 404 }
    )
  }

  const eventId = eventRow.id

  // Get layout IDs for this event to scope deletes
  const { data: existingLayouts } = await supabaseAdmin
    .from("layouts")
    .select("id")
    .eq("event_id", eventId)

  const existingLayoutIds = (existingLayouts ?? []).map((l) => l.id)

  if (existingLayoutIds.length > 0) {
    const { error: delSeatsErr } = await supabaseAdmin
      .from("seats")
      .delete()
      .in("layout_id", existingLayoutIds)
    if (delSeatsErr) {
      return Response.json(
        { success: false, error: delSeatsErr.message },
        { status: 500 }
      )
    }

    const { error: delCatErr } = await supabaseAdmin
      .from("categories")
      .delete()
      .in("layout_id", existingLayoutIds)
    if (delCatErr) {
      return Response.json(
        { success: false, error: delCatErr.message },
        { status: 500 }
      )
    }
  }

  const layoutIdMap: Record<string, string> = {}
  for (const layout of body.layouts as Array<Record<string, unknown>>) {
    const { id: oldId, ...data } = layout
    const row = {
      gender: data.gender,
      label: data.label,
      rows: data.rows,
      cols: data.cols,
      col_start_char: data.col_start_char,
      reverse_col: data.reverse_col,
      event_id: eventId,
    }
    const { data: saved, error } = await supabaseAdmin
      .from("layouts")
      .upsert(row, { onConflict: "event_id,gender" })
      .select()
      .single()
    if (error || !saved) {
      return Response.json(
        { success: false, error: error?.message ?? "layout upsert failed" },
        { status: 500 }
      )
    }
    layoutIdMap[String(oldId)] = saved.id
  }

  const categoryIdMap: Record<string, string> = {}
  for (const cat of body.categories as Array<Record<string, unknown>>) {
    const { id: oldId, layout_id, ...rest } = cat
    const newLayoutId = layoutIdMap[String(layout_id)]
    if (!newLayoutId) continue
    const { data: saved, error } = await supabaseAdmin
      .from("categories")
      .insert({
        ...rest,
        layout_id: newLayoutId,
      } as Record<string, unknown>)
      .select()
      .single()
    if (error || !saved) {
      return Response.json(
        { success: false, error: error?.message ?? "category insert failed" },
        { status: 500 }
      )
    }
    categoryIdMap[String(oldId)] = saved.id
  }

  const remapped = (body.seats as Array<Record<string, unknown>>).map(
    ({ id: _id, layout_id, category_id, ...data }) => ({
      ...data,
      layout_id: layoutIdMap[String(layout_id)],
      category_id: category_id
        ? categoryIdMap[String(category_id)] ?? null
        : null,
    })
  )

  const CHUNK = 200
  for (let i = 0; i < remapped.length; i += CHUNK) {
    const chunk = remapped.slice(i, i + CHUNK)
    const { error } = await supabaseAdmin.from("seats").insert(chunk)
    if (error) {
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }
  }

  const { id: _cid, ...configData } = body.config as Record<string, unknown>
  delete configData.slug
  const { error: cfgErr } = await supabaseAdmin
    .from("events")
    .update(configData)
    .eq("id", eventId)
  if (cfgErr) {
    return Response.json(
      { success: false, error: cfgErr.message },
      { status: 500 }
    )
  }

  return Response.json({
    success: true,
    data: {
      layouts: body.layouts.length,
      categories: body.categories.length,
      seats: body.seats.length,
    },
  })
}
