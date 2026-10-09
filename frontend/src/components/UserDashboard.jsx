import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { TEKNIS_HUKUM_SUBBAG_CODE } from "../constants/subbagian";
import { toast } from "sonner";
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
  CheckCircle2, 
  Calendar,
  Lock,
  Layers,
  BookOpen
} from "lucide-react";

const fmtWaktu = (iso) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export default function UserDashboard() {
  const [kategori, setKategori] = useState([]);
  const [stats, setStats] = useState({ suratMasuk: 0, suratKeluar: 0, totalArsip: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [jumlahBerkas, setJumlahBerkas] = useState({});


  useEffect(() => {
    const load = async () => {
      try {
        const [masuk, keluar, kategoriList] = await Promise.all([
          suratMasukApi.list(),
          suratKeluarApi.list(),
          arsipVisibilityApi.kategori(),
        ]);
        setKategori(kategoriList);

        const hasil = await Promise.all(
          kategoriList.filter((k) => k.tampil).map(async (k) => {
            const items = await arsipDokumenApi.list(k.code).catch(() => []);
            return [k.code, items.length];
          })
        );

        setJumlahBerkas(Object.fromEntries(hasil));
        setStats({
          suratMasuk: masuk.length,
          suratKeluar: keluar.length,
          totalArsip: hasil.reduce((n, [, c]) => n + c, 0),
        });
        setRecentActivities(
          [
            ...masuk.map((s) => ({ id: `sm-${s.id}`, createdAt: s.createdAt, text: `Surat masuk ditambahkan: ${s.perihal}` })),
            ...keluar.map((s) => ({ id: `sk-${s.id}`, createdAt: s.createdAt, text: `Surat keluar ditambahkan: ${s.perihal}` })),
          ]
            .filter((a) => a.createdAt)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 3)
            .map((a) => ({ ...a, time: fmtWaktu(a.createdAt) }))
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
      <div data-testid="user-dashboard-container" className="space-y-6">
        {/* Welcome Banner */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
              Panel Pegawai / Staf KPU
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Selamat datang di SIPADIN KPU Kota Banjarmasin
            </h1>
            <p className="text-sm text-slate-500">
              Sistem Informasi Pengelolaan Arsip, Data dan Informasi - Akses dokumen internal dan persuratan sesuai hak akses yang diberikan oleh administrator.
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link
              to="/buku-agenda"
              className="inline-flex items-center px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <BookOpen className="w-4 h-4 mr-1.5" />
              Buku Agenda
            </Link>
          </div>
        </div>

        {/* 3 Main Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Surat Masuk</p>
              <p className="text-3xl font-extrabold text-slate-900">{stats.suratMasuk}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-900 flex items-center justify-center">
              <Inbox className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Surat Keluar</p>
              <p className="text-3xl font-extrabold text-slate-900">{stats.suratKeluar}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-900 flex items-center justify-center">
              <Send className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Arsip</p>
              <p className="text-3xl font-extrabold text-slate-900">{stats.totalArsip}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FolderArchive className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Dynamic Dokumen Internal Section based on Hak Akses */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center">
              <FolderArchive className="w-4 h-4 mr-2 text-red-900" />
              Dokumen Internal (Sesuai Hak Akses Anda)
            </h3>
            <Link to="/dokumen-internal" className="text-xs font-semibold text-red-900 hover:underline flex items-center">
              Lihat Arsip <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kategori.map((k) =>
              k.tampil ? (
                <div key={k.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 mb-2">
                      Diizinkan (Aktif)
                    </span>
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900">{k.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-1">{k.deskripsi}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">{jumlahBerkas[k.code] ?? 0} Berkas</span>
                    <Link to={`/dokumen-internal/${encodeURIComponent(k.code)}`} className="text-red-900 font-semibold hover:underline">Buka →</Link>
                  </div>
                </div>
              ) : k.code === TEKNIS_HUKUM_SUBBAG_CODE ? (
                <div key={k.id} className="p-4 rounded-lg border border-dashed border-slate-300 bg-slate-100/50 flex flex-col justify-between opacity-75">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-600 mb-2">
                      <Lock className="w-3 h-3 mr-1" /> Akses Dinonaktifkan
                    </span>
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-700">{k.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-1">Menu disembunyikan sesuai kebijakan akses.</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-400 italic">
                    Hubungi Admin untuk akses
                  </div>
                </div>
              ) : null
            )}
          </div>
        </div>

        {/* Aktivitas Terbaru */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center">
            <Clock className="w-4 h-4 mr-2 text-red-900" />
            Aktivitas Surat & Arsip Terbaru
          </h3>
          <div className="divide-y divide-slate-100">
            {recentActivities.map((act) => (
              <div key={act.id} className="py-3 flex items-start space-x-3">
                <div className="w-7 h-7 rounded-full bg-red-50 text-red-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-800">{act.text}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{act.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
