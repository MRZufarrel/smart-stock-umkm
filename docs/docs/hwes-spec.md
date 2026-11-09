# DOKUMEN 4: SPESIFIKASI ALGORITMA HWES & RESTOCK (hwes-spec.md)
**Proyek:** Smart Stock UMKM (Florawins)

---

## 1. ALGORITMA HOLT-WINTERS EXPONENTIAL SMOOTHING (ADDITIVE, $m=7$)

### Parameter Default
- Seasonality Period ($m$): 7 hari
- Alpha ($lpha$ - Level Smoothing): 0.2
- Beta ($eta$ - Trend Smoothing): 0.1
- Gamma ($\gamma$ - Seasonal Smoothing): 0.3

### Syarat Data
- Membutuhkan minimal 14 data historis harian berturut-turut ($2 	imes m$).
- Hari kosong tanpa transaksi wajib diisi dengan `quantity = 0`.

### Inisialisasi Nilai Awal ($t = m = 7$)
1. **Initial Level ($L_m$):**
   $$L_m = rac{1}{m} \sum_{i=1}^{m} Y_i$$
2. **Initial Trend ($T_m$):**
   $$T_m = rac{\sum_{i=1}^{m} Y_{m+i} - \sum_{i=1}^{m} Y_i}{m^2}$$
3. **Initial Seasonal ($S_i$ untuk $i = 1 \dots m$):**
   $$S_i = Y_i - L_m$$

### Rumus Pembaruan Komponen ($t > m$)
- **Level ($L_t$):** $L_t = lpha (Y_t - S_{t-m}) + (1 - lpha)(L_{t-1} + T_{t-1})$
- **Trend ($T_t$):** $T_t = eta (L_t - L_{t-1}) + (1 - eta) T_{t-1}$
- **Seasonal ($S_t$):** $S_t = \gamma (Y_t - L_t) + (1 - \gamma) S_{t-m}$

### Rumus Prediksi ($F_{t+k}$)
$$F_{t+k} = L_t + (k 	imes T_t) + S_{t + k - m}$$
*Catatan: Nilai $F_{t+k} < 0$ dibulatkan menjadi 0.*

---

## 2. MEKANISME FALLBACK (SMA)
Jika data historis $< 14$ hari:
- Gunakan **Simple Moving Average (SMA)** dari data yang ada.
- Set `warning_flag = true` dan `method_used = "SMA_FALLBACK"`.

---

## 3. FORMULA KALKULASI RESTOCK

### Reorder Point (ROP)
$$ROP = (D_{avg} 	imes LT) + SS$$
- $D_{avg}$: Rata-rata prediksi harian 7 hari ke depan.
- $LT$ (Lead Time): Default 3 hari.
- $SS$ (Safety Stock / `min_stock`): Ambil dari field `min_stock` varian.

### Order Quantity ($Q$)
$$Q = F_{total} + SS - C_{stock}$$
- $F_{total}$: Total akumulasi prediksi 7 hari ke depan.
- $C_{stock}$: Stok varian saat ini.
- Jika $Q \le 0$, maka $Q = 0$ dan `needs_restock = false`.
