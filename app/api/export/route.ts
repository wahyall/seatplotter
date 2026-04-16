import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const url = new URL(req.url)
  const slug = url.searchParams.get("slug")

  const { data: eventData, error: evErr } = slug
    ? await supabaseAdmin.from("events").select("*").eq("slug", slug).single()
    : await supabaseAdmin.from("events").select("*").limit(1).maybeSingle()

  if (evErr || !eventData) {
    return Response.json(
      { error: evErr?.message ?? "Event not found" },
      { status: slug ? 404 : 500 }
    )
  }

  const { data: layouts } = await supabaseAdmin
    .from("layouts")
    .select("*")
    .eq("event_id", eventData.id)

  const layoutIds = (layouts ?? []).map((l) => l.id)

  const [categories, seats] = layoutIds.length > 0
    ? await Promise.all([
        supabaseAdmin.from("categories").select("*").in("layout_id", layoutIds),
        supabaseAdmin.from("seats").select("*").in("layout_id", layoutIds),
      ])
    : [{ data: [] }, { data: [] }]

  const exportData = {
    config: eventData,
    layouts: layouts ?? [],
    categories: categories.data ?? [],
    seats: seats.data ?? [],
    exportedAt: new Date().toISOString(),
    version: "1.0",
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="seatplotter-${slug ?? "export"}-${Date.now()}.json"`,
    },
  })
}
