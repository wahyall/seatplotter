import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Pro / long workloads — override in vercel.json if needed. */
export const maxDuration = 300;

/** Full URL to POST .../api/external/whatsapp/send on the bridge (see WHASTAPP_SERVICE.md). */
function resolveWhatsAppSendUrl(): string {
  const full = process.env.WHATSAPP_SEND_URL?.trim();
  if (full) return full;
  const origin = process.env.WHATSAPP_API_ORIGIN?.trim();
  if (origin) return `${origin.replace(/\/$/, "")}/api/external/whatsapp/send`;
  return "";
}

function resolveApiKey(): string {
  return process.env.WHATSAPP_EXTERNAL_API_KEY?.trim() ?? "";
}

function isWhatsAppConfigured(): boolean {
  return Boolean(resolveWhatsAppSendUrl() && resolveApiKey());
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * Concurrent outbound POSTs — bridge queues + rate-limits locally (WHASTAPP_SERVICE.md).
 * Env: WHATSAPP_REMINDER_CONCURRENCY (default 25, clamped 1–80).
 */
function getReminderConcurrency(): number {
  const raw = process.env.WHATSAPP_REMINDER_CONCURRENCY?.trim();
  const parsed = raw ? parseInt(raw, 10) : 25;
  if (Number.isNaN(parsed)) return 25;
  return clamp(parsed, 1, 80);
}

function getPublicOrigin(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return new URL(request.url).origin;
}

function uniqueTeleponPemesan(
  rows: { telepon_pemesan: string | null }[] | null,
): string[] {
  const set = new Set<string>();
  for (const r of rows ?? []) {
    const t = (r.telepon_pemesan ?? "").trim();
    if (t) set.add(t);
  }
  return [...set];
}

type SendOutcome = "ok" | { number: string; error: string };

/**
 * Bounded concurrent requests: N workers drain a shared queue.
 * Faster than sequential 1 msg + delay; avoids unbounded parallelism against the bridge.
 */
async function mapPoolConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  async function worker() {
    for (;;) {
      const i = nextIdx++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get("session")?.value) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (!supabaseAdmin) {
    return Response.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const eventId = new URL(request.url).searchParams.get("event_id")?.trim();
  if (!eventId) {
    return Response.json(
      { success: false, error: "event_id is required" },
      { status: 400 },
    );
  }

  const { data: rows, error } = await supabaseAdmin
    .from("participants")
    .select("telepon_pemesan")
    .eq("event_id", eventId);

  if (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  const unique = uniqueTeleponPemesan(rows ?? []);

  return Response.json({
    success: true,
    data: {
      unique_count: unique.length,
      whatsapp_configured: isWhatsAppConfigured(),
    },
  });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get("session")?.value) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (!supabaseAdmin) {
    return Response.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const sendUrl = resolveWhatsAppSendUrl();
  const apiKey = resolveApiKey();
  if (!sendUrl || !apiKey) {
    return Response.json(
      {
        success: false,
        error:
          "WhatsApp tidak dikonfigurasi (WHATSAPP_SEND_URL atau WHATSAPP_API_ORIGIN, dan WHATSAPP_EXTERNAL_API_KEY)",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const eventId =
    typeof body?.event_id === "string" ? body.event_id.trim() : "";
  if (!eventId) {
    return Response.json(
      { success: false, error: "event_id is required" },
      { status: 400 },
    );
  }

  const { data: eventRow, error: evErr } = await supabaseAdmin
    .from("events")
    .select("slug, event_name")
    .eq("id", eventId)
    .maybeSingle();

  if (evErr || !eventRow?.slug) {
    return Response.json(
      { success: false, error: "Event not found" },
      { status: 404 },
    );
  }

  const { data: rows, error: pErr } = await supabaseAdmin
    .from("participants")
    .select("telepon_pemesan")
    .eq("event_id", eventId);

  if (pErr) {
    return Response.json(
      { success: false, error: pErr.message },
      { status: 500 },
    );
  }

  const numbers = uniqueTeleponPemesan(rows ?? []);

  if (numbers.length === 0) {
    return Response.json({
      success: true,
      data: {
        unique_numbers: 0,
        queued: 0,
        failed: [] as { number: string; error: string }[],
      },
    });
  }

  const origin = getPublicOrigin(request);
  const bookingUrl = `${origin}/booking/${eventRow.slug}`;
  const eventTitle = eventRow.event_name?.trim() || "Acara";

  const message = [
    `Assalamu'alaikum warahmatullahi wabarakatuh,`,
    ``,
    `Semoga Allah selalu jaga kita semua dalam kesehatan dan keberkahan.`,
    ``,
    `Minji mau ngingetin nih, jangan lupa *booking kursi* untuk acara ini ya:`,
    `Acara: *${eventTitle}*`,
    ``,
    `Klik link ini untuk memilih kursi:`,
    bookingUrl,
    ``,
    `Jazakumullahu khairan.`,
    `Wassalamu'alaikum warahmatullahi wabarakatuh.`,
  ].join("\n");

  const concurrency = getReminderConcurrency();

  async function sendOne(number: string): Promise<SendOutcome> {
    try {
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ number, message }),
      });
      let errText = res.statusText;
      try {
        const json = await res.json();
        if (json?.message && typeof json.message === "string") {
          errText = json.message;
        }
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        return { number, error: errText };
      }
      return "ok";
    } catch (e) {
      return {
        number,
        error: e instanceof Error ? e.message : "Network error",
      };
    }
  }

  type Fail = { number: string; error: string };
  const outcomes = await mapPoolConcurrency(numbers, concurrency, (number) =>
    sendOne(number),
  );

  let queued = 0;
  const failed: Fail[] = [];
  for (const o of outcomes) {
    if (o === "ok") queued += 1;
    else failed.push(o as Fail);
  }

  return Response.json({
    success: true,
    data: {
      unique_numbers: numbers.length,
      queued,
      failed,
      booking_url: bookingUrl,
      concurrency,
    },
  });
}
