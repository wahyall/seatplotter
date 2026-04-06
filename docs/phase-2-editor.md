# Phase 2 — Editor Layout

> **Estimasi:** 3–4 hari  
> **Goal:** Operator dapat mengatur grid (dengan Reverse Kolom), membuat kategori, dan assign kursi per layout melalui wizard 3 langkah. Semua operasi CRUD dilakukan via Supabase client langsung — tanpa API route perantara, kecuali untuk generate massal.

---

## ✅ Checklist Phase 2

- [ ] 2.1 Util: generator label + getColHeaders (reverseCol)
- [ ] 2.2 API Route: `POST /api/seats/generate` (batch insert)
- [ ] 2.3 Operasi kategori via Supabase client
- [ ] 2.4 Halaman editor — pilih layout
- [ ] 2.5 Wizard wrapper + stepper
- [ ] 2.6 Step 1 — Grid Setup (+ checkbox Reverse Kolom)
- [ ] 2.7 Step 2 — Category Manager
- [ ] 2.8 Step 3 — Assign Kursi (tap + drag)
- [ ] 2.9 Edit label manual (inline)
- [ ] 2.10 Zustand store
- [ ] 2.11 SeatGrid (virtualisasi)
- [ ] 2.12 SeatColHeader + SeatRowLabel + SeatCell
- [ ] 2.13 Undo/Redo

---

## 2.1 Util: Generator Label & Header Kolom

### `lib/utils.js`

```js
/** index 0-based → huruf. 0→A, 25→Z */
export const indexToChar = (i) => String.fromCharCode(65 + i);

/** huruf → index. A→0, Z→25 */
export const charToIndex = (c) => c.toUpperCase().charCodeAt(0) - 65;

/**
 * Hasilkan array huruf kolom sesuai urutan tampil (kiri → kanan).
 *
 * reverseCol = false  →  A B C D ... (normal, A di kiri)
 * reverseCol = true   →  J I H ... A (A di kanan, terbesar di kiri)
 *
 * @param {string}  colStartChar   Huruf awal, misal "A" atau "K"
 * @param {number}  cols           Jumlah kolom
 * @param {boolean} reverseCol
 */
export function getColHeaders(colStartChar, cols, reverseCol) {
  const start = charToIndex(colStartChar);
  const headers = Array.from({ length: cols }, (_, i) => indexToChar(start + i));
  return reverseCol ? [...headers].reverse() : headers;
}

/**
 * Generate label satu kursi.
 * headers = array dari getColHeaders() → headers[colIndex] = huruf kolom
 */
export function generateSeatLabel(row, colIndex, headers) {
  return `${headers[colIndex]}_${String(row + 1).padStart(2, '0')}`;
}

/**
 * Generate array semua seats untuk satu layout.
 * Kembalikan plain object, siap di-insert ke Supabase.
 */
export function generateSeatsForLayout(layoutId, rows, cols, colStartChar, reverseCol) {
  const headers = getColHeaders(colStartChar, cols, reverseCol);
  const seats = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      seats.push({
        layout_id:   layoutId,
        row:         r,
        col:         c,
        label:       generateSeatLabel(r, c, headers),
        category_id: null,
        is_empty:    false,
        is_checked:  false,
        checked_at:  null,
      });
    }
  }
  return seats;
}

/**
 * Validasi range kolom: colStartChar + cols tidak boleh > 'Z'
 */
export function validateColRange(colStartChar, cols) {
  const startIdx = charToIndex(colStartChar);
  if (startIdx + cols > 26) {
    const endChar = indexToChar(startIdx + cols - 1);
    return {
      valid: false,
      errorMsg: `Melebihi batas Z. Mulai "${colStartChar}" + ${cols} kolom = sampai "${endChar}".`
    };
  }
  return { valid: true, errorMsg: '' };
}
```

---

## 2.2 API Route: Generate Seats (Batch Insert)

Generate bisa menghasilkan 500+ baris sekaligus. Gunakan `supabaseAdmin` (service role) untuk bypass RLS dan performa maksimal.

### `app/api/seats/generate/route.js`

