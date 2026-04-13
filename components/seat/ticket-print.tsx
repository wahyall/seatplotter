import * as React from "react"
import { ValidatedTicket } from "@/lib/booking"
import { ConfigRow } from "@/types/db"
import { TicketIcon } from "lucide-react"
import {
  generateGuillochePaths,
  generateMicrotextPath,
  generateIdenticon,
} from "@/lib/ticket-pattern"

interface TicketPrintProps {
  ticket: ValidatedTicket
  seatLabel: string
  config: ConfigRow | null
  authHash?: string | null
}

const TICKET_W = 350
const TICKET_H = 400

function StaticBgPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="bg-grid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0L6 6L0 0" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          <path d="M0 12L6 6L12 12" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        </pattern>
        <pattern id="bg-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="0.6" fill="rgba(255,255,255,0.04)" />
          <circle cx="0" cy="0" r="0.4" fill="rgba(255,255,255,0.025)" />
          <circle cx="24" cy="0" r="0.4" fill="rgba(255,255,255,0.025)" />
          <circle cx="0" cy="24" r="0.4" fill="rgba(255,255,255,0.025)" />
          <circle cx="24" cy="24" r="0.4" fill="rgba(255,255,255,0.025)" />
        </pattern>
        <pattern id="bg-cross" width="16" height="16" patternUnits="userSpaceOnUse">
          <line x1="8" y1="0" x2="8" y2="16" stroke="rgba(255,255,255,0.018)" strokeWidth="0.3" />
          <line x1="0" y1="8" x2="16" y2="8" stroke="rgba(255,255,255,0.018)" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg-grid)" />
      <rect width="100%" height="100%" fill="url(#bg-dots)" />
      <rect width="100%" height="100%" fill="url(#bg-cross)" />
    </svg>
  )
}

