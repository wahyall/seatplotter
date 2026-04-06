"use client"

import * as React from "react"
import { useCallback, useRef } from "react"

type Pt = { x: number; y: number }

function touchPoints(touches: React.TouchList): Pt[] {
  return Array.from({ length: touches.length }, (_, i) => ({
    x: touches[i].clientX,
    y: touches[i].clientY,
  }))
}

export function useZoomPan() {
  const scale = useRef(1)
  const offset = useRef({ x: 0, y: 0 })
  const lastTouch = useRef<Pt[] | null>(null)

  const apply = useCallback((el: HTMLElement | null) => {
    if (!el) return
    el.style.transform = `translate(${offset.current.x}px, ${offset.current.y}px) scale(${scale.current})`
    el.style.transformOrigin = "top left"
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    lastTouch.current = touchPoints(e.touches)
  }, [])

  const onTouchMove = useCallback(
    (e: React.TouchEvent, el: HTMLElement | null) => {
      if (!el) return
      const pts = touchPoints(e.touches)
      const prev = lastTouch.current
      if (e.touches.length === 2 && prev && prev.length === 2) {
        const [a, b] = pts
        const [la, lb] = prev
        const distPrev = Math.hypot(lb.x - la.x, lb.y - la.y)
        const distCurr = Math.hypot(b.x - a.x, b.y - a.y)
        if (distPrev > 0) {
          scale.current = Math.min(
            3,
            Math.max(0.4, scale.current * (distCurr / distPrev))
          )
        }
      } else if (e.touches.length === 1 && prev?.length === 1) {
        offset.current.x += pts[0].x - prev[0].x
        offset.current.y += pts[0].y - prev[0].y
      }
      lastTouch.current = pts
      apply(el)
    },
    [apply]
  )

  const reset = useCallback((el: HTMLElement | null) => {
    scale.current = 1
    offset.current = { x: 0, y: 0 }
    apply(el)
  }, [apply])

  return { onTouchStart, onTouchMove, reset, apply }
}
