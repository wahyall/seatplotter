import type { Metadata, Viewport } from "next"
import { AppDataProvider } from "@/components/providers/app-data-provider"
import { AppErrorBoundary } from "@/components/error-boundary"
import { cn } from "@/lib/utils"
import { getBookingThemeId, bookingThemeShellClass } from "@/lib/booking-theme"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const theme = getBookingThemeId(slug)
  if (theme === "reconnect") {
    return {
      title: "Pilih Kursi — Reconnect Surabaya",
      description: "Pilih kursi — ITTIBA' Reconnect Surabaya. Scan tiket QR, lalu pilih kursi.",
    }
  }
  if (theme === "disconnect") {
    return {
      title: "Pilih Kursi — Disconnect Surabaya",
      description: "Pilih kursi — ITTIBA' Disconnect Surabaya. Scan tiket QR, lalu pilih kursi.",
    }
  }
  return {
    title: "Pilih Kursi — SeatPlotter",
    description: "Pilih kursi Anda sendiri dengan scan tiket QR",
  }
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Viewport> {
  const { slug } = await params
  const theme = getBookingThemeId(slug)
  if (theme === "reconnect") {
    return { themeColor: "#059669" }
  }
  if (theme === "disconnect") {
    return { themeColor: "#b20000" }
  }
  return {}
}

export default async function BookingSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const themeId = getBookingThemeId(slug)
  const themed = themeId !== "default"

  return (
    <AppDataProvider slug={slug}>
      <AppErrorBoundary>
        <div
          className={cn("min-h-screen", bookingThemeShellClass(themeId))}
          data-booking-theme={themed ? themeId : undefined}
        >
          {children}
        </div>
      </AppErrorBoundary>
    </AppDataProvider>
  )
}
