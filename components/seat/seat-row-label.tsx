"use client";

import { cn } from "@/lib/utils";

export function SeatRowLabel({
  label,
  compact,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-7 shrink-0 items-center justify-center font-mono font-medium text-[12px]",
        compact && "w-8 text-[13px]",
      )}
    >
      {label}
    </div>
  );
}
