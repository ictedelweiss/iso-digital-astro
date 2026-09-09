# Prompt: Modul "Admin & Hak Akses" (User Management + Module Permission)

> **Cara pakai:** salin seluruh isi mulai dari bagian `=== MULAI PROMPT ===` sampai akhir file, lalu tempel ke chat/agent baru di workspace `D:\astro-app`. Bagian di atas garis itu hanya catatan untuk manusia, tidak perlu ikut disalin.

---

=== MULAI PROMPT ===

## 0. Tujuan

Tambahkan **modul baru "Admin & Hak Akses"** ke aplikasi ISO Digital Hub, yang berisi:

1. **CRUD akun admin/user** (tambah, lihat, ubah, nonaktifkan, hapus) beserta role-nya.
2. **Pengaturan hak akses per akun**: akun A boleh mengakses semua modul, akun B hanya beberapa modul — dan seterusnya. Hak akses diatur **per modul × per aksi** (lihat / buat / ubah / hapus / approve).
3. **Penegakan (enforcement) di sisi server**: daftar modul di sidebar mengikuti hak akses, **dan** setiap endpoint API ikut ditolak dengan 403 bila aksesnya tidak ada. Jangan hanya menyembunyikan menu di UI.

Hasil akhir harus konsisten dengan arsitektur dan gaya kode yang sudah ada (dijelaskan di bawah).

---

## 1. Konteks proyek (sudah benar, tidak perlu ditebak ulang)

**Stack:** Astro 4 (SSR, adapter Cloudflare / `@astrojs/node` untuk dev) + Solid.js islands + Tailwind CSS + Drizzle ORM (SQLite, D1) + Cloudflare Pages & D1. Deploy pakai Wrangler, binding D1 bernama `DB` (database: `iso_digital_db`).

**File kunci yang harus kamu baca sebelum menulis kode:**

| File | Isi |
|---|---|
| `src/db/schema.ts` | Semua tabel Drizzle (`users`, `assets`, `purchaseRequisitions`, `auditLog`, dst.) |
| `src/middleware.ts` | Verifikasi session, rate limit, CSRF, security headers, CSP nonce. Setiap request → `locals.user` |
| `src/lib/session.ts` | Session JWT (HS256, cookie `iso_user_session`, HttpOnly, umur 8 jam), tipe `SessionUser`, `hasRole()`, `ROLE_RANK` |
| `src/lib/audit.ts` | `recordAudit(db, entry)` — audit trail append-only. `AuditEntity` saat ini: `pr \| leave \| handover \| meeting \| asset \| user` |
| `src/lib/schemas.ts` | Semua skema validasi Zod + helper `parseBody(request, schema)` |
| `src/lib/validation.ts` | `json()`, `errorResponse()`, sanitizer |
| `src/pages/api/assets/index.ts` dan `[id].ts` | **Pola baku** untuk endpoint REST: cek `locals.user`, cek `env.DB`, `hasRole`, `parseBody`, `drizzle(env.DB)`, `recordAudit`, return `json()` |
| `src/components/Sidebar.tsx` | Daftar menu (6 modul) + gaya visual |
| `src/lib/types.ts` | `NavTab`, `UserProfile`, dst. |
| `src/db/seed.ts` | Seed user contoh |

**Modul/menu yang ada saat ini** (nilai `NavTab`): `dashboard`, `purchase-requisition`, `leave-request`, `handover-form`, `meeting-attendance`, `asset-management`. Modul baru yang akan ditambah: **`admin-access`**.

**Role yang dipakai** (`src/lib/session.ts`): `admin` (rank 3) > `approver` (2) > `coordinator` (1) > `staff` (0).
> Catatan: `src/lib/types.ts` di `UserProfile.role` masih menyisipkan `'user'` yang tidak ada di rank. Saat menyentuh file itu, samakan ke 4 role di atas; jangan menambah role baru tanpa need.

**Konvensi yang WAJIB diikuti:**
- Payload JSON API memakai **snake_case** (contoh: `asset_code`, `pr_number`, `has_signature`).
- Handler selalu: cek auth → cek otorisasi → `parseBody` dengan skema Zod → query → `recordAudit` → `json()`.
- Jangan pernah membaca secret lewat `import.meta.env` (di-inline saat build). Pakai `locals.runtime.env` / `process.env`.
- Tulis komentar yang menjelaskan **"why"**, bukan "what" — ikuti gaya file yang sudah ada.
- TypeScript strict, hindari `any` yang tidak perlu.
- **Jangan** mengubah perilaku modul yang sudah berjalan (PR, cuti, serah terima, rapat, aset). Tambahkan, jangan mengganti. `hasRole()` tetap dipertahankan.

