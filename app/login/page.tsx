"use client"

import { Suspense, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Armchair, Eye, EyeOff, Loader2, Lock, User } from "lucide-react"

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/dashboard"

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Login gagal.")
          return
        }

        router.push(redirectTo)
        router.refresh()
      } catch {
        setError("Terjadi kesalahan jaringan.")
      }
    })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[hsl(240_8%_5%)] px-4">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] animate-pulse rounded-full bg-[hsl(263_72%_58%/0.08)] blur-[120px]" />
        <div className="absolute -bottom-48 -right-48 h-[600px] w-[600px] animate-pulse rounded-full bg-[hsl(270_80%_50%/0.06)] blur-[150px]" style={{ animationDelay: "1s" }} />
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 animate-pulse rounded-full bg-[hsl(200_80%_50%/0.04)] blur-[100px]" style={{ animationDelay: "2s" }} />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(263_72%_58%)] to-[hsl(280_80%_50%)] shadow-lg shadow-[hsl(263_72%_58%/0.3)]">
            <Armchair className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              SeatPlotter
            </h1>
            <p className="mt-1 text-sm text-[hsl(240_5%_55%)]">
              Masuk untuk mengelola denah kursi
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[hsl(240_5%_16%)] bg-[hsl(240_6%_10%/0.8)] p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {error}
              </div>
            )}

            {/* Username field */}
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-xs font-medium uppercase tracking-wider text-[hsl(240_5%_55%)]"
              >
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(240_5%_40%)]" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full rounded-xl border border-[hsl(240_5%_18%)] bg-[hsl(240_6%_8%)] py-3 pl-11 pr-4 text-sm text-white placeholder-[hsl(240_5%_35%)] outline-none transition-all duration-200 focus:border-[hsl(263_72%_58%/0.5)] focus:ring-2 focus:ring-[hsl(263_72%_58%/0.15)]"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wider text-[hsl(240_5%_55%)]"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(240_5%_40%)]" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full rounded-xl border border-[hsl(240_5%_18%)] bg-[hsl(240_6%_8%)] py-3 pl-11 pr-12 text-sm text-white placeholder-[hsl(240_5%_35%)] outline-none transition-all duration-200 focus:border-[hsl(263_72%_58%/0.5)] focus:ring-2 focus:ring-[hsl(263_72%_58%/0.15)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[hsl(240_5%_40%)] transition-colors hover:text-[hsl(240_5%_60%)]"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isPending || !username || !password}
              className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[hsl(263_72%_58%)] to-[hsl(280_70%_55%)] py-3 text-sm font-semibold text-white shadow-lg shadow-[hsl(263_72%_58%/0.25)] transition-all duration-300 hover:shadow-xl hover:shadow-[hsl(263_72%_58%/0.35)] disabled:opacity-50 disabled:shadow-none"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 hover:translate-x-full" />
              <span className="relative flex items-center justify-center gap-2">
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "Masuk"
                )}
              </span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-[hsl(240_5%_35%)]">
          © {new Date().getFullYear()} SeatPlotter • Denah Kursi Event
        </p>
      </div>
    </div>
  )
}
