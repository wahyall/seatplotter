import html2canvas from "html2canvas"

export async function exportLayoutPNG(eventName: string) {
  const el = document.getElementById("export-layout")
  if (!el) return

  const canvas = await html2canvas(el, {
    backgroundColor: "#0c0c0f",
    scale: 2,
    useCORS: true,
    width: el.scrollWidth,
    height: el.scrollHeight,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  })

  const link = document.createElement("a")
  link.download = `denah-${eventName.replace(/\s+/g, "-")}.png`
  link.href = canvas.toDataURL("image/png")
  link.click()
}
