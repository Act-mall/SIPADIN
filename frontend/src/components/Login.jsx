import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [nip, setNip] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(isAdmin ? "/admin-dashboard" : "/user-dashboard", { replace: true });
    }
  }, [user, isAdmin, navigate]);

  const doLogin = async (nipVal, pwVal) => {
    setSubmitting(true);
    try {
      const u = await login(nipVal, pwVal);
      toast.success(`Selamat datang, ${u.name}`);
      navigate(u.role === "admin" ? "/admin-dashboard" : "/user-dashboard", { replace: true });
    } catch (err) {
      toast.error(err.message || "Login gagal");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nip.trim() || !password) {
      toast.error("Mohon isi NIP dan password");
      return;
    }
    doLogin(nip.trim(), password);
  };

  return (
    <div
      className="relative min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans bg-cover bg-center bg-slate-800"
      style={{ backgroundImage: "url('/gedung-kpu.jpeg')" }}
    >
      {/* Lapisan merah transparan di atas gambar gedung */}
      <div className="absolute inset-0 bg-red-900/70" aria-hidden="true" />

      <div className="relative sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img src="/logo-kpu.png" alt="Logo KPU" className="h-24 w-auto drop-shadow-lg" />
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-white">SIPADIN</h2>
        <p className="mt-1 text-center text-sm font-medium text-red-100">KPU Kota Banjarmasin</p>
        <p className="mt-1 text-center text-xs text-red-100/80">Sistem Informasi Pengelolaan Arsip, Data dan Informasi</p>
      </div>

      <div className="relative mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white/95 py-8 px-6 shadow-xl border border-white/40 rounded-xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700">NIP</label>
              <input
                data-testid="login-nip-input"
                type="text"
                required
                autoComplete="username"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder="Masukkan NIP"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-red-900 focus:border-red-900 sm:text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                data-testid="login-password-input"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-red-900 focus:border-red-900 sm:text-sm"
              />
            </div>
            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={submitting}
              className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-900 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-900 disabled:opacity-60 transition-colors"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Masuk
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-red-100/70">© 2026 KPU Kota Banjarmasin. Hak Cipta Dilindungi.</p>
      </div>
    </div>
  );
}