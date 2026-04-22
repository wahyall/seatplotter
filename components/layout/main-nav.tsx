"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArmchairIcon,
  CheckCircle2Icon,
  EyeIcon,
  FileSpreadsheetIcon,
  LayoutGridIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ArrowLeftIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "dashboard", label: "Dasbor", icon: LayoutDashboardIcon },
  { path: "editor", label: "Edit", icon: LayoutGridIcon },
  // { path: "view", label: "Lihat", icon: EyeIcon },
  { path: "check", label: "Centang", icon: CheckCircle2Icon },
  { path: "participants", label: "Peserta", icon: FileSpreadsheetIcon },
] as const;

function extractSlug(pathname: string): string | null {
  const match = pathname.match(/^\/event\/([^/]+)/);
  return match ? match[1] : null;
}

export function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const slug = extractSlug(pathname);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const items = slug
    ? navItems.map((item) => ({
        href: `/event/${slug}/${item.path}`,
        label: item.label,
        icon: item.icon,
      }))
    : [];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-52 flex-col border-r border-border bg-sidebar px-3 py-5 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ArmchairIcon className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-foreground">
              SeatPlotter
            </p>
          </div>
        </div>

        {slug && (
          <Link
            href="/events"
            className="mb-4 flex h-8 items-center gap-2 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            Semua Event
          </Link>
        )}

        <nav className="flex flex-1 flex-col gap-0.5">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href.endsWith("/dashboard")
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleLogout}
          className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-destructive"
        >
          <LogOutIcon className="size-4 shrink-0" />
          Keluar
        </button>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
        {slug && (
          <div className="border-b border-border px-3 pt-2">
            <Link
              href="/events"
              className="flex h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground active:bg-secondary"
            >
              <ArrowLeftIcon className="size-4 shrink-0" />
              Semua Event
            </Link>
          </div>
        )}
        <div className="mx-auto flex w-full max-w-lg items-stretch justify-between px-2 pt-1.5">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href.endsWith("/dashboard")
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[10px] font-medium transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
