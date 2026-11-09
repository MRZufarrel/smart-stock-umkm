import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import api from '../services/api.js';
import { formatCurrency, formatNumber } from '../utils/format.js';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-floral-500 focus:bg-white focus:ring-2 focus:ring-floral-100';

const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';

const createEmptyVariant = () => ({
  sku: '',
  variant_name: '',
  price: '',
  current_stock: '0',
  min_stock: '5',
});

const createInitialForm = () => ({
  name: '',
  category_id: '',
  description: '',
  variants: [createEmptyVariant()],
});

const createFormFromProduct = (product) => {
  const variants = (product.variants || []).map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    variant_name: variant.variant_name,
    price: String(variant.price),
    current_stock: String(variant.current_stock),
    min_stock: String(variant.min_stock),
  }));

  return {
    name: product.name || '',
    category_id: product.category_id || '',
    description: product.description || '',
    variants: variants.length > 0 ? variants : [createEmptyVariant()],
  };
};

const isCritical = (variant) =>
  Number(variant.current_stock) < Number(variant.min_stock);

export default function Products() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  const [notice, setNotice] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(createInitialForm);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [apiCategories, setApiCategories] = useState([]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await api.get('/categories');
      const data = response.data?.data;
      if (Array.isArray(data)) {
        setApiCategories(data);
      }
    } catch {
      // Fallback tetap menggunakan kategori yang diekstrak dari daftar produk
    }
  }, []);

  const loadProducts = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }

    setLoadError('');

    try {
      const response = await api.get('/products');
      const data = response.data?.data;

      setProducts(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setLoadError(
        requestError.response?.data?.message ||
          'Gagal memuat daftar produk. Periksa koneksi ke server.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [loadProducts, loadCategories]);

  // Cegah halaman ikut bergulir saat modal terbuka.
  useEffect(() => {
    if (!isModalOpen && !deleteTarget) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen, deleteTarget]);

  const categories = useMemo(() => {
    if (apiCategories.length > 0) {
      return apiCategories;
    }

    const map = new Map();

    products.forEach((product) => {
      if (product.category_id && !map.has(product.category_id)) {
        map.set(product.category_id, product.category_name || 'Tanpa nama');
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [apiCategories, products]);

  const totals = useMemo(() => {
    const variantList = products.flatMap((product) => product.variants || []);

    return {
      products: products.length,
      variants: variantList.length,
      critical: variantList.filter(isCritical).length,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return products;
    }

    return products
      .map((product) => {
        const productMatches =
          product.name.toLowerCase().includes(keyword) ||
          (product.category_name || '').toLowerCase().includes(keyword);

        if (productMatches) {
          return product;
        }

        const matchedVariants = (product.variants || []).filter(
          (variant) =>
            variant.sku.toLowerCase().includes(keyword) ||
            variant.variant_name.toLowerCase().includes(keyword)
        );

        return matchedVariants.length > 0
          ? { ...product, variants: matchedVariants }
          : null;
      })
      .filter(Boolean);
  }, [products, search]);

  const openModal = () => {
    loadCategories();
    setEditingProduct(null);
    setForm(createInitialForm());
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    loadCategories();
    setEditingProduct(product);
    setForm(createFormFromProduct(product));
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setEditingProduct(null);
    setFormError('');
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleVariantChange = (index, field, value) => {
    setForm((previous) => ({
      ...previous,
      variants: previous.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant
      ),
    }));
  };

  const addVariantRow = () => {
    setForm((previous) => ({
      ...previous,
      variants: [...previous.variants, createEmptyVariant()],
    }));
  };

  const removeVariantRow = (index) => {
    setForm((previous) => ({
      ...previous,
      variants: previous.variants.filter(
        (_, variantIndex) => variantIndex !== index
      ),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const name = form.name.trim();

    if (!name) {
      setFormError('Nama produk wajib diisi.');
      return;
    }

    if (form.variants.length === 0) {
      setFormError('Produk harus memiliki minimal satu varian.');
      return;
    }

    const payloadVariants = [];

    for (let index = 0; index < form.variants.length; index += 1) {
      const variant = form.variants[index];
      const sku = variant.sku.trim();
      const variantName = variant.variant_name.trim();
      const price = Number(variant.price);
      const currentStock = Number(
        variant.current_stock === '' ? 0 : variant.current_stock
      );
      const minStock = Number(variant.min_stock === '' ? 5 : variant.min_stock);

      if (!sku) {
        setFormError(`SKU varian #${index + 1} wajib diisi.`);
        return;
      }

      if (!variantName) {
        setFormError(`Nama varian #${index + 1} wajib diisi.`);
        return;
      }

      if (variant.price === '' || !Number.isFinite(price) || price < 0) {
        setFormError(
          `Harga varian #${index + 1} wajib berupa angka dan tidak boleh negatif.`
        );
        return;
      }

      if (!Number.isInteger(currentStock) || currentStock < 0) {
        setFormError(
          `Stok saat ini varian #${index + 1} harus bilangan bulat dan tidak negatif.`
        );
        return;
      }

      if (!Number.isInteger(minStock) || minStock < 0) {
        setFormError(
          `Stok minimum varian #${index + 1} harus bilangan bulat dan tidak negatif.`
        );
        return;
      }

      payloadVariants.push({
        ...(variant.id ? { id: variant.id } : {}),
        sku,
        variant_name: variantName,
        price,
        current_stock: currentStock,
        min_stock: minStock,
      });
    }

    const skuSet = new Set();

    for (const variant of payloadVariants) {
      const normalizedSku = variant.sku.toLowerCase();

      if (skuSet.has(normalizedSku)) {
        setFormError(`SKU "${variant.sku}" dipakai lebih dari sekali.`);
        return;
      }

      skuSet.add(normalizedSku);
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name,
        category_id: form.category_id || null,
        description: form.description.trim() || null,
        variants: payloadVariants,
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
      } else {
        await api.post('/products', payload);
      }

      setIsModalOpen(false);
      setEditingProduct(null);
      setForm(createInitialForm());
      setNotice({
        type: 'success',
        message: editingProduct
          ? `Produk "${name}" berhasil diperbarui.`
          : 'Produk beserta variannya berhasil ditambahkan.',
      });

      await loadProducts({ silent: true });
    } catch (requestError) {
      setFormError(
        requestError.response?.data?.message ||
          `Gagal ${editingProduct ? 'memperbarui' : 'menyimpan'} produk. Silakan coba lagi.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDelete = (product) => {
    setDeleteError('');
    setDeleteTarget(product);
  };

  const closeDeleteDialog = () => {
    if (isDeleting) {
      return;
    }

    setDeleteTarget(null);
    setDeleteError('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      await api.delete(`/products/${deleteTarget.id}`);

      setNotice({
        type: 'success',
        message: `Produk "${deleteTarget.name}" berhasil dihapus.`,
      });
      setDeleteTarget(null);

      await loadProducts({ silent: true });
    } catch (requestError) {
      setDeleteError(
        requestError.response?.data?.message ||
          'Gagal menghapus produk. Silakan coba lagi.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Judul halaman */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-floral-600 text-white shadow-lg shadow-floral-600/20">
            <Package className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Manajemen Produk &amp; Varian
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Kelola produk, SKU, harga, stok saat ini, dan batas stok minimum
              untuk setiap varian.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-floral-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-floral-600/20 transition hover:bg-floral-700 focus:outline-none focus:ring-2 focus:ring-floral-300 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Tambah Produk
        </button>
      </section>

      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          <span className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {notice.message}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
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

      {/* Ringkasan & pencarian */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
            <Package className="h-3.5 w-3.5" />
            {formatNumber(totals.products)} produk
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
            <Layers className="h-3.5 w-3.5" />
            {formatNumber(totals.variants)} varian
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {formatNumber(totals.critical)} stok kritis
          </span>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari produk, varian, atau SKU..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-floral-500 focus:bg-white focus:ring-2 focus:ring-floral-100"
          />
        </div>
      </section>

      {/* Tabel produk terkelompok */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-floral-600" />
            <p className="text-sm">Memuat daftar produk...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-floral-50 text-floral-600">
              <Package className="h-7 w-7" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              {products.length === 0
                ? 'Belum ada produk'
                : 'Produk tidak ditemukan'}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              {products.length === 0
                ? 'Tambahkan produk pertama beserta variannya untuk mulai memantau stok.'
                : 'Coba gunakan kata kunci lain untuk mencari produk atau SKU.'}
            </p>
            {products.length === 0 && (
              <button
                type="button"
                onClick={openModal}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-floral-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-floral-700"
              >
                <Plus className="h-4 w-4" />
                Tambah Produk
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    Varian
                  </th>
                  <th scope="col" className="px-5 py-3">
                    SKU
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Harga
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Stok
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Stok Min
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Status
                  </th>
                </tr>
              </thead>

              {filteredProducts.map((product) => (
                <tbody
                  key={product.id}
                  className="divide-y divide-slate-100 border-t border-slate-200"
                >
                  <tr className="bg-slate-50/80">
                    <td colSpan={6} className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-floral-600">
                            <Package className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {product.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {product.category_name || 'Tanpa kategori'}{' '}
                              &middot; {(product.variants || []).length} varian
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-200 hover:bg-slate-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(product)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {(product.variants || []).length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-3 text-xs text-slate-400"
                      >
                        Belum ada varian aktif pada produk ini.
                      </td>
                    </tr>
                  ) : (
                    product.variants.map((variant) => {
                      const critical = isCritical(variant);

                      return (
                        <tr
                          key={variant.id}
                          className="bg-white transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-3 pl-5 sm:pl-14">
                            <p className="font-medium text-slate-800">
                              {variant.variant_name}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3">
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600">
                              {variant.sku}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600">
                            {formatCurrency(variant.price)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${
                              critical ? 'text-red-700' : 'text-slate-800'
                            }`}
                          >
                            {formatNumber(variant.current_stock)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right text-slate-500">
                            {formatNumber(variant.min_stock)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right">
                            {critical ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                Stok Kritis
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Aman
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </section>

      {/* Modal tambah produk */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-floral-50 text-floral-600">
                  <Boxes className="h-4 w-4" />
                </span>
                <div>
                  <h3
                    id="product-modal-title"
                    className="text-sm font-bold text-slate-900"
                  >
                    {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingProduct
                      ? 'Perubahan pada produk dan varian disimpan sekaligus.'
                      : 'Satu produk wajib memiliki minimal satu varian.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Tutup form"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                {formError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {formError}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="product-name" className={labelClass}>
                      Nama Produk <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="product-name"
                      name="name"
                      type="text"
                      required
                      maxLength={255}
                      value={form.name}
                      onChange={handleFieldChange}
                      placeholder="Contoh: Pollycotton Premium"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="product-category" className={labelClass}>
                      Kategori
                    </label>
                    <select
                      id="product-category"
                      name="category_id"
                      value={form.category_id}
                      onChange={handleFieldChange}
                      className={inputClass}
                    >
                      <option value="">Tanpa kategori</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      Pilihan diambil dari kategori produk yang sudah ada.
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="product-description" className={labelClass}>
                    Deskripsi
                  </label>
                  <textarea
                    id="product-description"
                    name="description"
                    rows={2}
                    value={form.description}
                    onChange={handleFieldChange}
                    placeholder="Deskripsi singkat produk (opsional)"
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">
                      Varian Produk
                    </h4>
                    <span className="text-xs text-slate-500">
                      {form.variants.length} varian
                    </span>
                  </div>

                  {editingProduct && (
                    <p className="text-[11px] text-slate-400">
                      Varian yang dihapus dari form akan dinonaktifkan saat
                      disimpan.
                    </p>
                  )}

                  {form.variants.map((variant, index) => (
                    <div
                      key={`variant-row-${index}`}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Varian #{index + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeVariantRow(index)}
                          disabled={form.variants.length === 1}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor={`variant-sku-${index}`}
                            className={labelClass}
                          >
                            SKU <span className="text-red-500">*</span>
                          </label>
                          <input
                            id={`variant-sku-${index}`}
                            type="text"
                            required
                            maxLength={100}
                            value={variant.sku}
                            onChange={(event) =>
                              handleVariantChange(index, 'sku', event.target.value)
                            }
                            placeholder="PLY-CTN-01"
                            className={`${inputClass} bg-white font-mono`}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`variant-name-${index}`}
                            className={labelClass}
                          >
                            Nama Varian <span className="text-red-500">*</span>
                          </label>
                          <input
                            id={`variant-name-${index}`}
                            type="text"
                            required
                            maxLength={150}
                            value={variant.variant_name}
                            onChange={(event) =>
                              handleVariantChange(
                                index,
                                'variant_name',
                                event.target.value
                              )
                            }
                            placeholder="Pollycotton Warna Nude"
                            className={`${inputClass} bg-white`}
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div>
                          <label
                            htmlFor={`variant-price-${index}`}
                            className={labelClass}
                          >
                            Harga (Rp) <span className="text-red-500">*</span>
                          </label>
                          <input
                            id={`variant-price-${index}`}
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={variant.price}
                            onChange={(event) =>
                              handleVariantChange(
                                index,
                                'price',
                                event.target.value
                              )
                            }
                            placeholder="85000"
                            className={`${inputClass} bg-white`}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`variant-stock-${index}`}
                            className={labelClass}
                          >
                            Stok Saat Ini
                          </label>
                          <input
                            id={`variant-stock-${index}`}
                            type="number"
                            min="0"
                            step="1"
                            value={variant.current_stock}
                            onChange={(event) =>
                              handleVariantChange(
                                index,
                                'current_stock',
                                event.target.value
                              )
                            }
                            className={`${inputClass} bg-white`}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`variant-min-${index}`}
                            className={labelClass}
                          >
                            Stok Minimum
                          </label>
                          <input
                            id={`variant-min-${index}`}
                            type="number"
                            min="0"
                            step="1"
                            value={variant.min_stock}
                            onChange={(event) =>
                              handleVariantChange(
                                index,
                                'min_stock',
                                event.target.value
                              )
                            }
                            className={`${inputClass} bg-white`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-floral-300 bg-floral-50/50 px-4 py-2.5 text-sm font-semibold text-floral-700 transition hover:border-floral-400 hover:bg-floral-50"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Varian
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-floral-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-floral-700 focus:outline-none focus:ring-2 focus:ring-floral-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {editingProduct ? 'Simpan Perubahan' : 'Simpan Produk'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog konfirmasi hapus */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </span>

            <h3
              id="delete-dialog-title"
              className="mt-4 text-base font-bold text-slate-900"
            >
              Hapus produk ini?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">
                {deleteTarget.name}
              </span>{' '}
              beserta {(deleteTarget.variants || []).length} variannya akan
              dihapus dan tidak tampil lagi di daftar.
            </p>

            {deleteError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={isDeleting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Ya, Hapus
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
