import { supabase } from "@/lib/supabase"
import type { CategoryRow } from "@/types/db"

export async function fetchCategories(
  layoutId: string
): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("layout_id", layoutId)
    .order("order", { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCategory(
  layoutId: string,
  name: string,
  color: string
): Promise<CategoryRow> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("layout_id", layoutId)

  const { data, error } = await supabase
    .from("categories")
    .insert({
      layout_id: layoutId,
      name,
      color,
      order: existing?.length ?? 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(
  id: string,
  updates: Partial<Pick<CategoryRow, "name" | "color" | "order">>
): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id)
  if (error) throw error
}

export async function reorderCategories(
  items: Array<{ id: string; order: number }>
): Promise<void> {
  await Promise.all(
    items.map(({ id, order }) =>
      supabase.from("categories").update({ order }).eq("id", id)
    )
  )
}
