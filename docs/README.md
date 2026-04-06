# 🎬 SeatPlotter — Master Plan (Revised v3)

> Aplikasi web plotting kursi untuk 1 event, dengan 2 layout terpisah (Pria & Wanita), berbasis **Next.js + Supabase**, dapat di-deploy ke **Vercel**. Database, realtime, dan storage dalam satu layanan.

---

## 📋 Daftar Dokumen

| File | Isi |
|---|---|
| `README.md` | Dokumen ini — overview, arsitektur, schema, konvensi |
| `phase-1-foundation.md` | Setup project, Supabase, tabel, RLS, seed data |
| `phase-2-editor.md` | Grid builder, Reverse Kolom, kategori, assign kursi |
| `phase-3-view-check.md` | View mode, check-in, Supabase Realtime |
| `phase-4-polish.md` | Performa, animasi, export, deployment Vercel |

---

## 🎯 Ringkasan Produk

### Konteks
- **User:** Operator / panitia event — **tanpa login, tanpa autentikasi**
- **Event:** 1 event aktif
- **Layout:** 2 layout — **Pria** dan **Wanita**, masing-masing punya grid sendiri
- **Skala:** 500+ kursi per layout
- **Realtime:** Supabase Realtime (built-in, otomatis dari perubahan database)
- **Concurrent:** 6–20 operator centang bersamaan

### Kenapa Supabase?

Supabase menggantikan **MongoDB Atlas + Pusher sekaligus** dalam satu layanan:

```
MongoDB + Pusher (sebelumnya):       Supabase (sekarang):
────────────────────────────         ────────────────────
Mongoose models                      Supabase JS client
Pusher server SDK                    (tidak perlu)
Pusher client SDK                    (tidak perlu)
/api/seats/check + trigger           /api/seats/check saja
                                     Realtime otomatis dari DB
```

Alur realtime yang jauh lebih simpel:
```
Operator tap kursi
  ↓
PATCH /api/seats/check  →  UPDATE seats SET is_checked = true
                                    ↓
                           Supabase Realtime mendeteksi perubahan baris
                                    ↓
                           Broadcast ke semua client yang subscribe
                                    ↓
                           Semua operator update < 500ms
```

---

## 📐 Format Nomor Kursi

```
Format: [HURUF_KOLOM]_[NOMOR_BARIS_2DIGIT]
Contoh: A_01  K_03  T_06
```

### Opsi "Reverse Kolom"

| | Header (kiri → kanan) | Contoh A, 10 kolom |
|---|---|---|
| ☐ Normal | A B C D E F G H I J | A di kiri |
| ☑ Reverse | J I H G F E D C B A | A di kanan (sesuai gambar) |

---

## 🏗️ Arsitektur Sistem

```
┌────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                     │
│                                                         │
│  Next.js App (React)                                    │
│  ├── Pages & Components                                 │
│  ├── Zustand Store                                      │
│  └── supabase-js  ──────────────────────────────┐      │
└──────────────────────┬──────────────────────────│──────┘
                       │ HTTP (REST via supabase)  │ WebSocket (Realtime)
                       ▼                           ▼
┌────────────────────────────────────────────────────────┐
│                      SUPABASE                           │
│                                                         │
│  ┌─────────────────┐    ┌──────────────────────────┐   │
│  │   PostgreSQL DB  │    │     Realtime Engine       │   │
│  │   ─────────────  │───▶│   (mendengarkan WAL)     │   │
│  │   config         │    │   broadcast ke subscriber │   │
│  │   layouts        │    └──────────────────────────┘   │
│  │   categories     │                                    │
│  │   seats          │    ┌──────────────────────────┐   │
│  └─────────────────┘    │  PostgREST (Auto REST API)│   │
│                          │  (digunakan Next.js)      │   │
│                          └──────────────────────────┘   │
└────────────────────────────────────────────────────────┘
          ▲
          │ deploy
┌─────────────────┐
│  Next.js (Vercel)│
│  API Routes      │
│  (serverless)    │
└─────────────────┘
```