---

## 2. Desain data

### 2.1 Tabel baru di `src/db/schema.ts`

```ts
// Registri modul — sumber tunggal kebenaran untuk daftar modul yang bisa diatur aksesnya.
export const modules = sqliteTable('modules', {
  key: text('key').primaryKey(),              // 'purchase-requisition', 'admin-access', ...
  label: text('label').notNull(),             // 'Purchase Requisition'
  description: text('description'),
  icon: text('icon'),                         // emoji, ikuti gaya Sidebar.tsx
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  // Modul bawaan sistem tidak boleh dihapus (menghindari FK yatim & menu hilang).
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(true),
});

// Hak akses DEFAULT per role. Baris yang tidak ada = tidak punya akses.
export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    role: text('role').notNull(),             // 'admin' | 'approver' | 'coordinator' | 'staff'
    moduleKey: text('module_key')
      .notNull()
      .references(() => modules.key, { onDelete: 'cascade' }),
    canView: integer('can_view', { mode: 'boolean' }).notNull().default(false),
    canCreate: integer('can_create', { mode: 'boolean' }).notNull().default(false),
    canEdit: integer('can_edit', { mode: 'boolean' }).notNull().default(false),
    canDelete: integer('can_delete', { mode: 'boolean' }).notNull().default(false),
    canApprove: integer('can_approve', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => ({ uniq: uniqueIndex('role_module_unique').on(t.role, t.moduleKey) })
);

// OVERRIDE per user — menang atas default role. Tidak ada baris = ikut role.
export const userPermissions = sqliteTable(
  'user_permissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    moduleKey: text('module_key')
      .notNull()
      .references(() => modules.key, { onDelete: 'cascade' }),
    effect: text('effect').notNull(),         // 'allow' = pakai flag di bawah; 'deny' = cabut semua
    canView: integer('can_view', { mode: 'boolean' }).notNull().default(false),
    canCreate: integer('can_create', { mode: 'boolean' }).notNull().default(false),
    canEdit: integer('can_edit', { mode: 'boolean' }).notNull().default(false),
    canDelete: integer('can_delete', { mode: 'boolean' }).notNull().default(false),
    canApprove: integer('can_approve', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => ({ uniq: uniqueIndex('user_module_unique').on(t.userId, t.moduleKey) })
);
```

Tambahkan juga ke tabel `users` yang sudah ada:
- `isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true)` — nonaktifkan akun tanpa menghapus baris (audit log tetap menjaga FK/riwayat).
- `sessionVersion: integer('session_version').notNull().default(0)` — dinaikkan untuk **memaksa logout** akun yang sedang login (misal hak aksesnya baru dicabut).
- `lastLoginAt: text('last_login_at')` — opsional, untuk kolom "Login terakhir" di tabel user.

### 2.2 Aturan resolusi hak akses (efektif)

Untuk setiap `(user, module)`:
1. Ambil baris `userPermissions` → kalau ada:
   - `effect = 'allow'` → pakai flag `can_*` milik baris itu.
   - `effect = 'deny'` → semua aksi `false`.
2. Kalau tidak ada baris → pakai baris `rolePermissions` untuk `users.role`.
3. Kalau role pun tidak punya baris → semua `false`.
4. Akun dengan `isActive = false` → **semua akses false**, apa pun isinya.

Tambahkan `'permission'` ke union `AuditEntity` di `src/lib/audit.ts`.

---

## 3. Backend

### 3.1 `src/lib/permissions.ts` (baru)

```ts
export const MODULE_KEYS = [
  'dashboard', 'purchase-requisition', 'leave-request',
  'handover-form', 'meeting-attendance', 'asset-management', 'admin-access',
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve';
export type ModuleAccess = Record<Action, boolean>;
export type PermissionMap = Record<string, ModuleAccess>;
```

