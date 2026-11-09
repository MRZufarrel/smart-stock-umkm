import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  LayoutDashboard,
  Loader2,
  Package,
  PlusCircle,
  RefreshCw,
  TrendingDown,
  Wallet,
  X,
} from 'lucide-react';
import api from '../services/api.js';
import { formatCurrency, formatNumber } from '../utils/format.js';

const statTones = {
  floral: 'bg-floral-50 text-floral-600',
  red: 'bg-red-50 text-red-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  slate: 'bg-slate-100 text-slate-600',
};

function StatCard({ icon: Icon, label, value, hint, tone = 'floral' }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${statTones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [restockVariant, setRestockVariant] = useState(null);
  const [restockQty, setRestockQty] = useState('10');
  const [restockDate, setRestockDate] = useState(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
  });
  const [supplierNote, setSupplierNote] = useState('');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);
  const [restockError, setRestockError] = useState('');
  const [restockSuccess, setRestockSuccess] = useState('');

  const loadProducts = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await api.get('/products');
      const data = response.data?.data;

      setProducts(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Gagal memuat data produk. Periksa koneksi ke server.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const variants = useMemo(
    () =>
      products.flatMap((product) =>
        (product.variants || []).map((variant) => ({
          ...variant,
          product_name: product.name,
          category_name: product.category_name,
        }))
      ),
    [products]
  );

  const criticalVariants = useMemo(
    () =>
      variants
        .filter(
          (variant) =>
            Number(variant.current_stock) < Number(variant.min_stock)
        )
        .sort(
          (first, second) =>
            Number(first.current_stock) -
              Number(first.min_stock) -
            (Number(second.current_stock) - Number(second.min_stock))
        ),
    [variants]
  );

  const totalStockValue = useMemo(
    () =>
      variants.reduce(
        (total, variant) =>
          total +
          Number(variant.price || 0) * Number(variant.current_stock || 0),
        0
      ),
    [variants]
  );

  const safeVariants = variants.length - criticalVariants.length;

  const handleOpenRestock = (variant) => {
    const deficit = Math.max(1, Number(variant.min_stock) - Number(variant.current_stock));
    setRestockVariant(variant);
    setRestockQty(String(deficit));
    setSupplierNote('');
    setRestockError('');
  };

  const handleCloseRestock = () => {
    if (isSubmittingRestock) return;
    setRestockVariant(null);
    setRestockError('');
  };

  const handleSubmitRestock = async (e) => {
    e.preventDefault();
    if (!restockVariant) return;

    const qty = Number(restockQty);
    if (!Number.isInteger(qty) || qty <= 0) {
      setRestockError('Kuantitas restock harus bilangan bulat lebih dari 0.');
      return;
    }

    setIsSubmittingRestock(true);
    setRestockError('');

    try {
      await api.post('/restock', {
        variant_id: restockVariant.id,
        quantity: qty,
        restock_date: restockDate || undefined,
        supplier_note: supplierNote.trim() || undefined,
      });

      setRestockSuccess(
        `Restock ${formatNumber(qty)} unit untuk SKU ${restockVariant.sku} berhasil dicatat.`
      );
      setRestockVariant(null);
      await loadProducts({ silent: true });
    } catch (err) {
      setRestockError(
        err.response?.data?.message || 'Gagal mencatat restock. Silakan coba lagi.'
      );
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Judul halaman */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-floral-600 text-white shadow-lg shadow-floral-600/20">
            <LayoutDashboard className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Ringkasan Stok
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Daftar varian yang stoknya sudah berada di bawah batas minimum dan
              perlu segera diisi ulang.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadProducts({ silent: true })}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-floral-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          Muat ulang
        </button>
      </section>

      {restockSuccess && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          <span className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {restockSuccess}
          </span>
          <button
            type="button"
            onClick={() => setRestockSuccess('')}
            aria-label="Tutup notifikasi"
            className="text-emerald-600 transition hover:text-emerald-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => loadProducts()}
            className="shrink-0 self-start rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 sm:self-auto"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Statistik */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Package}
          label="Total Produk"
          value={formatNumber(products.length)}
          hint="Produk aktif yang terdaftar."
          tone="floral"
        />
        <StatCard
          icon={Boxes}
          label="Total Varian"
          value={formatNumber(variants.length)}
          hint={`${formatNumber(safeVariants)} varian dalam kondisi aman.`}
          tone="slate"
        />
        <StatCard
          icon={TrendingDown}
          label="Stok Kritis"
          value={formatNumber(criticalVariants.length)}
          hint="Varian dengan stok di bawah minimum."
          tone="red"
        />
        <StatCard
          icon={Wallet}
          label="Nilai Stok"
          value={formatCurrency(totalStockValue)}
          hint="Estimasi harga jual x stok saat ini."
          tone="emerald"
        />
      </section>

      {/* Tabel stok kritis */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Varian Stok Kritis
              </h3>
              <p className="text-xs text-slate-500">
                Kondisi: current_stock &lt; min_stock
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              {formatNumber(criticalVariants.length)} varian
            </span>
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-floral-700 transition hover:bg-floral-50"
            >
              Kelola produk
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-floral-600" />
            <p className="text-sm">Memuat data stok...</p>
          </div>
        ) : criticalVariants.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h4 className="text-base font-bold text-slate-900">
              Semua stok aman
            </h4>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Tidak ada varian yang stoknya berada di bawah batas minimum saat
              ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    Produk &amp; Varian
                  </th>
                  <th scope="col" className="px-5 py-3">
                    SKU
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Stok
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Minimum
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Kekurangan
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Harga
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criticalVariants.map((variant) => {
                  const deficit =
                    Number(variant.min_stock) - Number(variant.current_stock);

                  return (
                    <tr
                      key={variant.id}
                      className="bg-red-50/40 transition hover:bg-red-50"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">
                          {variant.variant_name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {variant.product_name} &middot;{' '}
                          {variant.category_name || 'Tanpa kategori'}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-600">
                          {variant.sku}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-2.5 py-1 text-sm font-bold text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {formatNumber(variant.current_stock)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">
                        {formatNumber(variant.min_stock)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-red-700">
                        -{formatNumber(deficit)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">
                        {formatCurrency(variant.price)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          Stok Kritis
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenRestock(variant)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-floral-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-floral-700 focus:outline-none focus:ring-2 focus:ring-floral-300"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          Restock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Restock Barang */}
      {restockVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="restock-modal-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 id="restock-modal-title" className="text-sm font-bold text-slate-900">
                  Catat Restock Barang Masuk
                </h3>
                <p className="text-xs text-slate-500">
                  Stok varian akan otomatis bertambah di database.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseRestock}
                aria-label="Tutup form restock"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRestock} className="space-y-4 p-5">
              {restockError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {restockError}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="font-semibold text-slate-900">{restockVariant.variant_name}</p>
                <p className="text-slate-500">{restockVariant.product_name} &middot; SKU: <span className="font-mono text-slate-700">{restockVariant.sku}</span></p>
                <div className="mt-2 flex gap-4 text-slate-600">
                  <span>Stok saat ini: <strong className="text-red-600">{formatNumber(restockVariant.current_stock)}</strong></span>
                  <span>Batas minimum: <strong>{formatNumber(restockVariant.min_stock)}</strong></span>
                </div>
              </div>

              <div>
                <label htmlFor="restock-qty" className="mb-1 block text-xs font-semibold text-slate-700">
                  Kuantitas Masuk <span className="text-red-500">*</span>
                </label>
                <input
                  id="restock-qty"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  placeholder="Jumlah unit masuk"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-floral-500 focus:bg-white focus:ring-2 focus:ring-floral-100"
                />
              </div>

              <div>
                <label htmlFor="restock-date" className="mb-1 block text-xs font-semibold text-slate-700">
                  Tanggal Restock <span className="text-red-500">*</span>
                </label>
                <input
                  id="restock-date"
                  type="date"
                  required
                  value={restockDate}
                  onChange={(e) => setRestockDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-floral-500 focus:bg-white focus:ring-2 focus:ring-floral-100"
                />
              </div>

              <div>
                <label htmlFor="supplier-note" className="mb-1 block text-xs font-semibold text-slate-700">
                  Catatan Supplier (Opsional)
                </label>
                <input
                  id="supplier-note"
                  type="text"
                  maxLength={255}
                  value={supplierNote}
                  onChange={(e) => setSupplierNote(e.target.value)}
                  placeholder="Contoh: Pengiriman batch #12 dari Supplier A"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-floral-500 focus:bg-white focus:ring-2 focus:ring-floral-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseRestock}
                  disabled={isSubmittingRestock}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRestock}
                  className="flex-1 rounded-xl bg-floral-600 py-2.5 text-xs font-semibold text-white transition hover:bg-floral-700 disabled:opacity-60"
                >
                  {isSubmittingRestock ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Menyimpan...
                    </span>
                  ) : (
                    'Simpan Restock'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Data diambil dari <span className="font-mono">GET /api/products</span>{' '}
        dan diperbarui setiap kali halaman dibuka.
      </p>
    </div>
  );
}