```js
import { supabase }      from '@/lib/supabase';        // untuk fetch layout
import { supabaseAdmin } from '@/lib/supabase-admin';  // untuk batch insert
import { generateSeatsForLayout } from '@/lib/utils';

export async function POST(req) {
  const { layoutId } = await req.json();

  // Ambil config layout
  const { data: layout, error: layoutErr } = await supabase
    .from('layouts')
    .select('*')
    .eq('id', layoutId)
    .single();

  if (layoutErr || !layout) {
    return Response.json({ success: false, error: 'Layout not found' }, { status: 404 });
  }

  // Hapus seats lama layout ini
  const { error: deleteErr } = await supabaseAdmin
    .from('seats')
    .delete()
    .eq('layout_id', layoutId);

  if (deleteErr) {
    return Response.json({ success: false, error: deleteErr.message }, { status: 500 });
  }

  // Generate seats baru
  const seats = generateSeatsForLayout(
    layoutId,
    layout.rows,
    layout.cols,
    layout.col_start_char,
    layout.reverse_col
  );

  // Batch insert — Supabase mendukung insert array langsung
  // Untuk 500+ baris, pecah menjadi chunks agar tidak timeout
  const CHUNK_SIZE = 200;
  for (let i = 0; i < seats.length; i += CHUNK_SIZE) {
    const chunk = seats.slice(i, i + CHUNK_SIZE);
    const { error: insertErr } = await supabaseAdmin
      .from('seats')
      .insert(chunk);

    if (insertErr) {
      return Response.json({ success: false, error: insertErr.message }, { status: 500 });
    }
  }

  return Response.json({ success: true, data: { count: seats.length } });
}
```

> Chunk size 200 dipilih untuk menghindari Supabase payload limit (1MB per request) dan Vercel function timeout.

---

## 2.3 Operasi Kategori via Supabase Client

Kategori tidak membutuhkan API route — bisa dilakukan langsung dari client karena RLS mengizinkan akses publik.

```js
// lib/categories.js — helper functions

import { supabase } from './supabase';

export async function fetchCategories(layoutId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('layout_id', layoutId)
    .order('order');
  if (error) throw error;
  return data;
}

export async function createCategory(layoutId, name, color) {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('layout_id', layoutId);

  const { data, error } = await supabase
    .from('categories')
    .insert({ layout_id: layoutId, name, color, order: existing?.length ?? 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id, updates) {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id) {
  // Supabase ON DELETE SET NULL sudah handle unassign seats otomatis
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderCategories(items) {
  // items = [{ id, order }]
  // Supabase belum punya native bulkUpdate — pakai Promise.all
  await Promise.all(
    items.map(({ id, order }) =>
      supabase.from('categories').update({ order }).eq('id', id)
    )
  );
}
```

---

## 2.4 Operasi Seats via Supabase Client

```js
// lib/seats.js

import { supabase } from './supabase';

export async function fetchSeats(layoutId) {
  const { data, error } = await supabase
    .from('seats')
    .select('*')
    .eq('layout_id', layoutId)
    .order('row')
    .order('col');
  if (error) throw error;
  return data;
}

// Update satu kursi (label, category_id, is_empty)
export async function updateSeat(id, updates) {
  const ALLOWED = ['label', 'category_id', 'is_empty'];
  const safe = Object.fromEntries(
    Object.entries(updates).filter(([k]) => ALLOWED.includes(k))
  );
  const { error } = await supabase
    .from('seats')
    .update({ ...safe, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Bulk assign kategori ke banyak kursi
export async function bulkAssignCategory(seatIds, categoryId) {
  const { error } = await supabase
    .from('seats')
    .update({ category_id: categoryId, updated_at: new Date().toISOString() })
    .in('id', seatIds);
  if (error) throw error;
}

// Check/uncheck (digunakan di Phase 3)
export async function checkSeat(id, isChecked) {
  const { error } = await supabase
    .from('seats')
    .update({
      is_checked: isChecked,
      checked_at: isChecked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}
```

---

## 2.5 Halaman Editor — Pilih Layout

```
┌──────────────────────────────────┐
│  Editor Layout                   │
│                                  │
│  ┌──────────────┐  ┌──────────┐  │
│  │     🔵       │  │   🩷    │  │
│  │    PRIA      │  │  WANITA  │  │
│  │  100 kursi   │  │ 60 kursi │  │
│  │  K–T, 10b   │  │ A–J rev  │  │
│  └──────────────┘  └──────────┘  │
└──────────────────────────────────┘
```

---

## 2.6 Step 1 — Grid Setup (+ Reverse Kolom)

### `components/editor/GridSetup.jsx`

