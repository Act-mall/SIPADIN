import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import { LayoutShell } from "./components/AppLayout";
import AdminDashboard from "./components/AdminDashboard";
import UserDashboard from "./components/UserDashboard";
import BukuAgenda from "./components/BukuAgenda";
import SuratMasuk from "./components/SuratMasuk";
import SuratKeluar from "./components/SuratKeluar";
import SuratTugasSpdKetua from "./components/SuratTugasSpdKetua";
import SuratTugasSpdSekretaris from "./components/SuratTugasSpdSekretaris";
import NotaDinas from "./components/NotaDinas";
import DokumenInternal from "./components/DokumenInternal";
import ArsipSubbagian from "./components/ArsipSubbagian";
import BeritaAcara from "./components/BeritaAcara";
import Legalisir from "./components/Legalisir";
import SK from "./components/SK";
import Sop from "./components/Sop";
import Mou from "./components/Mou";
import KlasifikasiArsip from "./components/KlasifikasiArsip";
import MasterData from "./components/MasterData";
import HakAkses from "./components/HakAkses";
import { Toaster } from "sonner";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Memuat sesi...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/user-dashboard" replace />;
  return children;
}

function Guard({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

function AdminGuard({ children }) {
  return <ProtectedRoute adminOnly>{children}</ProtectedRoute>;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          {/* Rangka halaman (sidebar & header) dibuat sekali dan dipakai semua halaman di bawah ini */}
          <Route element={<Guard><LayoutShell /></Guard>}>
            <Route path="/admin-dashboard" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
            <Route path="/user-dashboard" element={<UserDashboard />} />
            <Route path="/buku-agenda" element={<BukuAgenda />} />
            <Route path="/surat-masuk" element={<SuratMasuk />} />
            <Route path="/surat-keluar" element={<SuratKeluar />} />
            <Route path="/surat-tugas-ketua" element={<SuratTugasSpdKetua />} />
            <Route path="/surat-tugas-sekretaris" element={<SuratTugasSpdSekretaris />} />
            <Route path="/nota-dinas" element={<NotaDinas />} />
            <Route path="/dokumen-internal" element={<DokumenInternal />} />
            <Route path="/dokumen-internal/:kode" element={<ArsipSubbagian />} />
            <Route path="/berita-acara" element={<BeritaAcara />} />
            <Route path="/legalisir" element={<Legalisir />} />
            <Route path="/sk" element={<SK />} />
            <Route path="/sop" element={<Sop />} />
            <Route path="/mou" element={<Mou />} />
            <Route path="/klasifikasi-arsip" element={<KlasifikasiArsip />} />
            <Route path="/master-data" element={<AdminGuard><MasterData /></AdminGuard>} />
            <Route path="/hak-akses" element={<AdminGuard><HakAkses /></AdminGuard>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;