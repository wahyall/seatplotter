import { toPng } from "html-to-image"

export async function exportLayoutPNG(eventName: string) {
  const el = document.getElementById("export-layout")
  if (!el) return

  const dataUrl = await toPng(el, {
    backgroundColor: "#0c0c0f",
    pixelRatio: 2,
    width: el.scrollWidth,
    height: el.scrollHeight,
  })

  const link = document.createElement("a")
  link.download = `denah-${eventName.replace(/\s+/g, "-")}.png`
  link.href = dataUrl
  link.click()
}

export async function exportTicketPNG(ticketId: string, participantName: string) {
  const el = document.getElementById(`ticket-${ticketId}`)
  if (!el) return

  const dataUrl = await toPng(el, {
    backgroundColor: "#0c0c0f",
    pixelRatio: 3, // High resolution for ticket
  })

  const link = document.createElement("a")
  link.download = `tiket-${participantName.replace(/\s+/g, "-").toLowerCase()}.png`
  link.href = dataUrl
  link.click()
}
