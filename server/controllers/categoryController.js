import pool, { query } from '../config/db.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUuid = (value) =>
  typeof value === 'string' && UUID_PATTERN.test(value);

export const getCategories = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, created_at, updated_at
       FROM categories
       ORDER BY name ASC`
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows,
    });
  } catch (error) {
    console.error('Get categories error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export const createCategory = async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    if (!name) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Nama kategori wajib diisi.',
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Nama kategori maksimal 100 karakter.',
      });
    }

    const result = await query(
      `INSERT INTO categories (name)
       VALUES ($1)
       RETURNING id, name, created_at, updated_at`,
      [name]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Kategori berhasil ditambahkan.',
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        code: 'DUPLICATE_CATEGORY',
        message: 'Nama kategori sudah digunakan.',
      });
    }

    console.error('Create category error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Format ID kategori tidak valid.',
      });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    if (!name) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Nama kategori wajib diisi.',
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Nama kategori maksimal 100 karakter.',
      });
    }

    const result = await query(
      `UPDATE categories
       SET name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, created_at, updated_at`,
      [name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'CATEGORY_NOT_FOUND',
        message: 'Kategori tidak ditemukan.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Kategori berhasil diperbarui.',
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        status: 'error',
        code: 'DUPLICATE_CATEGORY',
        message: 'Nama kategori sudah digunakan.',
      });
    }

    console.error('Update category error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Format ID kategori tidak valid.',
      });
    }

    const inUse = await query(
      `SELECT p.id
       FROM products p
       LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
       WHERE p.category_id = $1 AND p.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );

    if (inUse.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        code: 'CATEGORY_IN_USE',
        message:
          'Kategori tidak dapat dihapus karena masih digunakan oleh produk atau varian aktif.',
      });
    }

    const result = await query(
      `DELETE FROM categories WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'CATEGORY_NOT_FOUND',
        message: 'Kategori tidak ditemukan.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Kategori berhasil dihapus.',
      data: { id },
    });
  } catch (error) {
    console.error('Delete category error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export default {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
