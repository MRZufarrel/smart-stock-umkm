import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  X,
} from 'lucide-react';
import { TOKEN_KEY, USER_KEY } from '../services/api.js';

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Produk', icon: Package },
  { to: '/sales', label: 'Penjualan', icon: ShoppingCart },
  { to: '/forecasting', label: 'Peramalan', icon: BarChart3 },
];

const pageMeta = {
  '/': {
    title: 'Dashboard',
    description: "Ringkasan stok hijab dan aktivitas penjualan FloralWin's.",
  },
  '/products': {
    title: 'Produk',
    description: 'Kelola produk, varian, harga, dan batas stok minimum.',
  },
  '/sales': {
    title: 'Penjualan',
    description: 'Catat transaksi harian atau impor data penjualan dari CSV.',
  },
  '/forecasting': {
    title: 'Peramalan',
    description: 'Prediksi permintaan dan rekomendasi restock tiap varian.',
  },
};

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null;
  } catch {
    return null;
  }
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user] = useState(readStoredUser);

  const meta = pageMeta[location.pathname] || {
    title: 'Halaman',
    description: '',
  };

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    navigate('/login', { replace: true });
  };

  const initials = (user?.email || 'A').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Overlay sidebar mobile */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800/60 bg-slate-900 text-slate-200 transition-transform duration-300 lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <img
              src="/floralwins-logo.png"
              alt="Logo FloralWin's"
              className="h-10 w-10 shrink-0 rounded-full shadow-sm"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-floral-300">
                FloralWin's
              </p>
              <p className="text-sm font-bold text-white">Smart Stock</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Tutup sidebar"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Menu Utama
          </p>
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-floral-600 text-white shadow-lg shadow-floral-900/30'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-floral-500/20 text-sm font-bold text-floral-200">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                Admin
              </p>
              <p className="truncate text-xs text-slate-400">
                {user?.email || 'admin@florawins.com'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Konten utama */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Buka menu navigasi"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                {meta.title}
              </h1>
              {meta.description && (
                <p className="hidden truncate text-xs text-slate-500 sm:block">
                  {meta.description}
                </p>
              )}
            </div>

            <span className="hidden rounded-full bg-floral-50 px-3 py-1 text-xs font-semibold text-floral-700 sm:inline-flex">
              Admin
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 sm:px-6">
          Smart Stock UMKM &mdash; FloralWin's
        </footer>
      </div>
    </div>
  );
}
