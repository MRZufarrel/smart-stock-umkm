# DOKUMEN 1: PRODUCT REQUIREMENTS DOCUMENT (PRD.md)
**Proyek:** Smart Stock UMKM (Florawins)  
**Versi:** 1.0  
**Peran Pengguna:** Single Admin (`admin@florawins.com`)  

---

## 1. RINGKASAN PRODUK
Smart Stock UMKM adalah aplikasi web manajemen persediaan stok barang dan peramalan kebutuhan restock harian untuk UMKM ritel/florist. Aplikasi ini mengintegrasikan pencatatan transaksi penjualan, manajemen varian produk, serta algoritma peramalan Holt-Winters Exponential Smoothing ($m=7$) dengan mekanisme *fallback* Simple Moving Average (SMA).

---

## 2. BATASAN & NON-GOALS
- **Single Role:** Hanya 1 peran yaitu Admin. Tidak ada fitur pendaftaran publik, multi-tenant, atau peran Staff/Kasir.
- **Tanpa PII:** Tidak menyimpan data pribadi pelanggan (Nama, Nomor HP, Alamat).
- **Tanpa Payment Gateway:** Tidak ada integrasi pembayaran elektronik.
- **Tanpa ORM & TypeScript:** Murni menggunakan Node.js (JavaScript ES Modules) dan PostgreSQL (`pg`).

---

## 3. FITUR UTAMA
1. **Autentikasi Admin:** Login berbasis JWT, sesi bertahan via localStorage, logout.
2. **Manajemen Produk & Varian:** CRUD Produk dan Varian (SKU, nama, harga, stok saat ini, stok minimum/safety stock). Menggunakan *soft delete* (`deleted_at`).
3. **Pencatatan Penjualan:**
   - Input manual transaksi penjualan harian.
   - Import file CSV penjualan (`sale_date,sku,quantity`).
4. **Pencatatan Barang Masuk (Restock):** Input manual jumlah barang masuk dari supplier untuk menambah stok varian.
5. **Peramalan HWES & Rekomendasi Restock:**
   - Peramalan penjualan 7 hari ke depan dengan Holt-Winters ($m=7$) jika data $\ge 14$ hari.
   - Fallback ke SMA jika data $< 14$ hari.
   - Perhitungan otomatis Reorder Point (ROP) dan Order Quantity ($Q$).
6. **Dasbor Stok Kritis:** Tampilan peringatan visual varian produk yang stoknya di bawah batas stok minimum.

---

## 4. DRAFT TASK PROMPTS UNTUK OPENCODE AGENT

### Tugas 1: Inisialisasi Database & Seed Data
"Buat file `server/db/schema.sql` sesuai DDL PostgreSQL murni. Jalankan script migrasi dan masukkan seed data default (kategori, produk, varian, user admin dengan password bcrypt `Admin123!`, serta 14+ hari data penjualan historis)."

### Tugas 2: Backend Authentication & Middleware
"Implementasikan modul autentikasi di `server/routes/auth.js` dan `server/controllers/authController.js` dengan endpoint `POST /api/auth/login`. Tambahkan middleware validasi JWT di `server/middleware/authMiddleware.js`."

### Tugas 3: Backend CRUD Produk & Varian
"Buat endpoint `GET /api/products`, `POST /api/products`, `PUT /api/products/:id`, dan `DELETE /api/products/:id` (soft delete) di backend dengan kueri SQL terparameter murni."

### Tugas 4: Backend Penjualan & Import CSV
"Buat endpoint `POST /api/sales` dan `POST /api/sales/import-csv` menggunakan `multer` dan `csv-parser`. Pastikan transaksi bersifat atomis (paling sedikit 1 error menolak seluruh CSV)."

### Tugas 5: Service Algoritma HWES & Restock
"Buat `server/services/hwesService.js` untuk mengkalkulasi prediksi Holt-Winters Additive ($m=7$) dan fallback SMA. Buat `server/services/restockService.js` untuk menghitung ROP dan $Q$."

### Tugas 6: Frontend Layout & Auth Page
"Buat komponen halaman Login (`src/pages/Login.jsx`) dan Layout Dasbor utama dengan Navbar/Sidebar menggunakan React, React Router, dan Tailwind CSS."

### Tugas 7: Frontend Page Dashboard, Produk, & Penjualan
"Buat halaman Dashboard (`src/pages/Dashboard.jsx`), Manajemen Produk (`src/pages/Products.jsx`), dan Transaksi Penjualan (`src/pages/Sales.jsx`)."

### Tugas 8: Frontend Page Peramalan & Chart.js
"Buat halaman Peramalan (`src/pages/Forecasting.jsx`) yang menampilkan grafik garis prediksi 7 hari menggunakan Chart.js dan tabel rekomendasi restock."
