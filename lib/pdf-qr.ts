/**
 * Client-side PDF → QR code extraction.
 * Uses pdf.js from CDN + jsQR for QR detection.
 *
 * Two complementary strategies:
 * 1. Canvas rendering + sliding window scan (primary)
 * 2. PDF text layer extraction (catches codes jsQR misses)
 */
import jsQR from "jsqr"

/** Yield control back to the browser so UI can repaint & stay responsive. */
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0))

const PDFJS_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs"
const PDFJS_WORKER_CDN =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib
  pdfjsLib = await import(/* webpackIgnore: true */ PDFJS_CDN)
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN
  return pdfjsLib
}

export interface QrScanResult {
  value: string
  page: number
}

export interface ScanProgress {
  current: number
  total: number
  found: number
}

/**
 * Scan a region of a canvas for a QR code.
 */
function scanRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): string | null {
  if (w < 40 || h < 40) return null
  try {
    const data = ctx.getImageData(x, y, w, h)
    const qr = jsQR(data.data, data.width, data.height)
    return qr?.data || null
  } catch {
    return null
  }
}

/**
 * Binarize canvas using Otsu's threshold for cleaner QR detection.
 */
function binarizeCanvas(
  srcCtx: CanvasRenderingContext2D,
  width: number,
  height: number
): CanvasRenderingContext2D {
  const srcData = srcCtx.getImageData(0, 0, width, height)
  const px = srcData.data

  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < px.length; i += 4) {
    hist[Math.round(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114)]++
  }

  const total = width * height
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, maxVar = 0, thresh = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const d = sumB / wB - (sum - sumB) / wF
    const v = wB * wF * d * d
    if (v > maxVar) { maxVar = v; thresh = t }
  }

  for (let i = 0; i < px.length; i += 4) {
    const g = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
    const val = g < thresh ? 0 : 255
    px[i] = val; px[i + 1] = val; px[i + 2] = val
  }

  const c = document.createElement("canvas")
  c.width = width; c.height = height
  const ctx2 = c.getContext("2d")!
  ctx2.putImageData(srcData, 0, 0)
  return ctx2
}

/**
 * Extract potential ticket codes from the PDF text layer.
 * Matches alphanumeric strings (6-20 chars) containing both letters and digits.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractTextCandidates(page: any): Promise<string[]> {
  try {
    const tc = await page.getTextContent()
    const candidates: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of tc.items as any[]) {
      const str = (item.str || "").trim()
      // Must be 6-20 chars, all uppercase alphanumeric, contain both letters and digits
      if (
        str.length >= 6 &&
        str.length <= 20 &&
        /^[A-Z0-9]+$/.test(str) &&
        /[A-Z]/.test(str) &&
        /[0-9]/.test(str)
      ) {
        candidates.push(str)
      }
    }
    return candidates
  } catch {
    return []
  }
}

/**
 * Run sliding-window QR scan on a canvas context.
 * Yields to the main thread between passes so the UI stays responsive.
 */
async function slidingWindowScan(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  seen: Set<string>,
  pageNum: number
): Promise<QrScanResult[]> {
  const results: QrScanResult[] = []

  const fractionalPasses = [
    { size: 1, step: 1 },
    { size: 1 / 2, step: 1 / 4 },
    { size: 1 / 3, step: 1 / 6 },
    { size: 1 / 4, step: 1 / 8 },
    { size: 1 / 5, step: 1 / 10 },
    { size: 1 / 6, step: 1 / 12 },
    { size: 1 / 8, step: 1 / 16 },
  ]

  for (const { size, step } of fractionalPasses) {
    const w = Math.floor(canvasW * size)
    const h = Math.floor(canvasH * size)
    const stepX = Math.max(1, Math.floor(canvasW * step))
    const stepY = Math.max(1, Math.floor(canvasH * step))

    for (let y = 0; y < canvasH; y += stepY) {
      for (let x = 0; x < canvasW; x += stepX) {
        const cw = Math.min(w, canvasW - x)
        const ch = Math.min(h, canvasH - y)
        if (cw < 40 || ch < 40) continue

        const value = scanRegion(ctx, x, y, cw, ch)
        if (value && !seen.has(value)) {
          seen.add(value)
          results.push({ value, page: pageNum })
        }
      }
    }

    // Yield to main thread between passes so UI can repaint
    await yieldToMain()
  }

  return results
}

export async function extractQrFromPdf(
  file: File,
  onProgress?: (p: ScanProgress) => void,
  scale = 3,
  alreadySeen?: Set<string>
): Promise<QrScanResult[]> {
  const pdfjs = await loadPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages
  const results: QrScanResult[] = []
  const seen = new Set<string>(alreadySeen)

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.({ current: i, total: totalPages, found: results.length })

    const page = await pdf.getPage(i)

    // --- Strategy 1: Canvas rendering + sliding window ---
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d")!
    await page.render({ canvasContext: ctx, viewport }).promise

    // Scan original canvas
    results.push(...await slidingWindowScan(ctx, canvas.width, canvas.height, seen, i))

    // Yield before binarization (CPU-heavy)
    await yieldToMain()

    // Scan binarized canvas
    const binCtx = binarizeCanvas(ctx, canvas.width, canvas.height)
    results.push(...await slidingWindowScan(binCtx, canvas.width, canvas.height, seen, i))

    // Cleanup canvases
    canvas.width = 0; canvas.height = 0
    binCtx.canvas.width = 0; binCtx.canvas.height = 0

    // --- Strategy 2: Text layer extraction ---
    const textCandidates = await extractTextCandidates(page)
    for (const code of textCandidates) {
      if (!seen.has(code)) {
        seen.add(code)
        results.push({ value: code, page: i })
      }
    }

    // Release page-level resources (operator lists, image caches, etc.)
    page.cleanup()
  }

  // Release the entire PDF document from memory
  pdf.destroy()

  onProgress?.({ current: totalPages, total: totalPages, found: results.length })
  return results
}

export async function extractQrFromMultiplePdfs(
  files: File[],
  onProgress?: (p: ScanProgress & { fileIndex: number; totalFiles: number }) => void,
  scale = 3
): Promise<QrScanResult[]> {
  const allResults: QrScanResult[] = []
  const globalSeen = new Set<string>()

  for (let fi = 0; fi < files.length; fi++) {
    const fileResults = await extractQrFromPdf(
      files[fi],
      onProgress
        ? (p) => onProgress({ ...p, fileIndex: fi, totalFiles: files.length })
        : undefined,
      scale,
      globalSeen
    )
    for (const r of fileResults) globalSeen.add(r.value)
    allResults.push(...fileResults)
  }

  return allResults
}
