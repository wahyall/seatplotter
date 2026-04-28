import { getPartnerEventSlug } from "@/lib/import-mirror-pair-slugs"
import { supabaseAdmin } from "@/lib/supabase-admin"

interface ParticipantInput {
  nama: string
  email: string
  jenis_kelamin: string
  telepon: string
  telepon_pemesan: string
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

  const eventId = body.event_id as string | undefined
  if (!eventId) {
    return Response.json(
      { success: false, error: "event_id is required" },
      { status: 400 }
    )
  }

  const importAllEvents = body.import_all_events === true

  const participants: ParticipantInput[] = body.participants

  const valid = participants.filter((p) => p.nama && p.nama.trim() !== "")
  if (valid.length === 0) {
    return Response.json(
      { success: false, error: "Tidak ada data peserta yang valid" },
      { status: 400 }
    )
  }

  const targetEventIds: string[] = [eventId]
  if (importAllEvents) {
    const { data: ev, error: evErr } = await supabaseAdmin
      .from("events")
      .select("slug")
      .eq("id", eventId)
      .single()
    if (evErr) {
      return Response.json(
        { success: false, error: evErr.message },
        { status: 500 }
      )
    }
    const partnerSlug = getPartnerEventSlug(ev?.slug)
    if (partnerSlug) {
      const { data: other, error: oErr } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("slug", partnerSlug)
        .maybeSingle()
      if (oErr) {
        return Response.json(
          { success: false, error: oErr.message },
          { status: 500 }
        )
      }
      if (other?.id) {
        targetEventIds.push(other.id)
      }
    }
  }
  const uniqueEventIds = [...new Set(targetEventIds)]

  if (body.replace === true) {
    for (const eid of uniqueEventIds) {
      const { error: delErr } = await supabaseAdmin
        .from("participants")
        .delete()
        .eq("event_id", eid)
      if (delErr) {
        return Response.json(
          { success: false, error: delErr.message },
          { status: 500 }
        )
      }
    }
  }

  const CHUNK = 500
  let dbRowCount = 0
  for (const targetId of uniqueEventIds) {
    for (let i = 0; i < valid.length; i += CHUNK) {
      const chunk = valid.slice(i, i + CHUNK).map((p) => ({
        nama: p.nama.trim(),
        email: (p.email ?? "").trim(),
        jenis_kelamin: (p.jenis_kelamin ?? "").trim(),
        telepon: String(p.telepon ?? "").trim(),
        telepon_pemesan: String(p.telepon_pemesan ?? "").trim(),
        tiket: (p.tiket ?? "").trim().replace(/\s*-\s*\(.*?\)\s*$/, ""),
        kode_tiket: (p.kode_tiket ?? "").trim(),
        event_id: targetId,
      }))
      const { error } = await supabaseAdmin.from("participants").insert(chunk)
      if (error) {
        return Response.json(
          { success: false, error: error.message, inserted: valid.length, dbRowCount },
          { status: 500 }
        )
      }
      dbRowCount += chunk.length
    }
  }

  return Response.json({
    success: true,
    data: {
      inserted: valid.length,
      event_targets: uniqueEventIds.length,
      total_db_rows: dbRowCount,
    },
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
  const eventId = url.searchParams.get("event_id") ?? ""
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("perPage")) || 25))
  const search = (url.searchParams.get("search") ?? "").trim()
  const tiket = url.searchParams.get("tiket") ?? ""
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabaseAdmin
    .from("participants")
    .select("*", { count: "exact" })

  if (eventId) {
    query = query.eq("event_id", eventId)
  }

  if (tiket) {
    query = query.eq("tiket", tiket)
  }

  if (search) {
    query = query.or(
      `nama.ilike.%${search}%,email.ilike.%${search}%,telepon.ilike.%${search}%,telepon_pemesan.ilike.%${search}%,kode_tiket.ilike.%${search}%`
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

  let ticketQuery = supabaseAdmin.from("participants").select("tiket")
  if (eventId) {
    ticketQuery = ticketQuery.eq("event_id", eventId)
  }
  const { data: ticketData } = await ticketQuery

  const ticketTypes = Array.from(
    new Set((ticketData ?? []).map((r: { tiket: string }) => r.tiket).filter(Boolean))
  ).sort() as string[]

  const stats: Record<string, number> = {}
  for (const r of (ticketData ?? [])) {
    const t = r.tiket || "Tidak ada tiket"
    stats[t] = (stats[t] || 0) + 1
  }

  let totalQuery = supabaseAdmin
    .from("participants")
    .select("*", { count: "exact", head: true })
  if (eventId) {
    totalQuery = totalQuery.eq("event_id", eventId)
  }
  const { count: totalCount } = await totalQuery

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

export async function DELETE(req: Request) {
  if (!supabaseAdmin) {
    return Response.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 }
    )
  }

  const url = new URL(req.url)
  const eventId = url.searchParams.get("event_id") ?? ""

  let query = supabaseAdmin.from("participants").delete()

  if (eventId) {
    query = query.eq("event_id", eventId)
  } else {
    query = query.neq("id", "00000000-0000-0000-0000-000000000000")
  }

  const { error } = await query

  if (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  return Response.json({ success: true })
}
