import app from '../server/server.js';

/**
 * Serverless function entrypoint untuk Vercel.
 * Menangani seluruh request API pada route /api/*
 */
export default function handler(req, res) {
  // Normalisasi URL jika Vercel memotong prefix /api
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
}
