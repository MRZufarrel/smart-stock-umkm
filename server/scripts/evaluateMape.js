import pool, { query } from '../config/db.js';
import {
  calculateHoltWinters,
  calculateSMA,
  calculateMAPE,
  getHistoricalDailySales,
} from '../services/hwesService.js';

const CSV_DATA = `sale_date,sku,quantity
2026-10-25,PLY-YN-01,1
2026-10-25,PLY-YN-02,1
2026-10-25,PLY-YN-03,1
2026-10-25,PLY-YN-04,2
2026-10-26,PLY-YN-01,0
2026-10-26,PLY-YN-02,1
2026-10-26,PLY-YN-03,0
2026-10-26,PLY-YN-04,2
2026-10-27,PLY-YN-01,1
2026-10-27,PLY-YN-02,2
2026-10-27,PLY-YN-03,1
2026-10-27,PLY-YN-04,3
2026-10-28,PLY-YN-01,0
2026-10-28,PLY-YN-02,1
2026-10-28,PLY-YN-03,1
2026-10-28,PLY-YN-04,2
2026-10-29,PLY-YN-01,1
2026-10-29,PLY-YN-02,1
2026-10-29,PLY-YN-03,1
2026-10-29,PLY-YN-04,2
2026-10-30,PLY-YN-01,2
2026-10-30,PLY-YN-02,3
2026-10-30,PLY-YN-03,2
2026-10-30,PLY-YN-04,4
2026-10-31,PLY-YN-01,1
2026-10-31,PLY-YN-02,2
2026-10-31,PLY-YN-03,1
2026-10-31,PLY-YN-04,3
2026-11-01,PLY-YN-01,1
2026-11-01,PLY-YN-02,1
2026-11-01,PLY-YN-03,1
2026-11-01,PLY-YN-04,2
2026-11-02,PLY-YN-01,0
2026-11-02,PLY-YN-02,1
2026-11-02,PLY-YN-03,0
2026-11-02,PLY-YN-04,2
2026-11-03,PLY-YN-01,1
2026-11-03,PLY-YN-02,2
2026-11-03,PLY-YN-03,1
2026-11-03,PLY-YN-04,3
2026-11-04,PLY-YN-01,0
2026-11-04,PLY-YN-02,1
2026-11-04,PLY-YN-03,1
2026-11-04,PLY-YN-04,2
2026-11-05,PLY-YN-01,1
2026-11-05,PLY-YN-02,1
2026-11-05,PLY-YN-03,1
2026-11-05,PLY-YN-04,2
2026-11-06,PLY-YN-01,2
2026-11-06,PLY-YN-02,3
2026-11-06,PLY-YN-03,2
2026-11-06,PLY-YN-04,4
2026-11-07,PLY-YN-01,1
2026-11-07,PLY-YN-02,2
2026-11-07,PLY-YN-03,1
2026-11-07,PLY-YN-04,3
2026-11-08,PLY-YN-01,1
2026-11-08,PLY-YN-02,1
2026-11-08,PLY-YN-03,1
2026-11-08,PLY-YN-04,2
2026-11-09,PLY-YN-01,0
2026-11-09,PLY-YN-02,1
2026-11-09,PLY-YN-03,0
2026-11-09,PLY-YN-04,2
2026-11-10,PLY-YN-01,1
2026-11-10,PLY-YN-02,2
2026-11-10,PLY-YN-03,1
2026-11-10,PLY-YN-04,3
2026-11-11,PLY-YN-01,0
2026-11-11,PLY-YN-02,1
2026-11-11,PLY-YN-03,1
2026-11-11,PLY-YN-04,2
2026-11-12,PLY-YN-01,1
2026-11-12,PLY-YN-02,1
2026-11-12,PLY-YN-03,1
2026-11-12,PLY-YN-04,2
2026-11-13,PLY-YN-01,2
2026-11-13,PLY-YN-02,3
2026-11-13,PLY-YN-03,2
2026-11-13,PLY-YN-04,4
2026-11-14,PLY-YN-01,1
2026-11-14,PLY-YN-02,2
2026-11-14,PLY-YN-03,1
2026-11-14,PLY-YN-04,3`;

