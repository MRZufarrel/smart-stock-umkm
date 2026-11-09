import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Loader2,
  Package,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import api from '../services/api.js';
import { formatDate, formatNumber } from '../utils/format.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-floral-500 focus:bg-white focus:ring-2 focus:ring-floral-100';

const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';

const FALLBACK_MESSAGE =
  'Data kurang dari 14 hari, menggunakan fallback Simple Moving Average';

const LEAD_TIME_DAYS = 3;

export default function Forecasting() {
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');

  const [result, setResult] = useState(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [forecastError, setForecastError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const abortRef = useRef(null);
  const requestIdRef = useRef(0);

  const loadProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    setProductsError('');

    try {
      const response = await api.get('/products');
      const data = response.data?.data;

      setProducts(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setProductsError(
        requestError.response?.data?.message ||
          'Gagal memuat daftar produk. Periksa koneksi ke server.'
      );
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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

  const selectedProduct = useMemo(
    () => productGroups.find((product) => product.id === selectedProductId) || null,
    [productGroups, selectedProductId]
  );

  const availableVariants = selectedProduct?.variants || [];

  const selectedVariant = useMemo(
    () =>
      availableVariants.find((variant) => variant.id === selectedVariantId) ||
      null,
    [availableVariants, selectedVariantId]
  );

  // Ambil hasil peramalan setiap varian berubah. Permintaan lama dibatalkan
  // agar respons yang datang terlambat tidak menimpa pilihan terbaru.
  useEffect(() => {
    if (!selectedVariantId) {
      abortRef.current?.abort();
      requestIdRef.current += 1;
      setResult(null);
      setForecastError('');
      setIsLoadingForecast(false);
      return undefined;
    }

    abortRef.current?.abort();

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;

    abortRef.current = controller;
    requestIdRef.current = requestId;

    setResult(null);
    setForecastError('');
    setIsLoadingForecast(true);

    api
      .get(`/forecasting/${selectedVariantId}`, { signal: controller.signal })
      .then((response) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setResult(response.data || null);
      })
      .catch((requestError) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return;
        }

        setForecastError(
          requestError.response?.data?.message ||
            'Gagal memuat hasil peramalan. Silakan coba lagi.'
        );
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setIsLoadingForecast(false);
        }
      });

    return () => controller.abort();
  }, [selectedVariantId, reloadTick]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const handleProductChange = (event) => {
    setSelectedProductId(event.target.value);
    setSelectedVariantId('');
  };

  const handleVariantChange = (event) => {
    setSelectedVariantId(event.target.value);
  };

  const retryForecast = () => {
    if (selectedVariantId) {
      setReloadTick((tick) => tick + 1);
    }
  };

  const forecastRows = useMemo(
    () => (Array.isArray(result?.forecast) ? result.forecast : []),
    [result]
  );

  const totalPredicted = useMemo(
    () =>
      forecastRows.reduce(
        (total, row) => total + (Number(row.predicted_qty) || 0),
        0
      ),
    [forecastRows]
  );

  const chartData = useMemo(
    () => ({
      labels: forecastRows.map((row) => formatDate(row.date)),
      datasets: [
        {
          label: 'Prediksi Permintaan (unit)',
          data: forecastRows.map((row) => Number(row.predicted_qty) || 0),
          borderColor: '#d48c8c',
          backgroundColor: 'rgba(212, 140, 140, 0.18)',
          pointBackgroundColor: '#d48c8c',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
        },
      ],
    }),
    [forecastRows]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 12,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            title: (items) => {
              const index = items[0]?.dataIndex ?? 0;
              const row = forecastRows[index];

              return row?.date ? formatDate(row.date) : '';
            },
            label: (item) => `Prediksi: ${formatNumber(item.parsed.y)} unit`,
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          border: {
            color: '#e2e8f0',
          },
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            maxRotation: 0,
            autoSkipPadding: 12,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(148, 163, 184, 0.2)',
          },
          border: {
            display: false,
          },
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            precision: 0,
          },
          title: {
            display: true,
            text: 'Unit',
            color: '#94a3b8',
            font: { size: 11 },
          },
        },
      },
    }),
    [forecastRows]
  );

  const recommendation = result?.restock_recommendation || null;
  const needsRestock = Boolean(recommendation?.needs_restock);
  const isFallback =
    Boolean(result) &&
    (result.warning_flag === true || result.method_used === 'SMA_FALLBACK');
  const methodLabel =
    result?.method_used === 'SMA_FALLBACK'
      ? 'SMA Fallback'
      : 'Holt-Winters (m=7)';

  return (
    <div className="space-y-6">
      {/* Judul halaman */}
      <section className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-floral-600 text-white shadow-lg shadow-floral-600/20">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Peramalan &amp; Rekomendasi Restock
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Prediksi permintaan 7 hari ke depan dengan Holt-Winters (m=7) atau
            fallback SMA, lengkap dengan reorder point dan saran jumlah pesanan.
          </p>
        </div>
      </section>

      {productsError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {productsError}
          </span>
          <button
            type="button"
            onClick={loadProducts}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 sm:self-auto"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Coba lagi
          </button>
        </div>
      )}

      {/* Pemilihan produk & varian */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-floral-50 text-floral-600">
            <Package className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Pilih Produk &amp; Varian
            </h3>
            <p className="text-xs text-slate-500">
              Peramalan dihitung per varian berdasarkan riwayat penjualan.
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label htmlFor="forecast-product" className={labelClass}>
              Produk
            </label>
            <select
              id="forecast-product"
              value={selectedProductId}
              onChange={handleProductChange}
              disabled={isLoadingProducts || productGroups.length === 0}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <option value="">
                {isLoadingProducts
                  ? 'Memuat produk...'
                  : productGroups.length === 0
                    ? 'Belum ada produk dengan varian'
                    : 'Pilih produk'}
              </option>
              {productGroups.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {product.category_name ? ` — ${product.category_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="forecast-variant" className={labelClass}>
              Varian
            </label>
            <select
              id="forecast-variant"
              value={selectedVariantId}
              onChange={handleVariantChange}
              disabled={!selectedProduct || availableVariants.length === 0}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <option value="">
                {!selectedProduct
                  ? 'Pilih produk terlebih dahulu'
                  : 'Pilih varian produk'}
              </option>
              {availableVariants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.sku} — {variant.variant_name} (stok{' '}
                  {variant.current_stock})
                </option>
              ))}
            </select>
          </div>

          {selectedVariant && (
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">
                    {selectedProduct?.name || 'Produk'}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedVariant.variant_name}
                  </p>
                </div>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-600">
                  {selectedVariant.sku}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>
                  Stok saat ini:{' '}
                  <span className="font-semibold text-slate-700">
                    {formatNumber(selectedVariant.current_stock)} unit
                  </span>
                </span>
                <span>
                  Safety stock (stok minimum):{' '}
                  <span className="font-semibold text-slate-700">
                    {formatNumber(selectedVariant.min_stock)} unit
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {isFallback && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>{FALLBACK_MESSAGE}</span>
        </div>
      )}

      {/* Grafik prediksi */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-floral-50 text-floral-600">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Grafik Prediksi 7 Hari
              </h3>
              <p className="text-xs text-slate-500">
                Jumlah unit yang diprediksi terjual setiap hari.
              </p>
            </div>
          </div>

          {result && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-floral-200 bg-floral-50 px-3 py-1 text-xs font-semibold text-floral-700">
              <span className="h-1.5 w-1.5 rounded-full bg-floral-500" />
              Metode: {methodLabel}
            </span>
          )}
        </div>

        <div className="p-5">
          {isLoadingForecast ? (
            <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-xl bg-slate-50 text-slate-500 sm:h-80">
              <Loader2 className="h-6 w-6 animate-spin text-floral-600" />
              <p className="text-sm">Menghitung peramalan...</p>
            </div>
          ) : forecastError ? (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {forecastError}
              </span>
              <button
                type="button"
                onClick={retryForecast}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 sm:self-auto"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Coba lagi
              </button>
            </div>
          ) : !selectedVariantId ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center sm:h-80">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-floral-600 shadow-sm">
                <BarChart3 className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-slate-700">
                Belum ada varian yang dipilih
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Pilih produk lalu variannya untuk melihat grafik prediksi
                permintaan 7 hari ke depan.
              </p>
            </div>
          ) : forecastRows.length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-xl bg-slate-50 px-6 text-center sm:h-80">
              <p className="text-sm font-semibold text-slate-700">
                Data prediksi belum tersedia
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Tambahkan transaksi penjualan untuk varian ini agar peramalan
                dapat dihitung.
              </p>
            </div>
          ) : (
            <>
              <div className="relative h-72 w-full sm:h-80">
                <Line data={chartData} options={chartOptions} />
              </div>
              <p className="mt-3 text-[11px] text-slate-400">
                Arahkan kursor ke titik grafik untuk melihat nilai prediksi per
                tanggal.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Rekomendasi restock */}
      {result && recommendation && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-floral-50 text-floral-600">
                <PackageCheck className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Rekomendasi Restock
                </h3>
                <p className="text-xs text-slate-500">
                  Dihitung dari total prediksi 7 hari, lead time, dan stok saat
                  ini.
                </p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                needsRestock
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  needsRestock ? 'bg-red-500' : 'bg-emerald-500'
                }`}
              />
              {needsRestock ? 'Butuh Restock' : 'Stok Aman'}
            </span>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div
              className={`rounded-xl border px-4 py-4 ${
                needsRestock
                  ? 'border-red-200 bg-red-50'
                  : 'border-emerald-200 bg-emerald-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {needsRestock ? (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                )}
                <p
                  className={`text-xs font-semibold ${
                    needsRestock ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  Status
                </p>
              </div>
              <p
                className={`mt-2 text-lg font-bold ${
                  needsRestock ? 'text-red-800' : 'text-emerald-800'
                }`}
              >
                {needsRestock ? 'Butuh Restock' : 'Stok Aman'}
              </p>
              <p
                className={`mt-1 text-[11px] leading-relaxed ${
                  needsRestock ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {needsRestock
                  ? 'Perkiraan permintaan 7 hari melebihi stok yang tersedia.'
                  : 'Stok saat ini masih mencukupi kebutuhan 7 hari ke depan.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold text-slate-600">
                Reorder Point (ROP)
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {formatNumber(recommendation.reorder_point)}
                <span className="ml-1 text-xs font-medium text-slate-500">
                  unit
                </span>
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Rata-rata prediksi harian &times; lead time {LEAD_TIME_DAYS} hari
                + safety stock.
              </p>
            </div>

            <div className="rounded-xl border border-floral-200 bg-floral-50 px-4 py-4">
              <p className="text-xs font-semibold text-floral-700">
                Order Quantity (Q)
              </p>
              <p className="mt-2 text-lg font-bold text-floral-800">
                {formatNumber(recommendation.order_quantity)}
                <span className="ml-1 text-xs font-medium text-floral-600">
                  unit
                </span>
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-floral-700">
                Rekomendasi jumlah pesanan: total prediksi 7 hari + safety stock
                &minus; stok saat ini.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 px-5 py-3 text-[11px] text-slate-500">
            <span>
              Total prediksi 7 hari:{' '}
              <span className="font-semibold text-slate-700">
                {formatNumber(totalPredicted)} unit
              </span>
            </span>
            {selectedVariant && (
              <>
                <span>
                  Stok saat ini:{' '}
                  <span className="font-semibold text-slate-700">
                    {formatNumber(selectedVariant.current_stock)} unit
                  </span>
                </span>
                <span>
                  Safety stock:{' '}
                  <span className="font-semibold text-slate-700">
                    {formatNumber(selectedVariant.min_stock)} unit
                  </span>
                </span>
              </>
            )}
          </div>
        </section>
      )}

      {!isLoadingProducts && productGroups.length === 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            Belum ada varian produk yang bisa diramalkan. Tambahkan produk dan
            varian terlebih dahulu di halaman Produk.
          </span>
        </div>
      )}
    </div>
  );
}
