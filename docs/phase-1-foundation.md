# Phase 1 — Fondasi & Infrastruktur

> **Estimasi:** 2 hari  
> **Goal:** Project Next.js berjalan, Supabase terkonfigurasi dengan tabel, RLS, dan seed data. Supabase client siap digunakan oleh semua phase berikutnya.

---

## ✅ Checklist Phase 1

- [ ] 1.1 Inisialisasi project Next.js
- [ ] 1.2 Buat Supabase project
- [ ] 1.3 Buat semua tabel via SQL Editor
- [ ] 1.4 Setup RLS policies
- [ ] 1.5 Enable Realtime pada tabel `seats`
- [ ] 1.6 Seed data awal (config + 2 layout)
- [ ] 1.7 Supabase client setup (anon + admin)
- [ ] 1.8 Test koneksi & query dasar
- [ ] 1.9 Bottom navigation
- [ ] 1.10 Halaman dashboard skeleton
- [ ] 1.11 Health check endpoint

---

## 1.1 Inisialisasi Project

```bash
npx create-next-app@latest seatplotter \
  --typescript=false \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"

cd seatplotter

npm install @supabase/supabase-js zustand framer-motion \
  @tanstack/react-virtual html2canvas uuid
```

### `.env.local`
```env
# Dari Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Service role key — JANGAN diexpose ke client (tidak pakai NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

| Key | Dipakai di | Aman diexpose? |
|---|---|---|
| `ANON_KEY` | Browser + server | ✅ Ya (dikontrol RLS) |
| `SERVICE_ROLE_KEY` | API Routes saja | ❌ Tidak (bypass RLS) |

---

## 1.2 Buat Supabase Project

1. Daftar di [supabase.com](https://supabase.com)
2. **New Project** → isi nama `seatplotter`, pilih region terdekat (Southeast Asia)
3. Tunggu provisioning (~2 menit)
4. Buka **Settings → API** → copy URL dan kedua keys ke `.env.local`

### Free Tier Limits
```
Database:              500MB
Realtime messages:     2 juta/bulan
Concurrent connections: 200
Inactivity pause:      setelah 7 hari tidak aktif
```

> **Solusi inactivity pause:** Daftarkan URL app ke UptimeRobot (gratis) untuk ping setiap hari.

---

## 1.3 Buat Tabel via SQL Editor

Buka **Supabase Dashboard → SQL Editor → New Query**, jalankan SQL berikut secara berurutan.

### Migration 001: Buat Tabel

```sql
-- =============================================
-- Tabel config: satu dokumen konfigurasi event
-- =============================================
CREATE TABLE IF NOT EXISTS config (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name  text        NOT NULL DEFAULT 'Event Saya',
  event_date  date,
  event_venue text        DEFAULT '',
  stage_label text        NOT NULL DEFAULT 'STAGE',
  updated_at  timestamptz DEFAULT now()
);

-- =============================================
-- Tabel layouts: tepat 2 baris (male & female)
-- =============================================
CREATE TABLE IF NOT EXISTS layouts (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  gender         text        NOT NULL UNIQUE CHECK (gender IN ('male', 'female')),
  label          text        NOT NULL,
  rows           int         NOT NULL DEFAULT 10 CHECK (rows BETWEEN 1 AND 50),
  cols           int         NOT NULL DEFAULT 10 CHECK (cols BETWEEN 1 AND 26),
  col_start_char char(1)     NOT NULL DEFAULT 'A',
  reverse_col    boolean     NOT NULL DEFAULT false,
  updated_at     timestamptz DEFAULT now()
);

-- =============================================
-- Tabel categories: kategori warna per layout
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  layout_id uuid NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  name      text NOT NULL,
  color     text NOT NULL DEFAULT '#6366F1',
  "order"   int  NOT NULL DEFAULT 0
);