function GuillocheOverlay({ hash, nama }: { hash: string; nama: string }) {
  const curves = React.useMemo(
    () => generateGuillochePaths(hash, TICKET_W, TICKET_H),
    [hash],
  )
  const microtextD = React.useMemo(
    () => generateMicrotextPath(hash, TICKET_W, TICKET_H),
    [hash],
  )
  const pathId = `mt-${hash.slice(0, 8)}`
  const repeatedName = Array(40).fill(nama.toUpperCase()).join(" \u2022 ")

  return (
    <svg
      viewBox={`0 0 ${TICKET_W} ${TICKET_H}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "hidden" }}
    >
      {curves.map((c, i) => (
        <path
          key={i}
          d={c.path}
          fill="none"
          stroke={c.color}
          strokeWidth={c.strokeWidth}
        />
      ))}
      <defs>
        <path id={pathId} d={microtextD} fill="none" />
      </defs>
      <text
        fill="rgba(255,255,255,0.1)"
        fontSize="3.5"
        fontFamily="monospace"
        letterSpacing="1"
      >
        <textPath href={`#${pathId}`}>{repeatedName}</textPath>
      </text>
    </svg>
  )
}

function SeatGuard({ hash, seatLabel }: { hash: string; seatLabel: string }) {
  const curves = React.useMemo(
    () => generateGuillochePaths(hash, 120, 56),
    [hash],
  )

  return (
    <div className="relative inline-flex items-center justify-center">
      <div className="bg-red-500 text-white font-black text-4xl px-4 pb-1 pt-6 rounded-xl relative overflow-hidden">
        <img
          src="/ticket.png"
          alt=""
          aria-hidden="true"
          className="absolute top-0 left-0 w-full h-8 object-cover opacity-20 drop-shadow-[0_3px_10px_rgba(0,0,0,0.35)] z-20"
        />
        <span className="relative z-10">{seatLabel.replace("_", " ")}</span>
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-30"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern id="seat-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M10 0L5 5L0 0" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />
              <path d="M0 10L5 5L10 10" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />
            </pattern>
            <pattern id="seat-dots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="0.6" fill="rgba(0,0,0,0.1)" />
              <circle cx="0" cy="0" r="0.4" fill="rgba(0,0,0,0.06)" />
              <circle cx="20" cy="0" r="0.4" fill="rgba(0,0,0,0.06)" />
              <circle cx="0" cy="20" r="0.4" fill="rgba(0,0,0,0.06)" />
              <circle cx="20" cy="20" r="0.4" fill="rgba(0,0,0,0.06)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#seat-grid)" />
          <rect width="100%" height="100%" fill="url(#seat-dots)" />
        </svg>
        <svg
          viewBox="0 0 120 56"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ overflow: "hidden" }}
        >
          {curves.map((c, i) => (
            <path
              key={i}
              d={c.path}
              fill="none"
              stroke={c.color.replace("0.22", "0.45")}
              strokeWidth={c.strokeWidth * 0.8}
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

function IdenticonBlock({ hash }: { hash: string }) {
  const { cells, size } = React.useMemo(
    () => generateIdenticon(hash, 7),
    [hash],
  )

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {cells.map((cell, i) =>
          cell.filled ? (
            <rect
              key={i}
              x={cell.x}
              y={cell.y}
              width={7}
              height={7}
              rx={1}
              fill={cell.color}
            />
          ) : null,
        )}
      </svg>
    </div>
  )
}

export function TicketPrint({ ticket, seatLabel, config, authHash }: TicketPrintProps) {
  return (
    <div className="absolute w-0 h-0 overflow-hidden pointer-events-none">
      <div
        id={`ticket-${ticket.id}`}
        className="w-[350px] flex flex-col rounded-2xl border border-white/20 bg-[#0c0c0f] relative overflow-hidden"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Static tiled background texture */}
        <StaticBgPattern />

        {/* Full-ticket guilloche overlay */}
        {authHash && (
          <GuillocheOverlay hash={authHash} nama={ticket.nama} />
        )}

        {/* Header */}
        <div className="relative w-full px-6 py-8 flex flex-col items-center justify-center border-b border-dashed border-white/20 overflow-hidden">
          {/* Background image */}
          <img
            src="/ticket.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Dark overlay for legibility */}
          <div className="absolute inset-0 bg-black/80" />
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent z-10" />

          <TicketIcon className="size-10 text-red-400 mb-4 relative z-10" />

          <h2 className="text-white text-lg font-bold text-center leading-snug mb-3 uppercase tracking-wide px-2 relative z-10">
            {config?.event_name || "Event Ticket"}
          </h2>

          <div className="bg-[#0c0c0f]/80 text-red-400 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.2em] border border-red-500/20 uppercase relative z-10">
            {ticket.tiket} • {ticket.jenis_kelamin === "MALE" ? "PRIA" : "WANITA"}
          </div>
        </div>

        {/* Ticket Body */}
        <div className="p-8 w-full flex flex-col gap-8 bg-transparent relative outline-none focus:outline-none z-10">
          {/* Name */}
          <div className="text-center w-full">
            <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.2em] mb-1.5">NAMA PESERTA</p>
            <div className="text-white text-2xl font-semibold tracking-tight break-words">
              {ticket.nama}
            </div>
          </div>

          {/* Footer Details */}
          <div className="flex w-full items-end justify-between pt-2">
            <div className="flex flex-col items-start gap-1">
              <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.2em]">KODE TIKET</p>
              <p className="text-white/80 font-mono text-sm font-medium tracking-wider">{ticket.kode_tiket}</p>
            </div>

            {authHash && <IdenticonBlock hash={authHash} />}

            <div className="flex flex-col items-end gap-1.5">
              <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.2em]">NOMOR KURSI</p>
              {authHash ? (
                <SeatGuard hash={authHash} seatLabel={seatLabel} />
              ) : (
                <div className="bg-red-500 text-white font-black text-4xl px-4 pb-1 pt-6 rounded-xl relative overflow-hidden">
                  <img
                    src="/ticket.png"
                    alt=""
                    aria-hidden="true"
                    className="absolute top-0 left-0 w-full h-8 object-cover opacity-20 drop-shadow-[0_3px_10px_rgba(0,0,0,0.35)] z-20"
                  />
                  <span className="relative z-10">{seatLabel.replace("_", " ")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
