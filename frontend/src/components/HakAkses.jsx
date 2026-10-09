import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { arsipVisibilityApi } from "../api/arsipVisibility";
import { Shield, CheckCircle2, X, FolderArchive, Lock, } from "lucide-react";
import { toast } from "sonner";

export default function HakAkses() {
  const [kategori, setKategori] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await arsipVisibilityApi.kategoriSettings();
        setKategori(list);
      } catch (e) {
        toast.error("Gagal memuat pengaturan hak akses dari server");
      }
    })();
  }, []);

  const handleToggle = async (k) => {
    const baru = !k.tampil;
    setKategori((prev) => prev.map((x) => (x.id === k.id ? { ...x, tampil: baru } : x)));
    setSaving(true);
    try {
      await arsipVisibilityApi.setKategori(k.id, baru);
      toast.success(`Hak akses untuk ${k.name} berhasil diperbarui`);
    } catch (e) {
      setKategori((prev) => prev.map((x) => (x.id === k.id ? { ...x, tampil: !baru } : x)));
      toast.error(e.message || "Gagal menyimpan perubahan hak akses");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout activePage="hak-akses">
      <div data-testid="hak-akses-container" className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 mb-1">
              Admin Area Exclusive
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pengaturan Hak Akses Menu</h1>
            <p className="text-sm text-slate-500">
              Atur visibilitas dokumen internal yang dapat diakses oleh akun pegawai (User).
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Kontrol Akses Dokumen Internal (DOKUMEN INTERNAL)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ketika diaktifkan (✓), menu akan langsung muncul di sidebar akun Pegawai. Ketika dinonaktifkan, menu akan disembunyikan.
            </p>
          </div>

          <div className="space-y-4">
            {kategori.map((sec) => {
              const isEnabled = sec.tampil;
              return (
                <div 
                  key={sec.id}
                  className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                    isEnabled ? 'border-red-900/40 bg-red-50/20' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center space-x-2">
                      <FolderArchive className={`w-4 h-4 ${isEnabled ? 'text-red-900' : 'text-slate-400'}`} />
                      <h4 className="text-sm font-bold text-slate-900">{sec.name}</h4>
                    </div>
                    <p className="text-xs text-slate-500">{sec.deskripsi}</p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {isEnabled ? 'Aktif (✓)' : 'Dinonaktifkan'}
                    </span>
                    <button
                      data-testid={`toggle-permission-${sec.id}`}
                      onClick={() => handleToggle(sec)}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
                        isEnabled ? 'bg-red-900' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
            Catatan: Perubahan hak akses tersimpan di server dan langsung berlaku untuk semua akun Pegawai. Khusus "Teknis Penyelenggaraan Pemilu dan Hukum", pegawai di Subbagian tersebut tetap bisa melihat arsipnya walau di sini dinonaktifkan.
          </div>
        </div>
      </div>
    </AppLayout>
  );
}