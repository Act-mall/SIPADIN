import React, { useState, useEffect, useRef, createContext, useContext, useLayoutEffect } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { 
  FileText, 
  Inbox, 
  Send, 
  FolderArchive, 
  Shield, 
  BarChart3, 
  Menu, 
  X, 
  LogOut, 
  CheckCircle2, 
  Building, 
  BookOpen, 
  FileCheck, 
  Briefcase, 
  BriefcaseBusiness, 
  Award,
  ClipboardList,
  Handshake,
  StickyNote,
  ChevronDown,
  KeyRound
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { arsipVisibilityApi } from "../api/arsipVisibility";
import { TEKNIS_HUKUM_SUBBAG_CODE } from "../constants/subbagian";
import GantiPasswordDialog from "./GantiPasswordDialog";

function AppLayoutBase({ children, activePage }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bukuAgendaOpen, setBukuAgendaOpen] = useState(true);
  const [dokumenInternalOpen, setDokumenInternalOpen] = useState(true);
  const [masterDataOpen, setMasterDataOpen] = useState(false);
  const { user: authUser, logout } = useAuth();
  const [user, setUser] = useState(authUser || { name: "Pengguna", role: "user" });
  const [arsipKategori, setArsipKategori] = useState([]);

  const navigate = useNavigate();
  
  const location = useLocation();
  // Kode subbagian yang sedang dibuka di /dokumen-internal/:kode (untuk penanda menu aktif)
  const kodeAktif = location.pathname.startsWith("/dokumen-internal/")
    ? decodeURIComponent(location.pathname.slice("/dokumen-internal/".length))
    : null;

  const [passwordOpen, setPasswordOpen] = useState(false);

  // Rangka tidak dibuat ulang saat pindah halaman, jadi sidebar HP ditutup di sini (dengan animasi geser).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Tutup menu pengguna kalau klik di luar menu.
  useEffect(() => {
    const onKlikLuar = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onKlikLuar);
    return () => document.removeEventListener("mousedown", onKlikLuar);
  }, []);

  useEffect(() => {
    if (authUser) {
      setUser(authUser);
    }
  }, [authUser, location.pathname]);

  useEffect(() => {
    if (!authUser) return;
    (async () => {
      try {
        const list = await arsipVisibilityApi.kategori();
        setArsipKategori(list);
      } catch (_e) {
        // Biarkan nilai default kalau gagal memuat dari server.
      }
    })();
  }, [authUser]);

  const handleLogout = () => {
    logout();
    toast.success("Berhasil keluar dari sistem");
    navigate("/", { replace: true });
  };

  const isAdmin = user.role === "admin";
  const isTeknisHukum = user.subbag_code === TEKNIS_HUKUM_SUBBAG_CODE;
  const canAccessSk = isAdmin || isTeknisHukum;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <GantiPasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      {/* Mobile Header */}
      <div className="lg:hidden bg-red-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center space-x-3">
          <button 
            data-testid="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded-md text-white hover:bg-red-800 focus:outline-none"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-white p-0.5 flex items-center justify-center">
              <img src="/logo-kpu.png" alt="Logo KPU" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight tracking-wide">SIPADIN</h1>
              <p className="text-[10px] text-red-200">KPU Kota Banjarmasin</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-red-950 text-slate-200 flex flex-col shadow-xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:bottom-auto lg:h-screen lg:shrink-0 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Sidebar Header */}
          <div className="p-5 bg-red-900 flex items-center justify-between border-b border-red-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center shadow-sm">
                <img src="/logo-kpu.png" alt="Logo KPU" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="font-bold text-white text-base tracking-wide">SIPADIN</h1>
                <p className="text-xs text-red-200 font-medium">KPU Kota Banjarmasin</p>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-red-200 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 space-y-1">
            <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-red-400 uppercase">
              Dashboard
            </div>
            
            <Link
              data-testid="nav-dashboard"
              to={isAdmin ? "/admin-dashboard" : "/user-dashboard"}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activePage === 'dashboard' 
                  ? 'bg-red-900 text-white shadow-sm' 
                  : 'text-slate-300 hover:bg-red-900/50 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-3 text-red-300" />
              Dashboard Utama
            </Link>

            <div className="pt-4 px-3 pb-2 text-[10px] font-semibold tracking-wider text-red-400 uppercase">
              Buku Agenda
            </div>

            <Link
              data-testid="nav-buku-agenda"
              to="/buku-agenda"
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activePage === 'buku-agenda' 
                  ? 'bg-red-900 text-white shadow-sm' 
                  : 'text-slate-300 hover:bg-red-900/50 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4 mr-3 text-red-300" />
              Buku Agenda
            </Link>

            <div className="space-y-0.5 pl-2 border-l border-red-900/60 ml-4 my-1">
              <Link
                data-testid="nav-surat-masuk"
                to="/surat-masuk"
                className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  activePage === 'surat-masuk' ? 'bg-red-900 text-white font-semibold' : 'text-slate-300 hover:bg-red-900/40 hover:text-white'
                }`}
              >
                <Inbox className="w-3.5 h-3.5 mr-2.5 text-red-300" />
                Surat Masuk
              </Link>
              <Link
                data-testid="nav-surat-keluar"
                to="/surat-keluar"
                className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  activePage === 'surat-keluar' ? 'bg-red-900 text-white font-semibold' : 'text-slate-300 hover:bg-red-900/40 hover:text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5 mr-2.5 text-red-300" />
                Surat Keluar
              </Link>
              <Link
                data-testid="nav-surat-tugas-ketua"
                to="/surat-tugas-ketua"
                className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  activePage === 'surat-tugas-ketua' ? 'bg-red-900 text-white font-semibold' : 'text-slate-300 hover:bg-red-900/40 hover:text-white'
                }`}
              >
                <BriefcaseBusiness className="w-3.5 h-3.5 mr-2.5 text-red-300" />
                Surat Tugas & SPD Ketua
              </Link>
              <Link
                data-testid="nav-surat-tugas-sekretaris"
                to="/surat-tugas-sekretaris"
                className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  activePage === 'surat-tugas-sekretaris' ? 'bg-red-900 text-white font-semibold' : 'text-slate-300 hover:bg-red-900/40 hover:text-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 mr-2.5 text-red-300" />
                Surat Tugas & SPD Sekretaris
              </Link>
              <Link
                data-testid="nav-nota-dinas"
                to="/nota-dinas"
                className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  activePage === 'nota-dinas' ? 'bg-red-900 text-white font-semibold' : 'text-slate-300 hover:bg-red-900/40 hover:text-white'
                }`}
              >
                <StickyNote className="w-3.5 h-3.5 mr-2.5 text-red-300" />
                Nota Dinas
              </Link>
              <Link
                data-testid="nav-berita-acara"
                to="/berita-acara"
                className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  activePage === 'berita-acara' ? 'bg-red-900 text-white font-semibold' : 'text-slate-300 hover:bg-red-900/40 hover:text-white'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5 mr-2.5 text-red-300" />
                Berita Acara
              </Link>
              <Link
                data-testid="nav-legalisir"
                to="/legalisir"
                className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  activePage === 'legalisir' ? 'bg-red-900 text-white font-semibold' : 'text-slate-300 hover:bg-red-900/40 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-2.5 text-red-300" />
                Legalisir
              </Link>
              {canAccessSk && (
                <Link
                  data-testid="nav-sk"
                  to="/sk"
                  className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    activePage === 'sk' ? 'bg-red-900 text-white font-semibold' : 'text-slate-300 hover:bg-red-900/40 hover:text-white'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 mr-2.5 text-red-300" />
                  SK
                </Link>
              )}
              <Link
                data-testid="nav-sop"
                to="/sop"
                className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  activePage === 'sop' ? 'bg-red-900 text-white font-semibold' : 'text-slate-300 hover:bg-red-900/40 hover:text-white'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 mr-2.5 text-red-300" />
                SOP
              </Link>
              <Link
                data-testid="nav-mou"
                to="/mou"
                className={`flex items-center px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  activePage === 'mou' ? 'bg-red-900 text-white font-semibold' : 'text-slate-300 hover:bg-red-900/40 hover:text-white'
                }`}
              >
                <Handshake className="w-3.5 h-3.5 mr-2.5 text-red-300" />
                MOU
              </Link>
            </div>

            <div className="pt-4 px-3 pb-2 text-[10px] font-semibold tracking-wider text-red-400 uppercase">
              Dokumen Internal
            </div>

            <Link
              data-testid="nav-dokumen-internal"
              to="/dokumen-internal"
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activePage === 'dokumen-internal' 
                  ? 'bg-red-900 text-white shadow-sm' 
                  : 'text-slate-300 hover:bg-red-900/50 hover:text-white'
              }`}
            >
              <FolderArchive className="w-4 h-4 mr-3 text-red-300" />
              Arsip & Dokumen
            </Link>

            <div className="space-y-0.5 pl-2 border-l border-red-900/60 ml-4 my-1">
              {arsipKategori.filter((k) => k.tampil).map((k) => (
                <Link
                  key={k.id}
                  to={`/dokumen-internal/${encodeURIComponent(k.code)}`}
                  className={`flex items-center px-3 py-1.5 rounded-md text-xs leading-snug transition-colors ${
                    kodeAktif === k.code
                      ? "bg-red-900 text-white font-semibold"
                      : "text-slate-300 hover:text-white hover:bg-red-900/40"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-2.5 shrink-0"></span>
                  {k.code}
                </Link>
              ))}
            </div>

            {isAdmin && (
              <>
                <div className="pt-4 px-3 pb-2 text-[10px] font-semibold tracking-wider text-amber-400 uppercase">
                  Master Data (Admin)
                </div>
                <Link
                  data-testid="nav-master-data"
                  to="/master-data"
                  className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activePage === 'master-data' 
                      ? 'bg-red-900 text-white shadow-sm' 
                      : 'text-slate-300 hover:bg-red-900/50 hover:text-white'
                  }`}
                >
                  <Building className="w-4 h-4 mr-3 text-amber-400" />
                  Manajemen Master Data
                </Link>
                <Link
                  data-testid="nav-hak-akses"
                  to="/hak-akses"
                  className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activePage === 'hak-akses' 
                      ? 'bg-red-900 text-white shadow-sm' 
                      : 'text-slate-300 hover:bg-red-900/50 hover:text-white'
                  }`}
                >
                  <Shield className="w-4 h-4 mr-3 text-amber-400" />
                  Hak Akses Menu
                </Link>
              </>
            )}
          </div>

          {/* Sidebar Footer User Info */}
          <div className="p-4 bg-red-950 border-t border-red-900 flex items-center justify-between lg:hidden">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-red-900 text-white flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                {user.name.substring(0, 2)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-white truncate">{user.name}</p>
                <p className="text-[10px] text-red-300 uppercase">{isAdmin ? "Administrator" : "Pegawai"}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                data-testid="sidebar-ganti-password-btn"
                onClick={() => {
                  setSidebarOpen(false);
                  setPasswordOpen(true);
                }}
                title="Ganti Password"
                className="p-1.5 text-red-300 hover:text-white hover:bg-red-900 rounded-md transition-colors"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                data-testid="sidebar-logout-btn"
                onClick={handleLogout}
                title="Keluar"
                className="p-1.5 text-red-300 hover:text-white hover:bg-red-900 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Desktop Header */}
          <header className="hidden lg:flex bg-white border-b border-slate-200 h-16 px-6 items-center justify-between z-20">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-slate-500 text-sm">
                <span className="font-semibold text-slate-800">SIPADIN KPU Kota Banjarmasin</span>
                <span>/</span>
                <span className="text-red-900 font-medium capitalize">{activePage ? activePage.replace("-", " ") : "Dashboard"}</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">

              <div className="relative" ref={userMenuRef}>
                <button
                  data-testid="user-menu-btn"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center space-x-3 rounded-lg px-2 py-1 hover:bg-slate-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-red-900 text-white flex items-center justify-center font-bold text-xs uppercase">
                    {user.name.substring(0, 2)}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-slate-900">{user.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase">{isAdmin ? "Admin Sekretariat" : "Pegawai / Staf"}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30">
                    <button
                      data-testid="header-ganti-password-btn"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setPasswordOpen(true);
                      }}
                      className="w-full flex items-center px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <KeyRound className="w-4 h-4 mr-2" /> Ganti Password
                    </button>
                    <button
                      data-testid="header-logout-btn"
                      onClick={handleLogout}
                      className="w-full flex items-center px-3 py-2 text-xs font-medium text-red-900 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Keluar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page Scroll Container */}
          <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}


const ShellContext = createContext(null);

// Rangka halaman (sidebar + header) dibuat SEKALI dan tidak dibuat ulang saat pindah halaman.
export function LayoutShell() {
  const [activePage, setActivePage] = useState("");
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <ShellContext.Provider value={setActivePage}>
      <AppLayoutBase activePage={activePage}>
        <Outlet />
      </AppLayoutBase>
    </ShellContext.Provider>
  );
}

// Setiap halaman tetap memakai <AppLayout activePage="...">. Di dalam rangka, komponen ini
// hanya memberi tahu rangka halaman mana yang aktif lalu menampilkan isinya.
export function AppLayout({ children, activePage }) {
  const setShellPage = useContext(ShellContext);
  useLayoutEffect(() => {
    if (setShellPage) setShellPage(activePage);
  }, [setShellPage, activePage]);
  if (setShellPage) return <>{children}</>;
  return <AppLayoutBase activePage={activePage}>{children}</AppLayoutBase>;
}