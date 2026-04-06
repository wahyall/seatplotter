import { create } from "zustand"
import type { Gender, SeatRow } from "@/types/db"
import { bulkAssignCategory, checkSeat, updateSeat } from "@/lib/seats"

export type SeatPatch = Partial<
  Pick<SeatRow, "category_id" | "is_empty" | "label">
>

type HistoryEntry = {
  gender: Gender
  seatIds: string[]
  before: Record<string, SeatPatch>
  after: Record<string, SeatPatch>
}

export const useSeatStore = create<{
  seats: Record<Gender, Record<string, SeatRow>>
  layoutIdMap: Record<string, Gender>
  animatingIds: Record<string, boolean>
  history: HistoryEntry[]
  historyIndex: number

  setSeats: (gender: Gender, list: SeatRow[], layoutId: string) => void
  updateSeatLocal: (
    seatId: string,
    gender: Gender,
    data: Partial<SeatRow>
  ) => void
  bulkUpdateLocal: (
    ids: string[],
    gender: Gender,
    data: Partial<SeatRow>
  ) => void

  applyRealtimeUpdate: (record: SeatRow) => void
  triggerAnimation: (seatId: string) => void

  pushHistory: (entry: HistoryEntry) => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  canUndo: () => boolean
  canRedo: () => boolean
}>((set, get) => ({
  seats: { male: {}, female: {} },
  layoutIdMap: {},
  animatingIds: {},
  history: [],
  historyIndex: -1,

  setSeats: (gender, list, layoutId) =>
    set((s) => ({
      seats: {
        ...s.seats,
        [gender]: Object.fromEntries(list.map((x) => [x.id, x])),
      },
      layoutIdMap: { ...s.layoutIdMap, [layoutId]: gender },
    })),

  updateSeatLocal: (seatId, gender, data) =>
    set((s) => {
      const prev = s.seats[gender][seatId]
      if (!prev) return s
      return {
        seats: {
          ...s.seats,
          [gender]: {
            ...s.seats[gender],
            [seatId]: { ...prev, ...data },
          },
        },
      }
    }),

  bulkUpdateLocal: (ids, gender, data) =>
    set((s) => {
      const g = { ...s.seats[gender] }
      for (const id of ids) {
        if (g[id]) g[id] = { ...g[id], ...data }
      }
      return { seats: { ...s.seats, [gender]: g } }
    }),

  applyRealtimeUpdate: (record) => {
    const gender = get().layoutIdMap[record.layout_id]
    if (!gender) return
    set((s) => {
      const prev = s.seats[gender][record.id]
      const merged = { ...(prev ?? record), ...record } as SeatRow
      return {
        seats: {
          ...s.seats,
          [gender]: { ...s.seats[gender], [record.id]: merged },
        },
      }
    })
    get().triggerAnimation(record.id)
  },

  triggerAnimation: (seatId) => {
    set((s) => ({
      animatingIds: { ...s.animatingIds, [seatId]: true },
    }))
    setTimeout(() => {
      set((s) => {
        const next = { ...s.animatingIds }
        delete next[seatId]
        return { animatingIds: next }
      })
    }, 700)
  },

  pushHistory: (entry) =>
    set((s) => {
      const cut = s.history.slice(0, s.historyIndex + 1)
      const nextHist = [...cut, entry]
      return {
        history: nextHist,
        historyIndex: nextHist.length - 1,
      }
    }),

  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  undo: async () => {
    const { history, historyIndex } = get()
    if (historyIndex < 0) return
    const entry = history[historyIndex]
    const { gender, seatIds, before } = entry

    for (const id of seatIds) {
      const patch = before[id]
      if (!patch) continue
      get().updateSeatLocal(id, gender, patch as Partial<SeatRow>)
      await updateSeat(id, {
        category_id: patch.category_id,
        is_empty: patch.is_empty,
        label: patch.label,
      })
    }
    set({ historyIndex: historyIndex - 1 })
  },

  redo: async () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    const nextIdx = historyIndex + 1
    const entry = history[nextIdx]
    const { gender, seatIds, after } = entry

    for (const id of seatIds) {
      const patch = after[id]
      if (!patch) continue
      get().updateSeatLocal(id, gender, patch as Partial<SeatRow>)
      await updateSeat(id, {
        category_id: patch.category_id,
        is_empty: patch.is_empty,
        label: patch.label,
      })
    }
    set({ historyIndex: nextIdx })
  },
}))

export async function persistAssignUndoable(
  gender: Gender,
  seatIds: string[],
  newCategoryId: string | null
) {
  const st = useSeatStore.getState()
  const before: Record<string, SeatPatch> = {}
  for (const id of seatIds) {
    const seat = st.seats[gender][id]
    if (seat)
      before[id] = { category_id: seat.category_id, is_empty: seat.is_empty }
  }
  const localPatch: SeatPatch = { category_id: newCategoryId }
  if (newCategoryId !== null) localPatch.is_empty = false
  st.bulkUpdateLocal(seatIds, gender, localPatch)
  await bulkAssignCategory(seatIds, newCategoryId)
  const after: Record<string, SeatPatch> = {}
  for (const id of seatIds) {
    const prev = before[id]
    after[id] = {
      category_id: newCategoryId,
      is_empty:
        newCategoryId !== null ? false : (prev?.is_empty ?? false),
    }
  }
  st.pushHistory({ gender, seatIds, before, after })
}

export async function persistEmptyUndoable(
  gender: Gender,
  seatId: string,
  newEmpty: boolean
) {
  const st = useSeatStore.getState()
  const seat = st.seats[gender][seatId]
  if (!seat) return
  const before: Record<string, SeatPatch> = {
    [seatId]: { is_empty: seat.is_empty },
  }
  st.updateSeatLocal(seatId, gender, { is_empty: newEmpty })
  await updateSeat(seatId, { is_empty: newEmpty })
  const after: Record<string, SeatPatch> = {
    [seatId]: { is_empty: newEmpty },
  }
  st.pushHistory({ gender, seatIds: [seatId], before, after })
}

export async function persistLabelUndoable(
  gender: Gender,
  seatId: string,
  newLabel: string
) {
  const st = useSeatStore.getState()
  const seat = st.seats[gender][seatId]
  if (!seat) return
  const before: Record<string, SeatPatch> = {
    [seatId]: { label: seat.label },
  }
  st.updateSeatLocal(seatId, gender, { label: newLabel })
  await updateSeat(seatId, { label: newLabel })
  const after: Record<string, SeatPatch> = { [seatId]: { label: newLabel } }
  st.pushHistory({ gender, seatIds: [seatId], before, after })
}

export async function persistCheck(
  gender: Gender,
  seatId: string,
  isChecked: boolean
) {
  const st = useSeatStore.getState()
  st.updateSeatLocal(seatId, gender, {
    is_checked: isChecked,
    checked_at: isChecked ? new Date().toISOString() : null,
  })
  await checkSeat(seatId, isChecked)
}
