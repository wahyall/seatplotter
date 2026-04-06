"use client"

import type { CategoryRow } from "@/types/db"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function FilterChips({
  categories,
  active,
  onChange,
  counts,
}: {
  categories: CategoryRow[]
  active: string
  onChange: (id: string) => void
  counts?: Record<string, number>
}) {
  const total = Object.values(counts ?? {}).reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant={active === "all" ? "default" : "outline"}
        className={cn(
          "cursor-pointer rounded-full px-3 py-1 text-xs",
          active === "all" && "bg-primary text-primary-foreground"
        )}
        onClick={() => onChange("all")}
      >
        Semua ({total || "—"})
      </Badge>
      {categories.map((c) => (
        <Badge
          key={c.id}
          variant={active === c.id ? "default" : "outline"}
          className={cn(
            "cursor-pointer rounded-full border-transparent px-3 py-1 text-xs text-white",
            active === c.id && "ring-2 ring-ring ring-offset-2 ring-offset-background"
          )}
          style={{ backgroundColor: c.color }}
          onClick={() => onChange(c.id)}
        >
          {c.name} ({counts?.[c.id] ?? "—"})
        </Badge>
      ))}
    </div>
  )
}
