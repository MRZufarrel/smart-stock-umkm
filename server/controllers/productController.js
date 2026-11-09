import pool, { query } from '../config/db.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const isValidUuid = (value) =>
  typeof value === 'string' && UUID_PATTERN.test(value);

const parseNonNegativeNumber = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
};

const parseNonNegativeInteger = (value) => {
  const parsed = parseNonNegativeNumber(value);

  if (parsed === null || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
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

const formatVariant = (row) => ({
  id: row.id,
  sku: row.sku,
  variant_name: row.variant_name,
  price: Number(row.price),
  current_stock: row.current_stock,
  min_stock: row.min_stock,
});

const formatProduct = (productRow, variantRows) => ({
  id: productRow.id,
  category_id: productRow.category_id,
  name: productRow.name,
  description: productRow.description,
  category_name: productRow.category_name,
  variants: variantRows.map(formatVariant),
});

const fetchProductWithVariants = async (db, productId) => {
  const productResult = await db.query(
    `SELECT p.id, p.category_id, p.name, p.description, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1 AND p.deleted_at IS NULL`,
    [productId]
  );

  const product = productResult.rows[0];

  if (!product) {
    return null;
  }

  const variantsResult = await db.query(
    `SELECT id, sku, variant_name, price, current_stock, min_stock
     FROM product_variants
     WHERE product_id = $1 AND deleted_at IS NULL
     ORDER BY created_at ASC, sku ASC`,
    [productId]
  );

  return formatProduct(product, variantsResult.rows);
};

const validateProductFields = (body, { requireName }) => {
  const data = {};

  if (requireName || hasOwn(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return { error: 'Nama produk wajib diisi.' };
    }

    if (body.name.trim().length > 255) {
      return { error: 'Nama produk maksimal 255 karakter.' };
    }

    data.name = body.name.trim();
  }

  if (hasOwn(body, 'category_id')) {
    if (body.category_id === null) {
      data.category_id = null;
    } else if (!isValidUuid(body.category_id)) {
      return { error: 'Format category_id tidak valid.' };
    } else {
      data.category_id = body.category_id;
    }
  }

  if (hasOwn(body, 'description')) {
    if (body.description !== null && typeof body.description !== 'string') {
      return { error: 'Deskripsi produk harus berupa teks atau null.' };
    }

    data.description =
      body.description === null ? null : body.description.trim();
  }

  return { data };
};

const validateVariantFields = (raw, { requireCoreFields }) => {
  if (!isPlainObject(raw)) {
    return { error: 'Setiap varian harus berupa objek.' };
  }

  const data = {};

  if (requireCoreFields || hasOwn(raw, 'sku')) {
    if (typeof raw.sku !== 'string' || !raw.sku.trim()) {
      return { error: 'SKU varian wajib diisi.' };
    }

    if (raw.sku.trim().length > 100) {
      return { error: 'SKU varian maksimal 100 karakter.' };
    }

    data.sku = raw.sku.trim();
  }

  if (requireCoreFields || hasOwn(raw, 'variant_name')) {
    if (typeof raw.variant_name !== 'string' || !raw.variant_name.trim()) {
      return { error: 'Nama varian wajib diisi.' };
    }

    if (raw.variant_name.trim().length > 150) {
      return { error: 'Nama varian maksimal 150 karakter.' };
    }

    data.variant_name = raw.variant_name.trim();
  }

  if (requireCoreFields || hasOwn(raw, 'price')) {
    const price = parseNonNegativeNumber(raw.price);

    if (price === null) {
      return { error: 'Harga varian wajib berupa angka dan tidak boleh negatif.' };
    }

    data.price = price;
  }

  if (hasOwn(raw, 'current_stock')) {
    const currentStock = parseNonNegativeInteger(raw.current_stock);

    if (currentStock === null) {
      return {
        error: 'Stok saat ini wajib berupa bilangan bulat dan tidak boleh negatif.',
      };
    }

    data.current_stock = currentStock;
  }

  if (hasOwn(raw, 'min_stock')) {
    const minStock = parseNonNegativeInteger(raw.min_stock);

    if (minStock === null) {
      return {
        error: 'Stok minimum wajib berupa bilangan bulat dan tidak boleh negatif.',
      };
    }

    data.min_stock = minStock;
  }

  return { data };
};

const handleDatabaseError = (res, error) => {
  if (error.code === '23505') {
    return res.status(409).json({
      status: 'error',
      code: 'DUPLICATE_SKU',
      message: 'SKU sudah digunakan oleh varian lain.',
    });
  }

  if (error.code === '23503') {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_CATEGORY',
      message: 'Kategori yang dipilih tidak ditemukan.',
    });
  }

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

export const getProducts = async (req, res) => {
  try {
    const productsResult = await query(
      `SELECT p.id, p.category_id, p.name, p.description, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.deleted_at IS NULL
       ORDER BY p.name ASC, p.id ASC`
    );

    if (productsResult.rows.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: [],
      });
    }

    const productIds = productsResult.rows.map((product) => product.id);

    const variantsResult = await query(
      `SELECT id, product_id, sku, variant_name, price, current_stock, min_stock
       FROM product_variants
       WHERE product_id = ANY($1::uuid[]) AND deleted_at IS NULL
       ORDER BY created_at ASC, sku ASC`,
      [productIds]
    );

    const variantsByProduct = new Map();

    for (const variant of variantsResult.rows) {
      if (!variantsByProduct.has(variant.product_id)) {
        variantsByProduct.set(variant.product_id, []);
      }

      variantsByProduct.get(variant.product_id).push(variant);
    }

    const data = productsResult.rows.map((product) =>
      formatProduct(product, variantsByProduct.get(product.id) || [])
    );

    return res.status(200).json({
      status: 'success',
      data,
    });
  } catch (error) {
    console.error('Get products error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export const createProduct = async (req, res) => {
  try {
    const body = isPlainObject(req.body) ? req.body : {};

    const productValidation = validateProductFields(body, {
      requireName: true,
    });

    if (productValidation.error) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: productValidation.error,
      });
    }

    if (!Array.isArray(body.variants) || body.variants.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Produk harus memiliki minimal satu varian.',
      });
    }

    const variants = [];
    const skuSet = new Set();

    for (const rawVariant of body.variants) {
      const variantValidation = validateVariantFields(rawVariant, {
        requireCoreFields: true,
      });

      if (variantValidation.error) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: variantValidation.error,
        });
      }

      const variant = variantValidation.data;

      if (skuSet.has(variant.sku)) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: `SKU "${variant.sku}" duplikat di dalam request.`,
        });
      }

      skuSet.add(variant.sku);

      variants.push({
        ...variant,
        current_stock: hasOwn(variant, 'current_stock')
          ? variant.current_stock
          : 0,
        min_stock: hasOwn(variant, 'min_stock') ? variant.min_stock : 5,
      });
    }

    const productData = productValidation.data;

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query('BEGIN');
      transactionOpen = true;

      if (productData.category_id) {
        const categoryResult = await client.query(
          'SELECT id FROM categories WHERE id = $1',
          [productData.category_id]
        );

        if (categoryResult.rows.length === 0) {
          throw new HttpError(
            400,
            'INVALID_CATEGORY',
            'Kategori yang dipilih tidak ditemukan.'
          );
        }
      }

      const existingSkuResult = await client.query(
        'SELECT sku FROM product_variants WHERE sku = ANY($1::varchar[])',
        [variants.map((variant) => variant.sku)]
      );

      if (existingSkuResult.rows.length > 0) {
        const usedSkus = existingSkuResult.rows
          .map((row) => row.sku)
          .join(', ');

        throw new HttpError(
          409,
          'DUPLICATE_SKU',
          `SKU berikut sudah digunakan: ${usedSkus}.`
        );
      }

      const productResult = await client.query(
        `INSERT INTO products (category_id, name, description)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [
          productData.category_id ?? null,
          productData.name,
          productData.description ?? null,
        ]
      );

      const productId = productResult.rows[0].id;

      for (const variant of variants) {
        await client.query(
          `INSERT INTO product_variants
             (product_id, sku, variant_name, price, current_stock, min_stock)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            productId,
            variant.sku,
            variant.variant_name,
            variant.price,
            variant.current_stock,
            variant.min_stock,
          ]
        );
      }

      const product = await fetchProductWithVariants(client, productId);

      await client.query('COMMIT');
      transactionOpen = false;

      return res.status(201).json({
        status: 'success',
        message: 'Produk berhasil ditambahkan.',
        data: product,
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

      console.error('Create product error:', error);

      return handleDatabaseError(res, error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create product error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Format ID produk tidak valid.',
      });
    }

    const body = isPlainObject(req.body) ? req.body : {};

    const hasName = hasOwn(body, 'name');
    const hasCategory = hasOwn(body, 'category_id');
    const hasDescription = hasOwn(body, 'description');
    const hasVariants = hasOwn(body, 'variants');

    if (!hasName && !hasCategory && !hasDescription && !hasVariants) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Tidak ada data produk yang diperbarui.',
      });
    }

    const productValidation = validateProductFields(body, {
      requireName: false,
    });

    if (productValidation.error) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: productValidation.error,
      });
    }

    if (hasVariants && !Array.isArray(body.variants)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Data varian harus berupa array.',
      });
    }

    if (hasVariants && body.variants.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Produk harus memiliki minimal satu varian.',
      });
    }

    const productData = productValidation.data;
    const variants = hasVariants ? body.variants : [];

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query('BEGIN');
      transactionOpen = true;

      const productLockResult = await client.query(
        `SELECT id FROM products
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [id]
      );

      if (productLockResult.rows.length === 0) {
        throw new HttpError(
          404,
          'PRODUCT_NOT_FOUND',
          'Produk tidak ditemukan.'
        );
      }

      const existingVariantsResult = await client.query(
        `SELECT id FROM product_variants
         WHERE product_id = $1 AND deleted_at IS NULL`,
        [id]
      );

      const existingVariantIds = new Set(
        existingVariantsResult.rows.map((row) => row.id)
      );
      const retainedVariantIds = new Set();

      if (
        hasCategory &&
        productData.category_id !== null &&
        productData.category_id !== undefined
      ) {
        const categoryResult = await client.query(
          'SELECT id FROM categories WHERE id = $1',
          [productData.category_id]
        );

        if (categoryResult.rows.length === 0) {
          throw new HttpError(
            400,
            'INVALID_CATEGORY',
            'Kategori yang dipilih tidak ditemukan.'
          );
        }
      }

      const productSetClauses = [];
      const productValues = [];

      if (hasName) {
        productValues.push(productData.name);
        productSetClauses.push(`name = $${productValues.length}`);
      }

      if (hasCategory) {
        productValues.push(productData.category_id ?? null);
        productSetClauses.push(`category_id = $${productValues.length}`);
      }

      if (hasDescription) {
        productValues.push(productData.description ?? null);
        productSetClauses.push(`description = $${productValues.length}`);
      }

      if (productSetClauses.length > 0) {
        productValues.push(id);

        await client.query(
          `UPDATE products
           SET ${productSetClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
           WHERE id = $${productValues.length} AND deleted_at IS NULL`,
          productValues
        );
      }

      for (const rawVariant of variants) {
        if (!isPlainObject(rawVariant)) {
          throw new HttpError(
            400,
            'VALIDATION_ERROR',
            'Setiap varian harus berupa objek.'
          );
        }

        if (hasOwn(rawVariant, 'id')) {
          if (!isValidUuid(rawVariant.id)) {
            throw new HttpError(
              400,
              'VALIDATION_ERROR',
              'Format ID varian tidak valid.'
            );
          }

          if (retainedVariantIds.has(rawVariant.id)) {
            throw new HttpError(
              400,
              'VALIDATION_ERROR',
              `Varian dengan ID ${rawVariant.id} dikirim lebih dari sekali.`
            );
          }

          const variantLockResult = await client.query(
            `SELECT id FROM product_variants
             WHERE id = $1 AND product_id = $2 AND deleted_at IS NULL
             FOR UPDATE`,
            [rawVariant.id, id]
          );

          if (variantLockResult.rows.length === 0) {
            throw new HttpError(
              404,
              'VARIANT_NOT_FOUND',
              `Varian dengan ID ${rawVariant.id} tidak ditemukan pada produk ini.`
            );
          }

          retainedVariantIds.add(rawVariant.id);

          const variantValidation = validateVariantFields(rawVariant, {
            requireCoreFields: false,
          });

          if (variantValidation.error) {
            throw new HttpError(
              400,
              'VALIDATION_ERROR',
              variantValidation.error
            );
          }

          const variantData = variantValidation.data;
          const variantSetClauses = [];
          const variantValues = [];

          if (hasOwn(variantData, 'sku')) {
            const skuResult = await client.query(
              `SELECT id FROM product_variants
               WHERE sku = $1 AND id <> $2
               LIMIT 1`,
              [variantData.sku, rawVariant.id]
            );

            if (skuResult.rows.length > 0) {
              throw new HttpError(
                409,
                'DUPLICATE_SKU',
                `SKU "${variantData.sku}" sudah digunakan oleh varian lain.`
              );
            }

            variantValues.push(variantData.sku);
            variantSetClauses.push(`sku = $${variantValues.length}`);
          }

          if (hasOwn(variantData, 'variant_name')) {
            variantValues.push(variantData.variant_name);
            variantSetClauses.push(
              `variant_name = $${variantValues.length}`
            );
          }

          if (hasOwn(variantData, 'price')) {
            variantValues.push(variantData.price);
            variantSetClauses.push(`price = $${variantValues.length}`);
          }

          if (hasOwn(variantData, 'current_stock')) {
            variantValues.push(variantData.current_stock);
            variantSetClauses.push(
              `current_stock = $${variantValues.length}`
            );
          }

          if (hasOwn(variantData, 'min_stock')) {
            variantValues.push(variantData.min_stock);
            variantSetClauses.push(`min_stock = $${variantValues.length}`);
          }

          if (variantSetClauses.length > 0) {
            variantValues.push(rawVariant.id);

            await client.query(
              `UPDATE product_variants
               SET ${variantSetClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
               WHERE id = $${variantValues.length} AND deleted_at IS NULL`,
              variantValues
            );
          }
        } else {
          const variantValidation = validateVariantFields(rawVariant, {
            requireCoreFields: true,
          });

          if (variantValidation.error) {
            throw new HttpError(
              400,
              'VALIDATION_ERROR',
              variantValidation.error
            );
          }

          const variantData = variantValidation.data;

          const skuResult = await client.query(
            'SELECT id FROM product_variants WHERE sku = $1 LIMIT 1',
            [variantData.sku]
          );

          if (skuResult.rows.length > 0) {
            throw new HttpError(
              409,
              'DUPLICATE_SKU',
              `SKU "${variantData.sku}" sudah digunakan oleh varian lain.`
            );
          }

          await client.query(
            `INSERT INTO product_variants
               (product_id, sku, variant_name, price, current_stock, min_stock)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              id,
              variantData.sku,
              variantData.variant_name,
              variantData.price,
              variantData.current_stock ?? 0,
              variantData.min_stock ?? 5,
            ]
          );
        }
      }

      if (hasVariants) {
        const removedVariantIds = [...existingVariantIds].filter(
          (variantId) => !retainedVariantIds.has(variantId)
        );

        if (removedVariantIds.length > 0) {
          await client.query(
            `UPDATE product_variants
             SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE product_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`,
            [id, removedVariantIds]
          );
        }
      }

      const product = await fetchProductWithVariants(client, id);

      await client.query('COMMIT');
      transactionOpen = false;

      return res.status(200).json({
        status: 'success',
        message: 'Produk berhasil diperbarui.',
        data: product,
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

      console.error('Update product error:', error);

      return handleDatabaseError(res, error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update product error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Format ID produk tidak valid.',
      });
    }

    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query('BEGIN');
      transactionOpen = true;

      const productResult = await client.query(
        `UPDATE products
         SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [id]
      );

      if (productResult.rows.length === 0) {
        throw new HttpError(
          404,
          'PRODUCT_NOT_FOUND',
          'Produk tidak ditemukan.'
        );
      }

      await client.query(
        `UPDATE product_variants
         SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $1 AND deleted_at IS NULL`,
        [id]
      );

      await client.query('COMMIT');
      transactionOpen = false;

      return res.status(200).json({
        status: 'success',
        message: 'Produk dan seluruh variannya berhasil dihapus.',
        data: {
          id,
        },
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

      console.error('Delete product error:', error);

      return handleDatabaseError(res, error);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete product error:', error);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  }
};

export default {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