```
┌────────────────────────────────────┐
│  Setup Grid — Pria                 │
│                                    │
│  Jumlah Baris        10            │
│  [──────────●──────────]           │  ← slider 1–50
│                                    │
│  Jumlah Kolom        10            │
│  [──────────●──────────]           │  ← slider 1–26
│                                    │
│  Mulai dari Huruf  [ K ▾ ]        │  ← dropdown A–Z
│                                    │
│  ┌─────────────────────────────┐   │
│  │  ☐ Reverse Kolom            │   │
│  │  Huruf terbesar di kiri,    │   │
│  │  huruf awal di kanan        │   │
│  │  Contoh A–J → J I H ... A  │   │
│  └─────────────────────────────┘   │
│                                    │
│  Preview urutan kolom:             │
│  ┌─────────────────────────────┐   │
│  │  K  L  M  N  O  P  Q  R  S  T  │  ← update real-time
│  └─────────────────────────────┘   │
│                                    │
│  Total: 100 kursi                  │
│                                    │
│  ⚠️ Generate akan hapus kursi lama  │
│                                    │
│  [  Generate & Lanjut →  ]         │
└────────────────────────────────────┘
```

### Implementasi

```jsx
// State form
const [rows, setRows]           = useState(layout.rows);
const [cols, setCols]           = useState(layout.cols);
const [colStart, setColStart]   = useState(layout.col_start_char);
const [reverse, setReverse]     = useState(layout.reverse_col);
const [loading, setLoading]     = useState(false);

// Preview update real-time
const headers     = useMemo(() => getColHeaders(colStart, cols, reverse), [colStart, cols, reverse]);
const validation  = useMemo(() => validateColRange(colStart, cols), [colStart, cols]);

const handleGenerate = async () => {
  if (!validation.valid || loading) return;

  const confirmed = hasSeats
    ? confirm(`Generate akan menghapus ${existingCount} kursi yang ada. Lanjutkan?`)
    : true;
  if (!confirmed) return;

  setLoading(true);
  try {
    // 1. Update layout config di Supabase
    await supabase
      .from('layouts')
      .update({ rows, cols, col_start_char: colStart, reverse_col: reverse, updated_at: new Date() })
      .eq('id', layout.id);

    // 2. Generate kursi via API route (batch insert)
    const res = await fetch('/api/seats/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layoutId: layout.id }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    // 3. Refresh store & lanjut ke step 2
    await refreshSeats();
    setStep(2);
  } catch (err) {
    toast.error(`Gagal generate: ${err.message}`);
  } finally {
    setLoading(false);
  }
};
```

### Dropdown Huruf Awal

```jsx
// Opsi: A–Z, tapi filter yang masih muat dalam range
const availableStarts = useMemo(() => {
  return Array.from({ length: 26 }, (_, i) => indexToChar(i))
    .filter(char => validateColRange(char, cols).valid);
}, [cols]);

<select value={colStart} onChange={e => setColStart(e.target.value)}
  className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-white">
  {availableStarts.map(char => (
    <option key={char} value={char}>{char}</option>
  ))}
</select>
```

---

## 2.7 Step 2 — Category Manager

CRUD kategori langsung via Supabase client (bukan API route).

```jsx
// Tambah kategori
const handleAdd = async () => {
  const cat = await createCategory(layout.id, formName, formColor);
  useLayoutStore.getState().addCategory(gender, cat);
  setShowModal(false);
};

// Edit
const handleEdit = async (id, updates) => {
  const cat = await updateCategory(id, updates);
  useLayoutStore.getState().updateCategory(gender, id, cat);
};

// Hapus — ON DELETE SET NULL di DB otomatis unassign seats
const handleDelete = async (id) => {
  await deleteCategory(id);
  useLayoutStore.getState().removeCategory(gender, id);
  // Re-fetch seats agar category_id null terupdate di store
  await refreshSeats();
};
```

---

## 2.8 Step 3 — Assign Kursi

### Layout Halaman

```
┌────────────────────────────────────┐
│          ▓▓▓ STAGE ▓▓▓              │
├────────────────────────────────────┤
│  K  L  M  N  O  P  Q  R  S  T    │  ← SeatColHeader
│ ①[■][■][■][■][■][■][■][■][■][■] ①│  ← SeatRowLabel + kursi
│ ②[■][■][■][■][■][■][■][■][■][■] ②│
│           [pan / zoom]             │
├────────────────────────────────────┤
│  Mode:  [● Assign]  [ Kosong]       │
├────────────────────────────────────┤
│  ● VIP  ● Regular  ● VVIP  ✕ Clear │
│  ↩ Undo   ↪ Redo                   │
└────────────────────────────────────┘
```

