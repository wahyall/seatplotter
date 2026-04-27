"use client";

import { cn } from "@/lib/utils";

export function StageBar({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-secondary p-4 text-center",
        className,
      )}
    >
      <span
        className="text-xs font-semibold tracking-[0.3em] uppercase inline-block"
        style={{
          transform: "translateX(var(--translate-x, 0))",
        }}
      >
        {label}
      </span>
    </div>
  );
}
