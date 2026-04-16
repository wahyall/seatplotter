import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export async function GET() {
  if (!isSupabaseConfigured) {
    return Response.json(
      {
        status: "error",
        message: "Supabase env not configured",
        ts: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
  try {
    const { error } = await supabase.from("events").select("id").limit(1)
    if (error) throw error
    return Response.json({
      status: "ok",
      db: "connected",
      ts: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return Response.json(
      { status: "error", message, ts: new Date().toISOString() },
      { status: 503 }
    )
  }
}