-- =============================================
-- Tabel seats: semua kursi + status
-- =============================================
CREATE TABLE IF NOT EXISTS seats (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  layout_id   uuid        NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  row         int         NOT NULL,
  col         int         NOT NULL,
  label       text        NOT NULL,
  category_id uuid        REFERENCES categories(id) ON DELETE SET NULL,
  is_empty    boolean     NOT NULL DEFAULT false,
  is_checked  boolean     NOT NULL DEFAULT false,
  checked_at  timestamptz,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (layout_id, row, col)
);

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_seats_layout   ON seats (layout_id);
CREATE INDEX IF NOT EXISTS idx_seats_checked  ON seats (layout_id, is_checked);
CREATE INDEX IF NOT EXISTS idx_seats_position ON seats (layout_id, row, col);
```

---

## 1.4 Setup RLS Policies

### Migration 002: RLS

```sql
-- Aktifkan RLS pada semua tabel
ALTER TABLE config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE layouts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats      ENABLE ROW LEVEL SECURITY;

-- Policy: izinkan semua operasi untuk public (anon role)
-- Aman karena tidak ada data sensitif — ini aplikasi internal operator
CREATE POLICY "allow_public_all" ON config
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_public_all" ON layouts
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_public_all" ON categories
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "allow_public_all" ON seats
  FOR ALL TO anon USING (true) WITH CHECK (true);
```

---

## 1.5 Enable Realtime pada Tabel `seats`

### Via Supabase Dashboard
1. Buka **Table Editor → seats**
2. Klik toggle **Realtime** → aktifkan
3. Simpan

### Via SQL (alternatif)
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE seats;
```

> Hanya tabel `seats` yang perlu Realtime. Tabel `config`, `layouts`, dan `categories` tidak berubah saat event berlangsung sehingga tidak perlu di-subscribe.

---

## 1.6 Seed Data

### Migration 003: Seed

```sql
-- Config event
INSERT INTO config (event_name, event_date, event_venue, stage_label)
VALUES ('Seminar Nasional 2026', '2026-07-12', 'Gedung Serbaguna', 'STAGE')
ON CONFLICT DO NOTHING;

-- Layout Pria: kolom K–T, normal (K di kiri, T di kanan)
INSERT INTO layouts (gender, label, rows, cols, col_start_char, reverse_col)
VALUES ('male', 'Pria', 6, 10, 'K', false)
ON CONFLICT (gender) DO UPDATE SET
  label = EXCLUDED.label,
  rows  = EXCLUDED.rows,
  cols  = EXCLUDED.cols,
  col_start_char = EXCLUDED.col_start_char,
  reverse_col    = EXCLUDED.reverse_col,
  updated_at     = now();

-- Layout Wanita: kolom A–J, reverse (J di kiri, A di kanan)
INSERT INTO layouts (gender, label, rows, cols, col_start_char, reverse_col)
VALUES ('female', 'Wanita', 6, 10, 'A', true)
ON CONFLICT (gender) DO UPDATE SET
  label = EXCLUDED.label,
  rows  = EXCLUDED.rows,
  cols  = EXCLUDED.cols,
  col_start_char = EXCLUDED.col_start_char,
  reverse_col    = EXCLUDED.reverse_col,
  updated_at     = now();
```

> Seed dijalankan sekali via SQL Editor. Tidak perlu script Node.js karena Supabase menyediakan SQL Editor langsung.

---

## 1.7 Supabase Client Setup

### `lib/supabase.js` — anon client (browser & server components)
```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Singleton — satu instance untuk seluruh app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### `lib/supabase-admin.js` — service role client (API Routes saja)
```js
import { createClient } from '@supabase/supabase-js';

// Service role bypass RLS — HANYA digunakan di API routes (server-side)
// JANGAN import file ini di komponen client
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
```

> `supabaseAdmin` digunakan di `POST /api/seats/generate` untuk batch insert besar yang butuh bypass RLS agar lebih cepat.

### Pola Query

```js
// SELECT
const { data, error } = await supabase
  .from('layouts')
  .select('*')
  .order('gender');

