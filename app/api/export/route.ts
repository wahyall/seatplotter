import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  if (!supabaseAdmin) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const [config, layouts, categories, seats] = await Promise.all([
    supabaseAdmin.from("config").select("*").limit(1).maybeSingle(),
    supabaseAdmin.from("layouts").select("*"),
    supabaseAdmin.from("categories").select("*"),
    supabaseAdmin.from("seats").select("*"),
  ])

  if (config.error) {
    return Response.json({ error: config.error.message }, { status: 500 })
  }

  const exportData = {
    config: config.data,
    layouts: layouts.data ?? [],
    categories: categories.data ?? [],
    seats: seats.data ?? [],
    exportedAt: new Date().toISOString(),
    version: "1.0",
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="seatplotter-${Date.now()}.json"`,
    },
  })
}
