"use client"

import * as React from "react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import type { ParticipantRow } from "@/types/db"
import { downloadParticipantQrPdf } from "@/lib/participant-qr-pdf"
import { getPartnerEventSlug } from "@/lib/import-mirror-pair-slugs"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { useLayoutStore } from "@/store/useLayoutStore"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  UploadIcon,
  Trash2Icon,
  SaveIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  SearchIcon,
  UsersIcon,
  XIcon,
  DownloadIcon,
  RefreshCwIcon,
  TicketIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  QrCodeIcon,
  Loader2Icon,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ---------- column-mapping types ---------- */
interface ColumnMapping {
  nama: string
  email: string
  jenis_kelamin: string
  telepon: string
  tiket: string
  kode_tiket: string
}

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  nama: "Nama",
  email: "Email",
  jenis_kelamin: "Jenis Kelamin",
  telepon: "Telepon",
  tiket: "Tiket",
  kode_tiket: "Kode Tiket",
}

const FIELD_ICONS: Record<keyof ColumnMapping, React.ReactNode> = {
  nama: <UsersIcon className="size-3.5" />,
  email: <span className="text-xs">@</span>,
  jenis_kelamin: <span className="text-xs">⚥</span>,
  telepon: <span className="text-xs">📞</span>,
  tiket: <TicketIcon className="size-3.5" />,
  kode_tiket: <span className="text-xs">#</span>,
}

/* ---------- helpers ---------- */
function guessColumn(headers: string[], keywords: string[]): string {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h === kw)
    if (idx >= 0) return headers[idx]
  }
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw))
    if (idx >= 0) return headers[idx]
  }
  return ""
}

function autoMap(headers: string[]): ColumnMapping {
  return {
    nama: guessColumn(headers, ["nama", "name", "nama lengkap", "full name"]),
    email: guessColumn(headers, ["email", "e-mail", "email address"]),
    jenis_kelamin: guessColumn(headers, [
      "jenis kelamin",
      "gender",
      "kelamin",
      "jk",
    ]),
    telepon: guessColumn(headers, [
      "telepon",
      "telephone",
      "phone",
      "telp",
      "hp",
      "no hp",
      "no. hp",
      "no telp",
      "no. telp",
      "nomor telepon",
    ]),
    tiket: guessColumn(headers, ["tiket", "ticket", "jenis tiket", "ticket type"]),
    kode_tiket: guessColumn(headers, [
      "kode tiket",
      "kode ticket",
      "ticket code",
      "voucher code",
      "kode voucher",
      "kode",
    ]),
  }
}

