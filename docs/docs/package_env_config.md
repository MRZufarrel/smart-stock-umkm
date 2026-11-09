# DOKUMEN 6: KONFIGURASI PROJECT & DEPENDENSI (package.json & .env)
**Proyek:** Smart Stock UMKM (Florawins)

---

## 1. ENVIRONMENT VARIABLES (`server/.env.example`)
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=isi_password_db_kamu
DB_NAME=smart_stock_db
JWT_SECRET=bikin_kunci_rahasia_yang_panjang_dan_susah_ditebak
JWT_EXPIRES_IN=24h
```

---

## 2. BACKEND DEPENDENCIES (`server/package.json`)
```json
{
  "name": "smart-stock-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "csv-parser": "^3.0.0",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.11.5"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.1.0",
    "supertest": "^7.0.0"
  }
}
```

---

## 3. FRONTEND DEPENDENCIES (`package.json`)
```json
{
  "name": "smart-stock-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.8",
    "chart.js": "^4.4.2",
    "lucide-react": "^0.378.0",
    "react": "^18.2.0",
    "react-chartjs-2": "^5.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.23.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "vite": "^5.2.11"
  }
}
```
