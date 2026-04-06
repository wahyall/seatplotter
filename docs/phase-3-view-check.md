# Phase 3 — View & Real-Time Check

> **Estimasi:** 3 hari  
> **Goal:** Tampilkan dual layout berdampingan, implementasi check-in kursi, dan sinkronisasi real-time ke semua operator via **Supabase Realtime** — tanpa service tambahan, cukup update database.

---

## ✅ Checklist Phase 3

- [ ] 3.1 Hook `useRealtimeSeats` (subscribe Supabase Realtime)
- [ ] 3.2 Halaman View — dual layout berdampingan
- [ ] 3.3 Filter per kategori
- [ ] 3.4 Popup info kursi
- [ ] 3.5 Halaman Check — pilih layout
- [ ] 3.6 Check mode per layout
- [ ] 3.7 Animasi kursi di-update orang lain
- [ ] 3.8 Handling koneksi terputus & reconnect
- [ ] 3.9 Counter & statistik live
- [ ] 3.10 Dashboard lengkap
- [ ] 3.11 Pinch-to-zoom & pan

---

## 3.1 Hook: useRealtimeSeats

Inilah perbedaan terbesar dari Pusher: tidak perlu trigger manual dari server. Cukup subscribe ke perubahan tabel `seats` di Supabase, semua update otomatis diterima.

### `lib/hooks/useRealtimeSeats.js`

```js
'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSeatStore } from '@/store/useSeatStore';

/**
 * Subscribe ke Supabase Realtime untuk perubahan kursi.
 *
 * @param {string | string[]} layoutIds  - ID layout yang di-subscribe
 *
 * Supabase Realtime filter: row-level filter `layout_id=eq.{id}`
 * Untuk 2 layout (view global), buat 2 channel terpisah.
 */
export function useRealtimeSeats(layoutIds) {
  const [isConnected, setIsConnected] = useState(false);
  const channelsRef = useRef([]);
  const { applyRealtimeUpdate } = useSeatStore();

  const ids = Array.isArray(layoutIds) ? layoutIds : [layoutIds];

  useEffect(() => {
    if (!ids.length || ids.some(id => !id)) return;

    // Buat channel per layoutId
    const channels = ids.map(layoutId => {
      const channel = supabase
        .channel(`seats-${layoutId}`)
        .on(
          'postgres_changes',
          {
            event:  'UPDATE',        // hanya UPDATE — is_checked berubah
            schema: 'public',
            table:  'seats',
            filter: `layout_id=eq.${layoutId}`,
          },
          (payload) => {
            // payload.new = seluruh baris yang baru diupdate
            applyRealtimeUpdate(payload.new);
          }
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
        });

      return channel;
    });

    channelsRef.current = channels;

    return () => {
      // Unsubscribe saat komponen unmount
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [ids.join(',')]);

  return { isConnected };
}
```

### Alur Realtime Lengkap

```
Operator A tap kursi K_01
  ↓
checkSeat('uuid-k01', true)          ← panggil lib/seats.js
  ↓
supabase.from('seats')
  .update({ is_checked: true })
  .eq('id', 'uuid-k01')
  ↓
PostgreSQL UPDATE terjadi
  ↓
Supabase Realtime mendeteksi WAL change
  ↓
Broadcast payload ke semua subscriber channel "seats-{maleLayoutId}"
  ↓
Operator B, C, D menerima payload.new
  ↓
applyRealtimeUpdate(payload.new) → update Zustand store
  ↓
SeatCell re-render (React.memo hanya update yg berubah)
  ↓
Animasi pulse + kursi tampil ✓
```

**Latency:** Supabase Realtime via WebSocket biasanya < 200ms dalam kondisi normal.

---

## 3.2 Halaman View — Dual Layout

### `app/(main)/view/page.jsx`

```jsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSeatStore, useLayoutStore } from '@/store';
import { useRealtimeSeats } from '@/lib/hooks/useRealtimeSeats';
import { DualLayoutView } from '@/components/layout/DualLayoutView';

export default function ViewPage() {
  const { layouts, categories } = useLayoutStore();
  const { seats } = useSeatStore();
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedSeat, setSelectedSeat] = useState(null); // untuk popup info

  const maleLayoutId   = layouts.male?.id;
  const femaleLayoutId = layouts.female?.id;

  // Subscribe realtime ke KEDUA layout
  const { isConnected } = useRealtimeSeats(
    [maleLayoutId, femaleLayoutId].filter(Boolean)
  );

  return (
    <div className="flex flex-col h-screen pb-16">
      <ConnectionBanner isConnected={isConnected} />

      {/* Stage */}
      <StageBar label={config?.stage_label ?? 'STAGE'} />

      {/* Filter chips */}
      <FilterChips
        categories={[...categories.male, ...categories.female]}
        active={activeFilter}
        onChange={setActiveFilter}
      />

      {/* Dual layout */}
      <div className="flex-1 overflow-auto">
        <DualLayoutView
          maleSeats={Object.values(seats.male)}
          femaleSeats={Object.values(seats.female)}
          maleLayout={layouts.male}
          femaleLayout={layouts.female}
          maleCategories={categories.male}
          femaleCategories={categories.female}
          activeFilter={activeFilter}
          onSeatTap={(seat, gender) => setSelectedSeat({ ...seat, gender })}
          mode="view"
        />
      </div>

      {/* Export button */}
      <button
        className="fixed right-4 bottom-20 w-12 h-12 rounded-full bg-accent
                   flex items-center justify-center shadow-lg"
        onClick={exportPNG}
      >📷</button>

      {/* Popup info kursi */}
      {selectedSeat && (
        <SeatInfoModal seat={selectedSeat} onClose={() => setSelectedSeat(null)} />
      )}
    </div>
  );
}
```

### Tampilan Dual Layout

```
              ▓▓▓▓▓ STAGE ▓▓▓▓▓

 T S R Q P O N M L K  │  J I H G F E D C B A
①[■][■][■]...[■][■][■]│[■][■][■]...[■][■][■]①
②[■][✓][■]...[■][✓][■]│[■][■][✓]...[■][■][■]②
                PRIA   │   WANITA
```

---

## 3.3 Filter Per Kategori

```jsx
// Filter seats — kursi kategori lain ditampilkan redup (bukan hilang)
const filterSeats = (seats, filter) => {
  if (filter === 'all') return seats;
  return seats.map(s => ({
    ...s,
    _dimmed: s.category_id !== filter,
  }));
};

// Di SeatCell, tambahkan opacity jika _dimmed
const opacity = seat._dimmed ? 'opacity-20' : '';
```

Chip filter menampilkan count per kategori:
```
[Semua (200)] [VIP (60)] [Regular (100)] [VVIP (40)]
```

---

## 3.4 Popup Info Kursi

```
┌────────────────────────────────┐
│  Kursi K_03                    │
│  ──────────────────────────    │
│  Layout     Pria               │
│  Kategori   ■ VIP              │
│  Status     ✓ Sudah hadir      │
│  Dicatat    09:43:12           │
│                                │
│                  [Tutup]       │
└────────────────────────────────┘
```

---

## 3.5 Halaman Check — Pilih Layout

### `app/(main)/check/page.jsx`

```
┌─────────────────────────────────┐
│  Mode Centang                   │
│                                 │
│  ┌────────────────┐  ┌────────┐ │
│  │     🔵         │  │  🩷   │ │
│  │    PRIA        │  │ WANITA │ │
│  │   47 / 100     │  │ 12/100 │ │
│  │  ████░░  47%   │  │ █░ 12% │ │
│  └────────────────┘  └────────┘ │
└─────────────────────────────────┘
```

Statistik di sini dihitung dari Zustand store (real-time, tanpa fetch ulang).

---

## 3.6 Check Mode Per Layout

### `app/(main)/check/[gender]/page.jsx`

```jsx
'use client';
import { useRealtimeSeats } from '@/lib/hooks/useRealtimeSeats';
import { checkSeat } from '@/lib/seats';
import { useSeatStore } from '@/store/useSeatStore';

export default function CheckPage({ params }) {
  const gender = params.gender;   // "male" | "female"
  const layout = useLayoutStore(s => s.layouts[gender]);
  const seats  = useSeatStore(s => Object.values(s.seats[gender] ?? {}));

  // Subscribe realtime untuk layout ini
  const { isConnected } = useRealtimeSeats(layout?.id);

  const handleSeatTap = async (seatId) => {
    const seat = useSeatStore.getState().seats[gender][seatId];
    if (!seat || seat.is_empty) return;

    const newChecked = !seat.is_checked;

    // Optimistic update — UI berubah sebelum server konfirmasi
    useSeatStore.getState().updateSeat(seatId, gender, {
      is_checked: newChecked,
      checked_at: newChecked ? new Date().toISOString() : null,
    });

    // Update ke Supabase — ini yang trigger Realtime ke operator lain
    try {
      await checkSeat(seatId, newChecked);
    } catch {
      // Rollback jika gagal
      useSeatStore.getState().updateSeat(seatId, gender, {
        is_checked: !newChecked,
        checked_at: null,
      });
      toast.error('Gagal update kursi');
    }
  };

  return (
    <div className="flex flex-col h-screen pb-16">
      <ConnectionBanner isConnected={isConnected} />
      <CheckCounter seats={seats} />
      <FilterChips ... />
      <StageBar />
      <SeatGrid
        seats={seats}
        layout={layout}
        categories={categories[gender]}
        mode="check"
        onSeatAction={(id, action) => action === 'click' && handleSeatTap(id)}
      />
    </div>
  );
}
```

