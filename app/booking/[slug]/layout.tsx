import { AppDataProvider } from "@/components/providers/app-data-provider"
import { AppErrorBoundary } from "@/components/error-boundary"

export const metadata = {
  title: "Pilih Kursi — SeatPlotter",
  description: "Pilih kursi Anda sendiri dengan scan tiket QR",
}

export default async function BookingSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <AppDataProvider slug={slug}>
      <AppErrorBoundary>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </AppErrorBoundary>
    </AppDataProvider>
  )
}
