"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import type { Gender } from "@/types/db"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import { GridSetup } from "@/components/editor/grid-setup"
import { CategoryManager } from "@/components/editor/category-manager"
import { AssignPanel } from "@/components/editor/assign-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { LayoutGridIcon, PaletteIcon, PaintbrushIcon } from "lucide-react"

const STEPS = [
  {
    value: "grid",
    title: "Grid",
    hint: "Baris & kolom",
    icon: LayoutGridIcon,
  },
  {
    value: "categories",
    title: "Kategori",
    hint: "Warna zona",
    icon: PaletteIcon,
  },
  {
    value: "assign",
    title: "Assign",
    hint: "Isi kursi",
    icon: PaintbrushIcon,
  },
] as const

export default function EditorGenderPage() {
  const params = useParams()
  const g = params.gender as string
  const gender = (g === "male" || g === "female" ? g : null) as Gender | null

  const hydrated = useLayoutStore((s) => s.hydrated)
  const layout = useLayoutStore((s) =>
    gender ? s.layouts[gender] : null
  )
  const seatCount = useSeatStore((s) =>
    gender ? Object.keys(s.seats[gender]).length : 0
  )

  const [tab, setTab] = React.useState("grid")

  if (!gender) {
    return (
      <p className="text-sm text-muted-foreground">Layout tidak valid.</p>
    )
  }

  if (!hydrated || !layout) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-96 rounded-md" />
      </div>
    )
  }

  const stepIndex = STEPS.findIndex((s) => s.value === tab)
  const stepNumber = stepIndex >= 0 ? stepIndex + 1 : 1

  return (
    <div className="space-y-4 pb-8 sm:space-y-6">
      <header className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              Edit — {layout.label}
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Wizard tiga langkah: atur grid, kategori warna, lalu assign kursi.
            </p>
          </div>
          <Badge
            variant="secondary"
            className="w-fit shrink-0 rounded-md px-2.5 py-1 text-xs sm:text-sm"
          >
            {seatCount} kursi
          </Badge>
        </div>

        <p className="text-center text-[11px] font-medium text-muted-foreground sm:hidden">
          Langkah {stepNumber} dari {STEPS.length}
        </p>
        <div
          className="flex justify-center gap-1.5 sm:hidden"
          aria-hidden
        >
          {STEPS.map((s) => (
            <span
              key={s.value}
              className={cn(
                "h-1.5 rounded-full transition-all",
                tab === s.value
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-muted-foreground/35"
              )}
            />
          ))}
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="w-full min-w-0 flex-col">
        <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-background px-4 py-3 sm:static sm:z-auto sm:mx-0 sm:rounded-md sm:border sm:border-border sm:bg-secondary sm:px-2 sm:py-2">
          <TabsList className="grid h-auto min-h-[3rem] w-full grid-cols-3 gap-1 rounded-md bg-transparent p-0 sm:min-h-9 sm:rounded-md sm:bg-secondary sm:p-1">
            {STEPS.map(({ value, title, hint, icon: Icon }, i) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  "touch-manipulation rounded-md px-1 py-2.5 text-[11px] leading-tight sm:min-h-0 sm:px-2 sm:py-2 sm:text-sm",
                  "flex min-h-[3rem] flex-col items-center justify-center gap-0.5 sm:min-h-8 sm:flex-row sm:gap-2",
                  "data-active:ring-1 data-active:ring-primary/40"
                )}
              >
                <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                <span className="font-semibold sm:hidden">{title}</span>
                <span className="hidden font-medium sm:inline">
                  {i + 1}. {title}
                </span>
                <span className="max-w-[4.5rem] truncate text-[10px] font-normal text-muted-foreground sm:sr-only">
                  {hint}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="grid" className="mt-4 outline-none sm:mt-6">
          <GridSetup
            layout={layout}
            gender={gender}
            onDone={() => setTab("categories")}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-4 outline-none sm:mt-6">
          <CategoryManager
            layout={layout}
            gender={gender}
            onDone={() => setTab("assign")}
          />
        </TabsContent>

        <TabsContent value="assign" className="mt-4 outline-none sm:mt-6">
          <AssignPanel layout={layout} gender={gender} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
