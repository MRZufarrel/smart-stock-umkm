import { Readable } from 'node:stream';
import csvParser from 'csv-parser';
import pool, { query } from '../config/db.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

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

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

const rollbackQuietly = async (client) => {
  try {
    await client.query('ROLLBACK');
  } catch (rollbackError) {
    console.error('Rollback error:', rollbackError);
  }
};

const formatSale = (row) => ({
  id: row.id,
  variant_id: row.variant_id,
  sale_date: row.sale_date,
  quantity: row.quantity,
  unit_price: Number(row.unit_price),
  total_amount: Number(row.total_amount),
});

const handleDatabaseError = (res, error) => {
  if (error.code === '23514') {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Nilai data tidak memenuhi aturan database.',
    });
  }

  if (error.code === '22P02') {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Format data yang dikirim tidak valid.',
    });
  }

  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Terjadi kesalahan pada server.',
  });
};

const parseCsvBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const rows = [];

    const stream = Readable.from([buffer]);
    const parser = csvParser({
      strict: true,
      mapHeaders: ({ header }) =>
        header.replace(/^\uFEFF/, '').trim().toLowerCase(),
    });

    stream
      .pipe(parser)
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', (error) => reject(error));
  });

const normalizeCsvRows = (rows) => {
  if (rows.length === 0) {
    throw new HttpError(
      422,
      'EMPTY_CSV',
      'File CSV tidak memiliki baris data.'
    );
  }

  return rows.map((row, index) => {
    const rowNumber = index + 2;

    if (
      !isPlainObject(row) ||
      !hasOwn(row, 'sale_date') ||
      !hasOwn(row, 'sku') ||
      !hasOwn(row, 'quantity')
    ) {
      throw new HttpError(
        422,
        'INVALID_CSV_FORMAT',
        `Baris ${rowNumber}: kolom sale_date, sku, dan quantity wajib ada.`
      );
    }

    const saleDate =
      typeof row.sale_date === 'string' ? row.sale_date.trim() : '';
    const sku = typeof row.sku === 'string' ? row.sku.trim() : '';
    const quantity = parsePositiveInteger(row.quantity);

    if (!isValidDate(saleDate)) {
      throw new HttpError(
        422,
        'INVALID_DATE',
        `Baris ${rowNumber}: format sale_date harus YYYY-MM-DD dan tanggal harus valid.`
      );
    }

    if (!sku) {
      throw new HttpError(
        422,
        'INVALID_CSV_FORMAT',
        `Baris ${rowNumber}: SKU wajib diisi.`
      );
    }

    if (quantity === null) {
      throw new HttpError(
        422,
        'INVALID_QUANTITY',
        `Baris ${rowNumber}: quantity harus bilangan bulat lebih dari 0.`
      );
    }

    return {
      rowNumber,
      saleDate,
      sku,
      quantity,
    };
  });
};

