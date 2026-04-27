"use client";

import { cn } from "@/lib/utils";

/** Mirrors `SeatGrid` row gutters: `px-1` + row label width + `gap-[3px]` + cells + label. */
export function SeatColHeader({
  headers,
  compact,
}: {
  headers: string[];
  compact?: boolean;
}) {
  return (
    <div className="flex w-max shrink-0 items-center gap-[3px] px-1">
      <div className={cn("shrink-0", compact ? "w-8" : "w-7")} aria-hidden />
      {headers.map((h) => (
        <div
          key={h}
          className={cn(
            "flex shrink-0 items-center justify-center px-px font-mono font-semibold leading-none text-[12px]",
          )}
          style={{
            width: "var(--seat-size, 34px)",
            height: "var(--seat-size, 34px)",
          }}
        >
          {h}
        </div>
      ))}
      <div className={cn("shrink-0", compact ? "w-8" : "w-7")} aria-hidden />
    </div>
  );
}
