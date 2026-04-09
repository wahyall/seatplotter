"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import type { Gender } from "@/types/db"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import { useShallow } from "zustand/react/shallow"
import { useRealtimeSeats } from "@/lib/hooks/useRealtimeSeats"
import { useSeatPresence } from "@/lib/hooks/useSeatPresence"
import { bookSeat, validateTickets, type ValidatedTicket } from "@/lib/booking"
import { extractQrFromMultiplePdfs, type ScanProgress } from "@/lib/pdf-qr"
import { ConnectionBanner } from "@/components/layout/connection-banner"
import { StageBar } from "@/components/layout/stage-bar"
import { SeatGrid } from "@/components/seat/seat-grid"
import {
  QrCodeIcon,
  TicketIcon,
  CheckCircle2Icon,
  Loader2Icon,
  UploadIcon,
  ScanLineIcon,
  XIcon,
  UserIcon,
  SparklesIcon,
  DownloadIcon,
} from "lucide-react"
import { TicketPrint } from "@/components/seat/ticket-print"
import { exportTicketPNG } from "@/lib/export-png"

export default function BookingPage() {
  const router = useRouter()

  const config = useLayoutStore((s) => s.config)
  const hydrated = useLayoutStore((s) => s.hydrated)

  const layoutM = useLayoutStore((s) => s.layouts.male)
  const layoutF = useLayoutStore((s) => s.layouts.female)
  const categoriesM = useLayoutStore((s) => s.categories.male ?? [])
  const categoriesF = useLayoutStore((s) => s.categories.female ?? [])
  
  const seatsM = useSeatStore(useShallow((s) => Object.values(s.seats.male ?? {})))
  const seatsF = useSeatStore(useShallow((s) => Object.values(s.seats.female ?? {})))

  const { isConnected: isRealtimeConnected } = useRealtimeSeats([layoutM?.id, layoutF?.id].filter(Boolean) as string[])
  const { isConnected: isPresenceConnected, globalDrafts, localDrafts, draftSeatLocal, clearLocalDraftForParticipant, sessionId } = useSeatPresence({
    onDraftLost: (seatId, participantId) => {
      import("sonner").then(m => m.toast.error("Maaf, kursi ini gagal didraft karena keduluan peserta lain!"))
      setTickets((prev) => prev.map(t => t.id === participantId ? { ...t, seat_id: null } : t))
    }
  })
  const isConnected = isRealtimeConnected && isPresenceConnected

  // Tickets from session storage or re-scan
  const [tickets, setTickets] = React.useState<ValidatedTicket[]>([])
  const [selectedTicketId, setSelectedTicketId] = React.useState<string | null>(null)
  const [booking, setBooking] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<Gender>("male")

  // Scan modal state
  const [showScanner, setShowScanner] = React.useState(false)
  const [scanning, setScanning] = React.useState(false)
  const [scanProgress, setScanProgress] = React.useState<ScanProgress | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const stored = localStorage.getItem("booking_tickets")
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ValidatedTicket[]
        setTickets(parsed)
      } catch {
        // ignore
      }
    }
  }, [])

  const ticketRefreshRef = React.useRef(false)
  React.useEffect(() => {
    if (tickets.length === 0 || ticketRefreshRef.current) return
    ticketRefreshRef.current = true
    const kodeTikets = tickets.map((t) => t.kode_tiket)
    validateTickets(kodeTikets).then((res) => {
      if (res.success) {
        setTickets(res.tickets)
      }
      ticketRefreshRef.current = false
    }).catch(() => {
      ticketRefreshRef.current = false
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const myParticipantIds = React.useMemo(
    () => new Set(tickets.map((t) => t.id)),
    [tickets]
  )

  function mapDisplaySeats(seatsData: typeof seatsM, categories: typeof categoriesM, gridGender: Gender) {
    let list = seatsData.map((s) => {
      const draft = globalDrafts[s.id]
      const dbBooked = !!s.participant_id
      const actualParticipantId = dbBooked ? s.participant_id : draft?.participantId

      const isMine = !!actualParticipantId && myParticipantIds.has(actualParticipantId)
      let initial = ""
      
      if (isMine) {
        const ticket = tickets.find((t) => t.id === actualParticipantId)
        if (ticket?.nama) {
          initial = ticket.nama.trim().split(/\s+/).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("")
        }
      } else if (dbBooked && s.participants?.nama) {
        initial = s.participants.nama.trim().split(/\s+/).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("")
      } else if (draft?.nama) {
        initial = draft.nama.trim().split(/\s+/).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("")
      }

      return {
        ...s,
        _booked: dbBooked || !!draft,
        _mine: isMine,
        _mineInitial: initial,
      }
    })

    if (selectedTicketId) {
      const ticket = tickets.find((t) => t.id === selectedTicketId)
      if (ticket) {
        if (ticket.jenis_kelamin !== gridGender.toUpperCase()) {
          // Wrong layout entirely for this ticket! Diff everything here!
          list = list.map((s) => ({ ...s, _dimmed: true }))
        } else {
          const ticketTypeLower = (ticket.tiket ?? "").toLowerCase()
          const matchingCats = categories
            .filter((c) => c.name.toLowerCase() === ticketTypeLower)
            .map((c) => c.id)

          if (matchingCats.length > 0) {
            list = list.map((s) => ({
              ...s,
              _dimmed: !matchingCats.includes(s.category_id ?? ""),
            }))
          } else {
            list = list.map((s) => ({ ...s, _dimmed: true }))
          }
        }
      }
    }

    return list
  }

  const displaySeatsM = React.useMemo(() => mapDisplaySeats(seatsM, categoriesM, "male"), [seatsM, myParticipantIds, selectedTicketId, tickets, categoriesM, globalDrafts])
  const displaySeatsF = React.useMemo(() => mapDisplaySeats(seatsF, categoriesF, "female"), [seatsF, myParticipantIds, selectedTicketId, tickets, categoriesF, globalDrafts])

  const stats = React.useMemo(() => {
    const allSeats = [...seatsM, ...seatsF]
    const active = allSeats.filter((s) => !s.is_empty)
    const booked = active.filter((s) => !!s.participant_id)
    const available = active.length - booked.length
    return { total: active.length, booked: booked.length, available }
  }, [seatsM, seatsF])

  const handleSeatRef = React.useRef<(seatId: string, gender: Gender, action: string) => void>(() => {})

  handleSeatRef.current = async (seatId: string, gender: Gender, action: string) => {
    if (action !== "click") return
    const seatStore = useSeatStore.getState().seats[gender]
    if (!seatStore) return
    const seat = seatStore[seatId]
    if (!seat || seat.is_empty) return

    if (seat.participant_id && myParticipantIds.has(seat.participant_id)) {
      const ticket = tickets.find((t) => t.id === seat.participant_id)
      if (ticket) {
        toast.success(`Ini kursi ${ticket.nama} (${ticket.kode_tiket})`)
      }
      return
    }

    if (seat.participant_id) {
      toast.error("Kursi ini sudah diambil peserta lain")
      return
    }

    if (!selectedTicketId) {
      if (tickets.length === 0) {
        toast.error("Scan tiket terlebih dahulu")
        setShowScanner(true)
      } else {
        toast.message("Pilih tiket terlebih dahulu dari daftar di bawah")
      }
      return
    }

    const ticket = tickets.find((t) => t.id === selectedTicketId)
    if (!ticket) return

    // Strict gender mapping validation
    if (ticket.jenis_kelamin !== gender.toUpperCase()) {
      // toast.error(`Tiket ini khusus untuk partisipan berjenis kelamin ${ticket.jenis_kelamin === "MALE" ? "PRIA" : "WANITA"}`)
      return
    }

    const categories = gender === "male" ? categoriesM : categoriesF

    if (!seat.category_id) {
      return
    }

    const cat = categories.find((c) => c.id === seat.category_id)
    if (!cat) {
      return
    }

    if (!ticket.tiket || cat.name.trim().toLowerCase() !== ticket.tiket.trim().toLowerCase()) {
      return // Do nothing or show an error. The user knows it's dimmed.
    }

    // Soft lock logic
    const draft = globalDrafts[seatId]
    if (draft && draft.participantId !== ticket.id) {
       toast.error("Kursi ini sedang diplih oleh peserta lain (draft)!")
       return
    }

    const oldSeatId = ticket.seat_id
    
    if (draft && draft.participantId === ticket.id && seatId === oldSeatId) {
      clearLocalDraftForParticipant(ticket.id)
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticket.id ? { ...t, seat_id: null } : t
        )
      )
      // toast.success(`Draft kursi batal`)
      return
    }

    // Update local ticket pointer
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id ? { ...t, seat_id: seatId } : t
      )
    )

    // Broadcast our draft to Presence
    draftSeatLocal(seatId, ticket.id, ticket.nama, oldSeatId)
    toast.success(`Kursi ${seat.label} didraft untuk ${ticket.nama}. Klik Simpan untuk mengunci!`)
  }

  const handleSeatClickM = React.useCallback(
    (id: string, action: "click" | "touchstart" | "touchend" | "longpress" | "touchpan") => {
      handleSeatRef.current(id, "male", action)
    },
    []
  )

  const handleSeatClickF = React.useCallback(
    (id: string, action: "click" | "touchstart" | "touchend" | "longpress" | "touchpan") => {
      handleSeatRef.current(id, "female", action)
    },
    []
  )

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    setScanning(true)
    setScanProgress(null)

    try {
      const alreadyKnown = new Set(tickets.map((t) => t.kode_tiket))
      const results = await extractQrFromMultiplePdfs(
        files,
        (p) => setScanProgress(p)
      )

      const newResults = results.filter((r) => !alreadyKnown.has(r.value))

      if (results.length === 0) {
        toast.error("Tidak ditemukan QR code di dalam PDF")
        setScanning(false)
        return
      }

      const allKodeTikets = [
        ...new Set([...results.map((r) => r.value), ...tickets.map((t) => t.kode_tiket)]),
      ]
      const response = await validateTickets(allKodeTikets)

      if (!response.success) {
        toast.error(response.error ?? "Gagal validasi tiket")
        setScanning(false)
        return
      }

      if (response.tickets.length === 0) {
        toast.error("Tidak ada kode tiket valid yang ditemukan")
        setScanning(false)
        return
      }

      const existingIds = new Set(tickets.map((t) => t.id))
      const freshTickets = response.tickets
      const updatedExisting = tickets.map((existing) => {
        const fresh = freshTickets.find((t) => t.id === existing.id)
        return fresh ? { ...existing, ...fresh } : existing
      })
      const brandNew = freshTickets.filter((t) => !existingIds.has(t.id))

      const merged = [...updatedExisting, ...brandNew]
      setTickets(merged)
      localStorage.setItem("booking_tickets", JSON.stringify(merged))
      setShowScanner(false)

      if (newResults.length > 0) {
        toast.success(`${brandNew.length} tiket baru ditemukan`)
      } else {
        toast.info("Semua QR code sudah ter-scan sebelumnya")
      }
    } catch (err) {
      toast.error("Gagal scan PDF: " + (err instanceof Error ? err.message : "Error"))
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const unbookedTickets = tickets.filter((t) => !t.already_booked)
  const bookedTickets = tickets.filter((t) => t.already_booked)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <h1 className="truncate font-display text-sm font-bold sm:text-base">
              {config?.event_name ?? "Pilih Kursi"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {stats.available} kursi tersedia · {stats.booked} terisi
            </p>
          </div>
          <ConnectionBanner isConnected={isConnected} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 py-4">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Category Colors */}
          {(activeTab === "male" ? categoriesM : categoriesF).map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: c.color }} />
              {c.name}
            </span>
          ))}
          
          <div className="mx-1 h-3 w-[1px] bg-border/60" />
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm bg-muted-foreground/40" />
            <UserIcon className="size-2.5" /> Terisi
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm bg-blue-200 ring-2 ring-blue-400 ring-offset-1 ring-offset-background" />
            Kursi Anda
          </span>
          {/* <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm bg-muted/30 opacity-40" />
            Tidak sesuai / Beda Layout
          </span> */}
        </div>

        {/* TABS */}
        <div className="flex w-full justify-center">
          <div className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
            <button
              onClick={() => setActiveTab("male")}
              className={`rounded-lg px-6 py-2 text-sm font-bold transition-all ${
                activeTab === "male"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              Denah PRIA
            </button>
            <button
              onClick={() => setActiveTab("female")}
              className={`rounded-lg px-6 py-2 text-sm font-bold transition-all ${
                activeTab === "female"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              Denah WANITA
            </button>
          </div>
        </div>

        {/* Active Grid Layout */}
        <div className="flex flex-col gap-6 items-stretch justify-center pb-8">
          {/* PRIA */}
          {activeTab === "male" && layoutM && (
            <div className="flex flex-col gap-4 flex-1 min-w-0">
              <StageBar label="PRIA" />
              <SeatGrid
                seats={displaySeatsM}
                layout={layoutM}
                categories={categoriesM}
                mode="booking"
                onSeatAction={handleSeatClickM}
                className="w-full"
              />
            </div>
          )}

          {/* WANITA */}
          {activeTab === "female" && layoutF && (
            <div className="flex flex-col gap-4 flex-1 min-w-0">
              <StageBar label="WANITA" />
              <SeatGrid
                seats={displaySeatsF}
                layout={layoutF}
                categories={categoriesF}
                mode="booking"
                onSeatAction={handleSeatClickF}
                className="w-full"
              />
            </div>
          )}
        </div>

        {booking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2Icon className="size-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Memproses booking...</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className="sticky bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] px-4 py-3">
          {tickets.length === 0 ? (
            <button
              onClick={() => setShowScanner(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <QrCodeIcon className="size-4" />
              Scan Tiket PDF
            </button>
          ) : (
            <div className="space-y-3">
              {unbookedTickets.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Pilih tiket, lalu tap kursi yang tersedia:
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {unbookedTickets.map((t) => {
                      const isSelected = selectedTicketId === t.id
                      return (
                        <div key={t.id} className="flex shrink-0 flex-col gap-2">
                          <button
                            onClick={() => {
                              const isNowSelected = !isSelected
                              setSelectedTicketId(isNowSelected ? t.id : null)
                              // Auto-switch tab based on ticket
                              if (isNowSelected) {
                                setActiveTab(t.jenis_kelamin === "MALE" ? "male" : "female")
                              }
                            }}
                            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                              isSelected
                                ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-1 ring-offset-background"
                                : "border-border/60 bg-card/40 hover:border-primary/40"
                            }`}
                          >
                            <TicketIcon className="size-3.5 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{t.nama}</p>
                              <p className="text-[10px] text-muted-foreground">{t.tiket}</p>
                            </div>
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {unbookedTickets.some((t) => t.seat_id) && (
                    <button
                      disabled={booking}
                      onClick={async () => {
                        setBooking(true)
                        let allSuccess = true
                        const newMerged = [...tickets]

                        // Iterate and book ONLY those carefully drafted locally
                        for (const draft of Object.values(localDrafts)) {
                           const res = await bookSeat(draft.seatId, draft.participantId)
                           if (res.success) {
                             clearLocalDraftForParticipant(draft.participantId)
                             // Finalize local ticket status
                             const idx = newMerged.findIndex(t => t.id === draft.participantId)
                             if (idx >= 0) newMerged[idx].already_booked = true
                           } else {
                             allSuccess = false
                             toast.error(`Gagal lock kursi untuk ${draft.nama}: ${res.error}`)
                             // Reverting local ticket pointer if API failed
                             const idx = newMerged.findIndex(t => t.id === draft.participantId)
                             if (idx >= 0) newMerged[idx].seat_id = null
                           }
                        }

                        // Also lock anything that was already fetched with a seat_id but not in localDrafts and unmarked (safeguard)
                        const unbookedWithoutDraft = newMerged.filter(t => !t.already_booked && t.seat_id && !Object.values(localDrafts).some(d => d.participantId === t.id))
                        for (const safeguard of unbookedWithoutDraft) {
                           safeguard.already_booked = true
                        }

                        setTickets(newMerged)
                        localStorage.setItem("booking_tickets", JSON.stringify(newMerged))
                        setSelectedTicketId(null)
                        setBooking(false)

                        if (allSuccess) {
                          toast.success("Semua kursi berhasil disimpan permanen!")
                        }
                      }}
                      className="mt-3 flex w-full animate-in fade-in slide-in-from-bottom-2 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition-colors hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {booking ? <Loader2Icon className="size-4 animate-spin" /> : <CheckCircle2Icon className="size-4" />}
                      SIMPAN PILIHAN KURSI
                    </button>
                  )}
                </div>
              )}

              {bookedTickets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {bookedTickets.map((t) => {
                    const seatId = t.seat_id
                    let seatLabel = "-"
                    if (t.jenis_kelamin === "MALE") {
                      seatLabel = seatsM.find((s) => s.id === seatId)?.label ?? "-"
                    } else {
                      seatLabel = seatsF.find((s) => s.id === seatId)?.label ?? "-"
                    }
                    return (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 pl-2.5 pr-1 py-1 text-[10px] font-medium text-emerald-400"
                      >
                        <CheckCircle2Icon className="size-3" />
                        {t.nama}
                        <span className="bg-emerald-500/20 px-1.5 py-0.5 rounded-md text-emerald-300 ml-1">
                          Kursi: {seatLabel}
                        </span>
                        <button
                          onClick={() => exportTicketPNG(t.id, t.nama)}
                          className="ml-1 rounded-full p-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 transition-colors"
                          title="Download Tiket"
                        >
                          <DownloadIcon className="size-3" />
                        </button>
                        <TicketPrint ticket={t} seatLabel={seatLabel} config={config} />
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowScanner(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-card/60"
                >
                  <QrCodeIcon className="size-3" />
                  Scan lagi
                </button>
                {unbookedTickets.length === 0 && bookedTickets.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <SparklesIcon className="size-3" />
                    Semua tiket sudah memiliki kursi!
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scanner modal */}
      <AnimatePresence>
        {showScanner && (
          <motion.div
            key="scanner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <QrCodeIcon className="size-5 text-primary" />
                  Scan Tiket PDF
                </h2>
                {tickets.length > 0 && (
                  <button
                    onClick={() => setShowScanner(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <XIcon className="size-5" />
                  </button>
                )}
              </div>

              <label
                htmlFor="scan-pdf-upload"
                className={`flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 transition-all ${
                  scanning
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/60 hover:border-primary/40 hover:bg-muted/20"
                }`}
              >
                {scanning ? (
                  <div className="flex flex-col items-center gap-3">
                    <ScanLineIcon className="size-10 animate-pulse text-primary" />
                    <p className="text-sm font-medium">Scanning...</p>
                    {scanProgress && (
                      <p className="text-xs text-muted-foreground">
                        Halaman {scanProgress.current} / {scanProgress.total} · {scanProgress.found} QR
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <UploadIcon className="size-8 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Upload PDF tiket</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Bisa pilih beberapa file sekaligus
                      </p>
                    </div>
                  </>
                )}
                <input
                  ref={fileRef}
                  id="scan-pdf-upload"
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="sr-only"
                  disabled={scanning}
                  onChange={handleScanFile}
                />
              </label>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