### Tap Assign (Single)

```js
const handleSeatClick = async (seatId) => {
  const seat = useSeatStore.getState().seats[gender][seatId];

  if (mode === 'empty') {
    // Toggle lorong
    const newEmpty = !seat.is_empty;
    useSeatStore.getState().updateSeat(seatId, gender, { is_empty: newEmpty }); // optimistic
    await updateSeat(seatId, { is_empty: newEmpty });
    return;
  }

  // Mode assign
  const newCategoryId = seat.category_id === activeCategoryId ? null : activeCategoryId;
  useSeatStore.getState().updateSeat(seatId, gender, { category_id: newCategoryId }); // optimistic
  await updateSeat(seatId, { category_id: newCategoryId });
};
```

### Drag Assign (Bulk Paint)

```js
const draggedSeats = useRef(new Set());

const handleTouchMove = (e) => {
  if (mode !== 'assign') return;
  const touch = e.touches[0];
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  const seatId = el?.dataset?.seatId;
  if (seatId && !draggedSeats.current.has(seatId)) {
    draggedSeats.current.add(seatId);
    // Optimistic update lokal saja saat drag berlangsung
    useSeatStore.getState().updateSeat(seatId, gender, { category_id: activeCategoryId });
  }
};

const handleTouchEnd = async () => {
  const ids = [...draggedSeats.current];
  if (!ids.length) return;
  draggedSeats.current.clear();

  // Satu request bulk ke Supabase
  await bulkAssignCategory(ids, activeCategoryId);
  // Store sudah diupdate secara optimistic, tidak perlu refresh
};
```

---

## 2.9 Edit Label Manual (Inline)

Long-press kursi → input inline muncul.

```jsx
const handleLabelSave = async (seatId, newLabel) => {
  if (!newLabel.trim()) return;
  const trimmed = newLabel.trim().slice(0, 10);
  // Optimistic update
  useSeatStore.getState().updateSeat(seatId, gender, { label: trimmed });
  // Simpan ke Supabase
  await updateSeat(seatId, { label: trimmed });
  setEditingId(null);
};
```

---

## 2.10 Zustand Store

### `store/useSeatStore.js`
```js
import { create } from 'zustand';

export const useSeatStore = create((set, get) => ({
  seats: { male: {}, female: {} },     // { [gender]: { [seatId]: seat } }
  layoutIdMap: {},                     // { [layoutId]: gender }
  animatingSeats: new Set(),           // untuk animasi realtime
  history: [],
  historyIndex: -1,

  setSeats: (gender, seatsArray, layoutId) => {
    const map = Object.fromEntries(seatsArray.map(s => [s.id, s]));
    set(s => ({
      seats: { ...s.seats, [gender]: map },
      layoutIdMap: { ...s.layoutIdMap, [layoutId]: gender },
    }));
  },

  updateSeat: (id, gender, data) => set(s => {
    const g = { ...s.seats[gender], [id]: { ...s.seats[gender][id], ...data } };
    return { seats: { ...s.seats, [gender]: g } };
  }),

  bulkUpdateSeats: (ids, gender, data) => set(s => {
    const g = { ...s.seats[gender] };
    ids.forEach(id => { g[id] = { ...g[id], ...data }; });
    return { seats: { ...s.seats, [gender]: g } };
  }),

  // Dipanggil dari Supabase Realtime (Phase 3)
  applyRealtimeUpdate: (record) => {
    const { layoutIdMap } = get();
    const gender = layoutIdMap[record.layout_id];
    if (!gender) return;
    set(s => {
      const g = { ...s.seats[gender], [record.id]: { ...s.seats[gender][record.id], ...record } };
      return { seats: { ...s.seats, [gender]: g } };
    });
    // Trigger animasi
    get().triggerAnimation(record.id);
  },

  triggerAnimation: (seatId) => {
    set(s => ({ animatingSeats: new Set([...s.animatingSeats, seatId]) }));
    setTimeout(() => {
      set(s => {
        const next = new Set(s.animatingSeats);
        next.delete(seatId);
        return { animatingSeats: next };
      });
    }, 700);
  },
}));
```

---

## 2.11 SeatGrid + SeatCell

