import React, { useState } from "react";
import { KeyRound, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "../context/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const inputCls =
  "mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-red-900 focus:border-red-900 text-sm";

export default function GantiPasswordDialog({ open, onClose }) {
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const tutup = () => {
    setLama("");
    setBaru("");
    setUlang("");
    onClose();
  };

  const simpan = async (e) => {
    e.preventDefault();
    if (baru.length < 6) {
      toast.error("Password baru minimal 6 karakter");
      return;
    }
    if (baru !== ulang) {
      toast.error("Konfirmasi password baru tidak sama");
      return;
    }
    if (baru === lama) {
      toast.error("Password baru harus berbeda dari password lama");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/auth/ganti-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ password_lama: lama, password_baru: baru }),
      });
      if (!res.ok) {
        let pesan = "Gagal mengganti password";
        try {
          const d = await res.json();
          if (typeof d.detail === "string") pesan = d.detail;
        } catch (_e) {
          /* abaikan */
        }
        throw new Error(pesan);
      }
      toast.success("Password berhasil diganti");
      tutup();
    } catch (err) {
      toast.error(err.message || "Gagal mengganti password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4"
      onClick={tutup}
      data-testid="ganti-password-overlay"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="ganti-password-dialog"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-900 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Ganti Password</h3>
          </div>
          <button
            type="button"
            onClick={tutup}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={simpan} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Password lama</label>
            <input
              data-testid="ganti-password-lama"
              type="password"
              required
              autoComplete="current-password"
              value={lama}
              onChange={(e) => setLama(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Password baru</label>
            <input
              data-testid="ganti-password-baru"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={baru}
              onChange={(e) => setBaru(e.target.value)}
              placeholder="Minimal 6 karakter"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Ulangi password baru</label>
            <input
              data-testid="ganti-password-ulang"
              type="password"
              required
              autoComplete="new-password"
              value={ulang}
              onChange={(e) => setUlang(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={tutup}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="ganti-password-simpan"
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-red-900 rounded-md hover:bg-red-800 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}