import { jsPDF } from "jspdf"
import QRCode from "qrcode"
import type { ParticipantRow } from "@/types/db"

function safeFileSegment(s: string) {
  return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim().slice(0, 80) || "peserta"
}

/** Single-page A6 PDF with QR encoding `kode_tiket` (same payload as booking scan). */
export async function downloadParticipantQrPdf(
  participant: ParticipantRow,
  options?: { eventTitle?: string }
): Promise<void> {
  const code = (participant.kode_tiket ?? "").trim()
  if (!code) {
    throw new Error("Kode tiket kosong — tidak bisa membuat QR.")
  }

  const qrDataUrl = await QRCode.toDataURL(code, {
    width: 320,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  })

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [105, 148],
  })

  const pageW = doc.internal.pageSize.getWidth()
  const margin = 12
  const maxW = pageW - margin * 2

  const title = options?.eventTitle?.trim() || "Tiket Peserta"

  let y = margin + 4
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(title, pageW / 2, y, { align: "center" })
  y += 10

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const nameLines = doc.splitTextToSize(participant.nama, maxW).slice(0, 4)
  for (const line of nameLines) {
    doc.text(line, pageW / 2, y, { align: "center" })
    y += 5
  }

  if (participant.tiket) {
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(participant.tiket, pageW / 2, y + 1, { align: "center" })
    y += 10
    doc.setTextColor(0, 0, 0)
  } else {
    y += 6
  }

  const qrMm = 52
  const qrX = (pageW - qrMm) / 2
  doc.addImage(qrDataUrl, "PNG", qrX, y, qrMm, qrMm)
  y += qrMm + 8

  doc.setFontSize(9)
  doc.setFont("courier", "normal")
  doc.text(code, pageW / 2, y, { align: "center" })

  doc.setFont("helvetica", "italic")
  doc.setFontSize(7)
  doc.setTextColor(120, 120, 120)
  doc.text("Scan untuk pemilihan kursi / validasi tiket.", pageW / 2, 142, {
    align: "center",
  })

  const fname = `${safeFileSegment(participant.nama)}-${safeFileSegment(code)}.pdf`
  doc.save(fname)
}
