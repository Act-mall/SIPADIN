import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { arsipVisibilityApi } from "../api/arsipVisibility";
import { arsipDokumenApi } from "../api/arsipDokumen";
import { Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DokumenInternal() {
  const [sections, setSections] = useState([]); // satu entri per subbagian (dari Master Data)
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await arsipVisibilityApi.kategori();
        setSections(list);
        const visible = list.filter((s) => s.tampil);
        const results = await Promise.all(
          visible.map((s) => arsipDokumenApi.list(s.code).catch(() => [])),
        );
        const c = {};
        visible.forEach((s, i) => {
          c[s.code] = results[i].length;
        });
        setCounts(c);
      } catch (e) {
        toast.error(e.message || "Gagal memuat daftar sub bagian dari server");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppLayout activePage="dokumen-internal">
      <div data-testid="dokumen-internal-container" className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-900 border border-red-200 mb-1">
            Arsip & Dokumen
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dokumen Internal</h1>
          <p className="text-sm text-slate-500">
            Pusat penyimpanan dokumen dan arsip digital per subbagian KPU Kota Banjarmasin. Pilih subbagian untuk
            membuka arsipnya.
          </p>
        </div>

        {loading && (
          <div className="py-10 text-center text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Memuat sub bagian...
          </div>
        )}

        {!loading && sections.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-400 text-sm italic">
            Belum ada sub bagian. Tambahkan lewat Manajemen Master Data.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sections.map((sec) =>
            sec.tampil ? (
              <Link
                key={sec.id}
                to={`/dokumen-internal/${encodeURIComponent(sec.code)}`}
                data-testid={`kartu-arsip-${sec.code}`}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-red-900/50 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-900 border border-red-200 mb-2">
                    {sec.code}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{sec.name}</h3>
                  {sec.deskripsi && (
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{sec.deskripsi}</p>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{counts[sec.code] ?? 0} Dokumen</span>
                  <span className="text-red-900">Buka</span>
                </div>
              </Link>
            ) : (
              <div
                key={sec.id}
                data-testid={`kartu-arsip-terkunci-${sec.code}`}
                className="p-4 rounded-xl border border-slate-200 bg-slate-100 opacity-60 flex flex-col justify-between cursor-not-allowed"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                      {sec.code}
                    </span>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{sec.name}</h3>
                  {sec.deskripsi && (
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{sec.deskripsi}</p>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 text-xs font-semibold text-slate-500">
                  Dibatasi oleh administrator
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </AppLayout>
  );
}