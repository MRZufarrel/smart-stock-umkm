# DOKUMEN: RENCANA PENGUJIAN & UAT (TEST-PLAN.md)
**Proyek:** Smart Stock UMKM (Florawins)

---

## 1. PENGUJIAN UNIT (UNIT TESTING)
**Lokasi:** `server/tests/unit/`

### A. Modul Holt-Winters (`hwesService.test.js`)
1. **Skenario Normal (Data >= 14 hari):** Input 14 data historis -> Output 7 nilai prediksi, `method_used: "HWES_M7"`, `warning_flag: false`.
2. **Skenario Fallback (Data < 14 hari):** Input 5 data historis -> Output 7 nilai rata-rata SMA, `method_used: "SMA_FALLBACK"`, `warning_flag: true`.
3. **Pembulatan Nilai Negatif:** Prediksi minus dipaksa menjadi 0.

### B. Kalkulasi Restock (`restockService.test.js`)
1. **Perhitungan ROP:** $D_{avg}=10, LT=3, SS=5 
ightarrow ROP = 35$.
2. **Perhitungan Q:** $F_{total}=70, SS=5, C_{stock}=20 
ightarrow Q = 55$.
3. **Stok Aman:** $F_{total}=10, SS=5, C_{stock}=30 
ightarrow Q = 0$, `needs_restock = false`.

---

## 2. PENGUJIAN INTEGRASI (INTEGRATION TESTING)
1. `POST /api/sales`: Transaksi valid mengurangi stok. Transaksi melebihi stok mengembalikan error 409 `INSUFFICIENT_STOCK`.
2. `POST /api/sales/import-csv`: File CSV valid berhasil diimport. File CSV rusak ditolak transaksional (error 422).

---

## 3. UAT MANUAL (CHECKLIST)
- [ ] **UAT-01 (Login):** Login admin@florawins.com berhasil.
- [ ] **UAT-02 (Produk):** Tambah/Edit/Soft-delete produk dan varian.
- [ ] **UAT-03 (Stok Kritis):** Varian dengan stok < min_stock ditandai merah di dashboard.
- [ ] **UAT-04 (Penjualan):** Penjualan mengurangi stok real-time.
- [ ] **UAT-05 (Barang Masuk):** Restock menambah stok varian.
- [ ] **UAT-06 (Peramalan):** Grafik HWES 7 hari dan rekomendasi restock tampil tanpa error.