### SeatGrid (virtualisasi baris)
```jsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function SeatGrid({ seats, layout, categories, mode, onSeatAction }) {
  const headers = useMemo(
    () => getColHeaders(layout.col_start_char, layout.cols, layout.reverse_col),
    [layout]
  );

  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: layout.rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 37,   // 34px seat + 3px gap
    overscan: 4,
  });

  // Group by row, index by col
  const seatsByRow = useMemo(() => {
    const map = {};
    seats.forEach(s => {
      if (!map[s.row]) map[s.row] = {};
      map[s.row][s.col] = s;
    });
    return map;
  }, [seats]);

  return (
    <div className="flex flex-col">
      <SeatColHeader headers={headers} />
      <div ref={parentRef} className="overflow-auto">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(vRow => (
            <div key={vRow.index}
              style={{ position: 'absolute', top: vRow.start }}
              className="flex items-center gap-[3px]">
              <SeatRowLabel row={vRow.index} />
              {Array.from({ length: layout.cols }, (_, c) => {
                const seat = seatsByRow[vRow.index]?.[c];
                if (!seat) return <div key={c} className="w-[34px] h-[34px]" />;
                return (
                  <SeatCell
                    key={seat.id}
                    seat={seat}
                    category={categories.find(cat => cat.id === seat.category_id)}
                    mode={mode}
                    onAction={onSeatAction}
                  />
                );
              })}
              <SeatRowLabel row={vRow.index} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### SeatCell (React.memo)
```jsx
export const SeatCell = React.memo(function SeatCell({ seat, category, onAction }) {
  const isAnimating = useSeatStore(s => s.animatingSeats.has(seat.id));
  if (seat.is_empty) return <div className="w-[34px] h-[34px] flex-shrink-0" />;

  return (
    <button
      data-seat-id={seat.id}
      style={{ backgroundColor: category?.color ?? '#2E2E2E' }}
      className={`
        relative w-[34px] h-[34px] rounded-md flex-shrink-0 select-none
        text-[8px] font-mono font-bold text-white/80
        transition-transform active:scale-90
        ${seat.is_checked ? 'opacity-40' : ''}
        ${isAnimating ? 'animate-seat-pulse' : ''}
      `}
      onClick={() => onAction(seat.id, 'click')}
      onTouchStart={() => onAction(seat.id, 'touchstart')}
      onTouchEnd={() => onAction(seat.id, 'touchend')}
    >
      {seat.label}
      {seat.is_checked && (
        <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-white">✓</span>
      )}
    </button>
  );
}, (prev, next) =>
  prev.seat.is_checked  === next.seat.is_checked  &&
  prev.seat.category_id === next.seat.category_id &&
  prev.seat.is_empty    === next.seat.is_empty    &&
  prev.seat.label       === next.seat.label
);
```

---

## 🧪 Definition of Done — Phase 2

- [ ] Grid pria (K, 10 kolom, normal): header = `K L M N O P Q R S T`
- [ ] Grid wanita (A, 10 kolom, reverse): header = `J I H G F E D C B A`
- [ ] Preview header update real-time saat form diubah
- [ ] Checkbox Reverse Kolom mengubah preview seketika
- [ ] Validasi: mulai "S" + 10 kolom → pesan error
- [ ] Dropdown "Mulai Huruf" hanya tampilkan opsi yang valid
- [ ] Generate 100 kursi → label benar sesuai preview
- [ ] Long-press → edit label inline → tersimpan di Supabase
- [ ] Tap assign, drag assign, mode kosong berfungsi
- [ ] Undo kembalikan state assign sebelumnya
- [ ] Grid 500+ kursi scroll smooth

---

## ⚠️ Catatan Teknis

- **Supabase `IN` filter** (`bulkAssignCategory`) mendukung array hingga ribuan ID — aman untuk bulk assign seluruh layout.
- **`ON DELETE SET NULL`** pada `category_id` di tabel `seats` berarti menghapus kategori otomatis unassign semua kursinya di level database — tidak perlu query tambahan dari aplikasi.
- **Chunk 200 baris** saat generate dipilih untuk menghindari Supabase's request payload limit (default 10MB) dan agar tidak timeout di Vercel (10 detik free tier).
- Untuk optimasi lebih jauh: gunakan Supabase **Database Function** (PL/pgSQL) yang bisa generate seluruh kursi dalam satu RPC call dari server — eliminasi overhead HTTP chunking.