### Tampilan Check Mode

```
┌──────────────────────────────────────┐
│  ✓ 47 / 100    ████████░░░░░░  47%  │
├──────────────────────────────────────┤
│  [Semua] [VIP] [Regular] [VVIP]     │
├──────────────────────────────────────┤
│          ▓▓▓ STAGE ▓▓▓               │
│                                      │
│  K  L  M  N  O  P  Q  R  S  T      │
│ ①[■][✓][■][■][■][■][✓][■][■][■] ①  │
│ ②[■][■][■][■][■][■][■][■][■][■] ②  │
│                                      │
├──────────────────────────────────────┤
│  🟢 Live                              │
└──────────────────────────────────────┘
```

---

## 3.7 Animasi Update dari Operator Lain

`applyRealtimeUpdate` di Zustand sudah memanggil `triggerAnimation`. Di `SeatCell`, cukup subscribe ke `animatingSeats`:

```jsx
const isAnimating = useSeatStore(s => s.animatingSeats.has(seat.id));

<button className={`... ${isAnimating ? 'animate-seat-pulse' : ''}`} />
```

```css
/* globals.css */
@keyframes seat-pulse {
  0%   { box-shadow: 0 0 0 0   rgba(99,102,241,0.8); }
  70%  { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
  100% { box-shadow: 0 0 0 0   rgba(99,102,241,0); }
}
.animate-seat-pulse { animation: seat-pulse 0.7s ease-out; }
```

Operator yang melakukan check sendiri juga menerima Realtime event (karena subscribe ke channel yang sama) — ini tidak masalah, `applyRealtimeUpdate` hanya menimpa dengan data yang sama sehingga tidak ada perubahan visual (data sudah diupdate secara optimistic).

---

## 3.8 Handling Disconnect & Reconnect

### Supabase Realtime Auto-reconnect

Supabase JS client handle reconnect otomatis. Status channel bisa dipantau:

```js
channel.subscribe((status, err) => {
  // status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'
  setIsConnected(status === 'SUBSCRIBED');
  if (err) console.error('Realtime error:', err);
});
```

### Re-sync saat Reconnect

Saat koneksi putus lalu kembali, ada kemungkinan update terlewat. Saat `SUBSCRIBED` kembali, fetch ulang semua kursi:

```js
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    setIsConnected(true);
    // Re-fetch snapshot terbaru
    const { data } = await supabase
      .from('seats')
      .select('*')
      .eq('layout_id', layoutId);
    if (data) useSeatStore.getState().setSeats(gender, data, layoutId);
  } else {
    setIsConnected(false);
  }
});
```

### Connection Banner

```jsx
export function ConnectionBanner({ isConnected }) {
  if (isConnected) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-yellow-500/90 backdrop-blur-sm
                    text-black text-sm font-semibold text-center py-2.5 animate-pulse">
      ⚠️ Koneksi terputus — mencoba menyambung kembali...
    </div>
  );
}
```

---

## 3.9 Counter & Statistik Live

Dihitung dari Zustand store — update otomatis setiap kali store berubah.

```js
// Di halaman check/[gender]
const seats = useSeatStore(s => Object.values(s.seats[gender] ?? {}));

const stats = useMemo(() => {
  const active   = seats.filter(s => !s.is_empty);
  const checked  = active.filter(s => s.is_checked);
  const pct      = active.length > 0
    ? Math.round(checked.length / active.length * 100) : 0;
  return { total: active.length, checked: checked.length, pct };
}, [seats]);
```

### Progress Bar Animasi
```jsx
<motion.div
  className="h-2 bg-green-500 rounded-full"
  animate={{ width: `${stats.pct}%` }}
  transition={{ duration: 0.4, ease: 'easeOut' }}
/>
```

