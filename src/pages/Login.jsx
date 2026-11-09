import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react';
import api, { TOKEN_KEY, USER_KEY } from '../services/api.js';

const initialForm = {
  email: '',
  password: '',
};

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Jika sudah punya token, langsung arahkan ke dashboard.
  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const email = form.email.trim();
    const password = form.password;

    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;

      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user ?? { email }));

      navigate('/', { replace: true });
    } catch (requestError) {
      const message =
        requestError.response?.data?.message ||
        'Tidak dapat terhubung ke server. Silakan coba lagi.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-card lg:grid-cols-2">
        {/* Panel brand */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-floral-600 via-floral-700 to-slate-900 p-10 text-white lg:flex">
          <div className="flex items-center gap-3">
            <img
              src="/floralwins-logo.png"
              alt="Logo FloralWin's"
              className="h-14 w-14 shrink-0 rounded-full shadow-lg shadow-black/20"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-floral-100">
                FloralWin's
              </p>
              <p className="text-lg font-bold">Smart Stock UMKM</p>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-bold leading-tight">
              Kelola stok hijab FloralWin's,
              <br />
              pantau persediaan lebih cerdas.
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-floral-100">
              Pantau stok hijab dan pashmina, catat penjualan, serta dapatkan
              rekomendasi restock harian dari peramalan Holt-Winters.
            </p>
          </div>

          <p className="text-xs text-floral-200">
            &copy; {new Date().getFullYear()} FloralWin's. Semua hak dilindungi.
          </p>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 top-1/3 h-56 w-56 rounded-full bg-floral-400/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-white/10 blur-2xl"
          />
        </div>

        {/* Panel form */}
        <div className="p-8 sm:p-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img
              src="/floralwins-logo.png"
              alt="Logo FloralWin's"
              className="h-12 w-12 shrink-0 rounded-full shadow-sm"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-floral-600">
                FloralWin's
              </p>
              <p className="text-base font-bold text-slate-900">
                Smart Stock UMKM
              </p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Masuk ke dasbor</h2>
            <p className="mt-2 text-sm text-slate-500">
              Gunakan akun admin untuk melanjutkan.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="admin@florawins.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-floral-500 focus:bg-white focus:ring-2 focus:ring-floral-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Masukkan password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-floral-500 focus:bg-white focus:ring-2 focus:ring-floral-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={
                    showPassword ? 'Sembunyikan password' : 'Tampilkan password'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-floral-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-floral-700 focus:outline-none focus:ring-2 focus:ring-floral-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  Masuk
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Sesi login disimpan aman di perangkat ini.
          </p>
        </div>
      </div>
    </div>
  );
}
