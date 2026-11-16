import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const hasDatabaseUrl = Boolean(
  process.env.DATABASE_URL && process.env.DATABASE_URL.trim()
);

let poolConfig;

if (hasDatabaseUrl) {
  // Mode Cloud Database (Neon, Supabase, Render, Railway, dll)
  poolConfig = {
    connectionString: process.env.DATABASE_URL.trim(),
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
} else {
  // Mode Konfigurasi Satuan (Lokal / Self-hosted)
  const requiredEnv = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length > 0) {
    throw new Error(
      `Konfigurasi database belum lengkap. Variabel yang belum diisi: ${missingEnv.join(', ')}. ` +
        'Salin server/.env.example menjadi server/.env lalu sesuaikan nilainya, atau isi DATABASE_URL.'
    );
  }

  const dbPort = Number(process.env.DB_PORT);

  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    throw new Error('DB_PORT harus berupa angka antara 1 sampai 65535.');
  }

  poolConfig = {
    host: process.env.DB_HOST,
    port: dbPort,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export const query = (text, params) => pool.query(text, params);

export default pool;
