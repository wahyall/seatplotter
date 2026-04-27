import { toPng } from "html-to-image"
import { jsPDF } from "jspdf"

function safeFileBase(s: string) {
  return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim().slice(0, 80) || "tiket"
}

/** A4 PDF, one page per ticket (visual capture of `#ticket-{id}`). */
export async function exportBookingTicketsPdf(options: {
  ticketIds: string[]
  fileBase: string
  /** Extra time is needed for KodeTiketQr async render inside each ticket. */
  pixelRatio?: number
}): Promise<void> {
  const { ticketIds, fileBase, pixelRatio = 2.5 } = options
  if (ticketIds.length === 0) return

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 10
  const maxW = pageW - margin * 2
  const maxH = pageH - margin * 2

  let pageIndex = 0
  for (const id of ticketIds) {
    const el = document.getElementById(`ticket-${id}`)
    if (!el) continue
    const wPx = el.offsetWidth
    const hPx = el.offsetHeight
    if (wPx <= 0 || hPx <= 0) continue
    const dataUrl = await toPng(el, {
      backgroundColor: "#0c0c0f",
      pixelRatio,
    })
    if (pageIndex > 0) doc.addPage()
    const wMm = (wPx * 25.4) / 96
    const hMm = (hPx * 25.4) / 96
    const scale = Math.min(maxW / wMm, maxH / hMm, 1)
    const drawW = wMm * scale
    const drawH = hMm * scale
    const x = (pageW - drawW) / 2
    const y = (pageH - drawH) / 2
    doc.addImage(dataUrl, "PNG", x, y, drawW, drawH)
    pageIndex += 1
  }
  if (pageIndex === 0) return
  doc.save(`${safeFileBase(fileBase)}.pdf`)
}
