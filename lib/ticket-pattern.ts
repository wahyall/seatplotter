/**
 * Deterministic visual pattern generators for ticket anti-forgery.
 * Both functions derive all visual parameters from a 64-char hex hash
 * produced by the server's HMAC-SHA256 signing. Changing any ticket
 * field invalidates the hash, so the patterns become impossible to
 * forge without the server secret.
 */

function hexBytes(hash: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < hash.length; i += 2) {
    bytes.push(parseInt(hash.substring(i, i + 2), 16))
  }
  return bytes
}

// ---------------------------------------------------------------------------
// Layer 1 — Guilloche (spirograph curves)
// ---------------------------------------------------------------------------

export interface GuillocheCurve {
  path: string
  color: string
  strokeWidth: number
}

/**
 * Generate 3-4 spirograph SVG path strings from hash bytes.
 * Parametric: x(t) = R*cos(t) + r*cos(n*t), y(t) = R*sin(t) + r*sin(n*t)
 * where R, r, n are derived from the hash.
 */
export function generateGuillochePaths(
  hash: string,
  width: number,
  height: number,
): GuillocheCurve[] {
  const bytes = hexBytes(hash)
  const cx = width / 2
  const cy = height / 2
  const curves: GuillocheCurve[] = []

  const hueBase = bytes[24] * 1.41 // 0-360
  const hues = [
    hueBase % 360,
    (hueBase + 90) % 360,
    (hueBase + 180) % 360,
    (hueBase + 45) % 360,
  ]

  const curveCount = 3 + (bytes[31] % 2) // 3 or 4

  for (let c = 0; c < curveCount; c++) {
    const R = 30 + (bytes[c * 2] / 255) * (Math.min(width, height) * 0.42)
    const r = 10 + (bytes[c * 2 + 1] / 255) * (R * 0.65)
    const n = 3 + (bytes[8 + c] % 8) // frequency 3-10
    const phase = (bytes[16 + c] / 255) * Math.PI * 2

    const steps = 600
    const points: string[] = []

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2 * n
      const x = cx + R * Math.cos(t + phase) + r * Math.cos(n * t + phase)
      const y = cy + R * Math.sin(t + phase) + r * Math.sin(n * t + phase)
      points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    }

    curves.push({
      path: points.join(" ") + " Z",
      color: `hsla(${hues[c]}, 70%, 65%, 0.22)`,
      strokeWidth: 0.6 + (bytes[28 + c] % 3) * 0.3,
    })
  }

  return curves
}

// ---------------------------------------------------------------------------
// Microtext path — the primary curve as a <textPath> id reference
// ---------------------------------------------------------------------------

export function generateMicrotextPath(
  hash: string,
  width: number,
  height: number,
): string {
  const bytes = hexBytes(hash)
  const cx = width / 2
  const cy = height / 2

  const R = 30 + (bytes[0] / 255) * (Math.min(width, height) * 0.42)
  const r = 10 + (bytes[1] / 255) * (R * 0.65)
  const n = 3 + (bytes[8] % 8)
  const phase = (bytes[16] / 255) * Math.PI * 2

  const steps = 400
  const points: string[] = []

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * n
    const x = cx + R * Math.cos(t + phase) + r * Math.cos(n * t + phase)
    const y = cy + R * Math.sin(t + phase) + r * Math.sin(n * t + phase)
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
  }

  return points.join(" ")
}

// ---------------------------------------------------------------------------
// Layer 2 — Identicon (5x5 symmetric color grid)
// ---------------------------------------------------------------------------

export interface IdenticonCell {
  x: number
  y: number
  filled: boolean
  color: string
}

/**
 * Produces a 5x5 horizontally-mirrored grid. Uses bytes 32-63 of the hash
 * so there's no overlap with guilloche parameters.
 */
export function generateIdenticon(
  hash: string,
  cellSize: number = 8,
): { cells: IdenticonCell[]; size: number } {
  const bytes = hexBytes(hash)
  const offset = 32

  const hue1 = bytes[offset] * 1.41
  const hue2 = (hue1 + 120) % 360
  const palette = [
    `hsl(${hue1}, 70%, 60%)`,
    `hsl(${hue2}, 70%, 60%)`,
  ]

  const grid = 5
  const cells: IdenticonCell[] = []

  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < Math.ceil(grid / 2) + 1; col++) {
      const byteIdx = offset + 1 + row * 3 + col
      const filled = bytes[byteIdx % bytes.length] % 2 === 0

      const color = palette[bytes[(byteIdx + 1) % bytes.length] % 2]

      cells.push({ x: col * cellSize, y: row * cellSize, filled, color })

      // Mirror (skip center column)
      const mirrorCol = grid - 1 - col
      if (mirrorCol !== col) {
        cells.push({ x: mirrorCol * cellSize, y: row * cellSize, filled, color })
      }
    }
  }

  return { cells, size: grid * cellSize }
}
