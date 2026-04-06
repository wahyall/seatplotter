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

  const { error: delSeatsErr } = await supabaseAdmin
    .from("seats")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")
  if (delSeatsErr) {
    return Response.json(
      { success: false, error: delSeatsErr.message },
      { status: 500 }
    )
  }

  const { error: delCatErr } = await supabaseAdmin
    .from("categories")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")
  if (delCatErr) {
    return Response.json(
      { success: false, error: delCatErr.message },
      { status: 500 }
    )
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
    }
    const { data: saved, error } = await supabaseAdmin
      .from("layouts")
      .upsert(row, { onConflict: "gender" })
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
  const { error: cfgErr } = await supabaseAdmin
    .from("config")
    .update(configData)
    .neq("id", "00000000-0000-0000-0000-000000000000")
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