---

## 🗄️ Database Schema (PostgreSQL)

Semua tabel dibuat via Supabase SQL Editor atau Migration.

### Tabel: `config`
```sql
CREATE TABLE config (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name  text NOT NULL DEFAULT 'Event Saya',
  event_date  date,
  event_venue text DEFAULT '',
  stage_label text NOT NULL DEFAULT 'STAGE',
  updated_at  timestamptz DEFAULT now()
);
```

### Tabel: `layouts`
```sql
CREATE TABLE layouts (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gender         text NOT NULL UNIQUE CHECK (gender IN ('male', 'female')),
  label          text NOT NULL,               -- "Pria" | "Wanita"
  rows           int  NOT NULL DEFAULT 10,
  cols           int  NOT NULL DEFAULT 10 CHECK (cols <= 26),
  col_start_char char(1) NOT NULL DEFAULT 'A',
  reverse_col    boolean NOT NULL DEFAULT false,
  updated_at     timestamptz DEFAULT now()
);
```

### Tabel: `categories`
```sql
CREATE TABLE categories (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  layout_id  uuid NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#6366F1',
  "order"    int  NOT NULL DEFAULT 0
);
```

### Tabel: `seats`
```sql
CREATE TABLE seats (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  layout_id    uuid NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  row          int  NOT NULL,
  col          int  NOT NULL,
  label        text NOT NULL,
  category_id  uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_empty     boolean NOT NULL DEFAULT false,
  is_checked   boolean NOT NULL DEFAULT false,
  checked_at   timestamptz,
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (layout_id, row, col)
);

-- Index untuk performa
CREATE INDEX idx_seats_layout    ON seats (layout_id);
CREATE INDEX idx_seats_checked   ON seats (layout_id, is_checked);
CREATE INDEX idx_seats_row_col   ON seats (layout_id, row, col);
```

---

## 🔐 Row Level Security (RLS)

Karena aplikasi ini tidak menggunakan autentikasi, semua operasi harus diizinkan secara publik. RLS tetap diaktifkan (best practice Supabase) tapi dengan policy yang mengizinkan semua akses.

```sql
-- Aktifkan RLS pada semua tabel
ALTER TABLE config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE layouts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats      ENABLE ROW LEVEL SECURITY;

-- Policy: izinkan semua operasi untuk semua user (public)
CREATE POLICY "public_all" ON config     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON layouts    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON seats      FOR ALL USING (true) WITH CHECK (true);
```

> Gunakan **`anon` key** (bukan `service_role` key) di client — ini key publik yang aman diexpose ke browser.

---

## ⚡ Supabase Realtime

### Cara Kerja
Supabase Realtime mendengarkan **Write-Ahead Log (WAL)** PostgreSQL. Setiap INSERT/UPDATE/DELETE pada tabel yang di-enable Realtime akan otomatis di-broadcast ke semua subscriber yang sesuai filter-nya.

### Enable Realtime pada Tabel `seats`
```sql
-- Di Supabase Dashboard: Table Editor → seats → Enable Realtime
-- Atau via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE seats;
```

> Hanya tabel `seats` yang perlu Realtime — tabel lain tidak berubah saat event berlangsung.

### Subscribe di Client
```js
// Subscribe perubahan kursi layout pria
const channel = supabase
  .channel('seats-male')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'seats',
      filter: `layout_id=eq.${maleLayoutId}`,
    },
    (payload) => {
      // payload.new = data baris terbaru
      updateSeatInStore(payload.new);
    }
  )
  .subscribe();
```

### Supabase Realtime Free Tier
```
Pesan/bulan:           2.000.000
Concurrent connections: 200
Max channels:          100
```

Jauh lebih besar dari Pusher free tier (200k/hari).

---

## 🔌 API Routes