// UPDATE
const { data, error } = await supabase
  .from('config')
  .update({ event_name: 'Event Baru' })
  .eq('id', configId)
  .select()
  .single();

// INSERT
const { data, error } = await supabase
  .from('categories')
  .insert({ layout_id, name, color, order: 0 })
  .select()
  .single();

// DELETE
const { error } = await supabase
  .from('categories')
  .delete()
  .eq('id', categoryId);

// Selalu handle error
if (error) throw new Error(error.message);
```

---

## 1.8 Query Dasar di API Routes

### `app/api/health/route.js`
```js
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { error } = await supabase.from('config').select('id').limit(1);
    if (error) throw error;
    return Response.json({ status: 'ok', db: 'connected', ts: new Date() });
  } catch (err) {
    return Response.json({ status: 'error', message: err.message }, { status: 503 });
  }
}
```

### Contoh: Fetch config di server component
```js
// app/(main)/dashboard/page.jsx
import { supabase } from '@/lib/supabase';

export default async function Dashboard() {
  const { data: config } = await supabase.from('config').select('*').single();
  const { data: layouts } = await supabase.from('layouts').select('*');
  // ...
}
```

### Contoh: Fetch di client component (dengan Zustand)
```js
// Di useConfigStore.js
const fetchConfig = async () => {
  const { data, error } = await supabase.from('config').select('*').single();
  if (!error) set({ config: data });
};
```

---

## 1.9 Bottom Navigation

```
┌────────────────────────────┐
│       [Page Content]       │
├────────────────────────────┤
│  🏠    🏗️    👁️    ✅    │
│ Dash  Edit  View  Check    │
└────────────────────────────┘
```

Semua halaman dalam `(main)/` otomatis mendapat bottom nav. Tidak ada halaman login.

---

## 1.10 Dashboard Skeleton

```jsx
// app/(main)/dashboard/page.jsx — versi awal
export default async function Dashboard() {
  const { data: config } = await supabase.from('config').select('*').single();

  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-bold text-white">{config?.event_name}</h1>
      <p className="text-secondary text-sm mt-1">
        {config?.event_date} · {config?.event_venue}
      </p>
      {/* Stats cards — diisi di Phase 3 */}
      <div className="mt-6 text-secondary text-sm">Layout belum di-setup</div>
    </div>
  );
}
```

---

## 🧪 Definition of Done — Phase 1

- [ ] `npm run dev` berjalan tanpa error
- [ ] Semua tabel terbuat di Supabase Dashboard
- [ ] RLS aktif, policy `allow_public_all` terpasang
- [ ] Realtime aktif pada tabel `seats`
- [ ] Seed berjalan: 1 config, 2 layout tersimpan
- [ ] `GET /api/health` → `{ status: "ok" }`
- [ ] Dashboard menampilkan nama event dari Supabase
- [ ] Supabase client dapat SELECT data di browser console

**Test di browser console:**
```js
import { supabase } from '/lib/supabase.js';
const { data } = await supabase.from('layouts').select('*');
console.log(data); // harus muncul 2 layout
```

---

## ⚠️ Catatan Teknis

- **`NEXT_PUBLIC_`** prefix wajib untuk variabel yang diakses di browser. `SUPABASE_SERVICE_ROLE_KEY` tanpa prefix hanya tersedia di server.
- **Jangan gunakan `service_role` key di client** — key ini bypass semua RLS dan bisa berbahaya jika diexpose.
- **Supabase pauses project** setelah 7 hari tidak aktif di free tier. Daftarkan endpoint `/api/health` ke **UptimeRobot** untuk ping otomatis setiap hari.
- SQL Editor Supabase mendukung multi-statement — bisa paste seluruh migration sekaligus dan run.
- `ON CONFLICT DO NOTHING` / `DO UPDATE` memastikan seed bisa dijalankan ulang tanpa error duplikat.