### Stats per Kategori
```js
const byCategory = useMemo(() =>
  categories.map(cat => ({
    ...cat,
    total:   seats.filter(s => s.category_id === cat.id && !s.is_empty).length,
    checked: seats.filter(s => s.category_id === cat.id && s.is_checked).length,
  })),
[seats, categories]);
```

---

## 3.10 Dashboard Lengkap

```
┌──────────────────────────────────────┐
│  🎬 SeatPlotter                      │
│  Seminar Nasional 2026               │
│  📅 12 Juli 2026  •  📍 Gedung       │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │  🔵 PRIA          47/100  47% │  │
│  │  ████████░░░░░░░░░░           │  │
│  │  VIP: 47/60  Regular: 0/40    │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  🩷 WANITA        12/100  12% │  │
│  │  ██░░░░░░░░░░░░░░░░           │  │
│  │  VIP: 12/60  Regular: 0/40    │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  🟢 Live                             │
├──────────────────────────────────────┤
│  [⚙️ Edit Event]  [✅ Mulai Centang] │
└──────────────────────────────────────┘
```

Dashboard juga subscribe Realtime ke kedua layout agar statistik update meski operator di halaman ini.

---

## 3.11 Pinch-to-Zoom & Pan

### `lib/hooks/useZoomPan.js`

```js
export function useZoomPan(gridRef) {
  const scale     = useRef(1);
  const offset    = useRef({ x: 0, y: 0 });
  const lastTouch = useRef([]);

  const apply = () => {
    if (!gridRef.current) return;
    gridRef.current.style.transform =
      `translate(${offset.current.x}px, ${offset.current.y}px) scale(${scale.current})`;
    gridRef.current.style.transformOrigin = 'top left';
  };

  const onTouchStart = (e) => { lastTouch.current = Array.from(e.touches); };

  const onTouchMove = (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      const [la, lb] = lastTouch.current;
      if (!la || !lb) return;
      const prev = Math.hypot(lb.clientX - la.clientX, lb.clientY - la.clientY);
      const curr = Math.hypot(b.clientX  - a.clientX,  b.clientY  - a.clientY);
      scale.current = Math.min(3, Math.max(0.4, scale.current * (curr / prev)));
    } else if (e.touches.length === 1 && lastTouch.current.length === 1) {
      offset.current.x += e.touches[0].clientX - lastTouch.current[0].clientX;
      offset.current.y += e.touches[0].clientY - lastTouch.current[0].clientY;
    }
    lastTouch.current = Array.from(e.touches);
    apply();
  };

  const reset = () => {
    scale.current = 1;
    offset.current = { x: 0, y: 0 };
    apply();
  };

  return { onTouchStart, onTouchMove, reset };
}
```

---

## 🧪 Definition of Done — Phase 3

- [ ] View mode: pria & wanita berdampingan, header & label baris benar
- [ ] Filter kategori → kursi lain redup, bukan hilang
- [ ] Tap kursi di view → popup info (label, layout, kategori, waktu)
- [ ] Check mode: tap → ✓ muncul, kursi redup
- [ ] Buka 2 tab browser → centang di tab 1 → tab 2 update < 1 detik
- [ ] Matikan WiFi → banner kuning muncul
- [ ] Nyalakan → reconnect → re-fetch snapshot, state sync
- [ ] Counter update real-time tanpa refresh halaman
- [ ] Progress bar animasi smooth
- [ ] Dashboard stats update saat operator lain check-in
- [ ] Pinch-to-zoom berjalan di mobile

---

## ⚠️ Catatan Teknis

- **Supabase Realtime filter** `layout_id=eq.{id}` bekerja di level server — hanya baris yang sesuai yang dikirim ke client. Efisien untuk 500+ baris.
- **Optimistic update + Realtime**: operator yang melakukan check akan menerima Realtime event dari dirinya sendiri. Ini normal — `applyRealtimeUpdate` menimpa state yang sudah sama, tidak ada efek visible.
- **Supabase Realtime free tier**: 2 juta pesan/bulan. Dengan 20 operator × 500 check × 20 subscribers = 200.000 event — masih jauh di bawah limit.
- **`SUBSCRIBED` status** = koneksi WebSocket aktif dan channel berhasil di-join. Status `TIMED_OUT`/`CLOSED` = koneksi bermasalah, perlu reconnect.
- Jangan buat terlalu banyak channel Supabase — free tier maks 100 channel concurrent. Satu channel per layoutId (= 2 channel untuk view global) sudah lebih dari cukup.
