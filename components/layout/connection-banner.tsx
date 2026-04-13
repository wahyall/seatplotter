"use client"

import { WifiOffIcon } from "lucide-react"

export function ConnectionBanner({ isConnected }: { isConnected: boolean }) {
  if (isConnected) return null
  return (
    <div
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 border-b border-amber-600 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950"
      role="status"
    >
      <WifiOffIcon className="size-4 shrink-0" />
      Koneksi terputus — mencoba menyambung kembali…
    </div>
  )
}
