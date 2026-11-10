import {
  calculateHoltWinters,
  calculateSMA,
  calculateForecast,
  calculateMAPE,
} from '../../services/hwesService.js';

describe('hwesService - Modul Holt-Winters & Metrik Evaluasi', () => {
  describe('calculateMAPE', () => {
    it('mengembalikan 0 jika data aktual dan prediksi identik', () => {
      const actuals = [10, 20, 30, 40];
      const predictions = [10, 20, 30, 40];

      expect(calculateMAPE(actuals, predictions)).toBe(0);
    });

    it('menghitung persentase kesalahan MAPE dengan benar pada contoh sederhana', () => {
      // Data: aktual 10 vs prediksi 12 (|10-12|/10 = 0.20 = 20%)
      // Data: aktual 20 vs prediksi 18 (|20-18|/20 = 0.10 = 10%)
      // Rata-rata: (20% + 10%) / 2 = 15%
      const actuals = [10, 20];
      const predictions = [12, 18];

      expect(calculateMAPE(actuals, predictions)).toBe(15);
    });

    it('menangani hari tanpa penjualan (aktual = 0) tanpa memicu division by zero', () => {
      const actuals = [0, 10, 20];
      const predictions = [0, 10, 25];
      // aktual 0 & pred 0 -> error 0
      // aktual 10 & pred 10 -> error 0
      // aktual 20 & pred 25 -> error |20-25|/20 = 25%
      // Rata-rata dari 3 titik: (0 + 0 + 25%) / 3 = 8.33%
      expect(calculateMAPE(actuals, predictions)).toBe(8.33);
    });

    it('melempar RangeError jika panjang array aktual dan prediksi berbeda', () => {
      expect(() => calculateMAPE([10, 20], [10])).toThrow(RangeError);
    });

    it('melempar TypeError jika input bukan array', () => {
      expect(() => calculateMAPE('bukan array', [10])).toThrow(TypeError);
    });

    it('mengembalikan 0 jika array kosong', () => {
      expect(calculateMAPE([], [])).toBe(0);
    });
  });

  describe('calculateForecast & calculateHoltWinters', () => {
    const fourteenDaysHistory = [
      12, 15, 10, 8, 14, 22, 25,
      13, 16, 11, 9, 15, 24, 27,
    ];

    it('skenario normal (data >= 14 hari) menggunakan HWES_M7 dan warning_flag false', () => {
      const result = calculateForecast(fourteenDaysHistory);

      expect(result.method_used).toBe('HWES_M7');
      expect(result.warning_flag).toBe(false);
      expect(result.predictions).toHaveLength(7);
      result.predictions.forEach((qty) => {
        expect(Number.isInteger(qty)).toBe(true);
        expect(qty).toBeGreaterThanOrEqual(0);
      });
    });

    it('skenario fallback (data < 14 hari) menggunakan SMA_FALLBACK dan warning_flag true', () => {
      const fiveDaysHistory = [10, 12, 15, 8, 20];
      const result = calculateForecast(fiveDaysHistory);

      expect(result.method_used).toBe('SMA_FALLBACK');
      expect(result.warning_flag).toBe(true);
      expect(result.predictions).toHaveLength(7);

      // Rata-rata 5 hari: (10 + 12 + 15 + 8 + 20) / 5 = 13
      result.predictions.forEach((qty) => {
        expect(qty).toBe(13);
      });
    });

    it('memastikan nilai prediksi negatif dibulatkan menjadi 0', () => {
      // Data tren turun drastis
      const decliningHistory = [
        100, 90, 80, 70, 60, 50, 40,
        30, 20, 10, 5, 2, 1, 0,
      ];
      const predictions = calculateHoltWinters(decliningHistory, { forecastDays: 7 });

      predictions.forEach((qty) => {
        expect(qty).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