Fungsi yang harus ada:
- `resolvePermissions(db, userId, role): Promise<PermissionMap>` — 2 query (override user + default role), gabungkan sesuai aturan §2.2, sertakan modul yang tidak punya baris sebagai semua-`false`.
- `getPermissionMap(locals): Promise<PermissionMap>` — resolve **sekali per request** lalu memoize di `locals` (simpan Promise-nya, bukan hasilnya) supaya tidak query berulang.
- `canAccess(locals, module: ModuleKey, action: Action): Promise<boolean>`
- `requirePermission(locals, module: ModuleKey, action: Action): Promise<Response | null>` — kembalikan `errorResponse(403, ...)` kalau ditolak, atau `null` kalau lolos. Dipakai di awal setiap handler.
- `ensureUserIsActive(locals): Promise<Response | null>` — 403 kalau user nonaktif.

### 3.2 `src/middleware.ts` (ubah)

Setelah `openSession()` berhasil **dan** `user.id !== null` **dan** request bukan aset statis:
- Ambil `users.isActive` + `users.sessionVersion` dari DB.
- Simpan `sessionVersion` ke JWT saat login (tambahkan field ke `SessionUser` dan ke `src/pages/api/auth/callback.ts`).
- Kalau `isActive === false` **atau** `sessionVersion` di DB berbeda dari yang di JWT → anggap tidak terautentikasi: `locals.user = null` dan kirim cookie kedaluwarsa. Ini yang bikin pencabutan akses langsung berlaku tanpa menunggu 8 jam.
- **Jangan** resolve seluruh permission map di middleware kalau tidak perlu — cukup validitas akun. Pemanggilan permission dilakukan lazily lewat `getPermissionMap()` di handler yang membutuhkan.
- Pastikan penambahan query ini tidak merusak jalur publik (`/api/auth/*`, `/api/meetings/*/attend`, halaman login). Kalau `user === null`, lewati semua query DB.

### 3.3 Endpoint baru

Semua berada di bawah `/api/admin/**` dan **wajib** lolos `requirePermission(locals, 'admin-access', ...)`.

**Modul**
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/admin/modules` | `admin-access:view` | Daftar modul + ringkasan akses user login |
| PATCH | `/api/admin/modules/[key]` | `admin-access:edit` | Ubah label/ikon/urutan/`is_active`. Tolak hapus bila `is_system = true` |
| POST | `/api/admin/modules` | `admin-access:edit` | Tambah modul kustom (`is_system = false`) |

**User**
| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/admin/users?q=&role=&status=&page=&limit=` | Tabel user: id, nama, email, username, departemen, jabatan, role, status aktif, login terakhir, **jumlah modul yang bisa diakses**. Paginasi wajib (default 20, maks 100). |
| POST | `/api/admin/users` | Buat akun. Body: `display_name`, `email`, `username`, `department`, `job_title`, `role`, `is_active`. Tolak email/username duplikat dengan pesan 409 yang jelas. |
| GET | `/api/admin/users/[id]` | Detail + permission efektif + asalnya (`role` / `override`) |
| PATCH | `/api/admin/users/[id]` | Ubah identitas/role/status aktif |
| DELETE | `/api/admin/users/[id]` | **Soft delete**: `isActive = false` + bump `sessionVersion` + hapus baris `userPermissions`. Jangan hard-delete (FK ke approval & audit). |
| POST | `/api/admin/users/[id]/reset-session` | Bump `session_version` → paksa logout semua sesi akun itu |

**Permission**
| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/admin/users/[id]/permissions` | Matriks lengkap: untuk tiap modul → flag efektif, flag default role, dan apakah sedang di-override |
| PUT | `/api/admin/users/[id]/permissions` | Simpan override. Body: `{ permissions: [{ module_key, effect: 'allow'\|'deny'\|'inherit', can_view, can_create, can_edit, can_delete, can_approve }] }`. `effect: 'inherit'` = hapus baris override. **Validasi**: `can_delete` tidak boleh `true` kalau `can_view` `false`; `can_approve` mengimplikasi `can_view`. |
| DELETE | `/api/admin/users/[id]/permissions` | Reset semua override → kembali ke default role |
| GET | `/api/admin/roles/[role]/permissions` | Matriks default per role |
| PUT | `/api/admin/roles/[role]/permissions` | Simpan default per role |

**Session / audit**
| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/me/permissions` | Untuk user yang sedang login: `{ role, is_active, modules: PermissionMap }`. **Tidak butuh** akses admin. Dipakai frontend untuk merender menu. |
| GET | `/api/admin/audit?entity=permission&page=` | Riwayat perubahan akses/user dari `audit_log`, urut terbaru |

### 3.4 Penegakan di endpoint yang SUDAH ada

