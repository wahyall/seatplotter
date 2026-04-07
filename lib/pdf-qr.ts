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
 * Extract QR codes from a PDF file.
 * Renders each page to an offscreen canvas, then scans for QR codes using
 * progressive grid subdivision (1×1 → 2×2 → 3×3 → 4×4) so multiple QR
 * codes on a single page are detected.
 *
 * @param file          PDF file to scan
 * @param onProgress    Optional progress callback
 * @param scale         Render scale (higher = better detection, slower)
 * @param alreadySeen   Optional set of QR values to skip (for cross-PDF dedup)
 */
export async function extractQrFromPdf(
  file: File,
  onProgress?: (p: ScanProgress) => void,
  scale = 2,
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

    // Sliding window scanning guarantees we don't miss closely packed QR codes that sit on tile boundaries.
    // size: width/height fraction of the page
    // step: how much to move the window each time (overlap)
    const fractionalPasses = [
      { size: 1, step: 1 },         // 1x1 = 1 window
      { size: 1 / 2, step: 1 / 4 }, // 3x3 = 9 windows
      { size: 1 / 3, step: 1 / 6 }, // 5x5 = 25 windows
      { size: 1 / 4, step: 1 / 8 }, // 7x7 = 49 windows
      { size: 1 / 5, step: 1 / 10 },// 9x9 = 81 windows
    ]

    for (const { size, step } of fractionalPasses) {
      const w = Math.floor(canvas.width * size)
      const h = Math.floor(canvas.height * size)
      const stepX = Math.floor(canvas.width * step)
      const stepY = Math.floor(canvas.height * step)

      for (let y = 0; y + h <= canvas.height || y === 0; y += stepY) {
        for (let x = 0; x + w <= canvas.width || x === 0; x += stepX) {
          // ensure we don't go out of bounds on the last step
          const currentW = Math.min(w, canvas.width - x)
          const currentH = Math.min(h, canvas.height - y)

          const value = scanRegion(ctx, x, y, currentW, currentH)
          if (value && !seen.has(value)) {
            seen.add(value)
            results.push({ value, page: i })
          }

          if (x + w >= canvas.width) break
        }
        if (y + h >= canvas.height) break
      }
    }

    // Cleanup
    canvas.width = 0
    canvas.height = 0
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
  scale = 2
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
