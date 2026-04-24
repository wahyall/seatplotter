"use client";

import * as React from "react";
import Link from "next/link";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { EventRow } from "@/types/db";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, MapPinIcon, ArrowRightIcon } from "lucide-react";

export default function EventsListPage() {
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true })
      .then(({ data }) => {
        setEvents(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-md" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-md" />
          <Skeleton className="h-40 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">
          Pilih Event
        </h1>
        <p className="text-sm text-muted-foreground">
          Kelola layout kursi dan peserta untuk masing-masing event.
        </p>
      </header>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada event.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="group rounded-md border border-border bg-card p-5 transition-colors duration-150 hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold leading-tight">
                  {ev.event_name}
                </h2>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {ev.event_date && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarIcon className="size-3" />
                    {ev.event_date}
                  </span>
                )}
                {ev.event_venue && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPinIcon className="size-3" />
                    {ev.event_venue}
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/event/${ev.slug}/dashboard`}
                  className="inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Dashboard
                </Link>
                <Link
                  href={`/booking/${ev.slug}`}
                  className="inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Booking Kursi
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
