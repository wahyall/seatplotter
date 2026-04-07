import { supabaseAdmin } from "@/lib/supabase-admin"

interface ParticipantInput {
  nama: string
  email: string
  jenis_kelamin: string
  telepon: string
  tiket: string
  kode_tiket: string
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return Response.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 }
    )
  }

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.participants) || body.participants.length === 0) {
    return Response.json(
      { success: false, error: "Data peserta tidak valid" },
      { status: 400 }
    )
  }

  const participants: ParticipantInput[] = body.participants

  // Validate each participant has at least a nama
  const valid = participants.filter((p) => p.nama && p.nama.trim() !== "")
  if (valid.length === 0) {
    return Response.json(
      { success: false, error: "Tidak ada data peserta yang valid" },
      { status: 400 }
    )
  }

  // If replace mode, delete all existing participants first
  if (body.replace === true) {
    const { error: delErr } = await supabaseAdmin
      .from("participants")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")
    if (delErr) {
      return Response.json(
        { success: false, error: delErr.message },
        { status: 500 }
      )
    }
  }

  // Insert in chunks of 500 for better throughput
  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK).map((p) => ({
      nama: p.nama.trim(),
      email: (p.email ?? "").trim(),
      jenis_kelamin: (p.jenis_kelamin ?? "").trim(),
      telepon: String(p.telepon ?? "").trim(),
      tiket: (p.tiket ?? "").trim().replace(/\s*-\s*\(.*?\)\s*$/, ""),
      kode_tiket: (p.kode_tiket ?? "").trim(),
    }))
    const { error } = await supabaseAdmin.from("participants").insert(chunk)
    if (error) {
      return Response.json(
        { success: false, error: error.message, inserted },
        { status: 500 }
      )
    }
    inserted += chunk.length
  }

  return Response.json({
    success: true,
    data: { inserted },
  })
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return Response.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 }
    )
  }

  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("perPage")) || 25))
  const search = (url.searchParams.get("search") ?? "").trim()
  const tiket = url.searchParams.get("tiket") ?? ""
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  // Build query
  let query = supabaseAdmin
    .from("participants")
    .select("*", { count: "exact" })

  if (tiket) {
    query = query.eq("tiket", tiket)
  }

  if (search) {
    // Use ilike for search across multiple columns
    query = query.or(
      `nama.ilike.%${search}%,email.ilike.%${search}%,telepon.ilike.%${search}%,kode_tiket.ilike.%${search}%`
    )
  }

  query = query.order("created_at", { ascending: true }).range(from, to)

  const { data, count, error } = await query

  if (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  // Fetch distinct ticket types for filter (lightweight query)
  const { data: ticketData } = await supabaseAdmin
    .from("participants")
    .select("tiket")

  const ticketTypes = Array.from(
    new Set((ticketData ?? []).map((r: { tiket: string }) => r.tiket).filter(Boolean))
  ).sort() as string[]

  const stats: Record<string, number> = {}
  for (const r of (ticketData ?? [])) {
    const t = r.tiket || "Tidak ada tiket"
    stats[t] = (stats[t] || 0) + 1
  }

  // Total count (unfiltered) for stats
  const { count: totalCount } = await supabaseAdmin
    .from("participants")
    .select("*", { count: "exact", head: true })

  return Response.json({
    success: true,
    data: data ?? [],
    total: count ?? 0,
    totalAll: totalCount ?? 0,
    ticketTypes,
    stats,
    page,
    perPage,
  })
}

export async function DELETE() {
  if (!supabaseAdmin) {
    return Response.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 }
    )
  }

  const { error } = await supabaseAdmin
    .from("participants")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")

  if (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return Response.json({ success: true })
}