Dengan Supabase, API routes menjadi lebih tipis — sebagian operasi bisa dilakukan langsung dari client menggunakan `supabase-js`. Namun untuk operasi yang butuh logika bisnis (validasi, generate massal), tetap gunakan API routes.

### Operasi via API Route (server-side)
```
POST   /api/seats/generate        Generate ratusan kursi (batch insert)
POST   /api/import                Import JSON backup
GET    /api/export                Export seluruh data
GET    /api/health                Health check
```

### Operasi via Supabase Client Langsung (client-side)
```
config     → supabase.from('config').select/update
layouts    → supabase.from('layouts').select/update
categories → supabase.from('categories').select/insert/update/delete
seats      → supabase.from('seats').select/update (single/bulk)
```

> Ini bisa karena RLS mengizinkan akses publik. Tidak perlu API route sebagai proxy untuk setiap operasi CRUD.

---

## 📁 Struktur Folder

```
seatplotter/
├── next.config.js
├── package.json
├── .env.local
│
├── app/
│   ├── layout.jsx
│   ├── page.jsx                       → redirect /dashboard
│   ├── (main)/
│   │   ├── layout.jsx                 ← bottom nav
│   │   ├── dashboard/page.jsx
│   │   ├── editor/
│   │   │   ├── page.jsx               ← pilih layout
│   │   │   └── [gender]/page.jsx      ← wizard 3 step
│   │   ├── view/page.jsx
│   │   └── check/
│   │       ├── page.jsx
│   │       └── [gender]/page.jsx
│   └── api/
│       ├── seats/
│       │   └── generate/route.js      ← batch insert via service role
│       ├── export/route.js
│       ├── import/route.js
│       └── health/route.js
│
├── components/
│   ├── ui/
│   ├── seat/
│   │   ├── SeatGrid.jsx
│   │   ├── SeatCell.jsx
│   │   ├── SeatColHeader.jsx
│   │   ├── SeatRowLabel.jsx
│   │   └── SeatLegend.jsx
│   ├── editor/
│   │   ├── GridSetup.jsx
│   │   ├── CategoryManager.jsx
│   │   └── AssignPanel.jsx
│   └── layout/
│       ├── BottomNav.jsx
│       ├── StageBar.jsx
│       └── DualLayoutView.jsx
│
├── lib/
│   ├── supabase.js                    ← anon client (browser & server)
│   ├── supabase-admin.js              ← service role client (API routes only)
│   ├── utils.js                       ← generateLabel, getColHeaders
│   └── hooks/
│       ├── useRealtimeSeats.js        ← subscribe Supabase Realtime
│       └── useZoomPan.js
│
├── supabase/
│   └── migrations/
│       ├── 001_create_tables.sql
│       ├── 002_enable_rls.sql
│       └── 003_seed.sql
│
└── store/
    ├── useConfigStore.js
    ├── useLayoutStore.js
    └── useSeatStore.js
```

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "@supabase/supabase-js": "^2.x",
    "zustand": "^4.x",
    "tailwindcss": "^3.x",
    "framer-motion": "^11.x",
    "@tanstack/react-virtual": "^3.x",
    "html2canvas": "^1.4",
    "uuid": "^9.x"
  }
}
```

**Tidak ada lagi:** `mongoose`, `pusher`, `pusher-js`, `express`, `socket.io`

Dari 10+ dependencies → cukup 1 tambahan (`@supabase/supabase-js`).

---

## 🚀 Phases Overview

```
Phase 1 — Fondasi            (est. 2 hari)
  Setup Next.js, Supabase project, tabel, RLS, seed, Supabase client

Phase 2 — Editor             (est. 3–4 hari)
  Grid builder + Reverse Kolom, generate label, kategori, assign kursi

Phase 3 — View & Check       (est. 3 hari)
  Dual view, check mode, Supabase Realtime

Phase 4 — Polish & Deploy    (est. 2 hari)
  Performa, export, PWA, deploy Vercel
```

**Total estimasi: ~10–12 hari**
