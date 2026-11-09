import { query } from '../config/db.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_PARAMS = Object.freeze({
  seasonLength: 7,
  alpha: 0.2,
  beta: 0.1,
  gamma: 0.3,
  forecastDays: 7,
  minDataPoints: 14,
  lookbackDays: 14,
});

const normalizeSeries = (series) => {
  if (!Array.isArray(series)) {
    throw new TypeError('Data historis harus berupa array.');
  }

  return series.map((value) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new TypeError('Setiap nilai data historis harus berupa angka.');
    }

    return parsed;
  });
};

const normalizeOptions = (options = {}) => {
  const seasonLength = Number(
    options.seasonLength ?? options.m ?? DEFAULT_PARAMS.seasonLength
  );
  const alpha = Number(options.alpha ?? DEFAULT_PARAMS.alpha);
  const beta = Number(options.beta ?? DEFAULT_PARAMS.beta);
  const gamma = Number(options.gamma ?? DEFAULT_PARAMS.gamma);
  const forecastDays = Number(
    options.forecastDays ?? DEFAULT_PARAMS.forecastDays
  );
  const minDataPoints = Number(
    options.minDataPoints ?? DEFAULT_PARAMS.minDataPoints
  );

  if (!Number.isInteger(seasonLength) || seasonLength <= 0) {
    throw new RangeError('Panjang musim (m) harus bilangan bulat positif.');
  }

  if (!Number.isInteger(forecastDays) || forecastDays <= 0) {
    throw new RangeError('Jumlah hari prediksi harus bilangan bulat positif.');
  }

  if (!Number.isInteger(minDataPoints) || minDataPoints <= 0) {
    throw new RangeError('Minimal data historis harus bilangan bulat positif.');
  }

  for (const [name, value] of [
    ['alpha', alpha],
    ['beta', beta],
    ['gamma', gamma],
  ]) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`Parameter ${name} harus berada di antara 0 dan 1.`);
    }
  }

  return {
    seasonLength,
    alpha,
    beta,
    gamma,
    forecastDays,
    minDataPoints,
  };
};

const padDatePart = (value) => String(value).padStart(2, '0');

const parseDateToUtc = (dateString) => {
  if (typeof dateString !== 'string' || !DATE_PATTERN.test(dateString)) {
    throw new TypeError('Format tanggal harus YYYY-MM-DD.');
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError('Tanggal tidak valid.');
  }

  return timestamp;
};

export const formatDate = (date) => {
  const timestamp = date instanceof Date ? date.getTime() : Number(date);

  if (!Number.isFinite(timestamp)) {
    throw new TypeError('Tanggal tidak valid.');
  }

  const parsed = new Date(timestamp);
  const year = parsed.getUTCFullYear();
  const month = padDatePart(parsed.getUTCMonth() + 1);
  const day = padDatePart(parsed.getUTCDate());

  return `${year}-${month}-${day}`;
};

export const addDays = (dateString, days) => {
  const offset = Number(days);

  if (!Number.isInteger(offset)) {
    throw new TypeError('Jumlah hari harus bilangan bulat.');
  }

  return formatDate(parseDateToUtc(dateString) + offset * MS_PER_DAY);
};

export const todayIso = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
    new Date()
  );

export const roundQuantity = (value) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.round(parsed);
};

/**
 * Holt-Winters Additive (m = 7) sesuai docs/hwes-spec.md.
 * Mengembalikan array nilai prediksi harian sepanjang `forecastDays`.
 */
export const calculateHoltWinters = (series, options = {}) => {
  const values = normalizeSeries(series);
  const {
    seasonLength,
    alpha,
    beta,
    gamma,
    forecastDays,
    minDataPoints,
  } = normalizeOptions(options);

  if (values.length < minDataPoints || values.length < seasonLength * 2) {
    console.warn(`Holt-Winters data insufficient. Fallback to 0. Length: ${values.length}`);
    return new Array(forecastDays).fill(0);
  }

  const firstSeason = values.slice(0, seasonLength);
  const secondSeason = values.slice(seasonLength, seasonLength * 2);

  let level =
    firstSeason.reduce((total, value) => total + value, 0) / seasonLength;
  const firstSeasonTotal = firstSeason.reduce(
    (total, value) => total + value,
    0
  );
  const secondSeasonTotal = secondSeason.reduce(
    (total, value) => total + value,
    0
  );
  let trend =
    (secondSeasonTotal - firstSeasonTotal) / (seasonLength * seasonLength);

  const seasonal = new Array(values.length).fill(0);

  for (let index = 0; index < seasonLength; index += 1) {
    seasonal[index] = values[index] - level;
  }

  for (let index = seasonLength; index < values.length; index += 1) {
    const previousLevel = level;
    const seasonalIndex = index - seasonLength;

    level =
      alpha * (values[index] - seasonal[seasonalIndex]) +
      (1 - alpha) * (previousLevel + trend);
    trend =
      beta * (level - previousLevel) + (1 - beta) * trend;
    seasonal[index] =
      gamma * (values[index] - level) +
      (1 - gamma) * seasonal[seasonalIndex];
  }

  const n = values.length;
  const m = seasonLength;
  const predictions = [];

  for (let step = 1; step <= forecastDays; step += 1) {
    const seasonalIndex = n - m + ((step - 1) % m);
    const seasonalFactor = seasonal[seasonalIndex] || 0;
    const rawPrediction = level + (step * trend) + seasonalFactor;

    predictions.push(roundQuantity(rawPrediction));
  }

  return predictions;
};