Tambahkan `requirePermission` di handler yang sudah ada, **tanpa mengubah** logikanya:

- `/api/assets` → module `asset-management`: GET `view`, POST `create`, PUT `edit`, DELETE `delete`
- `/api/prs` → module `purchase-requisition` (+ `/approve` → aksi `approve`)
- `/api/leaves` → module `leave-request` (+ `/approve` → `approve`)
- `/api/handovers` → module `handover-form` (+ `/approve` → `approve`)
- `/api/meetings` → module `meeting-attendance`

Pertahankan `hasRole()` yang sudah ada; anggap `requirePermission` sebagai **tambahan**, bukan pengganti, kecuali keduanya tumpang tindih — saat itu jelaskan di komentar kenapa salah satunya cukup.

### 3.5 Aturan keamanan (tidak bisa ditawar)

1. **Tidak pernah mempercayai role/hak akses dari client.** Semua keputusan diambil dari DB, di server.
2. **Minimal satu super-admin aktif.** Tolak (409) permintaan yang membuat jumlah akun `role = 'admin'` + `isActive = 1` + akses `admin-access:edit` menjadi nol.
3. **Larang bunuh diri digital.** Tolak permintaan yang menurunkan role sendiri, menonaktifkan akun sendiri, atau mencabut akses `admin-access` dari akun sendiri.
4. **Audit wajib.** Setiap perubahan user/permission/role → `recordAudit` dengan `entityType: 'permission'` (atau `'user'`), dan isi `notes` berisi ringkasan sebelum → sesudah (contoh: `"asset-management: view+create -> view only"`).
5. Rate limit & CSRF sudah ditangani middleware — pastikan semua pemanggilan dari frontend tetap **same-origin** (`credentials: 'same-origin'`, tanpa header CORS tambahan).
6. Validasi `role` dan `module_key` dengan enum Zod, jangan terima string bebas.
7. Endpoint `/api/admin/**` mengembalikan `Cache-Control: no-store` (helper `json()` sudah melakukan ini).

---

## 4. Frontend (Solid.js + Tailwind)

### 4.1 Tipe & helper
- Tambahkan `ModuleKey`, `ModuleAccess`, `PermissionMap` ke `src/lib/types.ts`.
- Tambahkan helper fetch kecil (`src/lib/api.ts`) yang membungkus `fetch` dengan `credentials: 'same-origin'`, header JSON, dan lempar error berstatus HTTP — dipakai semua komponen baru.

### 4.2 `src/components/AdminAccessView.tsx` (baru)

Satu komponen dengan **sub-tab internal**, mengikuti gaya visual `AssetManagementView.tsx` / `Sidebar.tsx` (rounded-2xl/3xl, biru `#1877f2`, teks `text-xs font-bold`, ikon `lucide-solid`, responsif mobile):

- **Tab "Akun"** — tabel daftar user: kolom nama, email, departemen, role, status (badge aktif/nonaktif), jumlah modul, aksi (Edit / Atur Akses / Reset Sesi / Nonaktifkan). Ada **pencarian**, **filter role**, **filter status**, dan tombol **"+ Tambah Akun"** (modal form, reuse gaya modal yang sudah ada).
- **Tab "Hak Akses"** — matriks **user × modul**. Baris = modul, kolom = checkbox Lihat/Buat/Ubah/Hapus/Approve, plus satu dropdown per baris: `Ikuti Role` / `Izinkan` / `Tolak`. Tampilkan badge kecil "override" bila berbeda dari default role. Tombol **"Pilih semua"** per baris, **"Reset ke default role"**, dan **Simpan** (satu PUT bulk).
- **Tab "Default per Role"** — matriks yang sama, tapi diterapkan ke `rolePermissions` (pilih role dari dropdown).
- **Tab "Log Perubahan"** — daftar isi `/api/admin/audit` (waktu, aktor, aksi, ringkasan sebelum→sesudah).

Semua aksi mutasi menampilkan **toast** dengan pola `showToast()` yang sudah ada di `App.tsx`. Konfirmasi (modal/alert) sebelum menonaktifkan atau menghapus akun.

