import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "./AppLayout";
import { Layers, Search, Filter, Loader2, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { klasifikasiApi } from "../api/klasifikasi";

const KATEGORI_TABS = ["Semua", "Substantif", "Fasilitatif"];

const kategoriBadge = (k) =>
  k === "Substantif"
    ? "bg-red-50 text-red-900 border border-red-200"
    : "bg-slate-100 text-slate-700 border border-slate-200";

export default function KlasifikasiArsip() {
  const [items, setItems] = useState([]);
  const [globalStats, setGlobalStats] = useState({ total: 0, substantif: 0, fasilitatif: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Semua");
  const [search, setSearch] = useState("");
  const [bidangFilter, setBidangFilter] = useState("Semua");
  const [bidangs, setBidangs] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [list, bList] = await Promise.all([
        klasifikasiApi.list({
          kategori: tab,
          search: search.trim() || undefined,
          bidang: bidangFilter,
        }),
        klasifikasiApi.bidangList(tab),
      ]);
      setItems(list);
      setBidangs(bList);
    } catch (err) {
      toast.error(err.message || "Gagal memuat data klasifikasi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    klasifikasiApi.stats().then(setGlobalStats).catch(() => {});
  }, []);

  // Reset bidang filter when kategori tab changes
  useEffect(() => {
    setBidangFilter("Semua");
  }, [tab]);

  useEffect(() => {
    const t = setTimeout(load, 200); // small debounce for search
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search, bidangFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      if (!map.has(it.bidang)) map.set(it.bidang, []);
      map.get(it.bidang).push(it);
    });
    return Array.from(map.entries()).map(([bidang, rows]) => ({
      bidang,
      rows: rows.slice().sort((a, b) => a.kode.localeCompare(b.kode)),
    }));
  }, [items]);

  const counts = useMemo(() => {
    return {
      total: globalStats.total,
      substantif: globalStats.substantif,
      fasilitatif: globalStats.fasilitatif,
      filtered: items.length,
    };
  }, [globalStats, items]);

  return (
    <AppLayout activePage="klasifikasi-arsip">
      <div data-testid="klasifikasi-arsip-container" className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-11 h-11 rounded-lg bg-red-900 items-center justify-center shadow-sm shrink-0">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-900 border border-red-200 mb-1.5 uppercase tracking-wide">
                Klasifikasi Arsip
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Substantif &amp; Fasilitatif</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Kode klasifikasi arsip resmi KPU (Peraturan KPU No. 1257/2024). Sumber tunggal untuk seluruh sistem persuratan.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
              <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">Total</div>
              <div data-testid="stat-total" className="text-lg font-bold text-slate-900">{counts.total}</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2">
              <div className="text-[10px] uppercase font-semibold text-red-900 tracking-wide">Substantif</div>
              <div data-testid="stat-substantif" className="text-lg font-bold text-red-900">{counts.substantif}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">Fasilitatif</div>
              <div data-testid="stat-fasilitatif" className="text-lg font-bold text-slate-800">{counts.fasilitatif}</div>
            </div>
          </div>
        </div>

        {/* Tabs & Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {KATEGORI_TABS.map((k) => (
              <button
                key={k}
                data-testid={`tab-${k.toLowerCase()}`}
                onClick={() => setTab(k)}
                className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  tab === k
                    ? "bg-red-900 text-white border-red-900 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-3.5 h-3.5 text-slate-400" />
              </span>
              <input
                data-testid="klasifikasi-search"
                type="text"
                placeholder="Cari berdasarkan kode / uraian / bidang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                data-testid="klasifikasi-filter-bidang"
                value={bidangFilter}
                onChange={(e) => setBidangFilter(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-md px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-900"
              >
                <option value="Semua">Semua Bidang</option>
                {bidangs.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Data */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
            Memuat data klasifikasi...
          </div>
        ) : grouped.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400 italic text-sm">
            Tidak ada klasifikasi yang cocok dengan filter.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => (
              <div key={g.bidang} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-red-900" />
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">{g.bidang}</h2>
                  <span className="ml-auto text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                    {g.rows.length} kode
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {g.rows.map((it) => {
                    const level = Math.max(0, Math.min(it.level || 0, 4));
                    return (
                      <div
                        key={it.id}
                        data-testid={`klasifikasi-row-${it.kode}`}
                        className="px-5 py-3 hover:bg-slate-50 flex items-start gap-3"
                      >
                        <div style={{ width: `${level * 20}px` }} className="shrink-0" aria-hidden="true" />
                        <span
                          className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${
                            level === 0
                              ? "bg-red-900 text-white"
                              : level === 1
                              ? "bg-red-100 text-red-900 border border-red-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {it.kode}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs ${level === 0 ? "font-bold text-slate-900" : "text-slate-700"}`}>
                            {it.uraian}
                          </div>
                        </div>
                        <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${kategoriBadge(it.kategori)}`}>
                          {it.kategori}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
