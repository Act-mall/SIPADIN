import React, { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { useAuth } from "../context/AuthContext";
import { arsipVisibilityApi } from "../api/arsipVisibility";
import { arsipDokumenApi } from "../api/arsipDokumen";
import ArsipUnggahDialog from "./ArsipUnggahDialog";
import ArsipFolderDialog from "./ArsipFolderDialog";
import {
  FolderArchive,
  Folder,
  FolderPlus,
  Download,
  Eye,
  Search,
  ArrowLeft,
  Loader2,
  Lock,
  UploadCloud,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const formatTgl = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch (_e) {
    return iso;
  }
};

const selectCls =
  "px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-900";

export default function ArsipSubbagian() {
  const { kode } = useParams(); // kode subbagian, sudah ter-decode oleh react-router
  const { user, isAdmin } = useAuth();
  const bolehUbah = isAdmin || !!user?.permissions?.surat_edit;
  const bolehHapus = isAdmin || !!user?.permissions?.surat_delete;

  const [sub, setSub] = useState(null);
  const [subLoaded, setSubLoaded] = useState(false);
  const [docs, setDocs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jenis, setJenis] = useState("Semua"); // "Semua" | "auto:<nama>" | "folder:<id>"
  const [tahun, setTahun] = useState("Semua");
  const [bulan, setBulan] = useState("Semua"); // "Semua" | "01".."12"
  const [q, setQ] = useState("");
  const [unggah, setUnggah] = useState(null); // null | { item?: dokumen }
  const [folderDialog, setFolderDialog] = useState(null); // null | { mode: "buat" | "ganti" }

  useEffect(() => {
    let batal = false;
    (async () => {
      setLoading(true);
      setSubLoaded(false);
      setSub(null);
      setDocs([]);
      setFolders([]);
      setJenis("Semua");
      setTahun("Semua");
      setBulan("Semua");
      setQ("");
      try {
        const list = await arsipVisibilityApi.kategori();
        const found = list.find((k) => k.code === kode) || null;
        if (batal) return;
        setSub(found);
        setSubLoaded(true);
        if (found && found.tampil) {
          const [items, daftarFolder] = await Promise.all([
            arsipDokumenApi.list(kode),
            arsipDokumenApi.folders(kode),
          ]);
          if (!batal) {
            setDocs(items);
            setFolders(daftarFolder);
          }
        }
      } catch (e) {
        if (!batal && e.status !== 403) toast.error(e.message || "Gagal memuat arsip dari server");
      } finally {
        if (!batal) setLoading(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, [kode]);

  // Muat ulang dokumen dan folder setelah ada perubahan.
  const muatUlang = async () => {
    try {
      const [items, daftarFolder] = await Promise.all([arsipDokumenApi.list(kode), arsipDokumenApi.folders(kode)]);
      setDocs(items);
      setFolders(daftarFolder);
    } catch (e) {
      toast.error(e.message || "Gagal memuat ulang arsip");
    }
  };

  // ---- Tahun -> Bulan -> Jenis/Folder -> Pencarian ----
  const tahunList = useMemo(() => {
    const set = new Set();
    docs.forEach((d) => {
      const y = (d.tanggal || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) set.add(y);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [docs]);

  const docsTahun = useMemo(
    () => docs.filter((d) => tahun === "Semua" || (d.tanggal || "").startsWith(tahun)),
    [docs, tahun],
  );

  // Bulan yang benar-benar punya dokumen pada tahun yang dipilih.
  const bulanList = useMemo(() => {
    const set = new Set();
    docsTahun.forEach((d) => {
      const m = (d.tanggal || "").slice(5, 7);
      if (/^(0[1-9]|1[0-2])$/.test(m)) set.add(m);
    });
    return Array.from(set).sort();
  }, [docsTahun]);

  useEffect(() => {
    if (bulan !== "Semua" && !bulanList.includes(bulan)) setBulan("Semua");
  }, [bulanList, bulan]);

  const docsBulan = useMemo(
    () => docsTahun.filter((d) => bulan === "Semua" || (d.tanggal || "").slice(5, 7) === bulan),
    [docsTahun, bulan],
  );

  // Tombol jenis (otomatis dari surat) dan folder buatan sendiri, beserta jumlahnya.
  const autoList = useMemo(() => {
    const hitung = {};
    docsBulan
      .filter((d) => !d.manual)
      .forEach((d) => {
        hitung[d.sumber] = (hitung[d.sumber] || 0) + 1;
      });
    return Object.entries(hitung).sort((a, b) => a[0].localeCompare(b[0]));
  }, [docsBulan]);

  const jumlahFolder = useMemo(() => {
    const hitung = {};
    docsBulan
      .filter((d) => d.manual)
      .forEach((d) => {
        hitung[d.folderId] = (hitung[d.folderId] || 0) + 1;
      });
    return hitung;
  }, [docsBulan]);

  const pills = useMemo(
    () => [
      { key: "Semua", label: "Semua", count: docsBulan.length },
      ...autoList.map(([nama, jumlah]) => ({ key: `auto:${nama}`, label: nama, count: jumlah })),
      ...folders.map((f) => ({ key: `folder:${f.id}`, label: f.nama, count: jumlahFolder[f.id] || 0, folder: true })),
    ],
    [docsBulan, autoList, folders, jumlahFolder],
  );

  // Kalau jenis yang dipilih sudah tidak ada (mis. tahun/bulan diganti), kembali ke "Semua".
  useEffect(() => {
    if (jenis !== "Semua" && !pills.some((p) => p.key === jenis)) setJenis("Semua");
  }, [pills, jenis]);

  const folderAktif = jenis.startsWith("folder:") ? folders.find((f) => f.id === jenis.slice(7)) : null;

  const tampilDocs = useMemo(() => {
    const kata = q.trim().toLowerCase();
    return docsBulan
      .filter((d) => {
        if (jenis.startsWith("auto:") && (d.manual || d.sumber !== jenis.slice(5))) return false;
        if (jenis.startsWith("folder:") && d.folderId !== jenis.slice(7)) return false;
        if (!kata) return true;
        return `${d.title || ""} ${d.perihal || ""} ${d.fileName || ""}`.toLowerCase().includes(kata);
      })
      .sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));
  }, [docsBulan, jenis, q]);

  // ---- Aksi folder ----
  const simpanFolder = async (nama) => {
    if (folderDialog?.mode === "ganti" && folderAktif) {
      await arsipDokumenApi.renameFolder(folderAktif.id, nama);
      toast.success("Nama folder berhasil diganti");
    } else {
      const baru = await arsipDokumenApi.createFolder(kode, nama);
      toast.success("Folder berhasil dibuat");
      setJenis(`folder:${baru.id}`);
    }
    setFolderDialog(null);
    await muatUlang();
  };

  const hapusFolder = async () => {
    if (!folderAktif) return;
    if (!window.confirm(`Hapus folder "${folderAktif.nama}"? Folder hanya bisa dihapus kalau sudah kosong.`)) return;
    try {
      await arsipDokumenApi.deleteFolder(folderAktif.id);
      toast.success("Folder berhasil dihapus");
      setJenis("Semua");
      await muatUlang();
    } catch (e) {
      toast.error(e.message || "Gagal menghapus folder");
    }
  };

  const hapusDokumen = async (doc) => {
    if (!window.confirm(`Hapus dokumen "${doc.title}"? Berkasnya juga ikut terhapus.`)) return;
    try {
      await arsipDokumenApi.deleteUpload(doc.id);
      toast.success("Dokumen berhasil dihapus");
      await muatUlang();
    } catch (e) {
      toast.error(e.message || "Gagal menghapus dokumen");
    }
  };

  const gagalMemuat = !loading && !subLoaded;
  const namaFolderDoc = (d) => folders.find((f) => f.id === d.folderId)?.nama || d.sumber;

  return (
    <AppLayout activePage="arsip-subbagian">
      <div data-testid="arsip-subbagian-container" className="space-y-6">
        <Link
          to="/dokumen-internal"
          data-testid="arsip-kembali"
          className="inline-flex items-center text-xs font-semibold text-red-900 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Arsip & Dokumen
        </Link>

        {loading && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Memuat arsip...
          </div>
        )}

        {gagalMemuat && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-500 text-sm">
            Data arsip tidak dapat dimuat. Muat ulang halaman, atau coba lagi beberapa saat.
          </div>
        )}

        {!loading && subLoaded && !sub && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-500 text-sm">
            Sub bagian dengan kode <span className="font-semibold text-slate-700">{kode}</span> tidak ditemukan.
            Pilih sub bagian dari halaman Arsip & Dokumen.
          </div>
        )}

        {sub && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-900 border border-red-200 mb-1">
                {sub.code}
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{sub.name}</h1>
              {sub.deskripsi && <p className="text-sm text-slate-500 mt-1">{sub.deskripsi}</p>}
              {sub.tampil && !loading && (
                <p className="text-xs text-slate-400 mt-2">{docs.length} dokumen tersimpan</p>
              )}
            </div>

            {!sub.tampil ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-400 text-sm italic">
                <Lock className="w-4 h-4 inline mr-2" />
                Arsip sub bagian ini sedang disembunyikan oleh admin.
              </div>
            ) : (
              !loading && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <h3 className="text-base font-bold text-slate-900">Daftar Dokumen</h3>
                    {bolehUbah && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          data-testid="arsip-folder-baru"
                          onClick={() => setFolderDialog({ mode: "buat" })}
                          className="inline-flex items-center px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                        >
                          <FolderPlus className="w-3.5 h-3.5 mr-1.5" /> Folder Baru
                        </button>
                        <button
                          type="button"
                          data-testid="arsip-unggah-btn"
                          onClick={() => setUnggah({})}
                          className="inline-flex items-center px-3 py-2 text-xs font-semibold text-white bg-red-900 rounded-md hover:bg-red-800"
                        >
                          <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> Unggah Dokumen
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col lg:flex-row gap-2 mb-4">
                    <select
                      data-testid="arsip-filter-tahun"
                      value={tahun}
                      onChange={(e) => {
                        setTahun(e.target.value);
                        setBulan("Semua");
                      }}
                      className={selectCls}
                    >
                      <option value="Semua">Semua Tahun</option>
                      {tahunList.map((y) => (
                        <option key={y} value={y}>
                          Tahun {y}
                        </option>
                      ))}
                    </select>
                    <select
                      data-testid="arsip-filter-bulan"
                      value={bulan}
                      onChange={(e) => setBulan(e.target.value)}
                      className={selectCls}
                    >
                      <option value="Semua">Semua Bulan</option>
                      {bulanList.map((m) => (
                        <option key={m} value={m}>
                          {NAMA_BULAN[Number(m) - 1]}
                        </option>
                      ))}
                    </select>
                    <div className="relative lg:flex-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="w-4 h-4 text-slate-400" />
                      </span>
                      <input
                        data-testid="arsip-cari"
                        type="text"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Cari judul atau perihal..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-900"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {pills.map((p) => (
                      <button
                        key={p.key}
                        data-testid={`filter-jenis-${p.key.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`}
                        onClick={() => setJenis(p.key)}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          jenis === p.key
                            ? "bg-red-900 text-white border-red-900"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {p.folder && <Folder className="w-3.5 h-3.5 mr-1" />}
                        {p.label} <span className="opacity-70 ml-1">({p.count})</span>
                      </button>
                    ))}
                  </div>

                  {folderAktif && (bolehUbah || bolehHapus) && (
                    <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
                      <Folder className="w-3.5 h-3.5" />
                      <span>
                        Folder <span className="font-semibold text-slate-700">{folderAktif.nama}</span>
                      </span>
                      {bolehUbah && (
                        <button
                          type="button"
                          data-testid="arsip-folder-ganti-nama"
                          onClick={() => setFolderDialog({ mode: "ganti" })}
                          className="inline-flex items-center px-2 py-1 rounded border border-slate-200 text-slate-600 hover:text-red-900 hover:bg-slate-50"
                        >
                          <Pencil className="w-3 h-3 mr-1" /> Ganti nama
                        </button>
                      )}
                      {bolehHapus && (
                        <button
                          type="button"
                          data-testid="arsip-folder-hapus"
                          onClick={hapusFolder}
                          className="inline-flex items-center px-2 py-1 rounded border border-slate-200 text-slate-600 hover:text-red-900 hover:bg-slate-50"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Hapus folder
                        </button>
                      )}
                    </div>
                  )}

                  <div className="divide-y divide-slate-100">
                    {docs.length === 0 && (
                      <div className="py-10 text-center text-slate-400 text-sm italic">
                        Belum ada arsip pada sub bagian ini.
                      </div>
                    )}
                    {docs.length > 0 && tampilDocs.length === 0 && (
                      <div className="py-10 text-center text-slate-400 text-sm italic">
                        Tidak ada dokumen yang cocok dengan pencarian atau filter.
                      </div>
                    )}
                    {tampilDocs.map((doc) => {
                      const url = arsipDokumenApi.fileUrl(doc.file);
                      return (
                        <div
                          key={`${doc.sumber}-${doc.id}`}
                          className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 px-3 rounded-lg transition-colors"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-900 flex items-center justify-center font-bold shrink-0">
                              {doc.manual ? <Folder className="w-5 h-5" /> : <FolderArchive className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{doc.title}</h4>
                              {doc.manual && doc.perihal && (
                                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{doc.perihal}</p>
                              )}
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {doc.manual ? namaFolderDoc(doc) : doc.sumber} • {formatTgl(doc.tanggal)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            {url && (
                              <>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  data-testid={`arsip-lihat-${doc.id}`}
                                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-red-900 hover:bg-slate-50 text-xs font-medium inline-flex items-center"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" /> Lihat
                                </a>
                                <a
                                  href={arsipDokumenApi.unduhUrl(doc.file, doc.title)}
                                  data-testid={`arsip-unduh-${doc.id}`}
                                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-red-900 hover:bg-slate-50 text-xs font-medium inline-flex items-center"
                                >
                                  <Download className="w-3.5 h-3.5 mr-1" /> Unduh
                                </a>
                              </>
                            )}
                            {doc.manual && bolehUbah && (
                              <button
                                type="button"
                                data-testid={`arsip-edit-${doc.id}`}
                                onClick={() => setUnggah({ item: doc })}
                                title="Edit dokumen"
                                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-red-900 hover:bg-slate-50"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {doc.manual && bolehHapus && (
                              <button
                                type="button"
                                data-testid={`arsip-hapus-${doc.id}`}
                                onClick={() => hapusDokumen(doc)}
                                title="Hapus dokumen"
                                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-red-900 hover:bg-slate-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>

      <ArsipUnggahDialog
        open={!!unggah}
        onClose={() => setUnggah(null)}
        kategori={kode}
        folders={folders}
        defaultFolderId={folderAktif?.id}
        item={unggah?.item || null}
        onSaved={muatUlang}
      />
      <ArsipFolderDialog
        open={!!folderDialog}
        mode={folderDialog?.mode}
        namaAwal={folderDialog?.mode === "ganti" ? folderAktif?.nama : ""}
        onClose={() => setFolderDialog(null)}
        onSubmit={simpanFolder}
      />
    </AppLayout>
  );
}