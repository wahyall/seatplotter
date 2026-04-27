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

