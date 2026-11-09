# DOKUMEN: SPESIFIKASI REST API (api-spec.md)
**Proyek:** Smart Stock UMKM (Florawins)  
**Base URL:** `/api`  

---

## 1. AUTHENTICATION (`/api/auth`)

### POST `/api/auth/login`
- **Request Body:**
  ```json
  {
    "email": "admin@example.com",
    "password": "password_kamu_di_sini"
  }
  ```
- **Response 200 (Sukses):**
  ```json
  {
    "status": "success",
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": "uuid-admin",
      "email": "admin@florawins.com"
    }
  }
  ```

---

## 2. PRODUK & VARIAN (`/api/products`)

### GET `/api/products`
- **Response 200:**
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": "uuid-product",
        "name": "Buket Mawar Merah",
        "category_name": "Mawar",
        "variants": [
          {
            "id": "uuid-variant",
            "sku": "MWR-RED-01",
            "variant_name": "Mawar Merah Isi 10",
            "price": 150000,
            "current_stock": 12,
            "min_stock": 5
          }
        ]
      }
    ]
  }
  ```

### POST `/api/products`
- **Request Body:**
  ```json
  {
    "category_id": "uuid-category",
    "name": "Buket Mawar Putih",
    "description": "Buket segar mawar putih",
    "variants": [
      {
        "sku": "MWR-WHT-01",
        "variant_name": "Mawar Putih Isi 10",
        "price": 160000,
        "current_stock": 20,
        "min_stock": 5
      }
    ]
  }
  ```
- **Response 201 (Created)**

---

## 3. PENJUALAN (`/api/sales`)

### POST `/api/sales`
- **Request Body:**
  ```json
  {
    "variant_id": "uuid-variant",
    "sale_date": "2026-10-30",
    "quantity": 3
  }
  ```
- **Response 201 (Created)**
- **Response 409 (Stock Insufficient):**
  ```json
  {
    "status": "error",
    "code": "INSUFFICIENT_STOCK",
    "message": "Stok varian tidak mencukupi."
  }
  ```

### POST `/api/sales/import-csv`
- **Form Data:** File `.csv` (kolom: `sale_date,sku,quantity`)
- **Response 200 (Sukses):**
  ```json
  {
    "status": "success",
    "inserted_rows": 45
  }
  ```

---

## 4. PERAMALAN & RESTOCK (`/api/forecasting`)

### GET `/api/forecasting/:variant_id`
- **Response 200:**
  ```json
  {
    "status": "success",
    "variant_id": "uuid-variant",
    "method_used": "HWES_M7",
    "warning_flag": false,
    "forecast": [
      { "date": "2026-10-31", "predicted_qty": 5 },
      { "date": "2026-11-01", "predicted_qty": 8 }
    ],
    "restock_recommendation": {
      "reorder_point": 35,
      "order_quantity": 40,
      "needs_restock": true
    }
  }
  ```
