import { create } from "zustand"
import type { CategoryRow, EventRow, Gender, LayoutRow } from "@/types/db"

export const useLayoutStore = create<{
  event: EventRow | null
  layouts: Record<Gender, LayoutRow | null>
  categories: Record<Gender, CategoryRow[]>
  hydrated: boolean
  isExporting: boolean

  setEvent: (e: EventRow | null) => void
  setLayouts: (male: LayoutRow | null, female: LayoutRow | null) => void
  setCategories: (gender: Gender, list: CategoryRow[]) => void
  addCategory: (gender: Gender, cat: CategoryRow) => void
  updateCategory: (gender: Gender, id: string, cat: CategoryRow) => void
  removeCategory: (gender: Gender, id: string) => void
  setHydrated: (v: boolean) => void
  setIsExporting: (v: boolean) => void
  patchEvent: (patch: Partial<EventRow>) => void
}>((set) => ({
  event: null,
  layouts: { male: null, female: null },
  categories: { male: [], female: [] },
  hydrated: false,
  isExporting: false,

  setEvent: (e) => set({ event: e }),

  setLayouts: (male, female) =>
    set({ layouts: { male, female } }),

  setCategories: (gender, list) =>
    set((s) => ({
      categories: { ...s.categories, [gender]: list },
    })),

  addCategory: (gender, cat) =>
    set((s) => ({
      categories: {
        ...s.categories,
        [gender]: [...s.categories[gender], cat],
      },
    })),

  updateCategory: (gender, id, cat) =>
    set((s) => ({
      categories: {
        ...s.categories,
        [gender]: s.categories[gender].map((c) =>
          c.id === id ? cat : c
        ),
      },
    })),

  removeCategory: (gender, id) =>
    set((s) => ({
      categories: {
        ...s.categories,
        [gender]: s.categories[gender].filter((c) => c.id !== id),
      },
    })),

  setHydrated: (v) => set({ hydrated: v }),
  setIsExporting: (v) => set({ isExporting: v }),
  patchEvent: (patch) =>
    set((s) => ({
      event: s.event ? { ...s.event, ...patch } : null,
    })),
}))
