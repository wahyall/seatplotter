import { toJpeg } from "html-to-image"
import { jsPDF } from "jspdf"

function safeFileBase(s: string) {
  return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim().slice(0, 80) || "tiket"
}

/** A4 PDF, one page per ticket (visual capture of `#ticket-{id}`). */
export async function exportBookingTicketsPdf(options: {
  ticketIds: string[]
  fileBase: string
  /**
   * Capture scale. Lower = smaller PDF. 1.25 is enough for A4 (was 2.5 + PNG → huge files).
   */
  pixelRatio?: number
  /** JPEG 0…1. ~0.82 balances size and readability on dark tickets. */
  jpegQuality?: number
}): Promise<void> {
  const { ticketIds, fileBase, pixelRatio = 1.5, jpegQuality = 1 } = options
  if (ticketIds.length === 0) return

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  /* Maximize ticket on page: scale = min(axes) so image fits, no 1x cap (was capping
     at 1 and leaving a small ticket in the middle of A4). */
  const maxW = pageW
  const maxH = pageH

  let pageIndex = 0
  for (const id of ticketIds) {
    const el = document.getElementById(`ticket-${id}`)
    if (!el) continue
    const wPx = el.offsetWidth
    const hPx = el.offsetHeight
    if (wPx <= 0 || hPx <= 0) continue
    const dataUrl = await toJpeg(el, {
      backgroundColor: "#0c0c0f",
      pixelRatio,
      quality: jpegQuality,
    })
    if (pageIndex > 0) doc.addPage()
    const wMm = (wPx * 25.4) / 96
    const hMm = (hPx * 25.4) / 96
    const scale = Math.min(maxW / wMm, maxH / hMm)
    const drawW = wMm * scale
    const drawH = hMm * scale
    const x = (pageW - drawW) / 2
    const y = (pageH - drawH) / 2
    doc.addImage(dataUrl, "JPEG", x, y, drawW, drawH)
    pageIndex += 1
  }
  if (pageIndex === 0) return
  doc.save(`${safeFileBase(fileBase)}.pdf`)
}
