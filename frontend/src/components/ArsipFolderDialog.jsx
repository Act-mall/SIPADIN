import React, { useState, useEffect } from "react";
import { FolderPlus, Loader2, X } from "lucide-react";

// Dialog kecil untuk membuat folder baru atau mengganti nama folder.
// onSubmit(nama) boleh melempar error; pesannya ditampilkan di dalam dialog.
export default function ArsipFolderDialog({ open, mode, namaAwal, onClose, onSubmit }) {
  const [nama, setNama] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setNama(namaAwal || "");
      setError("");
      setSubmitting(false);
    }
  }, [open, namaAwal]);

  if (!open) return null;

  const simpan = async (e) => {
    e.preventDefault();
    const bersih = nama.trim();
    if (!bersih) {
      setError("Nama folder tidak boleh kosong.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(bersih);
    } catch (err) {
      setError(err.message || "Gagal menyimpan folder.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="arsip-folder-overlay"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="arsip-folder-dialog"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-900 flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {mode === "ganti" ? "Ganti Nama Folder" : "Folder Baru"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={simpan} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Nama folder</label>
            <input
              data-testid="arsip-folder-nama"
              type="text"
              autoFocus
              maxLength={60}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: SPIP"
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-red-900 focus:border-red-900 text-sm"
            />
            {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="arsip-folder-simpan"
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