import React, { useEffect, useState } from "react";
import { Search, Edit2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { klasifikasiApi } from "../../api/klasifikasi";
import { KlasifikasiFormModal, KlasifikasiDeleteModal } from "../KlasifikasiFormModal";
import { inputCls } from "./MasterHelpers";

export default function KlasifikasiTab({ isTabActive, showAddModal, setShowAddModal }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [kategori, setKategori] = useState("Semua");
  const [bidang, setBidang] = useState("Semua");
  const [bidangs, setBidangs] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rows, b] = await Promise.all([
        klasifikasiApi.list({ kategori, bidang, search: search.trim() || undefined, activeOnly: false }),
        klasifikasiApi.bidangList(kategori),
      ]);
      setList(rows);
      setBidangs(b);
    } catch (e) {
      toast.error(e.message || "Gagal memuat klasifikasi");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isTabActive) setBidang("Semua"); }, [kategori, isTabActive]);
  useEffect(() => {
    if (!isTabActive) return;
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTabActive, kategori, bidang, search]);

  return (
    <div data-testid="klasifikasi-tab-content" className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 left-3" />
          <input data-testid="md-klasifikasi-search" type="text" placeholder="Cari kode / uraian / bidang..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-900" />
        </div>
        <select data-testid="md-klasifikasi-filter-kategori" value={kategori} onChange={(e) => setKategori(e.target.value)} className={inputCls}>
          <option value="Semua">Semua Kategori</option>
          <option value="Substantif">Substantif</option>
          <option value="Fasilitatif">Fasilitatif</option>
        </select>
        <select data-testid="md-klasifikasi-filter-bidang" value={bidang} onChange={(e) => setBidang(e.target.value)} className={inputCls}>
          <option value="Semua">Semua Bidang</option>
          {bidangs.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Daftar Klasifikasi Arsip</h3>
          <span data-testid="md-klasifikasi-count" className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{list.length} data</span>
        </div>
        {loading ? (
          <div className="py-10 text-center text-slate-400 text-xs"><Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />Memuat data klasifikasi...</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kode</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Uraian</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bidang</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kategori</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Level</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 text-xs">
                  {list.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 italic">Tidak ada klasifikasi.</td></tr>}
                  {list.map((k) => (
                    <tr key={k.id} data-testid={`md-klasifikasi-row-${k.kode}`} className={`hover:bg-slate-50 ${!k.is_active ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 border border-slate-200 rounded px-2 py-0.5">{k.kode}</span>
                        {!k.is_active && <span className="ml-2 text-[9px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">NONAKTIF</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-800 max-w-md" style={{ paddingLeft: `${16 + (k.level || 0) * 16}px` }}>{k.uraian}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={k.bidang}>{k.bidang}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${k.kategori === 'Substantif' ? 'bg-red-50 text-red-900 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{k.kategori}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 font-mono">{k.level}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button data-testid={`md-klasifikasi-edit-${k.kode}`} onClick={() => setEditing(k)} className="inline-flex text-slate-600 hover:text-red-900 font-semibold mr-3" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button data-testid={`md-klasifikasi-delete-${k.kode}`} onClick={() => setDeleting(k)} className="inline-flex text-slate-500 hover:text-red-900 font-semibold" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
              {list.length === 0 && <div className="py-10 text-center text-slate-400 italic text-xs">Tidak ada klasifikasi.</div>}
              {list.map((k) => (
                <div key={k.id} data-testid={`md-klasifikasi-card-${k.kode}`} className={`p-4 ${!k.is_active ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">{k.kode}</span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${k.kategori === 'Substantif' ? 'bg-red-50 text-red-900 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{k.kategori}</span>
                        <span className="text-[10px] text-slate-500">L{k.level}</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-800">{k.uraian}</div>
                      <div className="text-[11px] text-slate-500 mt-1">{k.bidang}</div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => setEditing(k)} className="w-8 h-8 rounded-md border border-slate-200 text-slate-500 hover:text-red-900 hover:border-red-200 hover:bg-red-50 flex items-center justify-center"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleting(k)} className="w-8 h-8 rounded-md border border-slate-200 text-slate-500 hover:text-red-900 hover:border-red-200 hover:bg-red-50 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <KlasifikasiFormModal open={showAddModal || !!editing} initial={editing}
        onClose={() => { setShowAddModal(false); setEditing(null); }}
        onSaved={() => { setShowAddModal(false); setEditing(null); load(); }} />
      <KlasifikasiDeleteModal open={!!deleting} item={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => { setDeleting(null); load(); }} />
    </div>
  );
}
