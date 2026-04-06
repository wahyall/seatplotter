export type Gender = "male" | "female"

export interface ConfigRow {
  id: string
  event_name: string
  event_date: string | null
  event_venue: string | null
  stage_label: string
  updated_at: string
}

export interface LayoutRow {
  id: string
  gender: Gender
  label: string
  rows: number
  cols: number
  col_start_char: string
  reverse_col: boolean
  updated_at: string
}

export interface CategoryRow {
  id: string
  layout_id: string
  name: string
  color: string
  order: number
}

export interface SeatRow {
  id: string
  layout_id: string
  row: number
  col: number
  label: string
  category_id: string | null
  is_empty: boolean
  is_checked: boolean
  checked_at: string | null
  updated_at: string
}

/** Client-only dim flag for view filter */
export type SeatWithDim = SeatRow & { _dimmed?: boolean }