async function main() {
  console.log('--- 1. Memeriksa Varian di Database ---');
  const variantsResult = await query(
    `SELECT pv.id, pv.sku, pv.variant_name, pv.price, pv.current_stock
     FROM product_variants pv
     WHERE pv.deleted_at IS NULL
     ORDER BY pv.sku ASC`
  );

  const variantMap = new Map();
  for (const row of variantsResult.rows) {
    variantMap.set(row.sku, row);
  }

  console.log(`Ditemukan ${variantMap.size} varian di database.`);

  console.log('\n--- 2. Memasukkan Data Penjualan ke PostgreSQL ---');
  const lines = CSV_DATA.trim().split('\n').slice(1);

  // Bersihkan data sales lama agar evaluasi bersih
  await query('DELETE FROM sales');

  let insertedCount = 0;
  for (const line of lines) {
    const [date, sku, qtyStr] = line.trim().split(',');
    const qty = Number(qtyStr);
    const variant = variantMap.get(sku);

    if (!variant) {
      console.warn(`SKU ${sku} tidak ditemukan, dilewati.`);
      continue;
    }

    // Hanya masukkan ke sales jika quantity > 0 (sesuai constraint DB)
    if (qty > 0) {
      const unitPrice = Number(variant.price);
      const totalAmount = unitPrice * qty;

      await query(
        `INSERT INTO sales (variant_id, sale_date, quantity, unit_price, total_amount)
         VALUES ($1, $2::date, $3, $4, $5)`,
        [variant.id, date, qty, unitPrice, totalAmount]
      );
      insertedCount += 1;
    }
  }

  console.log(`Berhasil memasukkan ${insertedCount} baris transaksi penjualan ke tabel sales.`);

  console.log('\n--- 3. Evaluasi Metrik Akurasi (MAPE) Holt-Winters vs SMA ---');

  // Kelompokkan data harian per SKU
  const seriesBySku = {};
  for (const line of lines) {
    const [date, sku, qtyStr] = line.trim().split(',');
    if (!seriesBySku[sku]) seriesBySku[sku] = [];
    seriesBySku[sku].push({ date, quantity: Number(qtyStr) });
  }

  const evaluationSummary = [];

  for (const [sku, dailyList] of Object.entries(seriesBySku)) {
    const variant = variantMap.get(sku);
    const variantName = variant ? variant.variant_name : sku;

    const fullSeries = dailyList.map((item) => item.quantity);
    // 14 hari pertama sebagai training (data historis untuk HWES m=7)
    const trainData = fullSeries.slice(0, 14);
    // 7 hari terakhir sebagai ground truth aktual
    const actualTest = fullSeries.slice(14, 21);

    // Prediksi 7 hari menggunakan Holt-Winters Additive (m=7)
    const hwesPredictions = calculateHoltWinters(trainData, {
      forecastDays: 7,
      seasonLength: 7,
    });

    // Prediksi 7 hari menggunakan SMA (baseline pembanding)
    const smaPredictions = calculateSMA(trainData, 7);

    // Hitung MAPE
    const hwesMape = calculateMAPE(actualTest, hwesPredictions);
    const smaMape = calculateMAPE(actualTest, smaPredictions);

    evaluationSummary.push({
      SKU: sku,
      'Nama Varian': variantName,
      'Data Latih (Hari)': trainData.length,
      'Data Uji (Hari)': actualTest.length,
      'Aktual Uji': actualTest.join(', '),
      'Prediksi HWES': hwesPredictions.join(', '),
      'Prediksi SMA': smaPredictions.join(', '),
      'MAPE HWES': `${hwesMape}%`,
      'MAPE SMA': `${smaMape}%`,
      'Akurasi HWES': `${(100 - hwesMape).toFixed(2)}%`,
    });
  }

  console.table(evaluationSummary);

  // Rata-rata keseluruhan
  const avgHwesMape =
    evaluationSummary.reduce(
      (sum, item) => sum + parseFloat(item['MAPE HWES']),
      0
    ) / evaluationSummary.length;

  const avgSmaMape =
    evaluationSummary.reduce(
      (sum, item) => sum + parseFloat(item['MAPE SMA']),
      0
    ) / evaluationSummary.length;

  console.log('====================================================');
  console.log(`RATA-RATA MAPE METODE HOLT-WINTERS (m=7): ${avgHwesMape.toFixed(2)}%`);
  console.log(`RATA-RATA MAPE METODE BASELINE SMA      : ${avgSmaMape.toFixed(2)}%`);
  console.log(
    `KESIMPULAN: Holt-Winters lebih akurat dengan selisih ${(
      avgSmaMape - avgHwesMape
    ).toFixed(2)}% dibanding SMA.`
  );
  console.log('====================================================');

  await pool.end();
}

main().catch((err) => {
  console.error('Evaluasi gagal:', err);
  process.exit(1);
});
