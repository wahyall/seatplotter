/**
 * Client-side PDF → QR code extraction.
 * Uses pdf.js from CDN (to keep bundle small) + jsQR for QR detection.
 */
import jsQR from "jsqr"

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
  /** Decoded QR string (kode_tiket) */
  value: string
  /** Which page the QR was found on (1-indexed) */
  page: number
}

export interface ScanProgress {
  current: number
  total: number
  found: number
}

/**
 * Scan a region of a canvas for a QR code.
 * Returns the decoded string or null.
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
 * Create a binarized (pure black & white) copy of a canvas.
 * This dramatically improves jsQR detection by removing grey text,
 * gradients, and other noise that confuses the QR detector.
 */
function binarizeCanvas(
  srcCtx: CanvasRenderingContext2D,
  width: number,
  height: number
): CanvasRenderingContext2D {
  const srcData = srcCtx.getImageData(0, 0, width, height)
  const pixels = srcData.data

  // Otsu's threshold: compute optimal threshold from histogram
  const histogram = new Array<number>(256).fill(0)
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = Math.round(
      pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
    )
    histogram[gray]++
  }

  const totalPixels = width * height
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * histogram[i]

  let sumB = 0
  let wB = 0
  let maxVariance = 0
  let threshold = 128

  for (let t = 0; t < 256; t++) {
    wB += histogram[t]
    if (wB === 0) continue
    const wF = totalPixels - wB
    if (wF === 0) break

    sumB += t * histogram[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const variance = wB * wF * (mB - mF) * (mB - mF)

    if (variance > maxVariance) {
      maxVariance = variance
      threshold = t
    }
  }

  // Apply threshold
  for (let i = 0; i < pixels.length; i += 4) {
    const gray =
      pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
    const val = gray < threshold ? 0 : 255
    pixels[i] = val
    pixels[i + 1] = val
    pixels[i + 2] = val
    // alpha stays 255
  }

  const binCanvas = document.createElement("canvas")
  binCanvas.width = width
  binCanvas.height = height
  const binCtx = binCanvas.getContext("2d")!
  binCtx.putImageData(srcData, 0, 0)
  return binCtx
}

/**
 * Extract QR codes from a PDF file.
 * Renders each page to an offscreen canvas, then scans for QR codes using
 * progressive grid subdivision with overlapping windows. Both the original
 * and a binarized (black & white) version of each page are scanned for
 * maximum reliability.
 *
 * @param file          PDF file to scan
 * @param onProgress    Optional progress callback
 * @param scale         Render scale (higher = better detection, slower)
 * @param alreadySeen   Optional set of QR values to skip (for cross-PDF dedup)
 */
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
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d")!

    await page.render({ canvasContext: ctx, viewport }).promise

    // Create a binarized copy for better QR detection through noise
    const binCtx = binarizeCanvas(ctx, canvas.width, canvas.height)

    // Sliding window scanning guarantees we don't miss closely packed QR codes
    // that sit on tile boundaries.
    // size: width/height fraction of the page
    // step: how much to move the window each time (overlap = 50%)
    const fractionalPasses = [
      { size: 1, step: 1 },          // full page
      { size: 1 / 2, step: 1 / 4 },
      { size: 1 / 3, step: 1 / 6 },
      { size: 1 / 4, step: 1 / 8 },
      { size: 1 / 5, step: 1 / 10 },
      { size: 1 / 6, step: 1 / 12 },
      { size: 1 / 8, step: 1 / 16 },
    ]

    // Scan both original and binarized contexts
    const contexts = [ctx, binCtx]

    for (const scanCtx of contexts) {
      for (const { size, step } of fractionalPasses) {
        const w = Math.floor(canvas.width * size)
        const h = Math.floor(canvas.height * size)
        const stepX = Math.max(1, Math.floor(canvas.width * step))
        const stepY = Math.max(1, Math.floor(canvas.height * step))

        for (let y = 0; y < canvas.height; y += stepY) {
          for (let x = 0; x < canvas.width; x += stepX) {
            const currentW = Math.min(w, canvas.width - x)
            const currentH = Math.min(h, canvas.height - y)

            if (currentW < 40 || currentH < 40) continue

            const value = scanRegion(scanCtx, x, y, currentW, currentH)
            if (value && !seen.has(value)) {
              seen.add(value)
              results.push({ value, page: i })
            }
          }
        }
      }
    }

    // Cleanup
    canvas.width = 0
    canvas.height = 0
    // cleanup binarized canvas
    const binCanvas = binCtx.canvas
    binCanvas.width = 0
    binCanvas.height = 0
  }

  onProgress?.({
    current: totalPages,
    total: totalPages,
    found: results.length,
  })

  return results
}

/**
 * Extract QR codes from multiple PDF files, deduplicating across files.
 */
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
    for (const r of fileResults) {
      globalSeen.add(r.value)
    }
    allResults.push(...fileResults)
  }

  return allResults
}
