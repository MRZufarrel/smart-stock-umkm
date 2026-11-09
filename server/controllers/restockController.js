import pool from '../config/db.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidUuid = (value) =>
  typeof value === 'string' && UUID_PATTERN.test(value);

const isValidDate = (value) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const parsePositiveInteger = (value) => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value.trim());

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const rollbackQuietly = async (client) => {
  try {
    await client.query('ROLLBACK');
  } catch (rollbackError) {
    console.error('Rollback error:', rollbackError);
  }
};

export const createRestock = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (!isValidUuid(body.variant_id)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Format variant_id tidak valid.',
      });
    }

    const quantity = parsePositiveInteger(body.quantity);

    if (quantity === null) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'quantity harus bilangan bulat lebih dari 0.',
      });
    }

    const restockDate =
      typeof body.restock_date === 'string' && body.restock_date.trim()
        ? body.restock_date.trim()
        : null;

    if (restockDate !== null && !isValidDate(restockDate)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'restock_date harus berformat YYYY-MM-DD dan tanggal harus valid.',
      });
    }

    const supplierNote =
      typeof body.supplier_note === 'string' ? body.supplier_note.trim() || null : null;

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query('BEGIN');
      transactionOpen = true;

      const variantResult = await client.query(
        `SELECT pv.id, pv.current_stock
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         WHERE pv.id = $1
           AND pv.deleted_at IS NULL
           AND p.deleted_at IS NULL
         FOR UPDATE OF pv`,
        [body.variant_id]
      );

      if (variantResult.rows.length === 0) {
        await client.query('ROLLBACK');
        transactionOpen = false;

        return res.status(404).json({
          status: 'error',
          code: 'VARIANT_NOT_FOUND',
          message: 'Varian produk tidak ditemukan.',
        });
      }

      const restockResult = await client.query(
        `INSERT INTO restock_records (variant_id, restock_date, quantity, supplier_note)
         VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4)
         RETURNING id, variant_id,
                   TO_CHAR(restock_date, 'YYYY-MM-DD') AS restock_date,
                   quantity, supplier_note, created_at`,
        [body.variant_id, restockDate, quantity, supplierNote]
      );

      const stockResult = await client.query(
        `UPDATE product_variants
         SET current_stock = current_stock + $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING current_stock`,
        [body.variant_id, quantity]
      );

      await client.query('COMMIT');
      transactionOpen = false;

      return res.status(201).json({
        status: 'success',
        message: 'Restock berhasil dicatat dan stok diperbarui.',
        data: {
          ...restockResult.rows[0],
          updated_stock: stockResult.rows[0].current_stock,
        },
      });
    } catch (error) {
      if (transactionOpen) {
        await rollbackQuietly(client);
      }

      console.error('Create restock error:', error);

      if (error.code === '23514') {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Nilai data tidak memenuhi aturan database.',
        });
      }

      return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan pada server.',
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create restock error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export const getRestockHistory = async (req, res) => {
  try {
    const { variant_id } = req.query;

    const conditions = [];
    const params = [];

    if (variant_id) {
      if (!isValidUuid(variant_id)) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Format variant_id tidak valid.',
        });
      }

      params.push(variant_id);
      conditions.push(`rr.variant_id = $${params.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT rr.id, rr.variant_id, rr.quantity, rr.supplier_note, rr.created_at,
              TO_CHAR(rr.restock_date, 'YYYY-MM-DD') AS restock_date,
              pv.sku, pv.variant_name, p.name AS product_name
       FROM restock_records rr
       JOIN product_variants pv ON pv.id = rr.variant_id
       JOIN products p ON p.id = pv.product_id
       ${whereClause}
       ORDER BY rr.restock_date DESC, rr.created_at DESC
       LIMIT 200`,
      params
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get restock history error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export default {
  createRestock,
  getRestockHistory,
};
