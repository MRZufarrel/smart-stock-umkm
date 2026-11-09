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

app.use(cors());
app.use(express.json());

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

  const PORT = Number(process.env.PORT);

  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT belum diatur dengan benar. Periksa file server/.env.');
  }

  app.listen(PORT, () => {
    console.log(`Smart Stock API berjalan di http://localhost:${PORT}`);
  });
}

export default app;
