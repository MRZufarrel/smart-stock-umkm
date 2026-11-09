# DOKUMEN 8: PANDUAN DEPLOYMENT JAGOAN HOSTING (deploy.md)
**Proyek:** Smart Stock UMKM (Florawins)  
**Provider:** Jagoan Hosting (Cloud VPS Linux Ubuntu 22.04 LTS)

---

## 1. SETUP PERSYARATAN UTAMA (SSH SERVER)
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx certbot python3-certbot-nginx git
sudo npm install -g pm2
```

---

## 2. KONFIGURASI DATABASE
```bash
sudo -u postgres psql
```
```sql
CREATE DATABASE smart_stock_db;
CREATE USER smartuser WITH PASSWORD 'PasswordJagoan123!';
GRANT ALL PRIVILEGES ON DATABASE smart_stock_db TO smartuser;
\c smart_stock_db
GRANT ALL ON SCHEMA public TO smartuser;
\q
```
```bash
psql -U smartuser -d smart_stock_db -h 127.0.0.1 -f /var/www/smart-stock/server/db/schema.sql
```

---

## 3. DEPLOY BACKEND EXPRESS (PORT 5000)
```bash
cd /var/www/smart-stock/server
npm install --production
pm2 start server.js --name "smart-stock-backend"
pm2 save
pm2 startup
```

---

## 4. BUILD FRONTEND & CONFIG NGINX
```bash
cd /var/www/smart-stock
npm install
npm run build
```
Buat file `/etc/nginx/sites-available/smart-stock` dengan reverse proxy dari `/api/` ke `http://127.0.0.1:5000/api/` dan root frontend di `/var/www/smart-stock/dist`.

Aktifkan SSL:
```bash
sudo certbot --nginx -d domain-kamu.com
```
