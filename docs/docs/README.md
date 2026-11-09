# DOKUMEN 9: REPOSITORY README (README.md)
# Smart Stock UMKM (Florawins)

Aplikasi manajemen stok dan peramalan restock harian untuk UMKM/Florist menggunakan algoritma **Holt-Winters Exponential Smoothing (HWES, m=7)** dan **Simple Moving Average (SMA)** sebagai fallback.

---

## Stack Teknologi
- **Frontend:** React (Vite), Tailwind CSS, Chart.js, Lucide React
- **Backend:** Node.js, Express.js (ES Modules, REST API)
- **Database:** PostgreSQL (Query SQL murni via `pg`, tanpa ORM)
- **Testing:** Jest, Supertest

---

## Struktur Folder
```text
smart-stock/
├── docs/          # Dokumentasi spesifikasi & panduan proyek
├── server/        # Backend API Express.js & Database
│   ├── config/    # Koneksi DB
│   ├── db/        # schema.sql & seed data
│   ├── routes/    # Route API
│   └── services/  # Logika HWES & ROP/Q
├── src/           # Frontend React Vite
│   ├── components/
│   └── pages/
├── package.json
└── README.md
```

---

## Cara Menjalankan di Lokal

### 1. Database
Buat database PostgreSQL bernama `smart_stock_db`, lalu jalankan schema:
```bash
psql -U postgres -d smart_stock_db -f server/db/schema.sql
```

### 2. Backend
```bash
cd server
npm install
npm run dev
```

### 3. Frontend
```bash
npm install
npm run dev
```
Akses di browser: `http://localhost:5173` (Admin: `admin@florawins.com` / `Admin123!`).

---

## Testing
```bash
cd server
npm test
```
