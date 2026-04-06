# Phase 4 — Polish & Deployment

> **Estimasi:** 2 hari  
> **Goal:** Aplikasi siap produksi — performa optimal, UI halus, error handling lengkap, export tersedia, dan ter-deploy ke **Vercel** dengan Supabase.

---

## ✅ Checklist Phase 4

- [ ] 4.1 Optimasi performa grid
- [ ] 4.2 Loading skeleton & empty states
- [ ] 4.3 Toast notification system
- [ ] 4.4 Error boundary & error handling global
- [ ] 4.5 Animasi transisi & micro-interactions
- [ ] 4.6 Export layout screenshot (PNG)
- [ ] 4.7 Export / Import data JSON
- [ ] 4.8 Responsive desktop view
- [ ] 4.9 PWA — installable di mobile
- [ ] 4.10 Environment variables Vercel
- [ ] 4.11 Deployment ke Vercel
- [ ] 4.12 UptimeRobot setup (anti-pause Supabase)

---

## 4.1 Optimasi Performa Grid

### Strategi Berlapis

**Layer 1 — `React.memo` + custom comparator per SeatCell**
Hanya re-render jika `is_checked`, `category_id`, `is_empty`, atau `label` berubah.

**Layer 2 — Zustand selector granular**
```js
// Subscribe hanya ke satu seat
const seat = useSeatStore(
  useCallback(s => s.seats[gender]?.[seatId], [gender, seatId])
);
```

**Layer 3 — Virtualisasi baris**
`@tanstack/react-virtual` hanya render baris yang terlihat di viewport.

**Layer 4 — Optimistic update**
UI berubah sebelum Supabase konfirmasi → terasa instan.

**Layer 5 — Supabase Realtime filter server-side**
Filter `layout_id=eq.{id}` di Supabase berarti hanya event yang relevan yang dikirim — tidak ada client-side filtering yang sia-sia.

### Benchmark Target

| Aksi | Target |
|---|---|
| Initial render 500+ kursi | < 300ms |
| Tap check (optimistic) | < 16ms |
| Supabase Realtime → UI update | < 300ms |
| Drag assign 30 kursi | < 100ms |

---

## 4.2 Loading Skeleton & Empty States

### Skeleton Grid
```jsx
function SeatGridSkeleton({ rows = 10, cols = 10 }) {
  return (
    <div className="flex flex-col gap-1 p-4 animate-pulse">
      <div className="flex gap-1 pl-[31px]">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="w-[34px] h-7 rounded-full bg-white/10" />
        ))}
      </div>
      {Array.from({ length: Math.min(rows, 8) }).map((_, r) => (
        <div key={r} className="flex items-center gap-1">
          <div className="w-7 h-[34px] rounded-full bg-white/10" />
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="w-[34px] h-[34px] rounded-md bg-white/10" />
          ))}
          <div className="w-7 h-[34px] rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  );
}
```

### Empty States

| Kondisi | Tampilan |
|---|---|
| Layout belum di-generate | Banner kuning + CTA "Buat Layout" |
| Tidak ada kategori | Banner oranye + CTA "Tambah Kategori" |
| Semua kursi di-check | 🎉 Konfeti + "Semua peserta hadir!" |
| Supabase error | Error boundary + tombol retry |

---

## 4.3 Toast System

```js
// lib/hooks/useToast.js
import { create } from 'zustand';

const useToastStore = create((set) => ({
  toasts: [],
  add: (toast) => {
    const id = Date.now();
    set(s => ({ toasts: [...s.toasts.slice(-2), { id, ...toast }] }));
    if (toast.duration !== 0) {
      setTimeout(
        () => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
        toast.duration ?? 3000
      );
    }
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

export const useToast = () => {
  const add = useToastStore(s => s.add);
  return {
    toast: {
      success: (msg, opts) => add({ type: 'success', message: msg, ...opts }),
      error:   (msg, opts) => add({ type: 'error',   message: msg, ...opts }),
      warning: (msg, opts) => add({ type: 'warning', message: msg, duration: 0, ...opts }),
      info:    (msg, opts) => add({ type: 'info',    message: msg, ...opts }),
    }
  };
};
```

---

## 4.4 Error Handling Global

### Error Boundary
```jsx
'use client';
import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold text-white">Terjadi Kesalahan</h2>
        <p className="text-secondary text-sm">{this.state.error?.message}</p>
        <button className="px-6 py-2 bg-accent rounded-lg text-white"
          onClick={() => window.location.reload()}>
          Muat Ulang
        </button>
      </div>
    );
    return this.props.children;
  }
}
```