export const getSales = async (req, res) => {
  try {
    const { start_date, end_date, search, variant_id } = req.query;

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
      conditions.push(`s.variant_id = $${params.length}`);
    }

    if (start_date) {
      if (!isValidDate(start_date)) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'start_date harus berformat YYYY-MM-DD dan tanggal harus valid.',
        });
      }

      params.push(start_date);
      conditions.push(`s.sale_date >= $${params.length}::date`);
    }

    if (end_date) {
      if (!isValidDate(end_date)) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'end_date harus berformat YYYY-MM-DD dan tanggal harus valid.',
        });
      }

      params.push(end_date);
      conditions.push(`s.sale_date <= $${params.length}::date`);
    }

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(
        `(LOWER(pv.sku) LIKE $${params.length} OR LOWER(pv.variant_name) LIKE $${params.length} OR LOWER(p.name) LIKE $${params.length})`
      );
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await query(
      `SELECT s.id, s.variant_id,
              TO_CHAR(s.sale_date, 'YYYY-MM-DD') AS sale_date,
              s.quantity, s.unit_price, s.total_amount,
              pv.sku, pv.variant_name,
              p.name AS product_name
       FROM sales s
       JOIN product_variants pv ON pv.id = s.variant_id
       JOIN products p ON p.id = pv.product_id
       ${whereClause}
       ORDER BY s.sale_date DESC, s.created_at DESC
       LIMIT 500`,
      params
    );

    const data = result.rows.map((row) => ({
      id: row.id,
      variant_id: row.variant_id,
      sale_date: row.sale_date,
      quantity: row.quantity,
      unit_price: Number(row.unit_price),
      total_amount: Number(row.total_amount),
      sku: row.sku,
      variant_name: row.variant_name,
      product_name: row.product_name,
    }));

    return res.status(200).json({
      status: 'success',
      data,
    });
  } catch (error) {
    console.error('Get sales error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export const createSale = async (req, res) => {
  try {
    const body = isPlainObject(req.body) ? req.body : {};

    if (!isValidUuid(body.variant_id)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Format variant_id tidak valid.',
      });
    }

    if (!isValidDate(body.sale_date)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'sale_date wajib diisi dengan format YYYY-MM-DD.',
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

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query('BEGIN');
      transactionOpen = true;

      const variantResult = await client.query(
        `SELECT pv.id, pv.price, pv.current_stock
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         WHERE pv.id = $1
           AND pv.deleted_at IS NULL
           AND p.deleted_at IS NULL
         FOR UPDATE OF pv`,
        [body.variant_id]
      );

      const variant = variantResult.rows[0];

      if (!variant) {
        throw new HttpError(
          404,
          'VARIANT_NOT_FOUND',
          'Varian produk tidak ditemukan.'
        );
      }

      if (variant.current_stock < quantity) {
        throw new HttpError(
          409,
          'INSUFFICIENT_STOCK',
          'Stok varian tidak mencukupi.'
        );
      }

      const updateResult = await client.query(
        `UPDATE product_variants
         SET current_stock = current_stock - $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND current_stock >= $2
         RETURNING current_stock`,
        [variant.id, quantity]
      );

      if (updateResult.rows.length === 0) {
        throw new HttpError(
          409,
          'INSUFFICIENT_STOCK',
          'Stok varian tidak mencukupi.'
        );
      }

      const saleResult = await client.query(
        `INSERT INTO sales
           (variant_id, sale_date, quantity, unit_price, total_amount)
         VALUES ($1, $2, $3, $4, ROUND($4::numeric * $3::int, 2))
         RETURNING id, variant_id,
                   TO_CHAR(sale_date, 'YYYY-MM-DD') AS sale_date,
                   quantity, unit_price, total_amount`,
        [variant.id, body.sale_date, quantity, variant.price]
      );

      await client.query('COMMIT');
      transactionOpen = false;

      return res.status(201).json({
        status: 'success',
        message: 'Penjualan berhasil dicatat.',
        data: formatSale(saleResult.rows[0]),
      });
    } catch (error) {
      if (transactionOpen) {
        await rollbackQuietly(client);
      }

      if (error instanceof HttpError) {
        return res.status(error.status).json({
          status: 'error',
          code: error.code,
          message: error.message,
        });
      }

      console.error('Create sale error:', error);

      return handleDatabaseError(res, error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create sale error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export const importSalesCsv = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        code: 'FILE_REQUIRED',
        message: 'File CSV wajib diunggah pada field "file".',
      });
    }

    const originalName = req.file.originalname || '';

    if (!originalName.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_FILE_TYPE',
        message: 'File yang diunggah harus berformat .csv.',
      });
    }

    let rows;

    try {
      rows = await parseCsvBuffer(req.file.buffer);
    } catch (parseError) {
      console.error('CSV parse error:', parseError);

      return res.status(422).json({
        status: 'error',
        code: 'INVALID_CSV_FORMAT',
        message: 'File CSV tidak dapat dibaca atau formatnya tidak valid.',
      });
    }

    let normalizedRows;

    try {
      normalizedRows = normalizeCsvRows(rows);
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({
          status: 'error',
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query('BEGIN');
      transactionOpen = true;

      let insertedRows = 0;

      for (const row of normalizedRows) {
        const variantResult = await client.query(
          `SELECT pv.id, pv.price, pv.current_stock
           FROM product_variants pv
           JOIN products p ON p.id = pv.product_id
           WHERE pv.sku = $1
             AND pv.deleted_at IS NULL
             AND p.deleted_at IS NULL
           FOR UPDATE OF pv`,
          [row.sku]
        );

        const variant = variantResult.rows[0];

        if (!variant) {
          throw new HttpError(
            422,
            'SKU_NOT_FOUND',
            `Baris ${row.rowNumber}: SKU "${row.sku}" tidak ditemukan.`
          );
        }

        if (variant.current_stock < row.quantity) {
          throw new HttpError(
            422,
            'INSUFFICIENT_STOCK',
            `Baris ${row.rowNumber}: stok SKU "${row.sku}" tidak mencukupi.`
          );
        }

        const updateResult = await client.query(
          `UPDATE product_variants
           SET current_stock = current_stock - $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND current_stock >= $2
           RETURNING current_stock`,
          [variant.id, row.quantity]
        );

        if (updateResult.rows.length === 0) {
          throw new HttpError(
            422,
            'INSUFFICIENT_STOCK',
            `Baris ${row.rowNumber}: stok SKU "${row.sku}" tidak mencukupi.`
          );
        }

        await client.query(
          `INSERT INTO sales
             (variant_id, sale_date, quantity, unit_price, total_amount)
           VALUES ($1, $2, $3, $4, ROUND($4::numeric * $3::int, 2))`,
          [variant.id, row.saleDate, row.quantity, variant.price]
        );

        insertedRows += 1;
      }

      await client.query('COMMIT');
      transactionOpen = false;

      return res.status(200).json({
        status: 'success',
        inserted_rows: insertedRows,
      });
    } catch (error) {
      if (transactionOpen) {
        await rollbackQuietly(client);
      }

      if (error instanceof HttpError) {
        return res.status(error.status).json({
          status: 'error',
          code: error.code,
          message: error.message,
        });
      }

      console.error('Import sales CSV error:', error);

      return handleDatabaseError(res, error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Import sales CSV error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export default {
  getSales,
  createSale,
  importSalesCsv,
};
