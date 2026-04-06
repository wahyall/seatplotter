import { Skeleton } from "@/components/ui/skeleton"

export function SeatGridSkeleton({
  rows = 8,
  cols = 10,
}: {
  rows?: number
  cols?: number
}) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <div className="flex gap-1 pl-8">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-[34px] rounded-md" />
        ))}
      </div>
      {Array.from({ length: Math.min(rows, 8) }).map((_, r) => (
        <div key={r} className="flex items-center gap-1">
          <Skeleton className="h-[34px] w-7 rounded-md" />
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-[34px] w-[34px] rounded-md" />
          ))}
          <Skeleton className="h-[34px] w-7 rounded-md" />
        </div>
      ))}
    </div>
  )
}
