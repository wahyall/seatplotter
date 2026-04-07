"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArmchairIcon,
  CheckCircle2Icon,
  EyeIcon,
  FileSpreadsheetIcon,
  LayoutGridIcon,
  LayoutDashboardIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const items = [
  { href: "/dashboard", label: "Dasbor", icon: LayoutDashboardIcon },
  { href: "/editor", label: "Edit", icon: LayoutGridIcon },
  { href: "/view", label: "Lihat", icon: EyeIcon },
  { href: "/check", label: "Centang", icon: CheckCircle2Icon },
  { href: "/participants", label: "Peserta", icon: FileSpreadsheetIcon },
] as const

export function MainNav() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-56 flex-col border-r border-sidebar-border bg-sidebar/95 px-3 py-6 backdrop-blur-md lg:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ArmchairIcon className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium text-muted-foreground">SeatPlotter</p>
            <p className="text-sm font-semibold text-sidebar-foreground">Operator</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  buttonVariants({
                    variant: active ? "secondary" : "ghost",
                    size: "default",
                  }),
                  "h-11 w-full justify-start gap-3 rounded-xl px-3",
                  active && "bg-primary/15 text-primary shadow-none"
                )}
              >
                <Icon className="size-4 shrink-0 opacity-80" />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex w-full max-w-lg items-stretch justify-between gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "flex h-14 flex-1 flex-col gap-0.5 rounded-xl py-2 text-[10px] font-medium",
                  active && "bg-primary/15 text-primary"
                )}
              >
                <Icon className="mx-auto size-5" />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
