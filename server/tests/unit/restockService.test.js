import {
  calculateReorderPoint,
  calculateOrderQuantity,
  calculateRestockRecommendation,
  DEFAULT_LEAD_TIME,
} from '../../services/restockService.js';

describe('restockService - Modul Kalkulasi Restock', () => {
  describe('calculateReorderPoint', () => {
    it('menghitung ROP dengan benar sesuai formula (D_avg * LT) + SS', () => {
      // Skenario dokumen TEST-PLAN.md: D_avg = 10, LT = 3, SS = 5 -> ROP = 35
      const reorderPoint = calculateReorderPoint(10, 3, 5);
      expect(reorderPoint).toBe(35);
    });

    it('menggunakan default lead time (3 hari) dan safety stock 0 jika tidak ditentukan', () => {
      // 12 * 3 + 0 = 36
      const reorderPoint = calculateReorderPoint(12);
      expect(reorderPoint).toBe(12 * DEFAULT_LEAD_TIME);
    });

    it('melempar RangeError jika input bernilai negatif', () => {
      expect(() => calculateReorderPoint(-1, 3, 5)).toThrow(RangeError);
      expect(() => calculateReorderPoint(10, -3, 5)).toThrow(RangeError);
      expect(() => calculateReorderPoint(10, 3, -5)).toThrow(RangeError);
    });

    it('melempar RangeError jika input bukan angka valid', () => {
      expect(() => calculateReorderPoint('bukan angka', 3, 5)).toThrow(RangeError);
    });
  });

  describe('calculateOrderQuantity', () => {
    it('menghitung kuantitas order (Q) dengan benar saat stok kurang', () => {
      // Skenario dokumen TEST-PLAN.md: F_total = 70, SS = 5, C_stock = 20 -> Q = 55
      const orderQuantity = calculateOrderQuantity(70, 5, 20);
      expect(orderQuantity).toBe(55);
    });

    it('mengembalikan 0 jika stok saat ini mencukupi (hasil formula negatif)', () => {
      // Skenario dokumen TEST-PLAN.md: F_total = 10, SS = 5, C_stock = 30 -> 10 + 5 - 30 = -15 -> Q = 0
      const orderQuantity = calculateOrderQuantity(10, 5, 30);
      expect(orderQuantity).toBe(0);
    });

    it('melempar RangeError jika parameter bernilai negatif', () => {
      expect(() => calculateOrderQuantity(-10, 5, 20)).toThrow(RangeError);
      expect(() => calculateOrderQuantity(70, -5, 20)).toThrow(RangeError);
      expect(() => calculateOrderQuantity(70, 5, -20)).toThrow(RangeError);
    });
  });

  describe('calculateRestockRecommendation', () => {
    it('menghasilkan rekomendasi restock lengkap saat stok berada di bawah batas aman', () => {
      // 7 hari prediksi dengan total 70 unit (rata-rata 10 unit/hari)
      const predictions = [10, 10, 10, 10, 10, 10, 10];
      const recommendation = calculateRestockRecommendation({
        predictions,
        minStock: 5,
        currentStock: 20,
        leadTime: 3,
      });

      // ROP = (10 * 3) + 5 = 35
      // Q = 70 + 5 - 20 = 55
      expect(recommendation.reorder_point).toBe(35);
      expect(recommendation.order_quantity).toBe(55);
      expect(recommendation.needs_restock).toBe(true);
    });

    it('menandai needs_restock false saat stok mencukupi kebutuhan prediksi', () => {
      const predictions = [2, 1, 1, 2, 1, 2, 1]; // Total = 10, rata-rata = 10/7
      const recommendation = calculateRestockRecommendation({
        predictions,
        minStock: 5,
        currentStock: 30,
        leadTime: 3,
      });

      expect(recommendation.order_quantity).toBe(0);
      expect(recommendation.needs_restock).toBe(false);
    });

    it('melempar TypeError jika data prediksi bukan array atau berisi elemen non-numerik', () => {
      expect(() =>
        calculateRestockRecommendation({
          predictions: 'bukan array',
          minStock: 5,
          currentStock: 10,
        })
      ).toThrow(TypeError);

      expect(() =>
        calculateRestockRecommendation({
          predictions: [10, 'tidak valid', 5],
          minStock: 5,
          currentStock: 10,
        })
      ).toThrow(TypeError);
    });
  });
});
