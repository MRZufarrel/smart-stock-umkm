import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import productRoutes from './routes/products.js';
import salesRoutes from './routes/sales.js';
import restockRoutes from './routes/restock.js';
import forecastingRoutes from './routes/forecasting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();

// Izinkan request dari origin frontend (mendukung multiple origin dipisahkan koma).
// Default ke localhost:5173 (Vite dev server) jika variabel belum diatur.
const rawCors = process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedOrigins = rawCors.split(',').map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan request tanpa header origin (mis. supertest, server-to-server, curl)
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Akses ditolak oleh kebijakan CORS.'));
    },
    credentials: true,
  })
);

app.use(express.json());

// Health check endpoint untuk cloud monitoring & deployment ping
app.get('/api/health', (req, res) => {
  return res.status(200).json({
    status: 'success',
    message: 'Smart Stock API aktif.',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/restock', restockRoutes);
app.use('/api/forecasting', forecastingRoutes);

app.use((req, res) => {
  return res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: 'Endpoint tidak ditemukan.',
  });
});

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_JSON',
      message: 'Format JSON pada request body tidak valid.',
    });
  }

  console.error('Unhandled server error:', error);

  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Terjadi kesalahan pada server.',
  });
});

if (process.env.NODE_ENV !== 'test') {
  if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    throw new Error(
      'JWT_SECRET belum diatur. Salin server/.env.example menjadi server/.env lalu isi nilainya.'
    );
  }

  const rawPort = process.env.PORT;
  const PORT = rawPort ? Number(rawPort) : 5000;

  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT belum diatur dengan benar. Periksa file server/.env.');
  }

  app.listen(PORT, () => {
    console.log(`Smart Stock API berjalan di http://localhost:${PORT}`);
  });
}

export default app;
