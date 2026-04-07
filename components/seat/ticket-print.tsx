import * as React from "react"
import { ValidatedTicket } from "@/lib/booking"
import { ConfigRow } from "@/types/db"
import { TicketIcon } from "lucide-react"

interface TicketPrintProps {
  ticket: ValidatedTicket
  seatLabel: string
  config: ConfigRow | null
}

export function TicketPrint({ ticket, seatLabel, config }: TicketPrintProps) {
  return (
    <div className="absolute w-0 h-0 overflow-hidden pointer-events-none">
      <div
        id={`ticket-${ticket.id}`}
        className="w-[350px] flex flex-col rounded-2xl border border-white/20 bg-[#0c0c0f]"
        style={{ 
          fontFamily: "'Inter', sans-serif" 
        }}
      >
        {/* Dynamic Header */}
        <div className="relative w-full bg-[#15151a] px-6 py-8 flex flex-col items-center justify-center border-b border-dashed border-white/20">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
          
          <TicketIcon className="size-10 text-emerald-400 mb-4" />
          
          <h2 className="text-white text-lg font-bold text-center leading-snug mb-3 uppercase tracking-wide px-2 relative z-10">
            {config?.event_name || "Event Ticket"}
          </h2>
          
          <div className="bg-[#0c0c0f] text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.2em] border border-emerald-500/20 uppercase relative z-10">
            {ticket.tiket} • {ticket.jenis_kelamin === "MALE" ? "PRIA" : "WANITA"}
          </div>
        </div>

        {/* Ticket Body */}
        <div className="p-8 w-full flex flex-col gap-8 bg-[#0c0c0f] relative outline-none focus:outline-none">
          
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
            
            <div className="flex flex-col items-end gap-1.5">
              <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.2em]">NOMOR KURSI</p>
              <div className="bg-emerald-500 text-[#0c0c0f] font-black text-4xl px-4 py-1 rounded-xl">
                {seatLabel.replace('_', ' ')}
              </div>
            </div>
          </div>
          
        </div>
        
      </div>
    </div>
  )
}
