import { AppDataProvider } from "@/components/providers/app-data-provider"
import { AppErrorBoundary } from "@/components/error-boundary"

export const metadata = {
  title: "Pilih Kursi — SeatPlotter",
  description: "Pilih kursi Anda sendiri dengan scan tiket QR",
}

/**
 * Standalone layout for the self-service booking page.
 * No sidebar/navbar — clean cinema-style experience.
 */
export default function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppDataProvider>
      <AppErrorBoundary>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </AppErrorBoundary>
    </AppDataProvider>
  )
}
