import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Hash,
  History,
  Loader2,
  RefreshCw,
  Search,
  ShoppingCart,
  Upload,
  X,
} from 'lucide-react';
import api from '../services/api.js';
import { formatCurrency, formatDate, formatNumber } from '../utils/format.js';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-floral-500 focus:bg-white focus:ring-2 focus:ring-floral-100';

const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';

function getToday() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

const createInitialForm = () => ({
  variant_id: '',
  sale_date: getToday(),
  quantity: '1',
});

export default function Sales() {
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState(createInitialForm);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentSales, setRecentSales] = useState([]);

  const [csvFile, setCsvFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const csvInputRef = useRef(null);

  const [salesHistory, setSalesHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const loadSalesHistory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoadingHistory(true);
    }
    setHistoryError('');

    try {
      const params = {};
      if (filterStartDate) params.start_date = filterStartDate;
      if (filterEndDate) params.end_date = filterEndDate;
      if (filterSearch.trim()) params.search = filterSearch.trim();

      const response = await api.get('/sales', { params });
      const data = response.data?.data;

      setSalesHistory(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setHistoryError(
        requestError.response?.data?.message ||
          'Gagal memuat riwayat penjualan. Periksa koneksi ke server.'
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }, [filterStartDate, filterEndDate, filterSearch]);

  const loadProducts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoadingProducts(true);
    }

    setLoadError('');

    try {
      const response = await api.get('/products');
      const data = response.data?.data;

      setProducts(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setLoadError(
        requestError.response?.data?.message ||
          'Gagal memuat daftar varian. Periksa koneksi ke server.'
      );
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadSalesHistory();
  }, [loadSalesHistory]);

  const productGroups = useMemo(
    () =>
      products
        .map((product) => ({
          ...product,
          variants: product.variants || [],
        }))
        .filter((product) => product.variants.length > 0),
    [products]
  );

  const variants = useMemo(
    () =>
      productGroups.flatMap((product) =>
        product.variants.map((variant) => ({
          ...variant,
          product_name: product.name,
        }))
      ),
    [productGroups]
  );

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === form.variant_id) || null,
    [variants, form.variant_id]
  );

  const quantityNumber = Number(form.quantity);
  const safeQuantity = Number.isFinite(quantityNumber) ? quantityNumber : 0;
  const remainingStock = selectedVariant
    ? Number(selectedVariant.current_stock) - safeQuantity
    : null;
  const isInsufficient =
    Boolean(selectedVariant) &&
    Number.isInteger(safeQuantity) &&
    safeQuantity > 0 &&
    safeQuantity > Number(selectedVariant.current_stock);
  const estimatedTotal = selectedVariant
    ? Number(selectedVariant.price) * (Number.isFinite(quantityNumber) ? quantityNumber : 0)
    : 0;

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));
    setFormError('');
    setSuccessMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!form.variant_id) {
      setFormError('Pilih varian produk terlebih dahulu.');
      return;
    }

    if (!selectedVariant) {
      setFormError('Varian yang dipilih tidak ditemukan. Muat ulang daftar varian.');
      return;
    }

    if (!form.sale_date) {
      setFormError('Tanggal penjualan wajib diisi.');
      return;
    }

    if (!Number.isInteger(quantityNumber) || quantityNumber <= 0) {
      setFormError('Kuantitas harus bilangan bulat lebih dari 0.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post('/sales', {
        variant_id: form.variant_id,
        sale_date: form.sale_date,
        quantity: quantityNumber,
      });

      const createdSale = response.data?.data;

      setRecentSales((previous) =>
        [
          {
            id: createdSale?.id || `${Date.now()}-${Math.random()}`,
            sku: selectedVariant.sku,
            variant_name: selectedVariant.variant_name,
            product_name: selectedVariant.product_name,
            sale_date: form.sale_date,
            quantity: quantityNumber,
            total_amount:
              createdSale?.total_amount ??
              Number(selectedVariant.price) * quantityNumber,
          },
          ...previous,
        ].slice(0, 5)
      );

      setSuccessMessage(
        `Penjualan ${formatNumber(quantityNumber)} unit ${selectedVariant.sku} berhasil dicatat.`
      );
      setForm((previous) => ({ ...previous, quantity: '1' }));

      await Promise.all([
        loadProducts({ silent: true }),
        loadSalesHistory({ silent: true }),
      ]);
    } catch (requestError) {
      const code = requestError.response?.data?.code;
      const message =
        requestError.response?.data?.message ||
        'Gagal menyimpan penjualan. Silakan coba lagi.';

      setFormError(
        code === 'INSUFFICIENT_STOCK'
          ? `${message} Stok tersedia saat ini ${formatNumber(
              selectedVariant.current_stock
            )} unit.`
          : message
      );

      // Stok di server mungkin sudah berubah, sinkronkan kembali.
      if (code === 'INSUFFICIENT_STOCK') {
        loadProducts({ silent: true });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;

    setImportError('');
    setImportResult(null);

    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      setCsvFile(null);
      setImportError('File yang dipilih harus berformat .csv.');
      event.target.value = '';
      return;
    }

    setCsvFile(file);
  };

  const clearCsvFile = () => {
    setCsvFile(null);
    setImportError('');
    setImportResult(null);

    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    setImportError('');
    setImportResult(null);

    if (!csvFile) {
      setImportError('Pilih file CSV terlebih dahulu sebelum mengimpor.');
      return;
    }

    const formData = new FormData();
    formData.append('file', csvFile);

    setIsImporting(true);

    try {
      const response = await api.post('/sales/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      setImportResult({
        insertedRows: Number(response.data?.inserted_rows) || 0,
      });
      setCsvFile(null);

      if (csvInputRef.current) {
        csvInputRef.current.value = '';
      }

      await Promise.all([
        loadProducts({ silent: true }),
        loadSalesHistory({ silent: true }),
      ]);
    } catch (requestError) {
      setImportError(
        requestError.response?.data?.message ||
          'Gagal mengimpor file CSV. Silakan coba lagi.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = [
      'sale_date,sku,quantity',
      `${getToday()},PLY-NUDE-01,2`,
      `${getToday()},PSH-MOCA-01,1`,
      '',
    ].join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'template-import-penjualan.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Judul halaman */}
      <section className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-floral-600 text-white shadow-lg shadow-floral-600/20">
          <ShoppingCart className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Transaksi Penjualan
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Catat penjualan satu per satu atau impor banyak transaksi sekaligus
            dari file CSV. Stok varian otomatis berkurang.
          </p>
        </div>
      </section>

      {successMessage && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          <span className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {successMessage}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            aria-label="Tutup notifikasi"
            className="text-emerald-600 transition hover:text-emerald-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {loadError}
          </span>
          <button
            type="button"
            onClick={() => loadProducts()}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 sm:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Coba lagi
          </button>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-5">
        {/* Form input manual */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-floral-50 text-floral-600">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Input Penjualan Manual
              </h3>
              <p className="text-xs text-slate-500">
                Satu transaksi untuk satu varian.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <div>
              <label htmlFor="variant-id" className={labelClass}>
                Varian Produk <span className="text-red-500">*</span>
              </label>
              <select
                id="variant-id"
                name="variant_id"
                required
                value={form.variant_id}
                onChange={handleFieldChange}
                disabled={isLoadingProducts}
                className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <option value="">
                  {isLoadingProducts
                    ? 'Memuat varian...'
                    : variants.length === 0
                      ? 'Belum ada varian tersedia'
                      : 'Pilih varian produk'}
                </option>
                {productGroups.map((product) => (
                  <optgroup key={product.id} label={product.name}>
                    {product.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.sku} &mdash; {variant.variant_name} (stok{' '}
                        {variant.current_stock})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {selectedVariant && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">
                      {selectedVariant.product_name}
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedVariant.variant_name}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      Number(selectedVariant.current_stock) <
                      Number(selectedVariant.min_stock)
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        Number(selectedVariant.current_stock) <
                        Number(selectedVariant.min_stock)
                          ? 'bg-red-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    Stok {formatNumber(selectedVariant.current_stock)}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    Harga:{' '}
                    <span className="font-semibold text-slate-700">
                      {formatCurrency(selectedVariant.price)}
                    </span>
                  </span>
                  <span>
                    Stok minimum: {formatNumber(selectedVariant.min_stock)}
                  </span>
                  <span>
                    SKU:{' '}
                    <span className="font-mono text-slate-700">
                      {selectedVariant.sku}
                    </span>
                  </span>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sale-date" className={labelClass}>
                  Tanggal Penjualan <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="sale-date"
                    name="sale_date"
                    type="date"
                    required
                    value={form.sale_date}
                    onChange={handleFieldChange}
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="quantity" className={labelClass}>
                  Kuantitas <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={form.quantity}
                    onChange={handleFieldChange}
                    placeholder="1"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
            </div>

            {isInsufficient && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Kuantitas melebihi stok tersedia (
                  {formatNumber(selectedVariant.current_stock)} unit). Server
                  akan menolak transaksi ini.
                </span>
              </div>
            )}

            {selectedVariant && remainingStock !== null && !isInsufficient && (
              <p className="text-xs text-slate-500">
                Sisa stok setelah transaksi:{' '}
                <span className="font-semibold text-slate-700">
                  {formatNumber(remainingStock)} unit
                </span>
              </p>
            )}

            <div className="flex items-center justify-between rounded-xl bg-floral-50 px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-floral-700">
                  Estimasi Total
                </p>
                <p className="text-[11px] text-floral-600">
                  Harga jual &times; kuantitas
                </p>
              </div>
              <p className="text-lg font-bold text-floral-800">
                {formatCurrency(estimatedTotal)}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoadingProducts}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-floral-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-floral-700 focus:outline-none focus:ring-2 focus:ring-floral-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Simpan Penjualan
                </>
              )}
            </button>
          </form>
        </section>

        {/* Import CSV */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-floral-50 text-floral-600">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Import CSV Penjualan
              </h3>
              <p className="text-xs text-slate-500">
                Unggah banyak transaksi sekaligus.
              </p>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-600">
                Format kolom wajib
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['sale_date', 'sku', 'quantity'].map((column) => (
                  <span
                    key={column}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-600"
                  >
                    {column}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Tanggal berformat YYYY-MM-DD. SKU harus terdaftar. Maksimal 5
                MB.
              </p>
            </div>

            <input
              ref={csvInputRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="sr-only"
            />

            <label
              htmlFor="csv-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-floral-400 hover:bg-floral-50/40"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-floral-600 shadow-sm">
                <Upload className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-slate-700">
                Pilih file .csv
              </span>
              <span className="text-[11px] text-slate-500">
                Klik untuk menjelajahi file di perangkat
              </span>
            </label>

            {csvFile && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-floral-200 bg-floral-50 px-3.5 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-floral-600" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-floral-800">
                      {csvFile.name}
                    </span>
                    <span className="block text-[11px] text-floral-600">
                      {(csvFile.size / 1024).toFixed(1)} KB
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={clearCsvFile}
                  aria-label="Batalkan file yang dipilih"
                  className="rounded-lg p-1 text-floral-600 transition hover:bg-floral-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {importError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {importError}
              </div>
            )}

            {importResult && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Import berhasil. {formatNumber(importResult.insertedRows)}{' '}
                  baris penjualan ditambahkan.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || !csvFile}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-floral-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-floral-700 focus:outline-none focus:ring-2 focus:ring-floral-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mengimpor...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh Template CSV
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Riwayat Penjualan dari Database */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-floral-50 text-floral-600">
              <History className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Riwayat Penjualan
              </h3>
              <p className="text-xs text-slate-500">
                Daftar transaksi penjualan terverifikasi dari database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {salesHistory.length} transaksi
            </span>
            <button
              type="button"
              onClick={() => loadSalesHistory()}
              disabled={isLoadingHistory}
              aria-label="Muat ulang riwayat penjualan"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Toolbar Filter */}
        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-3">
          <div>
            <label htmlFor="filter-start-date" className={labelClass}>
              Dari Tanggal
            </label>
            <input
              id="filter-start-date"
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="filter-end-date" className={labelClass}>
              Sampai Tanggal
            </label>
            <input
              id="filter-end-date"
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="filter-search" className={labelClass}>
              Pencarian
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="filter-search"
                type="search"
                placeholder="Cari SKU, varian, produk..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>
        </div>

        {(filterStartDate || filterEndDate || filterSearch) && (
          <div className="flex items-center justify-between border-b border-slate-100 bg-floral-50/50 px-4 py-2 text-xs">
            <span className="text-floral-800">
              Filter aktif diterapkan.
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterStartDate('');
                setFilterEndDate('');
                setFilterSearch('');
              }}
              className="font-semibold text-floral-700 underline transition hover:text-floral-900"
            >
              Reset Filter
            </button>
          </div>
        )}

        {historyError && (
          <div
            role="alert"
            className="m-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {historyError}
          </div>
        )}

        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-floral-600" />
            <p className="text-xs">Memuat data riwayat penjualan...</p>
          </div>
        ) : salesHistory.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Tidak ada transaksi penjualan yang sesuai dengan filter.
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
                  <th scope="col" className="px-5 py-3">
                    Tanggal
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Qty
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Harga Satuan
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesHistory.map((sale) => (
                  <tr key={sale.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">
                        {sale.variant_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {sale.product_name || 'Tanpa nama produk'}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600">
                        {sale.sku}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                      {formatDate(sale.sale_date)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-800">
                      {formatNumber(sale.quantity)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600">
                      {formatCurrency(sale.unit_price)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-800">
                      {formatCurrency(sale.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
