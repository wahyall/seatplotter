"use client"

import { Component, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangleIcon } from "lucide-react"

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message?: string }
> {
  state = { hasError: false, message: undefined as string | undefined }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangleIcon className="size-12 text-destructive" />
          <h2 className="text-xl font-semibold">Terjadi kesalahan</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.message}
          </p>
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => window.location.reload()}
          >
            Muat ulang
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
