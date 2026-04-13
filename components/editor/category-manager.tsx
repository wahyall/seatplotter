"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/categories"
import { fetchSeats } from "@/lib/seats"
import type { CategoryRow, Gender, LayoutRow } from "@/types/db"
import { useLayoutStore } from "@/store/useLayoutStore"
import { useSeatStore } from "@/store/useSeatStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { PaletteIcon, PlusIcon, Trash2Icon, PencilIcon } from "lucide-react"

const PRESETS = [
  "#8B5CF6",
  "#06B6D4",
  "#22C55E",
  "#EAB308",
  "#F97316",
  "#EC4899",
]

export function CategoryManager({
  layout,
  gender,
  onDone,
}: {
  layout: LayoutRow
  gender: Gender
  onDone: () => void
}) {
  const categories = useLayoutStore((s) => s.categories[gender])
  const addCategory = useLayoutStore((s) => s.addCategory)
  const updateCategoryStore = useLayoutStore((s) => s.updateCategory)
  const removeCategoryStore = useLayoutStore((s) => s.removeCategory)
  const setSeats = useSeatStore((s) => s.setSeats)

  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState(PRESETS[0])
  const [editing, setEditing] = React.useState<CategoryRow | null>(null)

  const refreshSeats = async () => {
    const list = await fetchSeats(layout.id)
    setSeats(gender, list, layout.id)
  }

  const handleAdd = async () => {
    if (!name.trim()) return
    try {
      const cat = await createCategory(layout.id, name.trim(), color)
      addCategory(gender, cat)
      setName("")
      setOpen(false)
      toast.success("Kategori ditambahkan")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus kategori? Kursi akan di-unassign.")) return
    try {
      await deleteCategory(id)
      removeCategoryStore(gender, id)
      await refreshSeats()
      toast.success("Kategori dihapus")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal")
    }
  }

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) return
    try {
      const cat = await updateCategory(editing.id, {
        name: editing.name.trim(),
        color: editing.color,
      })
      updateCategoryStore(gender, editing.id, cat)
      setEditing(null)
      toast.success("Disimpan")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal")
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <PaletteIcon className="size-5 text-primary" />
          Kategori warna
        </CardTitle>
        <CardDescription>
          Buat kategori untuk assign kursi di langkah berikutnya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Badge
              key={c.id}
              className="gap-1.5 pr-1 pl-2 py-1.5 text-white"
              style={{ backgroundColor: c.color }}
            >
              {c.name}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-white hover:bg-white/20"
                onClick={() => setEditing({ ...c })}
              >
                <PencilIcon className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-white hover:bg-white/20"
                onClick={() => void handleDelete(c.id)}
              >
                <Trash2Icon className="size-3" />
              </Button>
            </Badge>
          ))}
        </div>

        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => setOpen(true)}
        >
          <PlusIcon className="size-4" />
          Tambah kategori
        </Button>

        <Button className="w-full rounded-xl" size="lg" onClick={onDone}>
          Lanjut assign kursi →
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="rounded-lg">
            <DialogHeader>
              <DialogTitle>Kategori baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nama</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VIP, Regular…"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Warna</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="size-9 rounded-full border-2 border-transparent ring-offset-2 ring-offset-background transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        backgroundColor: p,
                        boxShadow:
                          color === p ? "0 0 0 2px var(--ring)" : undefined,
                      }}
                      onClick={() => setColor(p)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button onClick={() => void handleAdd()}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
          <DialogContent className="rounded-lg">
            <DialogHeader>
              <DialogTitle>Edit kategori</DialogTitle>
            </DialogHeader>
            {editing && (
              <>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Nama</Label>
                    <Input
                      value={editing.name}
                      onChange={(e) =>
                        setEditing({ ...editing, name: e.target.value })
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Warna</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className="size-9 rounded-full border-2 border-transparent transition hover:scale-105"
                          style={{
                            backgroundColor: p,
                            boxShadow:
                              editing.color === p
                                ? "0 0 0 2px var(--ring)"
                                : undefined,
                          }}
                          onClick={() =>
                            setEditing({ ...editing, color: p })
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    Batal
                  </Button>
                  <Button onClick={() => void handleSaveEdit()}>Simpan</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
