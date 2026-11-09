import { getRestockRecommendation } from '../services/restockService.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUuid = (value) =>
  typeof value === 'string' && UUID_PATTERN.test(value);

export const getForecasting = async (req, res) => {
  try {
    const { variant_id: variantId } = req.params;

    if (!isValidUuid(variantId)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Format variant_id tidak valid.',
      });
    }

    const result = await getRestockRecommendation(variantId);

    if (!result) {
      return res.status(404).json({
        status: 'error',
        code: 'VARIANT_NOT_FOUND',
        message: 'Varian produk tidak ditemukan.',
      });
    }

    return res.status(200).json({
      status: 'success',
      variant_id: result.variant_id,
      method_used: result.method_used,
      warning_flag: result.warning_flag,
      message: result.message || undefined,
      forecast: result.forecast,
      restock_recommendation: result.restock_recommendation,
    });
  } catch (error) {
    console.error('Get forecasting error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export default {
  getForecasting,
};