### Supabase Error Handling Pattern

```js
// Gunakan helper ini di semua query Supabase
export async function safeQuery(queryFn) {
  const result = await queryFn();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// Contoh usage
const layouts = await safeQuery(() =>
  supabase.from('layouts').select('*')
);
```

---

## 4.5 Animasi & Micro-interactions

### Page Transitions
```jsx
const variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.12 } },
};
```

### Tabel Micro-interactions

| Elemen | Animasi | Durasi |
|---|---|---|
| Tap kursi | `scale(0.85)` bounce | 150ms |
| Kursi jadi ✓ | ✓ scale in + fade | 200ms |
| Realtime update orang lain | Pulse ring indigo | 700ms |
| Progress bar | Width animate | 400ms |
| Toast | Slide up + fade | 250ms |
| Modal | Scale 95%→100% | 200ms |
| Konfeti semua hadir | Particle burst | 2s |

---

## 4.6 Export PNG

```js
import html2canvas from 'html2canvas';

export async function exportLayoutPNG(eventName) {
  const el = document.getElementById('export-layout');
  if (!el) return;

  const canvas = await html2canvas(el, {
    backgroundColor: '#0F0F0F',
    scale: 2,
    useCORS: true,
    width:  el.scrollWidth,
    height: el.scrollHeight,
    windowWidth:  el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  const link = document.createElement('a');
  link.download = `denah-${eventName.replace(/\s+/g, '-')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
```

---

## 4.7 Export / Import JSON

### Export — `GET /api/export`
```js
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const [config, layouts, categories, seats] = await Promise.all([
    supabaseAdmin.from('config').select('*').single(),
    supabaseAdmin.from('layouts').select('*'),
    supabaseAdmin.from('categories').select('*'),
    supabaseAdmin.from('seats').select('*'),
  ]);

  const exportData = {
    config:     config.data,
    layouts:    layouts.data,
    categories: categories.data,
    seats:      seats.data,
    exportedAt: new Date().toISOString(),
    version:    '1.0',
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="seatplotter-${Date.now()}.json"`,
    },
  });
}
```

### Import — `POST /api/import`
```js
export async function POST(req) {
  const body = await req.json();

  // Validasi struktur
  if (!body.config || !body.layouts || !body.categories || !body.seats) {
    return Response.json({ success: false, error: 'Format tidak valid' }, { status: 400 });
  }

  // Hapus data lama (kecuali layouts — hanya ada 2, cukup update)
  await supabaseAdmin.from('seats').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Remap ID: buat mapping old_id → new_id
  const layoutIdMap    = {};
  const categoryIdMap  = {};

  // Upsert layouts (gunakan gender sebagai key)
  for (const layout of body.layouts) {
    const { id: oldId, ...data } = layout;
    const { data: saved } = await supabaseAdmin
      .from('layouts')
      .upsert({ ...data }, { onConflict: 'gender' })
      .select().single();
    layoutIdMap[oldId] = saved.id;
  }

  // Insert categories dengan ID baru
  for (const cat of body.categories) {
    const { id: oldId, layout_id, ...data } = cat;
    const { data: saved } = await supabaseAdmin
      .from('categories')
      .insert({ ...data, layout_id: layoutIdMap[layout_id] })
      .select().single();
    categoryIdMap[oldId] = saved.id;
  }

  // Batch insert seats (chunk 200)
  const remappedSeats = body.seats.map(({ id, layout_id, category_id, ...data }) => ({
    ...data,
    layout_id:   layoutIdMap[layout_id],
    category_id: category_id ? categoryIdMap[category_id] : null,
  }));

  const CHUNK = 200;
  for (let i = 0; i < remappedSeats.length; i += CHUNK) {
    await supabaseAdmin.from('seats').insert(remappedSeats.slice(i, i + CHUNK));
  }

  // Update config
  const { id: _cid, ...configData } = body.config;
  await supabaseAdmin.from('config').update(configData).neq('id', '');

  return Response.json({
    success: true,
    data: { layouts: body.layouts.length, categories: body.categories.length, seats: body.seats.length }
  });
}
```

---

## 4.8 Responsive Desktop

| Elemen | Mobile | Desktop (>1024px) |
|---|---|---|
| Navigasi | Bottom tab bar | Sidebar kiri vertikal |
| Grid | Full width, scroll | Centered, max-w-6xl |
| Kursi | 34×34px | 42×42px |
| Panel info kursi | Modal fullscreen | Panel samping kanan |

---

## 4.9 PWA

### `app/manifest.json`
```json
{
  "name": "SeatPlotter",
  "short_name": "SeatPlotter",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0F0F0F",
  "theme_color": "#6366F1",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

---

## 4.10 Environment Variables di Vercel

```
NEXT_PUBLIC_SUPABASE_URL         = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    = eyJ...  (aman diexpose)
SUPABASE_SERVICE_ROLE_KEY        = eyJ...  (RAHASIA, tanpa NEXT_PUBLIC_)
```

---

## 4.11 Deployment ke Vercel

### Persiapan

```bash
# Push ke GitHub
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/user/seatplotter.git
git push -u origin main
```

### Deploy

1. Buka [vercel.com](https://vercel.com) → **New Project** → Import dari GitHub
2. Pilih repo `seatplotter`
3. Framework: **Next.js** (auto-detected)
4. Tambahkan 3 environment variables (lihat 4.10)
5. **Deploy!**

### `vercel.json`
```json
{
  "functions": {
    "app/api/seats/generate/route.js": { "maxDuration": 30 },
    "app/api/import/route.js":         { "maxDuration": 30 }
  }
}
```

> Generate 500+ kursi dan import JSON bisa >10 detik — extend timeout ke 30 detik.

### Supabase Realtime di Vercel

Karena Realtime menggunakan WebSocket dari **browser ke Supabase** (bukan dari Vercel server), tidak ada masalah kompatibilitas. Vercel hanya menangani HTTP requests (API routes), WebSocket Realtime berjalan langsung antara browser dan Supabase.

```
Browser ←──WebSocket──▶ Supabase Realtime   ✅ Tidak melalui Vercel
Browser ←────HTTP────▶ Vercel API Routes    ✅ Serverless-compatible
Vercel  ←────HTTP────▶ Supabase PostgREST   ✅ Standard HTTP
```

---

## 4.12 UptimeRobot — Anti-pause Supabase

Supabase free tier pause project setelah **7 hari tidak aktif**. Solusi: ping otomatis setiap hari.

### Setup UptimeRobot

1. Daftar gratis di [uptimerobot.com](https://uptimerobot.com)
2. **Add New Monitor**:
   - Monitor Type: **HTTP(s)**
   - URL: `https://seatplotter.vercel.app/api/health`
   - Monitoring Interval: **1 day (1440 minutes)**
3. Simpan → UptimeRobot ping URL setiap hari

Ini juga berfungsi sebagai monitoring uptime — dapat notifikasi email jika app down.

---

## Checklist Pre-Launch

### Fungsionalitas
- [ ] Generate pria (K, 10 kolom, normal) → header: `K L M N O P Q R S T`
- [ ] Generate wanita (A, 10 kolom, reverse) → header: `J I H G F E D C B A`
- [ ] Preview header update real-time saat form berubah
- [ ] Checkbox Reverse Kolom → preview seketika berubah
- [ ] Edit label kursi manual → tersimpan
- [ ] Assign tap & drag → tersimpan di Supabase
- [ ] View dual layout tampil berdampingan
- [ ] Check mode: tap → semua operator lain update < 1 detik
- [ ] Disconnect → reconnect → state sync
- [ ] Export PNG beresolusi tinggi
- [ ] Export JSON → Import JSON → data sama

### Performa
- [ ] Initial load < 3 detik (4G)
- [ ] Grid 500+ kursi scroll 60fps
- [ ] Supabase Realtime latency < 500ms

### Deployment
- [ ] 3 env vars tersimpan di Vercel
- [ ] `GET /api/health` → `{ status: "ok" }` di production
- [ ] Supabase Realtime aktif di tabel `seats`
- [ ] UptimeRobot aktif, sudah ping pertama kali
- [ ] PWA bisa di-install dari Chrome Android

---

## 🎉 Pengembangan Selanjutnya

- **Supabase Database Functions** — generate kursi via RPC call (1 request, gantikan chunking)
- **QR Check-in** — scan QR untuk auto-centang
- **Supabase Storage** — simpan export PNG langsung ke cloud
- **Riwayat check-in** — tabel `check_logs` dengan timestamp per perubahan
- **Presence** — tampilkan siapa saja yang sedang online via Supabase Presence
- **Multi-section** — lebih dari 2 layout
