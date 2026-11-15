# Smart Stock UMKM (Toko Florawins)

Aplikasi manajemen inventaris dan sistem rekomendasi restock harian untuk UMKM Toko Florawins menggunakan peramalan deret berkala **Holt-Winters Exponential Smoothing (HWES Additive, $m=7$)** dengan fallback **Simple Moving Average (SMA)**, kalkulasi **Reorder Point (ROP)**, dan **Order Quantity ($Q$)**.

---

## 🛠️ Stack Teknologi

- **Frontend:** React 18, Vite, Tailwind CSS, Chart.js, Lucide React
- **Backend:** Node.js (ES Modules), Express.js
- **Database:** PostgreSQL (Native SQL query via `pg`, tanpa ORM)
- **Testing:** Jest, Supertest (29 Automated Tests: Unit & Integration)
- **Keamanan:** JWT Authentication, Bcrypt Password Hashing, Rate Limiting (anti brute-force), CORS Whitelist, Input Sanitization & SQL Injection Protection via Parameterized Queries.

---

## 📁 Struktur Direktori

```text
Smart_Stock_UMKM/
├── docs/                      # Dokumentasi PRD, spesifikasi API, dan skema
├── server/                    # Backend API Express.js
│   ├── config/                # Konfigurasi pool PostgreSQL
│   ├── controllers/           # Route controller (Auth, Sales, Products, Restock, Forecasting)
│   ├── db/                    # Skema database (schema.sql)
│   ├── middleware/            # Auth & security middleware
│   ├── routes/                # Endpoint router
│   ├── scripts/               # Skrip evaluasi empiris MAPE
│   ├── services/              # Logika algoritma HWES, SMA, MAPE, dan kalkulasi Restock
│   └── tests/                 # Automated tests (Unit HWES, Unit Restock, Integrasi Sales & CSV)
├── src/                       # Frontend React (Vite)
│   ├── components/            # Reusable UI components & Layout
│   ├── pages/                 # Halaman aplikasi (Dashboard, Sales, Products, Forecasting, Login)
│   ├── services/              # API client axios/fetch
│   └── utils/                 # Helper format tanggal & mata uang
├── .env.example               # Template environment frontend
└── README.md
```

---

## 🚀 Panduan Menjalankan di Lokal

### 1. Prasyarat
- Node.js versi 18+ atau 20+
- PostgreSQL 14+ aktif di lokal

### 2. Konfigurasi Database
1. Buat database di PostgreSQL:
   ```sql
   CREATE DATABASE smart_stock_db;
   ```
2. Jalankan skema tabel dan data awal:
   ```bash
   psql -U postgres -d smart_stock_db -f server/db/schema.sql
   ```

### 3. Konfigurasi Backend
1. Masuk ke direktori server:
   ```bash
   cd server
   npm install
   ```
2. Buat file `.env` dari template:
   ```bash
   cp .env.example .env
   ```
   Sesuaikan `DB_USER`, `DB_PASSWORD`, `PORT=5000`, dan `JWT_SECRET`.
3. Jalankan server:
   ```bash
   npm run dev
   # Server berjalan di http://localhost:5000
   ```

### 4. Konfigurasi Frontend
1. Kembali ke root direktori dan pasang dependensi:
   ```bash
   npm install
   ```
2. Jalankan frontend:
   ```bash
   npm run dev
   # Akses aplikasi di http://localhost:5173
   ```

---

## 🧪 Pengujian Otomatis (Automated Testing)

Seluruh pengujian unit dan integrasi dapat dijalankan langsung dengan:

```bash
npm --prefix server test
```

### Cakupan Pengujian (29 Tests - 100% Passed):
1. **`tests/unit/hwesService.test.js` (9 tests):**
   - Inisialisasi level, trend, dan seasonal indices ($m=7$)
   - Formula HWES Additive & smoothing parameter ($\alpha, \beta, \gamma$)
   - Validasi fallback SMA saat data historis $< 14$ hari
   - Fungsi evaluasi akurasi `calculateMAPE` (zero-sales handling, error validation)
2. **`tests/unit/restockService.test.js` (10 tests):**
   - Perhitungan Safety Stock ($SS$), Reorder Point ($ROP = D_{avg} \times LT + SS$)
   - Perhitungan kuantitas restock optimal ($Q = F - C + SS$)
   - Penanganan nilai negatif dan edge-cases stok aman
3. **`tests/integration/sales.test.js` (10 tests):**
   - Autentikasi JWT & validasi input transaksi
   - Pengurangan stok otomatis saat transaksi berhasil
   - Proteksi stok minus (insufficient stock)
   - Parsing dan validasi upload CSV mutasi penjualan (format header, validasi SKU, data kosong)

---

## 📊 Evaluasi Empiris Akurasi (MAPE)

Untuk menjalankan evaluasi perbandingan akurasi peramalan Holt-Winters vs Simple Moving Average pada 75 data penjualan historis Toko Florawins:

```bash
node server/scripts/evaluateMape.js
```
Skrip ini akan membandingkan nilai aktual penjualan dengan peramalan model, serta menampilkan metrik MAPE secara otomatis.