/* ---------- main component ---------- */
export default function ImportParticipantsPage() {
  const event = useLayoutStore((s) => s.event)
  const eventId = event?.id ?? ""
  const eventTitle = event?.event_name ?? ""

  const [file, setFile] = React.useState<File | null>(null)
  const [headers, setHeaders] = React.useState<string[]>([])
  const [rawRows, setRawRows] = React.useState<Record<string, string>[]>([])
  const [mapping, setMapping] = React.useState<ColumnMapping>({
    nama: "",
    email: "",
    jenis_kelamin: "",
    telepon: "",
    tiket: "",
    kode_tiket: "",
  })

  // saved participants from DB
  const [participants, setParticipants] = React.useState<ParticipantRow[]>([])
  const [loadingDb, setLoadingDb] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [saveProgress, setSaveProgress] = React.useState(0)

  // filter/search for saved table
  const [search, setSearch] = React.useState("")
  const [ticketFilter, setTicketFilter] = React.useState("all")

  // pagination & filter states
  const [page, setPage] = React.useState(1)
  const [perPage, setPerPage] = React.useState(25)
  const [totalItems, setTotalItems] = React.useState(0)
  const [totalAll, setTotalAll] = React.useState(0)
  const [ticketTypes, setTicketTypes] = React.useState<string[]>([])
  const [stats, setStats] = React.useState<Record<string, number>>({})
  const [pdfLoadingId, setPdfLoadingId] = React.useState<string | null>(null)
  const [importToAllEvents, setImportToAllEvents] = React.useState(false)
  const [mirrorEventName, setMirrorEventName] = React.useState<string | null>(null)

  async function handleDownloadQrPdf(p: ParticipantRow) {
    setPdfLoadingId(p.id)
    try {
      await downloadParticipantQrPdf(p, {
        eventTitle: eventTitle || undefined,
      })
      toast.success("PDF berhasil diunduh")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat PDF")
    } finally {
      setPdfLoadingId(null)
    }
  }

  // debounce search
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const partnerSlug = getPartnerEventSlug(event?.slug)
  React.useEffect(() => {
    if (!isSupabaseConfigured || !partnerSlug) {
      setMirrorEventName(null)
      setImportToAllEvents(false)
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from("events")
        .select("event_name")
        .eq("slug", partnerSlug)
        .maybeSingle()
      if (cancelled) return
      setMirrorEventName(data?.event_name?.trim() || null)
    })()
    return () => {
      cancelled = true
    }
  }, [partnerSlug])

  /* ---------- load saved participants ---------- */
  React.useEffect(() => {
    if (eventId) fetchParticipants()
  }, [page, perPage, debouncedSearch, ticketFilter, eventId])

  async function fetchParticipants() {
    setLoadingDb(true)
    try {
      const qs = new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
        search: debouncedSearch,
        tiket: ticketFilter === "all" ? "" : ticketFilter,
        event_id: eventId,
      })
      const res = await fetch(`/api/participants?${qs.toString()}`)
      const json = await res.json()
      if (json.success) {
        setParticipants(json.data ?? [])
        setTotalItems(json.total ?? 0)
        setTotalAll(json.totalAll ?? 0)
        setTicketTypes(json.ticketTypes ?? [])
        setStats(json.stats ?? {})
      }
    } catch {
      toast.error("Gagal memuat data peserta")
    } finally {
      setLoadingDb(false)
    }
  }

  /* ---------- file handling ---------- */
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        })

        if (json.length === 0) {
          toast.error("File kosong atau format tidak sesuai")
          return
        }

        const hdrs = Object.keys(json[0])
        setHeaders(hdrs)
        setRawRows(
          json.map((row) => {
            const out: Record<string, string> = {}
            for (const k of hdrs) {
              out[k] = String(row[k] ?? "")
            }
            return out
          })
        )
        setMapping(autoMap(hdrs))
        toast.success(`${json.length} baris data ditemukan`)
      } catch {
        toast.error("Gagal membaca file Excel")
      }
    }
    reader.readAsArrayBuffer(f)
  }

  function clearFile() {
    setFile(null)
    setHeaders([])
    setRawRows([])
    setMapping({
      nama: "",
      email: "",
      jenis_kelamin: "",
      telepon: "",
      tiket: "",
      kode_tiket: "",
    })
  }

  /* ---------- mapped preview data ---------- */
  const mappedData = React.useMemo(() => {
    return rawRows.map((row) => ({
      nama: row[mapping.nama] ?? "",
      email: row[mapping.email] ?? "",
      jenis_kelamin: row[mapping.jenis_kelamin] ?? "",
      telepon: row[mapping.telepon] ?? "",
      tiket: row[mapping.tiket] ?? "",
      kode_tiket: row[mapping.kode_tiket] ?? "",
    }))
  }, [rawRows, mapping])

  const validCount = React.useMemo(
    () => mappedData.filter((p) => p.nama.trim()).length,
    [mappedData]
  )

  /* ---------- save to database ---------- */
  async function handleSave(replace: boolean) {
    if (mappedData.length === 0) return
    setSaving(true)
    setSaveProgress(10)

    try {
      setSaveProgress(30)
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants: mappedData.filter((p) => p.nama.trim()),
          replace,
          event_id: eventId,
          import_all_events: importToAllEvents,
        }),
      })
      setSaveProgress(80)
      const json = await res.json()

      if (json.success) {
        const n = json.data?.inserted ?? 0
        const t = json.data?.event_targets ?? 1
        if (t > 1) {
          toast.success(
            `${n} peserta per acara disimpan (${t} acara, total ${json.data?.total_db_rows ?? n * t} baris)`
          )
        } else {
          toast.success(`${n} peserta berhasil disimpan`)
        }
        clearFile()
        await fetchParticipants()
        setSaveProgress(100)
      } else {
        toast.error(json.error ?? "Gagal menyimpan")
      }
    } catch {
      toast.error("Gagal menyimpan data")
    } finally {
      setTimeout(() => {
        setSaving(false)
        setSaveProgress(0)
      }, 500)
    }
  }

  /* ---------- delete all ---------- */
  async function handleDeleteAll() {
    if (!confirm("Hapus semua data peserta? Tindakan ini tidak bisa dibatalkan."))
      return
    try {
      const res = await fetch(`/api/participants?event_id=${eventId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) {
        toast.success("Semua data peserta dihapus")
        setParticipants([])
      } else {
        toast.error(json.error ?? "Gagal menghapus")
      }
    } catch {
      toast.error("Gagal menghapus data")
    }
  }

  // reset page when filters change
  React.useEffect(() => {
    setPage(1)
  }, [debouncedSearch, ticketFilter])

  const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
  const startIndex = (page - 1) * perPage

  /* ---------- render ---------- */
  return (
    <div className="space-y-6 pb-12">
      <header className="space-y-1">
        <h1 className="font-display text-xl font-bold tracking-tight">
          Import Peserta
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload file Excel (.xlsx, .xls), mapping kolom, lalu simpan ke database.
        </p>
      </header>

      {/* Upload Area */}
      <div className={cn(
        "rounded-md border border-dashed transition-colors duration-150",
        file
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border hover:border-primary/40"
      )}>
        <div className="p-5">
          {!file ? (
            <label
              htmlFor="excel-upload"
              className="flex cursor-pointer flex-col items-center gap-3 py-6"
            >
              <UploadIcon className="size-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Klik untuk upload file Excel
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  .xlsx atau .xls &mdash; maks 10MB
                </p>
              </div>
              <Input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={handleFile}
              />
            </label>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2Icon className="size-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {rawRows.length} baris &middot; {headers.length} kolom &middot;{" "}
                    {validCount} valid
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFile}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {headers.length > 0 && (
          <div className="space-y-6">
            <Card className="overflow-hidden border-border">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Mapping Kolom
                </CardTitle>
                <CardDescription>
                  Sesuaikan kolom Excel dengan field yang akan disimpan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map(
                    (field) => (
                      <div key={field} className="space-y-1.5">
                        <Label className="inline-flex items-center gap-1.5 text-xs font-medium">
                          {FIELD_ICONS[field]}
                          {FIELD_LABELS[field]}
                        </Label>
                        <Select
                          value={mapping[field] || "__none__"}
                          onValueChange={(v: string | null) =>
                            setMapping((prev) => ({
                              ...prev,
                              [field]: !v || v === "__none__" ? "" : v,
                            }))
                          }
                        >
                          <SelectTrigger className="h-9 rounded-lg text-xs">
                            <SelectValue placeholder="Pilih kolom..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              — Tidak dipilih —
                            </SelectItem>
                            {headers.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Preview Table */}
            <Card className="overflow-hidden border-border">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Preview Data ({validCount} valid dari {rawRows.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[400px]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary">
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                            #
                          </th>
                          {(
                            Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]
                          ).map((f) => (
                            <th
                              key={f}
                              className="px-3 py-2.5 text-left font-medium text-muted-foreground"
                            >
                              {FIELD_LABELS[f]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mappedData.slice(0, 50).map((row, i) => (
                          <tr
                            key={i}
                            className={cn(
                              "border-b border-border/30 transition-colors hover:bg-muted/20",
                              !row.nama.trim() && "opacity-40"
                            )}
                          >
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">
                              {i + 1}
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {row.nama || "—"}
                            </td>
                            <td className="px-3 py-2">{row.email || "—"}</td>
                            <td className="px-3 py-2">
                              {row.jenis_kelamin || "—"}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.telepon || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {row.tiket ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {row.tiket}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-[10px]">
                              {row.kode_tiket || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rawRows.length > 50 && (
                    <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
                      Menampilkan 50 dari {rawRows.length} baris
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Save Actions */}
            <div className="space-y-3">
            {partnerSlug && (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm"
              >
                <Checkbox
                  checked={importToAllEvents}
                  onCheckedChange={(v) => setImportToAllEvents(v === true)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-medium leading-tight">Import ke semua acara</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Jika diaktifkan, daftar yang sama juga disimpan ke
                    {mirrorEventName ? (
                      <span className="text-foreground"> {mirrorEventName}</span>
                    ) : (
                      " acara terhubung"
                    )}
                    . Matikan hanya jika data ini khusus untuk acara saat ini.
                  </p>
                </div>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => handleSave(true)}
                disabled={saving || validCount === 0}
                className="gap-2 rounded-md"
                size="lg"
              >
                <SaveIcon className="size-4" />
                Simpan (Ganti Semua)
              </Button>
              <Button
                onClick={() => handleSave(false)}
                disabled={saving || validCount === 0}
                variant="secondary"
                className="gap-2 rounded-md"
                size="lg"
              >
                <DownloadIcon className="size-4" />
                Tambahkan ke Data
              </Button>
              {saving && (
                <div className="flex-1">
                  <Progress value={saveProgress} className="h-2" />
                </div>
              )}
            </div>
            </div>
          </div>
      )}

      {/* Saved Data Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight">
            Data Tersimpan
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchParticipants}
              className="gap-1.5"
            >
              <RefreshCwIcon className="size-3.5" />
              Refresh
            </Button>
            {participants.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteAll}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Trash2Icon className="size-3.5" />
                Hapus Semua
              </Button>
            )}
          </div>
        </div>

        {!loadingDb && participants.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 bg-primary/5 px-3 py-1.5 text-xs"
            >
              <UsersIcon className="size-3" />
              Total: {totalAll}
            </Badge>
            {Object.entries(stats).map(([ticket, count]) => (
              <Badge
                key={ticket}
                variant="outline"
                className="gap-1 px-3 py-1.5 text-xs"
              >
                <TicketIcon className="size-3" />
                {ticket}: {count}
              </Badge>
            ))}
          </div>
        )}

        {/* Filter & Search */}
        {!loadingDb && participants.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama, email, telepon, kode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-lg pl-9 text-xs"
              />
            </div>
            {ticketTypes.length > 1 && (
              <Select value={ticketFilter} onValueChange={(v: string | null) => setTicketFilter(v ?? "all")}>
                <SelectTrigger className="h-9 w-[180px] rounded-lg text-xs">
                  <SelectValue placeholder="Filter tiket" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tiket</SelectItem>
                  {ticketTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Data Table */}
        {loadingDb ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : participants.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-10 text-center">
            <AlertCircleIcon className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Belum ada data peserta. Import dari file Excel di atas.
            </p>
          </div>
        ) : (
          <Card className="overflow-hidden border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        #
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        Nama
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        Email
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        Jenis Kelamin
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        Telepon
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        Tiket
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                        Kode Tiket
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p, i) => (
                      <tr
                        key={p.id}
                        className="border-b border-border/20 transition-colors hover:bg-muted/20"
                      >
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {startIndex + i + 1}
                        </td>
                        <td className="px-3 py-2 font-medium">{p.nama}</td>
                        <td className="px-3 py-2">{p.email || "—"}</td>
                        <td className="px-3 py-2">
                          {p.jenis_kelamin ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                p.jenis_kelamin.toUpperCase() === "MALE" ||
                                  p.jenis_kelamin.toUpperCase() === "LAKI-LAKI"
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : p.jenis_kelamin.toUpperCase() === "FEMALE" ||
                                    p.jenis_kelamin.toUpperCase() === "PEREMPUAN"
                                  ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                                  : ""
                              )}
                            >
                              {p.jenis_kelamin}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {p.telepon || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {p.tiket ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {p.tiket}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] tracking-wider">
                          {p.kode_tiket || "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 px-2 text-[11px]"
                            disabled={
                              !p.kode_tiket?.trim() || pdfLoadingId === p.id
                            }
                            onClick={() => handleDownloadQrPdf(p)}
                            title={
                              p.kode_tiket?.trim()
                                ? "Unduh PDF berisi QR kode tiket"
                                : "Perlu kode tiket untuk QR"
                            }
                          >
                            {pdfLoadingId === p.id ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <QrCodeIcon className="size-3.5" />
                            )}
                            PDF QR
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {participants.length === 0 && totalAll > 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Tidak ada hasil yang cocok.
                </div>
              )}
              {/* Pagination Controls */}
              {participants.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {startIndex + 1}–{Math.min(startIndex + perPage, totalItems)}{" "}
                      dari {totalItems}
                    </span>
                    <span className="text-border">|</span>
                    <Select
                      value={String(perPage)}
                      onValueChange={(v: string | null) => {
                        setPerPage(Number(v) || 25)
                        setPage(1)
                      }}
                    >
                      <SelectTrigger className="h-7 w-[70px] rounded-md text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>per halaman</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      disabled={page <= 1}
                      onClick={() => setPage(1)}
                    >
                      <ChevronsLeftIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeftIcon className="size-3.5" />
                    </Button>
                    <span className="px-2 text-xs tabular-nums font-medium">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRightIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)}
                    >
                      <ChevronsRightIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
