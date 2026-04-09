"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { Gender } from "@/types/db";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useShallow } from "zustand/react/shallow";
import { useRealtimeSeats } from "@/lib/hooks/useRealtimeSeats";
import { persistCheck, persistGoodieBag, useSeatStore } from "@/store/useSeatStore";
import { ConnectionBanner } from "@/components/layout/connection-banner";
import { StageBar } from "@/components/layout/stage-bar";
import { SeatGrid } from "@/components/seat/seat-grid";
import { FilterChips } from "@/components/seat/filter-chips";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  XIcon,
  QrCodeIcon,
  CheckCircle2Icon,
  UserIcon,
  Trash2Icon,
  GiftIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
export default function CheckGenderPage() {
  const params = useParams();
  const g = params.gender as string;
  const gender = (g === "male" || g === "female" ? g : null) as Gender | null;
  if (!gender) {
    return <p className="text-sm text-muted-foreground">Layout tidak valid.</p>;
  }

  const layout = useLayoutStore((s) => s.layouts[gender]);
  const categories = useLayoutStore((s) => s.categories[gender]);
  const config = useLayoutStore((s) => s.config);
  const seats = useSeatStore(
    useShallow((s) => Object.values(s.seats[gender] ?? {})),
  );

  const { isConnected } = useRealtimeSeats(layout?.id);
  const scanQrUrl = config?.scan_qr_url ?? "";

  const [filter, setFilter] = React.useState("all");
  const [withScanQr, setWithScanQr] = React.useState(false);
  const [qrModalSeatId, setQrModalSeatId] = React.useState<string | null>(null);

  const [removeSeatMode, setRemoveSeatMode] = React.useState(false);
  const [pageMode, setPageMode] = React.useState<"check" | "goodie_bag">("check");
  const [participantInfoSeatId, setParticipantInfoSeatId] = React.useState<
    string | null
  >(null);
  const [loadingParticipant, setLoadingParticipant] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("withScanQr");
      if (saved === "true") {
        setWithScanQr(true);
      }
    }
  }, []);

  const handleWithScanQrChange = (checked: boolean) => {
    setWithScanQr(checked);
    if (typeof window !== "undefined") {
      localStorage.setItem("withScanQr", String(checked));
    }
  };

  const stats = React.useMemo(() => {
    const active = seats.filter((s) => !s.is_empty);
    const checked = active.filter((s) =>
      pageMode === "check" ? s.is_checked : s.is_goodie_bag,
    );
    const pct =
      active.length > 0
        ? Math.round((checked.length / active.length) * 100)
        : 0;
    return {
      total: active.length,
      checked: checked.length,
      pct,
      label: pageMode === "check" ? "Hadir" : "Goodie Bag",
    };
  }, [seats, pageMode]);

  const filteredSeats = React.useMemo(() => {
    if (filter === "all") return seats;
    return seats.map((s) => ({
      ...s,
      _dimmed: s.category_id !== filter,
    }));
  }, [seats, filter]);

  const counts = React.useMemo(() => {
    const m: Record<string, number> = { all: 0 };
    for (const s of seats) {
      if (s.is_empty) continue;
      m.all += 1;
      if (s.category_id) m[s.category_id] = (m[s.category_id] ?? 0) + 1;
    }
    return m;
  }, [seats]);

  const handleSeatRef = React.useRef<(seatId: string, action: string) => void>(
    () => {},
  );

  handleSeatRef.current = async (seatId: string, action: string) => {
    if (action !== "click") return;
    const seat = useSeatStore.getState().seats[gender][seatId];
    if (!seat || seat.is_empty) return;
    if (filter !== "all" && seat.category_id !== filter) return;

    // If scan QR mode is enabled and seat is not yet checked, open modal
    if (
      withScanQr &&
      scanQrUrl &&
      !seat.is_checked &&
      !seat.participant_id &&
      pageMode === "check"
    ) {
      setQrModalSeatId(seatId);
      return;
    }

    if (pageMode === "check") {
      if (seat.is_checked && !removeSeatMode) {
        return;
      }
    } else {
      if (seat.is_goodie_bag && !removeSeatMode) {
        return;
      }
    }

    if (seat.participant_id && !removeSeatMode && pageMode === "check") {
      return;
    }

    if (seat.participant_id) {
      if (removeSeatMode) {
        if (
          confirm(
            `Yakin ingin mengosongkan kursi ini (Peserta: ${seat.participants?.nama ?? "Tanpa Nama"})?`,
          )
        ) {
          const { error } = await supabase
            .from("seats")
            .update({
              participant_id: null,
              is_checked: false,
              checked_at: null,
              is_goodie_bag: false,
              goodie_bag_at: null,
            })
            .eq("id", seatId);
          const { error: participantError } = await supabase
            .from("participants")
            .update({
              seat_id: null,
            })
            .eq("id", seat.participant_id);
          if (!error && !participantError) {
            toast.success("Kursi berhasil dikosongkan");
            useSeatStore.getState().updateSeatLocal(seatId, gender, {
              participant_id: null,
              is_checked: false,
              checked_at: null,
              is_goodie_bag: false,
              goodie_bag_at: null,
              participants: null,
            });
          } else {
            toast.error("Gagal mengosongkan kursi");
          }
        }
        return;
      } else {
        setParticipantInfoSeatId(seatId);
        if (!seat.participants) {
          setLoadingParticipant(true);
          supabase
            .from("participants")
            .select("*")
            .eq("id", seat.participant_id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                useSeatStore
                  .getState()
                  .updateSeatLocal(seatId, gender, { participants: data });
              }
              setLoadingParticipant(false);
            });
        }
        return;
      }
    }

    // Normal toggle logic
    if (pageMode === "check") {
      const next = !seat.is_checked;
      try {
        await persistCheck(gender, seatId, next);
      } catch {
        toast.error("Gagal update kursi");
        useSeatStore.getState().updateSeatLocal(seatId, gender, {
          is_checked: !next,
          checked_at: null,
        });
      }
    } else {
      const next = !seat.is_goodie_bag;
      try {
        await persistGoodieBag(gender, seatId, next);
        toast.success(
          next ? "Goodie Bag diberikan" : "Goodie Bag batal diberikan",
        );
      } catch {
        toast.error("Gagal update Goodie Bag");
        useSeatStore.getState().updateSeatLocal(seatId, gender, {
          is_goodie_bag: !next,
          goodie_bag_at: null,
        });
      }
    }
  };

  const handleSeat = React.useCallback(
    (
      seatId: string,
      action: "click" | "touchstart" | "touchend" | "longpress" | "touchpan",
    ) => {
      handleSeatRef.current(seatId, action);
    },
    [],
  );

  const confirmScanAndCheck = async () => {
    if (!qrModalSeatId || !gender) return;
    const seatId = qrModalSeatId;
    setQrModalSeatId(null);
    useSeatStore.getState().updateSeatLocal(seatId, gender, {
      is_checked: true,
      checked_at: new Date().toISOString(),
    });
    try {
      await persistCheck(gender, seatId, true);
      toast.success("Kursi berhasil dicentang");
    } catch {
      toast.error("Gagal update kursi");
      useSeatStore.getState().updateSeatLocal(seatId, gender, {
        is_checked: false,
        checked_at: null,
      });
    }
  };

  const activeModalSeat = participantInfoSeatId
    ? useSeatStore.getState().seats[gender]?.[participantInfoSeatId]
    : null;

  const toggleModalSeatCheck = async () => {
    if (!participantInfoSeatId || !gender || !activeModalSeat) return;
    const next = !activeModalSeat.is_checked;
    useSeatStore.getState().updateSeatLocal(participantInfoSeatId, gender, {
      is_checked: next,
      checked_at: next ? new Date().toISOString() : null,
    });
    try {
      await persistCheck(gender, participantInfoSeatId, next);
      toast.success(
        next ? "Berhasil ditandai hadir" : "Berhasil dibatalkan hadir",
      );
    } catch {
      toast.error("Gagal ubah status kehadiran");
      useSeatStore.getState().updateSeatLocal(participantInfoSeatId, gender, {
        is_checked: !next,
        checked_at: null,
      });
    }
  };

  if (!layout) return null;

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4 pb-8">
      <ConnectionBanner isConnected={isConnected} />

      <div>
        <h1 className="font-display text-xl font-bold">
          {pageMode === "check" ? "Centang" : "Goodie Bag"} — {layout.label}
        </h1>
        <p className="text-sm text-muted-foreground">
          {pageMode === "check"
            ? "Tap kursi untuk hadir / batal hadir."
            : "Tap kursi untuk beri goodie bag."}
        </p>
      </div>

      <div className="flex bg-muted/30 p-1 rounded-xl w-fit">
        <button
          onClick={() => setPageMode("check")}
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
            pageMode === "check"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <CheckCircle2Icon className="size-3.5" />
          Check In
        </button>
        <button
          onClick={() => setPageMode("goodie_bag")}
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
            pageMode === "goodie_bag"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <GiftIcon className="size-3.5" />
          Goodie Bag
        </button>
      </div>

      <motion.div
        className="rounded-2xl border border-border/80 bg-card/50 p-4"
        initial={false}
        animate={{ opacity: 1 }}
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {stats.checked}{" "}
              <span className="text-muted-foreground">/ {stats.total}</span>
            </p>
            <p className="text-xs text-muted-foreground">{stats.label}</p>
          </div>
          <span className="text-3xl font-bold tabular-nums text-primary">
            {stats.pct}%
          </span>
        </div>
        <Progress value={stats.pct} className="h-3" />
      </motion.div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 mb-2">
        <FilterChips
          categories={categories}
          active={filter}
          onChange={setFilter}
          counts={counts}
        />
      </div>

      {scanQrUrl && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="with-scan-qr"
            checked={withScanQr}
            onCheckedChange={(v) => handleWithScanQrChange(v === true)}
          />
          <Label
            htmlFor="with-scan-qr"
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm"
          >
            <QrCodeIcon className="size-3.5" />
            Dengan Scan QR
          </Label>
        </div>
      )}

      <div className="flex items-center space-x-2 rounded-lg">
        <Checkbox
          id="hapus-mode"
          checked={removeSeatMode}
          onCheckedChange={(c) => setRemoveSeatMode(!!c)}
          className="border-red-500/50 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
        />
        <Label
          htmlFor="hapus-mode"
          className="text-xs font-semibold text-red-600 dark:text-red-400 cursor-pointer"
        >
          Hapus Kursi
        </Label>
      </div>

      <StageBar label={config?.stage_label ?? "STAGE"} />

      <SeatGrid
        seats={filteredSeats}
        layout={layout}
        categories={categories}
        mode={pageMode}
        onSeatAction={handleSeat}
      />

      {/* Fullscreen QR Scan Modal */}
      <AnimatePresence>
        {qrModalSeatId && scanQrUrl && (
          <motion.div
            key="qr-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col bg-background"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <QrCodeIcon className="size-4 text-primary" />
                Scan QR —{" "}
                {useSeatStore.getState().seats[gender][qrModalSeatId]?.label ??
                  qrModalSeatId}
              </div>
              <button
                onClick={() => setQrModalSeatId(null)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            {/* Iframe */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={scanQrUrl}
                className="h-full w-full border-0"
                allow="camera;microphone"
              />
            </div>

            {/* Footer action */}
            <div className="border-t border-border/60 p-4 space-y-3">
              <p className="text-center text-xs text-muted-foreground">
                Klik tombol di bawah ini jika sudah melakukan scan QR.
              </p>
              <Button
                onClick={confirmScanAndCheck}
                size="lg"
                className="w-full gap-2 rounded-xl"
              >
                <CheckCircle2Icon className="size-4" />
                Tutup & Centang Kursi
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Participant Info Modal */}
      <AnimatePresence>
        {participantInfoSeatId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 p-4">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <UserIcon className="size-5 text-primary" />
                  Info Peserta
                </h2>
                <button
                  onClick={() => setParticipantInfoSeatId(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <XIcon className="size-5" />
                </button>
              </div>

              <div className="p-6">
                {loadingParticipant ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Memuat data peserta...
                  </div>
                ) : activeModalSeat?.participants ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/40 bg-card/50 p-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Nama Lengkap
                      </p>
                      <p className="font-semibold">
                        {activeModalSeat.participants.nama}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border/40 bg-card/50 p-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Tiket
                        </p>
                        <p className="font-semibold text-sm">
                          {activeModalSeat.participants.tiket || "-"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-card/50 p-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Kode QR
                        </p>
                        <p className="font-semibold text-sm font-mono">
                          {activeModalSeat.participants.kode_tiket || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border/40 bg-card/50 p-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Email
                        </p>
                        <p
                          className="font-semibold text-xs truncate"
                          title={activeModalSeat.participants.email}
                        >
                          {activeModalSeat.participants.email || "-"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/40 bg-card/50 p-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Telepon
                        </p>
                        <p className="font-semibold text-xs">
                          {activeModalSeat.participants.telepon || "-"}
                        </p>
                      </div>
                    </div>

                    {/* <div className="pt-4 flex flex-col gap-3">
                      <button
                        onClick={toggleModalSeatCheck}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-md transition-colors ${
                          activeModalSeat?.is_checked
                            ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
                            : "bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600"
                        }`}
                      >
                        <CheckCircle2Icon className="size-5" />
                        {activeModalSeat?.is_checked
                          ? "Batalkan Kehadiran"
                          : "Tandai Hadir"}
                      </button>
                    </div> */}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Data peserta tidak ditemukan.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
