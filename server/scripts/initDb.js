import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initDatabase() {
  const schemaPath = path.resolve(__dirname, '..', 'db', 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    console.error('File schema.sql tidak ditemukan di:', schemaPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Menghubungkan ke database...');
  const client = await pool.connect();

  try {
    console.log('Menjalankan skema database dari server/db/schema.sql...');
    await client.query(sql);
    console.log('Inisialisasi skema database berhasil!');

    // Cek jumlah user di database
    const userCheck = await client.query('SELECT count(*) FROM users');
    console.log(`Jumlah akun admin terdaftar: ${userCheck.rows[0].count}`);
  } catch (error) {
    console.error('Gagal menjalankan inisialisasi database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
