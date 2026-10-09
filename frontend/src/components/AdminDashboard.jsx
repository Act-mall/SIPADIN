import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { suratMasukApi, suratKeluarApi } from "../api/surat";
import { arsipDokumenApi } from "../api/arsipDokumen";
import { arsipVisibilityApi } from "../api/arsipVisibility";
import { 
  Inbox, 
  Send, 
  FolderArchive, 
  BarChart3, 
  Clock, 
  ArrowUpRight, 
  FileText, 
  Plus, 
  CheckCircle2, 
  Calendar,
  Users,
  ShieldAlert
} from "lucide-react";
import { toast } from "sonner";

const fmtTanggal = (t) => {
  if (!t) return "-";
  const d = new Date(`${String(t).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? t
    : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

const fmtWaktu = (iso) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    suratMasuk: 0, suratKeluar: 0, totalArsip: 0,
    masukBulanIni: 0, keluarBulanIni: 0, masukHariIni: 0, keluarHariIni: 0,
  });
  const [activities, setActivities] = useState([]);
  const [dokumenTerbaru, setDokumenTerbaru] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [masuk, keluar, kategoriList] = await Promise.all([
          suratMasukApi.list(),
          suratKeluarApi.list(),
          arsipVisibilityApi.kategori(),
        ]);

        const now = new Date();
        const bulanIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const dibuatHariIni = (s) => s.createdAt && new Date(s.createdAt).toDateString() === now.toDateString();

        const kategoriAktif = kategoriList.filter((k) => k.tampil);
        const arsipPerKategori = await Promise.all(
          kategoriAktif.map(async (k) => {
            const items = await arsipDokumenApi.list(k.code).catch(() => []);
            return items.map((d) => ({ ...d, kategoriNama: k.name }));
          })
        );
        const semuaArsip = arsipPerKategori.flat();

        setStats({
          suratMasuk: masuk.length,
          suratKeluar: keluar.length,
          totalArsip: semuaArsip.length,
          masukBulanIni: masuk.filter((s) => (s.tanggal || "").startsWith(bulanIni)).length,
          keluarBulanIni: keluar.filter((s) => (s.tanggal || "").startsWith(bulanIni)).length,
          masukHariIni: masuk.filter(dibuatHariIni).length,
          keluarHariIni: keluar.filter(dibuatHariIni).length,
        });

        setActivities(
          [
            ...masuk.map((s) => ({ id: `sm-${s.id}`, createdAt: s.createdAt, text: `Surat masuk ditambahkan: ${s.perihal}` })),
            ...keluar.map((s) => ({ id: `sk-${s.id}`, createdAt: s.createdAt, text: `Surat keluar ditambahkan: ${s.perihal}` })),
          ]
            .filter((a) => a.createdAt)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
            .map((a) => ({ ...a, time: fmtWaktu(a.createdAt) }))
        );

        setDokumenTerbaru(
          semuaArsip
            .sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""))
            .slice(0, 4)
            .map((d) => ({
              id: `${d.sumber}-${d.id}`,
              category: d.kategoriNama,
              title: d.title,
              date: fmtTanggal(d.tanggal),
              sumber: d.sumber,
            }))
        );
      } catch (e) {
        console.error(e);
        toast.error("Gagal memuat data dashboard");
      }
    };
    load();
  }, []);

  return (
    <AppLayout activePage="dashboard">
      <div data-testid="admin-dashboard-container" className="space-y-6">
        {/* Welcome Banner */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-900 border border-red-200">
              Panel Administrator
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Selamat datang di SIPADIN KPU Kota Banjarmasin
            </h1>
            <p className="text-sm text-slate-500">
              Sistem Informasi Pengelolaan Arsip, Data dan Informasi — Pantau agenda surat, arsip, dan dokumen internal instansi.
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <Link
              data-testid="btn-tambah-surat-masuk"
              to="/surat-masuk"
              className="inline-flex items-center px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Surat Masuk Baru
            </Link>
            <Link
              data-testid="btn-tambah-surat-keluar"
              to="/surat-keluar"
              className="inline-flex items-center px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Surat Keluar
            </Link>
          </div>
        </div>

        {/* 4 Main Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div data-testid="card-surat-masuk" className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between hover:border-red-900/40 transition-all">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Surat Masuk</p>
              <p className="text-3xl font-extrabold text-slate-900">{stats.suratMasuk}</p>
              <p className="text-xs text-emerald-600 font-medium flex items-center pt-1">
                <span className="text-emerald-600 font-bold mr-1">{stats.masukBulanIni}</span> surat bulan ini
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-900 flex items-center justify-center">
              <Inbox className="w-6 h-6" />
            </div>
          </div>

          <div data-testid="card-surat-keluar" className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between hover:border-red-900/40 transition-all">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Surat Keluar</p>
              <p className="text-3xl font-extrabold text-slate-900">{stats.suratKeluar}</p>
              <p className="text-xs text-emerald-600 font-medium flex items-center pt-1">
                <span className="text-emerald-600 font-bold mr-1">{stats.keluarBulanIni}</span> surat bulan ini
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-900 flex items-center justify-center">
              <Send className="w-6 h-6" />
            </div>
          </div>

          <div data-testid="card-total-arsip" className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between hover:border-red-900/40 transition-all">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Arsip</p>
              <p className="text-3xl font-extrabold text-slate-900">{stats.totalArsip}</p>
              <p className="text-xs text-slate-500 font-medium pt-1">
                Dokumen dengan berkas arsip
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FolderArchive className="w-6 h-6" />
            </div>
          </div>

          <div data-testid="card-aktivitas" className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between hover:border-red-900/40 transition-all">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Aktivitas Hari Ini</p>
              <p className="text-3xl font-extrabold text-slate-900">{stats.masukHariIni + stats.keluarHariIni}</p>
              <p className="text-xs text-amber-600 font-medium pt-1">
                {stats.masukHariIni} masuk · {stats.keluarHariIni} keluar
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Two Column Layout: Aktivitas Terbaru & Dokumen Internal Terbaru */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Aktivitas Terbaru */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-red-900" />
                Aktivitas Terbaru
              </h3>
              <Link to="/buku-agenda" className="text-xs font-semibold text-red-900 hover:underline flex items-center">
                Lihat Semua <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 flex-1">
              {activities.map((act) => (
                <div key={act.id} className="py-3.5 flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-red-50 text-red-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-800">{act.text}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center">
                      <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                      {act.time}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                    Sistem
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Col: Quick Access / Status */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center">
              <ShieldAlert className="w-4 h-4 mr-2 text-red-900" />
              Pintasan Menu Admin
            </h3>
            <div className="space-y-3 flex-1">
              <Link 
                to="/master-data"
                className="block p-3 rounded-lg border border-slate-200 hover:border-red-900 hover:bg-red-50/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-red-900">Manajemen Master Data</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-red-900" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Kelola data pegawai, subbagian, pejabat & wilayah.</p>
              </Link>

              <Link 
                to="/hak-akses"
                className="block p-3 rounded-lg border border-slate-200 hover:border-red-900 hover:bg-red-50/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-red-900">Pengaturan Hak Akses</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-red-900" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Atur visibilitas menu dokumen internal untuk staf.</p>
              </Link>

              <Link 
                to="/buku-agenda"
                className="block p-3 rounded-lg border border-slate-200 hover:border-red-900 hover:bg-red-50/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-red-900">Buku Agenda Lengkap</span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-red-900" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Rekapitulasi seluruh surat masuk, keluar, dan nota dinas.</p>
              </Link>
            </div>
          </div>
        </div>

        {/* Dokumen Internal Terbaru Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center">
              <FolderArchive className="w-4 h-4 mr-2 text-red-900" />
              Dokumen Internal Terbaru
            </h3>
            <Link to="/dokumen-internal" className="text-xs font-semibold text-red-900 hover:underline flex items-center">
              Semua Kategori <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {dokumenTerbaru.map((doc) => (
              <div key={doc.id} className="p-4 rounded-lg border border-slate-200 hover:border-red-900/50 transition-all flex flex-col justify-between">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-900 mb-2">
                    {doc.category}
                  </span>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2">{doc.title}</h4>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{doc.date}</span>
                  <span className="font-medium">{doc.sumber}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
