"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useSeatStore } from "@/store/useSeatStore";
import { useRealtimeSeats } from "@/lib/hooks/useRealtimeSeats";
import { ConnectionBanner } from "@/components/layout/connection-banner";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarIcon,
  MapPinIcon,
  RadioIcon,
  SettingsIcon,
  CheckCircle2Icon,
  QrCodeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

function statsForGender(
  gender: "male" | "female",
  seats: Record<string, import("@/types/db").SeatRow>,
) {
  const list = Object.values(seats);
  const active = list.filter((s) => !s.is_empty);
  const checked = active.filter((s) => s.is_checked);
  const goodieBag = active.filter((s) => s.is_goodie_bag);
  const checkPct =
    active.length > 0 ? Math.round((checked.length / active.length) * 100) : 0;
  const goodiePct =
    active.length > 0
      ? Math.round((goodieBag.length / active.length) * 100)
      : 0;
  return {
    total: active.length,
    checked: checked.length,
    goodieBag: goodieBag.length,
    checkPct,
    goodiePct,
  };
}

export default function DashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const hydrated = useLayoutStore((s) => s.hydrated);
  const event = useLayoutStore((s) => s.event);
  const maleL = useLayoutStore((s) => s.layouts.male);
  const femaleL = useLayoutStore((s) => s.layouts.female);
  const maleSeats = useSeatStore((s) => s.seats.male);
  const femaleSeats = useSeatStore((s) => s.seats.female);
  const patchEvent = useLayoutStore((s) => s.patchEvent);

  const scanQrUrl = event?.scan_qr_url ?? "";

  const ids = [maleL?.id, femaleL?.id].filter(Boolean) as string[];
  const { isConnected } = useRealtimeSeats(ids);

  const maleStats = React.useMemo(
    () => statsForGender("male", maleSeats),
    [maleSeats],
  );
  const femaleStats = React.useMemo(
    () => statsForGender("female", femaleSeats),
    [femaleSeats],
  );

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScanQrUrlChange = React.useCallback(
    (value: string) => {
      patchEvent({ scan_qr_url: value });

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (!event?.id) return;
        const { error } = await supabase
          .from("events")
          .update({ scan_qr_url: value, updated_at: new Date().toISOString() })
          .eq("id", event.id);
        if (error) toast.error("Gagal menyimpan Scan QR Url");
      }, 600);
    },
    [event?.id, patchEvent],
  );

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-2/3 max-w-md rounded-md" />
        <Skeleton className="h-20 rounded-md" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36 rounded-md" />
          <Skeleton className="h-36 rounded-md" />
        </div>
      </div>
    );
  }

  const base = `/event/${slug}`;

  return (
    <div className="space-y-6 pb-8">
      <ConnectionBanner isConnected={isConnected} />

      <header className="space-y-1">
        <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">
          {event?.event_name ?? "Event"}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {event?.event_date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" />
              {event.event_date}
            </span>
          )}
          {event?.event_venue && (
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="size-3.5" />
              {event.event_venue}
            </span>
          )}
        </div>
      </header>

      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium",
          isConnected
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-amber-500/30 bg-amber-500/10 text-amber-400",
        )}
      >
        <RadioIcon className={cn("size-3", isConnected && "animate-pulse")} />
        {isConnected ? "Realtime aktif" : "Menyambungkan\u2026"}
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <Label
          htmlFor="scan-qr-url"
          className="mb-2 inline-flex items-center gap-2 text-sm font-medium"
        >
          <QrCodeIcon className="size-4 text-primary" />
          Scan QR Url
        </Label>
        <Input
          id="scan-qr-url"
          type="url"
          placeholder="https://example.com/scan"
          value={scanQrUrl}
          onChange={(e) => handleScanQrUrlChange(e.target.value)}
          className="rounded-md"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          URL yang digunakan untuk iframe scan QR di halaman centang.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GenderStatsCard label="Pria" color="blue" stats={maleStats} />
        <GenderStatsCard label="Wanita" color="pink" stats={femaleStats} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`${base}/editor`}
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "inline-flex gap-2 rounded-md",
          )}
        >
          <SettingsIcon className="size-4" />
          Edit layout
        </Link>
        <Link
          href={`${base}/check`}
          className={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            "inline-flex gap-2 rounded-md",
          )}
        >
          <CheckCircle2Icon className="size-4" />
          Mulai centang
        </Link>
        <Link
          href={`/booking/${slug}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "inline-flex gap-2 rounded-md",
          )}
        >
          <QrCodeIcon className="size-4" />
          Booking Kursi
        </Link>
      </div>
    </div>
  );
}

function GenderStatsCard({
  label,
  color,
  stats,
}: {
  label: string;
  color: "blue" | "pink";
  stats: {
    total: number;
    checked: number;
    goodieBag: number;
    checkPct: number;
    goodiePct: number;
  };
}) {
  const borderColor =
    color === "blue" ? "border-primary/20" : "border-rose-500/20";

  return (
    <div className={cn("rounded-md border bg-card p-4", borderColor)}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {stats.checked} / {stats.total} hadir &middot; {stats.goodieBag} /{" "}
        {stats.total} goodie bag
      </p>

      <div className="mt-4 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Kehadiran</span>
            <span>{stats.checkPct}%</span>
          </div>
          <Progress value={stats.checkPct} className="h-1.5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Goodie Bag</span>
            <span>{stats.goodiePct}%</span>
          </div>
          <Progress value={stats.goodiePct} className="h-1.5" />
        </div>
      </div>
    </div>
  );
}
