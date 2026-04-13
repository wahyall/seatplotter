import { AppDataProvider } from "@/components/providers/app-data-provider"
import { MainNav } from "@/components/layout/main-nav"
import { AppErrorBoundary } from "@/components/error-boundary"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppDataProvider>
      <AppErrorBoundary>
        <div className="flex min-h-screen flex-col lg:flex-row lg:pb-0">
          <MainNav />
          <main className="flex flex-1 flex-col pb-24 pt-4 lg:pb-8 lg:pl-52 lg:pt-5">
            <div className="mx-auto w-full max-w-6xl flex-1 px-4">{children}</div>
          </main>
        </div>
      </AppErrorBoundary>
    </AppDataProvider>
  )
}
