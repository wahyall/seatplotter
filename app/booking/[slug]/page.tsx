"use client"

import * as React from "react"
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import type { Gender } from "@/types/db"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import { useShallow } from "zustand/react/shallow"
import { useRealtimeSeats } from "@/lib/hooks/useRealtimeSeats"
import { useSeatPresence } from "@/lib/hooks/useSeatPresence"
import { bookSeat, validateTickets, type ValidatedTicket } from "@/lib/booking"
import { extractQrFromMultiplePdfs, generatePdfPreview, type ScanProgress } from "@/lib/pdf-qr"
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
import { exportBookingTicketsPdf } from "@/lib/export-booking-tickets-pdf"
import { eventPrimaryColor, primaryMutedWash } from "@/lib/event-color"
import {
  getBookingThemeId,
  bookingThemePrimaryFallback,
  bookingThemePageRootClass,
  bookingBannerShellClass,
  bookingBannerOverlayClass,
  bookingHeaderClass,
  bookingTitleClass,
  bookingBottomPanelClass,
  bookingTabShellClass,
  bookingModalBackdropClass,
  bookingModalCardClass,
  bookingStageBarClass,
  bookingLoaderShellClass,
  bookingBookedPillClass,
  bookingBookedPillBadgeClass,
  bookingCompletionTextClass,
  bookingSecondaryButtonClass,
  bookingOverlayBlockClass,
  bookingMicroLoadingCardClass,
  bookingRingOffsetClass,
  bookingInsetPreviewClass,
  bookingTicketCardIdleClass,
} from "@/lib/booking-theme"
import { cn } from "@/lib/utils"