### 4.3 Menu & navigasi
- `src/lib/types.ts`: tambahkan `'admin-access'` ke union `NavTab`.
- `src/components/Sidebar.tsx`: terima prop baru `permissions: PermissionMap` (atau `allowedModules: ModuleKey[]`), lalu **filter** `menuItems` berdasarkan `permissions[key].view`. Tambahkan entri `{ id: 'admin-access', label: 'Admin & Hak Akses', icon: '⚙️' }` yang hanya muncul bila punya akses view.
- `src/components/MobileNav.tsx`: filter yang sama.
- `src/components/App.tsx`:
  - `onMount`: setelah `/api/auth/me` sukses, panggil `/api/me/permissions`, simpan di signal `permissions`.
  - Render `<AdminAccessView />` untuk tab `admin-access`.
  - **Guard**: kalau tab aktif tidak lagi diizinkan setelah permission dimuat, alihkan ke `dashboard`.
  - Kirim `permissions` ke `Sidebar` dan `MobileNav`.
- Tampilkan pesan kosong yang ramah ("Tidak ada modul yang bisa diakses") bila permission map kosong.

### 4.4 Catatan penting
Data PR/cuti/serah terima/rapat di `App.tsx` masih berasal dari `INITIAL_*` dummy (bukan API). **Jangan refactor itu sekarang.** Cukup pastikan filter menu & guard tab memakai permission dari API.

---

## 5. Migrasi & seed

1. Tambahkan tabel baru ke `src/db/schema.ts`.
2. **`Jangan tulis file SQL manual.** Jalankan `npx drizzle-kit generate` untuk menghasilkan `drizzle/0004_*.sql`. Tunjukkan isi SQL-nya ke saya dan **tunggu konfirmasi** sebelum menjalankan apa pun ke D1 remote.
3. Tambahkan seed modul ke `src/db/seed.ts` (7 modul di atas) **dan** default `rolePermissions` dengan asumsi berikut — sebutkan asumsinya di komentar supaya mudah dikoreksi:
   - `admin` → semua modul, semua aksi.
   - `coordinator` → semua modul kecuali `admin-access`; boleh approve PR/cuti/serah terima.
   - `approver` → `dashboard` (view), PR/cuti/serah terima (view + approve), rapat & aset (view).
   - `staff` → `dashboard` (view), PR/cuti/serah terima (view + create), rapat (view), aset (view).
4. Backfill: user `role = 'admin'` yang sudah ada **tidak** diberi baris override (cukup default role) sehingga langsung mendapat akses penuh.
5. Perintah apply (hanya setelah saya setujui):
   - lokal: `npx wrangler d1 migrations apply iso_digital_db --local`
   - remote: `npx wrangler d1 migrations apply iso_digital_db --remote`

---

## 6. Kriteria selesai (harus bisa dibuktikan)

- [ ] `npm run build` lolos tanpa error TypeScript/build.
- [ ] Login sebagai akun **admin** → menu "Admin & Hak Akses" muncul; bisa CRUD akun.
- [ ] Buat **akun B** dengan hanya 2 modul → login sebagai B → sidebar/mobile nav hanya menampilkan 2 modul itu.
- [ ] Sebagai B, `GET`/`POST` ke API modul lain menghasilkan **403**, bukan 200 (bukan sekadar menu disembunyikan).
- [ ] Ubah hak akses B dari akun admin → perubahan **langsung efektif** pada request berikutnya tanpa B harus login ulang.
- [ ] Nonaktifkan akun → sesi aktif akun itu langsung ditolak.
- [ ] Percobaan menonaktifkan/menurunkan hak akun sendiri, atau menghapus admin terakhir, ditolak dengan pesan yang jelas.
- [ ] Setiap perubahan akses/user tercatat di `audit_log` dan tampil di tab "Log Perubahan".
- [ ] Tidak ada modul yang sudah ada yang perilakunya berubah/regresi.

## 7. Cara bekerja

- Kerjakan bertahap: **schema → migrasi → lib permissions → middleware → API → UI → verifikasi build**. Laporkan ringkasan per tahap.
- Sebelum menulis kode, sebutkan dulu rencana perubahan file (nama file + perubahan singkat), lalu lanjutkan.
- Kalau ada keputusan desain yang ambigu (misalnya apakah "Approve" perlu dipisah dari "Edit"), pilih yang paling sederhana dan konsisten dengan pola `pr_approvals` yang sudah ada, lalu **catat asumsinya**.
- Jangan menambah dependency baru ke `package.json` tanpa bertanya.
- Jangan menjalankan perintah Wrangler yang mengubah database remote tanpa konfirmasi saya.

=== SELESAI PROMPT ===
