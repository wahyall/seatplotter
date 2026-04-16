import { AppDataProvider } from "@/components/providers/app-data-provider"

export default async function EventSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return <AppDataProvider slug={slug}>{children}</AppDataProvider>
}