export default function BookingPage() {
  const params = useParams<{ slug?: string | string[] }>()
  const pageSlug = React.useMemo(() => {
    const rawSlug = params?.slug
    if (Array.isArray(rawSlug)) return rawSlug[0] ?? ""
    return rawSlug ?? ""
  }, [params])
  const bannerUrl = pageSlug ? `/banners/${pageSlug}.jpg` : null
  const themeId = React.useMemo(() => getBookingThemeId(pageSlug), [pageSlug])
  const { scrollY } = useScroll()
  const bannerY = useTransform(scrollY, [0, 900], [0, 180])

  const event = useLayoutStore((s) => s.event)
  const effectivePrimary = React.useMemo(() => {
    if (event?.color?.trim()) return eventPrimaryColor(event)
    return bookingThemePrimaryFallback(themeId)
  }, [event, themeId])
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
  const [microLoading, setMicroLoading] = React.useState(false)
  const [downloadingAllPdf, setDownloadingAllPdf] = React.useState(false)
  const isProcessingRef = React.useRef(false)
  const [activeTab, setActiveTab] = React.useState<Gender>("male")
  const [authHashes, setAuthHashes] = React.useState<Record<string, string>>({})

  // Scan modal state
  const [showScanner, setShowScanner] = React.useState(false)
  const [scanning, setScanning] = React.useState(false)
  const [scanProgress, setScanProgress] = React.useState<ScanProgress | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  // We no longer use object URLs, so we don't need the URL.revokeObjectURL cleanup, 
  // but it's safe to keep the state reset.
  React.useEffect(() => {
    if (!showScanner && previewUrl) {
      setPreviewUrl(null)
    }
  }, [showScanner, previewUrl])

  React.useEffect(() => {
    const stored = localStorage.getItem(`booking_tickets_${event?.slug ?? ""}`)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ValidatedTicket[]
        setTickets(parsed)
      } catch {
        // ignore
      }
    }
  }, [event?.slug])

  const ticketRefreshRef = React.useRef(false)
  React.useEffect(() => {
    ticketRefreshRef.current = false
  }, [event?.id])

  React.useEffect(() => {
    if (!event?.id || tickets.length === 0 || ticketRefreshRef.current) return
    ticketRefreshRef.current = true
    const kodeTikets = tickets.map((t) => t.kode_tiket)
    validateTickets(kodeTikets, event.id)
      .then((res) => {
        if (res.success) {
          setTickets(res.tickets)
        }
        ticketRefreshRef.current = false
      })
      .catch(() => {
        ticketRefreshRef.current = false
      })
  }, [event?.id, tickets.length])

  const myParticipantIds = React.useMemo(
    () => new Set(tickets.map((t) => t.id)),
    [tickets]
  )

  // Fetch auth hashes for booked tickets (anti-forgery patterns)
  React.useEffect(() => {
    const booked = tickets.filter((t) => t.already_booked && t.seat_id)
    if (booked.length === 0) return

    const allSeats = [...seatsM, ...seatsF]

    booked.forEach(async (t) => {
      if (authHashes[t.id]) return
      const seat = allSeats.find((s) => s.id === t.seat_id)
      if (!seat) return
      try {
        const res = await fetch("/api/ticket/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId: t.id,
            kodeTiket: t.kode_tiket,
            nama: t.nama,
            seatLabel: seat.label,
          }),
        })
        const data = await res.json()
        if (data.hash) {
          setAuthHashes((prev) => ({ ...prev, [t.id]: data.hash }))
        }
      } catch {
        // silently skip — ticket will render without auth pattern
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, seatsM, seatsF])

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

    isProcessingRef.current = true
    setMicroLoading(true)

    try {
      const oldSeatId = ticket.seat_id
      
      if (draft && draft.participantId === ticket.id && seatId === oldSeatId) {
        clearLocalDraftForParticipant(ticket.id)
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticket.id ? { ...t, seat_id: null } : t
          )
        )
        // toast.success(`Draft kursi batal`)
        await new Promise((r) => setTimeout(r, 400))
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
      
      await new Promise((r) => setTimeout(r, 400))
    } finally {
      isProcessingRef.current = false
      setMicroLoading(false)
    }
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
      // Generate standard image preview for mobile compatibility 
      // (mobile Chrome doesn't display PDF iframes)
      const previewDataUrl = await generatePdfPreview(files[0])
      setPreviewUrl(previewDataUrl)
      
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

      if (!event?.id) {
        toast.error("Event belum dimuat")
        setScanning(false)
        return
      }

      const allKodeTikets = [
        ...new Set([...results.map((r) => r.value), ...tickets.map((t) => t.kode_tiket)]),
      ]
      const response = await validateTickets(allKodeTikets, event.id)

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
      localStorage.setItem(`booking_tickets_${event?.slug ?? ""}`, JSON.stringify(merged))
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
      // Kept previewUrl until modal closes so they can still see it if they want
    }
  }

  const downloadAllBookedTicketsPdf = React.useCallback(async () => {
    const ids = tickets
      .filter((t) => t.already_booked && t.seat_id)
      .map((t) => t.id)
    if (ids.length === 0) return
    setDownloadingAllPdf(true)
    try {
      await new Promise((r) => setTimeout(r, 400))
      await exportBookingTicketsPdf({
        ticketIds: ids,
        fileBase: `tiket-${event?.event_name ?? pageSlug}`,
      })
    } catch (e) {
      console.error(e)
      toast.error("Gagal membuat PDF tiket.")
    } finally {
      setDownloadingAllPdf(false)
    }
  }, [tickets, event?.event_name, pageSlug])

  if (!hydrated) {
    return (
      <div className={bookingLoaderShellClass(themeId)}>
        <Loader2Icon className="size-8 animate-spin" style={{ color: effectivePrimary }} />
      </div>
    )
  }

  const unbookedTickets = tickets.filter((t) => !t.already_booked)
  const bookedTickets = tickets.filter((t) => t.already_booked)
  const allUnbookedTicketsPlotted =
    unbookedTickets.length > 0 && unbookedTickets.every((t) => Boolean(t.seat_id))
  const selectedTicket = selectedTicketId
    ? tickets.find((t) => t.id === selectedTicketId) ?? null
    : null
  const disableMaleTab = selectedTicket?.jenis_kelamin === "FEMALE"
  const disableFemaleTab = selectedTicket?.jenis_kelamin === "MALE"

  return (
    <div
      className={bookingThemePageRootClass(themeId)}
      style={
        {
          "--event-primary": effectivePrimary,
        } as React.CSSProperties
      }
    >
      {bannerUrl && (
        <div className={bookingBannerShellClass(themeId)}>
          <motion.img
            src={bannerUrl}
            alt={`${pageSlug} banner`}
            className="h-[260px] w-full object-cover will-change-transform md:h-[300px]"
            style={{ y: bannerY }}
          />
          <div className={bookingBannerOverlayClass(themeId)} />
        </div>
      )}

      <header className={bookingHeaderClass(themeId)}>
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-5 py-4">
          <div className="flex-1 min-w-0">
            <h1 className={bookingTitleClass(themeId)}>
              {event?.event_name ?? "Pilih Kursi"}
            </h1>
            <p className="text-sm text-muted-foreground tabular-nums md:text-base">
              {stats.available} kursi tersedia &middot; {stats.booked} terisi
            </p>
          </div>
          <ConnectionBanner isConnected={isConnected} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-5 py-6">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-sm md:text-base">
          {/* Category Colors */}
          {(activeTab === "male" ? categoriesM : categoriesF).map((c) => (
            <span key={c.id} className="flex items-center gap-2">
              <span className="inline-block size-4 rounded-sm" style={{ backgroundColor: c.color }} />
              {c.name}
            </span>
          ))}
          
          <div className="mx-1 h-4 w-[1px] bg-border/60" />
          <span className="flex items-center gap-2">
            <span className="inline-block size-4 rounded-sm bg-muted-foreground/40" />
            <UserIcon className="size-3.5" /> Terisi
          </span>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block size-4 rounded-sm ring-2 ring-offset-1",
                bookingRingOffsetClass(themeId)
              )}
              style={{
                backgroundColor: primaryMutedWash(effectivePrimary, 35),
                boxShadow: `0 0 0 2px ${effectivePrimary}`,
              }}
            />
            Kursi Anda
          </span>
          {/* <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm bg-muted/30 opacity-40" />
            Tidak sesuai / Beda Layout
          </span> */}
        </div>

        {/* TABS */}
        <div className="flex w-full justify-center">
          <div className={bookingTabShellClass(themeId)}>
            <button
              type="button"
              onClick={() => {
                if (disableMaleTab) return
                setActiveTab("male")
              }}
              disabled={disableMaleTab}
              className={`rounded-md px-6 py-2.5 text-base font-semibold transition-colors duration-150 ${
                activeTab === "male"
                  ? "text-white shadow-sm"
                  : disableMaleTab
                    ? "cursor-not-allowed opacity-45 text-muted-foreground"
                    : "text-muted-foreground hover:text-foreground"
              }`}
              style={
                activeTab === "male"
                  ? { backgroundColor: effectivePrimary }
                  : undefined
              }
            >
              Denah PRIA
            </button>
            <button
              type="button"
              onClick={() => {
                if (disableFemaleTab) return
                setActiveTab("female")
              }}
              disabled={disableFemaleTab}
              className={`rounded-md px-6 py-2.5 text-base font-semibold transition-colors duration-150 ${
                activeTab === "female"
                  ? "text-white shadow-sm"
                  : disableFemaleTab
                    ? "cursor-not-allowed opacity-45 text-muted-foreground"
                    : "text-muted-foreground hover:text-foreground"
              }`}
              style={
                activeTab === "female"
                  ? { backgroundColor: effectivePrimary }
                  : undefined
              }
            >
              Denah WANITA
            </button>
          </div>
        </div>

        {/* Active Grid Layout */}
        <div className="flex flex-col gap-7 items-stretch justify-center pb-10">
          {/* PRIA */}
          {activeTab === "male" && layoutM && (
            <div className="flex flex-col gap-4 flex-1 min-w-0">
              <StageBar label="STAGE" className={cn(bookingStageBarClass(themeId), activeTab === "male" && "w-[150%] [--translate-x:-110px]")} />
              <SeatGrid
                seats={displaySeatsM}
                layout={layoutM}
                categories={categoriesM}
                mode="booking"
                onSeatAction={handleSeatClickM}
                className="w-full [--seat-size:48px] md:w-auto md:self-center md:max-w-full md:[--seat-size:56px]"
              />
            </div>
          )}

          {/* WANITA */}
          {activeTab === "female" && layoutF && (
            <div className="flex flex-col gap-4 flex-1 min-w-0">
              <StageBar label="STAGE" className={cn(bookingStageBarClass(themeId), activeTab === "female" && "w-[150%] -translate-x-[33%] [--translate-x:-110px]")} />
              <SeatGrid
                seats={displaySeatsF}
                layout={layoutF}
                categories={categoriesF}
                mode="booking"
                onSeatAction={handleSeatClickF}
                className="w-full [--seat-size:48px] md:w-auto md:self-center md:max-w-full md:[--seat-size:56px]"
              />
            </div>
          )}
        </div>

        {(booking || microLoading) && (
          <div className={bookingOverlayBlockClass(themeId, booking)}>
            <div
              className={cn(
                "flex flex-col items-center gap-3",
                microLoading && !booking ? bookingMicroLoadingCardClass(themeId) : ""
              )}
            >
              <Loader2Icon
                className="size-8 animate-spin"
                style={{ color: effectivePrimary }}
              />
              <p className="text-base font-semibold">{booking ? "Memproses booking..." : "Memproses..."}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className={bookingBottomPanelClass(themeId)}>
        <div className="mx-auto max-w-[1600px] px-5 py-4">
          {tickets.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md px-5 py-3 text-base font-semibold text-white shadow-md transition-[opacity,filter] duration-150 hover:brightness-110 active:brightness-95"
                style={{ backgroundColor: effectivePrimary }}
              >
              <QrCodeIcon className="size-5" />
              Scan Tiket PDF
            </button>
          ) : (
            <div className="space-y-4">
              {unbookedTickets.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground md:text-base">
                    Pilih tiket, lalu tap kursi yang tersedia:
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {unbookedTickets.map((t) => {
                      const isSelected = selectedTicketId === t.id
                      return (
                        <div key={t.id} className="flex shrink-0 flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const isNowSelected = !isSelected
                              setSelectedTicketId(isNowSelected ? t.id : null)
                              if (isNowSelected) {
                                setActiveTab(t.jenis_kelamin === "MALE" ? "male" : "female")
                              }
                            }}
                            className={cn(
                              "flex min-h-12 w-full items-center gap-2.5 rounded-md border px-4 py-3 text-left text-sm transition-colors duration-150 md:text-base",
                              isSelected ? "" : bookingTicketCardIdleClass(themeId)
                            )}
                            style={
                              isSelected
                                ? {
                                    borderColor: effectivePrimary,
                                    backgroundColor: primaryMutedWash(effectivePrimary, 12),
                                  }
                                : undefined
                            }
                          >
                            <TicketIcon
                              className="size-4 shrink-0"
                              style={{ color: effectivePrimary }}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{t.nama}</p>
                              <p className="text-xs text-muted-foreground md:text-sm">{t.tiket}</p>
                            </div>
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {allUnbookedTicketsPlotted && (
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
                        localStorage.setItem(`booking_tickets_${event?.slug ?? ""}`, JSON.stringify(newMerged))
                        setSelectedTicketId(null)
                        setBooking(false)

                        if (allSuccess) {
                          toast.success("Semua kursi berhasil disimpan permanen!")
                          const ticketIds = newMerged
                            .filter((t) => t.already_booked && t.seat_id)
                            .map((t) => t.id)
                          if (ticketIds.length > 0) {
                            const loadingId = toast.loading("Sedang Mengunduh Tiket...")
                            try {
                              await new Promise((r) => setTimeout(r, 800))
                              await exportBookingTicketsPdf({
                                ticketIds,
                                fileBase: `tiket-${event?.event_name ?? pageSlug}`,
                              })
                              toast.success("Tiket berhasil diunduh", { id: loadingId })
                            } catch (e) {
                              console.error(e)
                              toast.error(
                                "Gagal mengunduh PDF tiket otomatis. Gunakan tombol unduh di bawah.",
                                { id: loadingId }
                              )
                            }
                          }
                        }
                      }}
                      className="mt-3 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md py-3 text-base font-bold text-white shadow-md transition-[opacity,filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-50"
                      style={{ backgroundColor: effectivePrimary }}
                    >
                      {booking ? <Loader2Icon className="size-5 animate-spin" /> : <CheckCircle2Icon className="size-5" />}
                      SIMPAN PILIHAN KURSI
                    </button>
                  )}
                </div>
              )}

              {bookedTickets.length > 0 && (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={downloadingAllPdf}
                    onClick={() => void downloadAllBookedTicketsPdf()}
                    className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-md px-5 py-3 text-base font-bold text-white shadow-md transition-[opacity,filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:pointer-events-none"
                    style={{ backgroundColor: effectivePrimary }}
                    title="Satu file PDF berisi semua tiket tersimpan"
                  >
                    {downloadingAllPdf ? (
                      <Loader2Icon className="size-5 shrink-0 animate-spin" />
                    ) : (
                      <DownloadIcon className="size-5 shrink-0" />
                    )}
                    {downloadingAllPdf ? "Mengunduh…" : "Unduh PDF (semua tiket)"}
                  </button>
                  <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1">
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
                          className={cn(
                            bookingBookedPillClass(themeId),
                            "min-h-10 shrink-0 gap-2 px-3 py-2 text-sm md:min-h-11 md:text-base"
                          )}
                        >
                          <CheckCircle2Icon className="size-4 md:size-5" />
                          {t.nama}
                          <span className={cn(bookingBookedPillBadgeClass(themeId), "text-xs md:text-sm")}>
                            Kursi: {seatLabel}
                          </span>
                          <TicketPrint
                            ticket={t}
                            seatLabel={seatLabel}
                            event={event}
                            authHash={authHashes[t.id]}
                          />
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className={bookingSecondaryButtonClass(themeId)}
                >
                  <QrCodeIcon className="size-4" />
                  Scan lagi
                </button>
                {unbookedTickets.length === 0 && bookedTickets.length > 0 && (
                  <span className={bookingCompletionTextClass(themeId)}>
                    <SparklesIcon className="size-4" />
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
            className={cn(bookingModalBackdropClass(themeId), "p-4")}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className={bookingModalCardClass(themeId)}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 font-display text-lg font-bold">
                  <QrCodeIcon
                    className="size-5"
                    style={{ color: effectivePrimary }}
                  />
                  Scan Tiket PDF
                </h2>
                {tickets.length > 0 && (
                  <button
                    onClick={() => setShowScanner(false)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <XIcon className="size-5" />
                  </button>
                )}
              </div>

              <label
                htmlFor="scan-pdf-upload"
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-4 rounded-md border-2 border-dashed px-7 py-10 transition-colors duration-150",
                  scanning
                    ? ""
                    : themeId === "reconnect"
                      ? "border-emerald-900/50 hover:border-[color:var(--event-primary)]"
                      : themeId === "disconnect"
                        ? "border-zinc-600 hover:border-[color:var(--event-primary)]"
                        : "border-border hover:border-[color:var(--event-primary)]"
                )}
                style={
                  scanning
                    ? {
                        borderColor: primaryMutedWash(effectivePrimary, 55),
                        backgroundColor: primaryMutedWash(effectivePrimary, 6),
                      }
                    : undefined
                }
              >
                {scanning ? (
                  <div className="flex flex-col items-center gap-4">
                    <ScanLineIcon
                      className="size-12 animate-pulse"
                      style={{ color: effectivePrimary }}
                    />
                    <p className="text-base font-semibold">Scanning...</p>
                    {scanProgress && (
                      <p className="text-sm text-muted-foreground">
                        Halaman {scanProgress.current} / {scanProgress.total} · {scanProgress.found} QR
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <UploadIcon className="size-10 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-base font-semibold">Upload PDF tiket</p>
                      <p className="mt-1 text-sm text-muted-foreground">
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

              {previewUrl && (
                <div className={bookingInsetPreviewClass(themeId)}>
                  <img 
                    src={previewUrl} 
                    className="max-h-[50vh] w-auto max-w-full object-contain drop-shadow-sm rounded" 
                    alt="PDF Preview"
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
