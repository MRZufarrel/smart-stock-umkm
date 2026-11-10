import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import pool, { query } from '../../config/db.js';

describe('Integrasi Penjualan & Integritas Stok (sales)', () => {
  let targetVariant;
  let authToken;

  beforeAll(async () => {
    // Siapkan token autentikasi JWT yang valid untuk pengujian
    authToken = jwt.sign(
      { id: '00000000-0000-0000-0000-000000000001', email: 'admin@florawins.com' },
      process.env.JWT_SECRET || 'bikin_kunci_rahasia_yang_panjang_dan_susah_ditebak'
    );

    // Ambil varian pertama yang aktif untuk pengujian
    const result = await query(
      `SELECT pv.id, pv.sku, pv.current_stock, pv.price
       FROM product_variants pv
       WHERE pv.deleted_at IS NULL
       LIMIT 1`
    );

    if (result.rows.length > 0) {
      targetVariant = result.rows[0];
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('menolak akses jika request tidak menyertakan token JWT (HTTP 401 UNAUTHORIZED)', async () => {
    const response = await request(app).get('/api/sales');

    expect(response.status).toBe(401);
    expect(response.body.status).toBe('error');
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('menolak request jika variant_id tidak valid (HTTP 400)', async () => {
    const response = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        variant_id: 'bukan-uuid',
        sale_date: '2026-11-10',
        quantity: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('menolak request jika quantity bernilai 0 atau negatif (HTTP 400)', async () => {
    if (!targetVariant) return;

    const response = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        variant_id: targetVariant.id,
        sale_date: '2026-11-10',
        quantity: 0,
      });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('menolak transaksi jika kuantitas melebihi stok yang tersedia (HTTP 409 INSUFFICIENT_STOCK)', async () => {
    if (!targetVariant) return;

    const excessiveQuantity = Number(targetVariant.current_stock) + 99999;

    const response = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        variant_id: targetVariant.id,
        sale_date: '2026-11-10',
        quantity: excessiveQuantity,
      });

    expect(response.status).toBe(409);
    expect(response.body.status).toBe('error');
    expect(response.body.code).toBe('INSUFFICIENT_STOCK');
  });

  it('mengambil riwayat penjualan dengan token valid melalui GET /api/sales (HTTP 200)', async () => {
    const response = await request(app)
      .get('/api/sales')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
