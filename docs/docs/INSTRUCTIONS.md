# DOKUMEN 7: ATURAN KERJA AI AGENT (INSTRUCTIONS.md)
**Proyek:** Smart Stock UMKM (Florawins)

---

## 1. ATURAN KERAS (MUTLAK)
- **Bahasa:** Gunakan JavaScript murni (`.js` dan `.jsx`). Dilarang menggunakan TypeScript (`.ts` / `.tsx`).
- **Database:** Gunakan PostgreSQL murni dengan library `pg`. Dilarang keras menggunakan ORM (Prisma, Drizzle, Sequelize). Seluruh query wajib terparameter (`$1, $2`).
- **Tampilan:** Gunakan Tailwind CSS murni. Dilarang menginstal library UI tambahan (Material UI, Chakra UI).
- **Privasi:** Dilarang menyimpan nama, nomor HP, atau alamat pembeli (Tanpa PII).

---

## 2. FILE PATOKAN (SOURCE OF TRUTH)
Sebelum membuat endpoint, komponen, atau fungsi baru, kamu wajib membaca file rujukan berikut:
1. `schema.sql` — Patokan nama tabel, kolom, dan tipe data database.
2. `api-spec.md` — Patokan URL endpoint, method HTTP, request body, dan format respons JSON.
3. `hwes-spec.md` — Patokan rumus hitungan Holt-Winters, SMA, ROP, dan Order Quantity.
4. `PRD.md` — Patokan alur fitur dan urutan pengerjaan.
5. `TEST-PLAN.md` — Patokan pengujian fungsi.

---

## 3. CARA KERJA
- Kerjakan fitur secara bertahap (satu per satu).
- Selalu bungkus kode async di backend dengan `try...catch`.
- Jika satu tugas selesai, berhenti dan minta konfirmasi sebelum lanjut ke tugas berikutnya.
