import { query } from '../config/db.js';
import { getVariantForecast } from './hwesService.js';

export const DEFAULT_LEAD_TIME = 3;

const toNonNegativeNumber = (value, fieldName) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RangeError(`${fieldName} harus berupa angka dan tidak negatif.`);
  }

  return parsed;
};

const normalizePredictions = (predictions) => {
  if (!Array.isArray(predictions)) {
    throw new TypeError('Data prediksi harus berupa array.');
  }

  return predictions.map((value) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new TypeError('Setiap nilai prediksi harus berupa angka.');
    }

    return parsed;
  });
};

/**
 * ROP = (D_avg x LT) + SS
 */
export const calculateReorderPoint = (
  dailyAverage,
  leadTime = DEFAULT_LEAD_TIME,
  safetyStock = 0
) => {
  const average = toNonNegativeNumber(dailyAverage, 'Rata-rata prediksi harian');
  const leadTimeDays = toNonNegativeNumber(leadTime, 'Lead time');
  const stock = toNonNegativeNumber(safetyStock, 'Safety stock');

  return Math.max(0, Math.round(average * leadTimeDays + stock));
};

/**
 * Q = F_total + SS - C_stock
 */
export const calculateOrderQuantity = (
  forecastTotal,
  safetyStock = 0,
  currentStock = 0
) => {
  const total = toNonNegativeNumber(forecastTotal, 'Total prediksi');
  const stock = toNonNegativeNumber(safetyStock, 'Safety stock');
  const availableStock = toNonNegativeNumber(currentStock, 'Stok saat ini');

  return Math.max(0, Math.round(total + stock - availableStock));
};

export const calculateRestockRecommendation = ({
  predictions,
  minStock,
  currentStock,
  leadTime = DEFAULT_LEAD_TIME,
}) => {
  const forecastValues = normalizePredictions(predictions);
  const safetyStock = toNonNegativeNumber(minStock, 'Stok minimum');
  const stock = toNonNegativeNumber(currentStock, 'Stok saat ini');
  const leadTimeDays = toNonNegativeNumber(leadTime, 'Lead time');

  const forecastTotal = forecastValues.reduce(
    (total, value) => total + value,
    0
  );
  const dailyAverage =
    forecastValues.length > 0 ? forecastTotal / forecastValues.length : 0;

  const reorderPoint = calculateReorderPoint(
    dailyAverage,
    leadTimeDays,
    safetyStock
  );
  const orderQuantity = calculateOrderQuantity(
    forecastTotal,
    safetyStock,
    stock
  );

  return {
    reorder_point: reorderPoint,
    order_quantity: orderQuantity,
    needs_restock: orderQuantity > 0,
  };
};

/**
 * 
 
 */
export const getRestockRecommendation = async (variantId) => {
  try {
    const variantResult = await query(
      `SELECT id, current_stock, min_stock
       FROM product_variants
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [variantId]
    );

    const variant = variantResult.rows[0];

    if (!variant) {
      return null;
    }

    const forecastResult = await getVariantForecast(variantId);
    const restockRecommendation = calculateRestockRecommendation({
      predictions: forecastResult.predictions,
      minStock: variant.min_stock,
      currentStock: variant.current_stock,
      leadTime: DEFAULT_LEAD_TIME,
    });

    return {
      variant_id: variant.id,
      method_used: forecastResult.method_used,
      warning_flag: forecastResult.warning_flag,
      forecast: forecastResult.forecast,
      restock_recommendation: restockRecommendation,
    };
  } catch (error) {
    console.error('Get restock recommendation error:', error);
    throw error;
  }
};

export const calculateRop = calculateReorderPoint;
export const calculateQ = calculateOrderQuantity;

export default {
  DEFAULT_LEAD_TIME,
  calculateReorderPoint,
  calculateOrderQuantity,
  calculateRestockRecommendation,
  calculateRop,
  calculateQ,
  getRestockRecommendation,
};
