import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import {
  bookingThemePrimaryFallback,
  getBookingThemeId,
} from "@/lib/booking-theme";

const PORTAL_LINKS = [
  {
    name: "Ittiba Reconnect",
    href: "/booking/ittiba-reconnect-sby",
    description: "Pilih kursi untuk event Ittiba Reconnect Surabaya.",
    imageSrc: "/banners/ittiba-reconnect-sby.jpg",
    imageAlt: "Banner event Ittiba Reconnect Surabaya",
  },
  {
    name: "Ittiba Disconnect",
    href: "/booking/ittiba-disconnect-sby",
    description: "Pilih kursi untuk event Ittiba Disconnect Surabaya.",
    imageSrc: "/banners/ittiba-disconnect-sby.jpg",
    imageAlt: "Banner event Ittiba Disconnect Surabaya",
  },
] as const;

export const metadata: Metadata = {
  title: "Booking Portal",
  description: "Pilih portal booking berdasarkan event ITTIBA.",
};

export default function BookingPortalPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.2),transparent_42%),radial-gradient(circle_at_80%_85%,rgba(34,197,94,0.12),transparent_30%)]"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 md:py-16">
        <header className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-6 backdrop-blur-sm md:p-8">
          <p className="inline-flex w-fit items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-violet-200">
            ITTIBA Surabaya 2026
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Pilih Event untuk Booking Kursi Anda
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-300 md:text-base">
            Masuk ke event yang sesuai untuk scan tiket QR dan pilih kursi Anda.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {PORTAL_LINKS.map((item) => {
            const themeId = getBookingThemeId(
              item.href.replace("/booking/", ""),
            );
            const primary = bookingThemePrimaryFallback(themeId);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "group cursor-pointer rounded-2xl border p-5 transition-colors duration-200 motion-safe:transition-transform motion-safe:duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                  "motion-safe:hover:-translate-y-0.5",
                  "text-zinc-100/90",
                ].join(" ")}
                style={{
                  borderColor: `${primary}45`,
                  backgroundColor: `${primary}12`,
                }}
              >
                <div className="relative mb-4 aspect-16/8 w-full overflow-hidden rounded-xl border border-current/20">
                  <Image
                    src={item.imageSrc}
                    alt={item.imageAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <p className="text-lg font-semibold text-white">{item.name}</p>
                <p className="mt-2 min-h-12 text-sm leading-relaxed text-zinc-300">
                  {item.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-zinc-100">
                  Pilih Kursi
                  <ArrowRightIcon
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    style={{ color: primary }}
                  />
                </span>
              </Link>
            );
          })}
        </section>

        <footer className="rounded-xl border border-zinc-800/70 bg-zinc-900/50 px-4 py-3 text-xs text-zinc-400 md:text-sm">
          Pastikan memilih event sesuai tiket Anda: Reconnect atau Disconnect
          atau Keduanya.
        </footer>
      </div>
    </main>
  );
}