/**
 * Fallback SMA: rata-rata seluruh data yang tersedia.
 * Jika `period` diberikan, hanya `period` data terakhir yang dipakai.
 */
export const calculateSMA = (series, forecastDays = 7, period = null) => {
  const values = normalizeSeries(series);
  const totalDays = Number(forecastDays);

  if (!Number.isInteger(totalDays) || totalDays <= 0) {
    throw new RangeError('Jumlah hari prediksi harus bilangan bulat positif.');
  }

  if (values.length === 0) {
    return new Array(totalDays).fill(0);
  }

  const windowSize =
    period === null || period === undefined
      ? values.length
      : Math.min(Number(period), values.length);
  const selectedValues = values.slice(values.length - windowSize);
  const average =
    selectedValues.reduce((total, value) => total + value, 0) /
    selectedValues.length;

  return new Array(totalDays).fill(roundQuantity(average));
};

export const calculateHWES = calculateHoltWinters;

/**
 * Memilih HWES_M7 atau SMA_FALLBACK dan mengembalikan metadata hasil.
 */
export const calculateForecast = (series, options = {}) => {
  const values = normalizeSeries(series);
  const {
    forecastDays,
    minDataPoints,
  } = normalizeOptions(options);

  if (values.length === 0) {
    return {
      method_used: 'SMA_FALLBACK',
      warning_flag: true,
      predictions: new Array(forecastDays).fill(0),
    };
  }

  if (values.length < minDataPoints) {
    return {
      method_used: 'SMA_FALLBACK',
      warning_flag: true,
      predictions: calculateSMA(values, forecastDays),
    };
  }

  return {
    method_used: 'HWES_M7',
    warning_flag: false,
    predictions: calculateHoltWinters(values, options),
  };
};

/**
 * Mengambil penjualan harian dalam jendela historis (default 14 hari)
 * yang berpatokan pada hari. Hari tanpa transaksi diisi 0.
 */
export const getHistoricalDailySales = async (
  variantId,
  lookbackDays = DEFAULT_PARAMS.lookbackDays
) => {
  try {
    const today = todayIso();
    const result = await query(
      `SELECT TO_CHAR(gs.day_date, 'YYYY-MM-DD') AS date,
              COALESCE(SUM(s.quantity), 0)::int AS quantity
       FROM generate_series(
         ($2::date - ($3 * interval '1 day')),
         $2::date,
         interval '1 day'
       ) AS gs(day_date)
       LEFT JOIN sales s
         ON s.variant_id = $1
        AND s.sale_date = gs.day_date::date
       GROUP BY gs.day_date
       ORDER BY gs.day_date ASC`,
      [variantId, today, lookbackDays - 1]
    );

    return result.rows.map((row) => ({
      date: row.date,
      quantity: Number(row.quantity),
    }));
  } catch (error) {
    console.error('Get historical daily sales error:', error);
    throw error;
  }
};
const buildForecastDates = (referenceDate, forecastDays) =>
  Array.from({ length: forecastDays }, (_, index) => ({
    date: addDays(referenceDate, index + 1),
  }));

/**
 * Mengambil data historis lalu menghitung prediksi 7 hari ke depan.
 */
export const getVariantForecast = async (variantId, options = {}) => {
  try {
    const { forecastDays } = normalizeOptions(options);
    const history = await getHistoricalDailySales(variantId);
    const referenceDate = todayIso();

    const calculation = calculateForecast(
      history.map((row) => row.quantity),
      options
    );

    const dates = buildForecastDates(referenceDate, forecastDays);
    const forecast = calculation.predictions.map((predictedQty, index) => ({
      date: dates[index].date,
      predicted_qty: predictedQty,
    }));

    return {
      method_used: calculation.method_used,
      warning_flag: calculation.warning_flag,
      reference_date: referenceDate,
      history,
      forecast,
      predictions: calculation.predictions,
    };
  } catch (error) {
    console.error('Get variant forecast error:', error);
    throw error;
  }
};

export default {
  DEFAULT_PARAMS,
  addDays,
  formatDate,
  todayIso,
  roundQuantity,
  calculateHoltWinters,
  calculateHWES,
  calculateSMA,
  calculateForecast,
  getHistoricalDailySales,
  getVariantForecast,
};
