import express from 'express';
import { login } from '../controllers/authController.js';

const router = express.Router();

/**
 * Rate limiter sederhana berbasis Map in-memory.
 * Per-IP: maksimal MAX_ATTEMPTS percobaan dalam WINDOW_MS milidetik.
 * Jika batas terlampaui, kembalikan 429 dan tandai waktu cooldown.
 *
 * Catatan: untuk deployment multi-proses/cluster, gunakan solusi berbasis
 * Redis (mis. rate-limit-redis). Versi ini cukup untuk UMKM single-process.
 */
const WINDOW_MS = 15 * 60 * 1000; // 15 menit
const MAX_ATTEMPTS = 10;

const loginAttempts = new Map();

const loginRateLimiter = (req, res, next) => {
  // Ambil IP pengirim; jika di balik proxy, gunakan X-Forwarded-For pertama.
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record) {
    // Jika window sudah lewat, reset catatan.
    if (now - record.startedAt > WINDOW_MS) {
      loginAttempts.delete(ip);
    } else if (record.count >= MAX_ATTEMPTS) {
      const retryAfterSec = Math.ceil((record.startedAt + WINDOW_MS - now) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        status: 'error',
        code: 'TOO_MANY_REQUESTS',
        message: `Terlalu banyak percobaan login. Coba lagi dalam ${retryAfterSec} detik.`,
      });
    }
  }

  // Catat percobaan ini.
  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { count: 1, startedAt: now });
  } else {
    loginAttempts.get(ip).count += 1;
  }

  return next();
};

router.post('/login', loginRateLimiter, login);

export default router;
