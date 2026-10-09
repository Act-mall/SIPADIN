import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { MOCK_DATA } from "../mock";
import { suratMasukApi, suratKeluarApi } from "../api/surat";
import { notaDinasApi } from "../api/notaDinas";
import { beritaAcaraApi } from "../api/beritaAcara";
import { legalisirApi } from "../api/legalisir";
import { skApi } from "../api/sk";
import { sopApi } from "../api/sop";
import { mouApi } from "../api/mou";
import {
  ChevronRight,
  Inbox,
  Send,
  BriefcaseBusiness,
  Briefcase,
  FileText,
  FileCheck,
  CheckCircle2,
  Award,
  ClipboardList,
  Handshake,
} from "lucide-react";

// Ikon per kategori — disamakan dengan ikon yang dipakai di sidebar kiri (menu Buku Agenda).
const CATEGORY_ICONS = {
  "surat-masuk": Inbox,
  "surat-keluar": Send,
  "surat-tugas-ketua": BriefcaseBusiness,
  "surat-tugas-sekretaris": Briefcase,
  "nota-dinas": FileText,
  "berita-acara": FileCheck,
  legalisir: CheckCircle2,
  "surat-keputusan": Award,
  sop: ClipboardList,
  mou: Handshake,
};

// Rute Surat Keputusan adalah /sk, sedangkan path di mock "surat-keputusan".
const ROUTE_BY_PATH = { "surat-keputusan": "sk" };

// Sumber jumlah berkas per kategori. Surat Tugas belum tersimpan di server, jadi tidak ada di sini.
const COUNT_SOURCES = {
  "surat-masuk": () => suratMasukApi.list(),
  "surat-keluar": () => suratKeluarApi.list(),
  "nota-dinas": () => notaDinasApi.list(),
  "berita-acara": () => beritaAcaraApi.list(),
  legalisir: () => legalisirApi.list(),
  "surat-keputusan": () => skApi.list(),
  sop: () => sopApi.list(),
  mou: () => mouApi.list(),
};

export default function BukuAgenda() {
  const categories = MOCK_DATA.bukuAgendaCategories;
  const [counts, setCounts] = useState({});

  useEffect(() => {
    const load = async () => {
      const entries = await Promise.all(
        Object.entries(COUNT_SOURCES).map(async ([path, fetchList]) => {
          try {
            const list = await fetchList();
            return [path, list.length];
          } catch (e) {
            return [path, null]; // mis. SK untuk pegawai di luar Teknis & Hukum
          }
        })
      );
      setCounts(Object.fromEntries(entries));
    };
    load();
  }, []);

  return (
    <AppLayout activePage="buku-agenda">
      <div data-testid="buku-agenda-container" className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Buku Agenda Persuratan</h1>
            <p className="text-sm text-slate-500 mt-1">
              Pilih kategori buku agenda untuk melihat rekapitulasi, pencarian, dan disposisi dokumen.
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-2">
            <Link
              to="/surat-masuk"
              className="px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              Buka Surat Masuk →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat, idx) => {
            const Icon = CATEGORY_ICONS[cat.path] || FileText;
            return (
              <Link
                key={idx}
                to={`/${ROUTE_BY_PATH[cat.path] || cat.path}`}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-red-900 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-red-50 text-red-900 flex items-center justify-center font-bold">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 group-hover:bg-red-900 group-hover:text-white transition-colors">
                      {counts[cat.path] != null ? `${counts[cat.path]} Berkas` : "—"}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-red-900 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {cat.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-red-900">
                  <span>Lihat Agenda</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}